from fastapi import APIRouter, HTTPException, Query
from app.db.repository import get_latest_report, delete_device_data
from celery_app import celery_app
import json

router = APIRouter()

@router.get("/reports/latest")
async def get_report(deviceId: str = Query(...)):
    report = get_latest_report(deviceId)
    if not report: return {"status": "none", "message": "No reports generated yet."}
    try:
        data = json.loads(report["data"])
    except json.JSONDecodeError:
        data = {"error": "Report data is malformed.", "raw": report["data"]}
    return {"status": "success", "report": {**report, "data": data}}

@router.post("/reports/generate")
async def generate_report(req: dict):
    device_id = req.get("deviceId")
    if not device_id: raise HTTPException(400, "deviceId required")
    task = celery_app.send_task("generate_daily_report", args=[device_id])
    return {"status": "processing", "jobId": task.id}
