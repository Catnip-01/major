from fastapi import APIRouter, HTTPException, Query
from app.db.repository import get_latest_report, delete_device_data, query_db
from app.core.config_loader import config_loader
from celery_app import celery_app
import json

router = APIRouter()

@router.get("/analytics")
async def get_analytics(deviceId: str = Query(...)):
    # Helper to execute query with deviceId
    def get_data(query_name):
        sql = config_loader.get_query(query_name)
        return query_db(sql, (deviceId,))

    return {
        "status": "success",
        "data": {
            "daily_trend": get_data("daily_spending_stats"),
            "bank_share": get_data("bank_usage"),
            "time_slots": get_data("time_of_day_breakdown"),
            "heavy_hitters": get_data("heavy_hitters"),
            "consistency": get_data("micro_transactions")
        }
    }

@router.get("/reports/latest")
async def get_report(deviceId: str = Query(...)):
    report = get_latest_report(deviceId)
    if not report: return {"status": "none", "message": "No reports generated yet."}
    try:
        data = json.loads(report["data"])
    except json.JSONDecodeError:
        data = {"error": "Report data is malformed.", "raw": report["data"]}

    # Enrich with real-time SQL data
    def get_data(query_name):
        sql = config_loader.get_query(query_name)
        return query_db(sql, (deviceId,))

    analytics = {
        "daily_trend": get_data("daily_spending_stats"),
        "bank_share": get_data("bank_usage"),
        "time_slots": get_data("time_of_day_breakdown"),
        "heavy_hitters": get_data("heavy_hitters"),
        "consistency": get_data("micro_transactions")
    }

    return {"status": "success", "report": {**report, "data": data, "analytics": analytics}}

@router.post("/reports/generate")
async def generate_report(req: dict):
    device_id = req.get("deviceId")
    if not device_id: raise HTTPException(400, "deviceId required")
    task = celery_app.send_task("generate_daily_report", args=[device_id])
    return {"status": "processing", "jobId": task.id}
