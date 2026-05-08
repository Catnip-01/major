import json
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

            # 4. Call AI for Deep Insights
            prompt = config_loader.get_prompt("behavioral_analyst", "prompt_template").format(
                snapshot=json.dumps(snapshot, indent=2)
            )
            
            report_json_str = ai_service.generate_report(prompt)
            
            # 5. Enrich the report with raw data for UI charts
            report_data = json.loads(report_json_str)
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
