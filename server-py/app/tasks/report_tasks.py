import json
from celery_app import celery_app, REDIS_URL
from app.db.repository import query_db, save_report, get_all_device_ids
from app.core.config_loader import config_loader
from app.services.ai_service import ai_service
import redis

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
            emit_event(d_id, "report_status", "Building your daily financial report...")
            cat_sums = query_db(config_loader.get_query("summary_report_categories"), (d_id,))
            bank_sums = query_db(config_loader.get_query("summary_report_banks"), (d_id,))
            
            prompt = config_loader.get_prompt("report_generator", "prompt_template").format(
                cat_sums=cat_sums, bank_sums=bank_sums
            )
            
            report_json = ai_service.generate_report(prompt)
            save_report(d_id, "daily", report_json)
            emit_event(d_id, "report_complete", "Report ready!")
        return {"status": "success", "processed": len(devices)}
    except Exception as e:
        return {"status": "failed", "error": str(e)}
