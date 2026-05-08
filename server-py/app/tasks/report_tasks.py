import json
from celery_app import celery_app
from app.db.repository import query_db, save_report
from app.services.ai_service import ai_service
import redis
from celery_app import REDIS_URL

def _get_redis():
    return redis.from_url(REDIS_URL)

def emit_event(device_id: str, event_type: str, message: str):
    r = _get_redis()
    r.publish(f"events:{device_id}", json.dumps({"event": event_type, "message": message}))

@celery_app.task(name="generate_daily_report")
def generate_daily_report(device_id: str = "all_active_devices"):
    try:
        devices = [r['device_id'] for r in query_db("SELECT DISTINCT device_id FROM transactions")] if device_id == "all_active_devices" else [device_id]
        for d_id in devices:
            emit_event(d_id, "report_status", "Building your daily financial report...")
            cat_sums = query_db("SELECT category, SUM(amount) as total FROM transactions WHERE device_id = ? GROUP BY category", (d_id,))
            bank_sums = query_db("SELECT bank, SUM(amount) as total FROM transactions WHERE device_id = ? GROUP BY bank", (d_id,))
            prompt = f"Generate a financial JSON report.\nAggregates: Categories: {cat_sums}, Banks: {bank_sums}.\nReturn JSON only..."
            report_json = ai_service.generate_report(prompt)
            save_report(d_id, "daily", report_json)
            emit_event(d_id, "report_complete", "Report ready!")
        return {"status": "success", "processed": len(devices)}
    except Exception as e:
        return {"status": "failed", "error": str(e)}
