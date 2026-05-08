import json
import re
from celery_app import celery_app, REDIS_URL
from app.db.repository import query_db, save_report, get_all_device_ids
from app.core.config_loader import config_loader
from app.services.ai_service import ai_service
import redis
import logging 

logger = logging.getLogger(__name__)

def _get_redis():
    return redis.from_url(REDIS_URL)

def emit_event(device_id: str, event_type: str, message: str):
    r = _get_redis()
    r.publish(f"events:{device_id}", json.dumps({"event": event_type, "message": message}))

def parse_behavioral_markdown(text: str) -> dict:
    """Parses the strict [TAG] based markdown from AI into a clean JSON dict."""
    result = {
        "total_spent": 0,
        "savings_rate": 0,
        "needs_wants_split": {"needs": 50, "wants": 50},
        "burn_projection": 0,
        "behavioral_summary": "",
        "smart_tips": [],
        "top_loyalty": "Unknown",
        "leaky_bucket_score": 5
    }
    
    try:
        # 1. Extract Metrics
        metrics_block = re.search(r"\[METRICS\](.*?)(\[|$)", text, re.DOTALL)
        if metrics_block:
            lines = metrics_block.group(1).strip().split('\n')
            for line in lines:
                if ':' in line:
                    key, val = [part.strip() for part in line.split(':', 1)]
                    val_clean = re.sub(r"[^\d\.]", "", val.replace(",", ""))
                    try:
                        if "TOTAL_SPENT" in key: result["total_spent"] = float(val_clean)
                        elif "SAVINGS_RATE" in key: result["savings_rate"] = float(val_clean)
                        elif "NEEDS_PCT" in key: result["needs_wants_split"]["needs"] = float(val_clean)
                        elif "WANTS_PCT" in key: result["needs_wants_split"]["wants"] = float(val_clean)
                        elif "BURN_PROJECTION" in key: result["burn_projection"] = float(val_clean)
                        elif "LOYALTY_MERCHANT" in key: result["top_loyalty"] = val
                        elif "LEAK_SCORE" in key: result["leaky_bucket_score"] = int(float(val_clean))
                    except: pass

        # 2. Extract Summary
        summary_block = re.search(r"\[SUMMARY\](.*?)(\[|$)", text, re.DOTALL)
        if summary_block:
            result["behavioral_summary"] = summary_block.group(1).strip()

        # 3. Extract Tips
        tips_block = re.search(r"\[TIPS\](.*?)$", text, re.DOTALL)
        if tips_block:
            lines = tips_block.group(1).strip().split('\n')
            for line in lines:
                line = line.strip()
                if (line.startswith('-') or line.startswith('*')) and '|' in line:
                    parts = [p.strip() for p in line[1:].split('|')]
                    if len(parts) >= 2:
                        result["smart_tips"].append({
                            "title": parts[0],
                            "description": parts[1],
                            "impact": parts[2] if len(parts) > 2 else "Medium"
                        })
    except Exception as e:
        logger.error(f"Markdown parsing failed: {e}")
        
    return result

@celery_app.task(name="generate_daily_report")
def generate_daily_report(device_id: str = "all_active_devices"):
    try:
        devices = get_all_device_ids() if device_id == "all_active_devices" else [device_id]
        for d_id in devices:
            emit_event(d_id, "report_status", "Analyzing your spending behavior...")
            
            # 1. Gather Data Slices
            cat_sums = query_db(config_loader.get_query("summary_report_categories"), (d_id,))
            bank_sums = query_db(config_loader.get_query("summary_report_banks"), (d_id,))
            dow_sums = query_db(config_loader.get_query("spending_by_day_of_week"), (d_id,))
            merchants = query_db(config_loader.get_query("merchant_frequency"), (d_id,))
            savings_data = query_db(config_loader.get_query("savings_rate_data"), (d_id,))
            atv_data = query_db(config_loader.get_query("average_transaction_value"), (d_id,))
            subs = query_db(config_loader.get_query("subscription_candidates"), (d_id,))

            # 2. Calculate Derived Metrics
            credits = next((item['total'] for item in savings_data if item['type'] == 'credit'), 0)
            debits = next((item['total'] for item in savings_data if item['type'] == 'debit'), 0)
            savings_rate = ((credits - debits) / credits * 100) if credits > 0 else 0
            
            avg_tx = atv_data[0]['avg_value'] if atv_data and atv_data[0]['avg_value'] else 0
            
            # 3. Construct the Behavioral Snapshot for AI
            snapshot = {
                "total_credits": credits,
                "total_debits": debits,
                "savings_rate_pct": round(savings_rate, 2),
                "avg_transaction_value": round(avg_tx, 2),
                "top_categories": cat_sums,
                "day_of_week_distribution": dow_sums,
                "top_merchants": merchants,
                "potential_subscriptions": subs[:5]
            }

            # 4. Call AI for Deep Insights (using new Tag-based Markdown)
            prompt = config_loader.get_prompt("behavioral_analyst", "prompt_template").format(
                snapshot=json.dumps(snapshot, indent=2)
            )
            
            raw_markdown = ai_service.generate_tag_report(prompt)
            
            # 5. Parse Markdown to JSON and enrich with raw data for UI charts
            report_data = parse_behavioral_markdown(raw_markdown)
            report_data["raw_data"] = {
                "dow": dow_sums,
                "merchants": merchants,
                "savings": {"credits": credits, "debits": debits},
                "categories": cat_sums
            }
            
            save_report(d_id, "daily", json.dumps(report_data))
            emit_event(d_id, "report_complete", "Behavioral analysis complete!")
            
        return {"status": "success", "processed": len(devices)}
    except Exception as e:
        import traceback
        logger.error(f"Report generation failed: {e}\n{traceback.format_exc()}")
        return {"status": "failed", "error": str(e)}
