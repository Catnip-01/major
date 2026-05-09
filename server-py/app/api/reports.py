from fastapi import APIRouter, HTTPException, Query
from app.db.repository import get_latest_report, delete_device_data, query_db
from app.core.config_loader import config_loader
from celery_app import celery_app
import json

router = APIRouter()
@router.get("/analytics")
async def get_analytics(deviceId: str = Query(...)):
    def get_data(query_name):
        sql = config_loader.get_query(query_name)
        return query_db(sql, (deviceId,))

    # Get latest report for summary and consistency audit
    report = get_latest_report(deviceId)
    report_data = {}
    if report:
        try:
            report_data = json.loads(report["data"])
        except:
            pass

    # Format time_slots as an object for the BarChart
    raw_time_slots = get_data("time_of_day_breakdown")
    time_slots = {item['slot']: item['total'] for item in raw_time_slots}

    analytics = {
        "daily_trend": get_data("daily_spending_stats"),
        "bank_share": get_data("bank_usage"),
        "time_slots": time_slots,
        "heavy_hitters": get_data("heavy_hitters"),
        "consistency": [report_data.get("consistency", {})], # List for AnalyticsScreen
        "behavioral_summary": report_data.get("behavioral_summary", "Analyzing your patterns..."),
        "total_spent": report_data.get("total_spent", 0)
    }

    return {
        "status": "success",
        "data": {
            **analytics,
            "analytics": analytics
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

    # Ensure consistency is an object (not list) and invisible_drain has 'sum'
    if isinstance(data.get('consistency'), list):
        data['consistency'] = data['consistency'][0]
    if 'invisible_drain' in data:
        data['invisible_drain']['sum'] = data['invisible_drain'].get('total', 0)

    # Enrich with real-time SQL data
    def get_data(query_name):
        sql = config_loader.get_query(query_name)
        return query_db(sql, (deviceId,))

    # Format time_slots as an object
    raw_time_slots = get_data("time_of_day_breakdown")
    time_slots = {item['slot']: item['total'] for item in raw_time_slots}

    analytics = {
        "daily_trend": get_data("daily_spending_stats"),
        "bank_share": get_data("bank_usage"),
        "time_slots": time_slots,
        "heavy_hitters": get_data("heavy_hitters"),
        "consistency": data.get('invisible_drain', {"total": 0, "count": 0}) # Map micro-transactions for Dashboard
    }

    return {"status": "success", "report": {**report, "data": data, "analytics": analytics}}
@router.post("/reports/generate")
async def generate_report(req: dict):
    device_id = req.get("deviceId")
    if not device_id: raise HTTPException(400, "deviceId required")
    task = celery_app.send_task("generate_daily_report", args=[device_id])
    return {"status": "processing", "jobId": task.id}
