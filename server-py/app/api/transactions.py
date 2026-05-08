from fastapi import APIRouter, HTTPException, Query
from app.db.repository import query_db, delete_device_data
from celery_app import celery_app
from pydantic import BaseModel

router = APIRouter()

class SyncSmsRequest(BaseModel):
    deviceId: str
    transactions: list[dict]

@router.post("/sync-sms")
async def sync_sms(req: SyncSmsRequest):
    if not req.deviceId or not req.transactions:
        raise HTTPException(400, "deviceId and transactions[] required")
    task = celery_app.send_task("classify_batch", args=[req.deviceId, req.transactions])
    return {"status": "queued", "synced": len(req.transactions), "taskId": task.id}

@router.get("/transactions")
async def get_transactions(deviceId: str = Query(...), limit: int = Query(50), category: str = None, type: str = None):
    conditions = ["device_id = ?"]
    params = [deviceId]
    if category: conditions.append("LOWER(category) = LOWER(?)"); params.append(category)
    if type: conditions.append("type = ?"); params.append(type)
    sql = f"SELECT * FROM transactions WHERE {' AND '.join(conditions)} ORDER BY created_at DESC LIMIT ?"
    params.append(limit)
    return {"transactions": query_db(sql, tuple(params))}

@router.delete("/device/{deviceId}")
async def wipe_device(deviceId: str):
    delete_device_data(deviceId)
    return {"status": "success", "message": "Data wiped."}
