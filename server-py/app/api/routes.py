from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from celery.result import AsyncResult
from celery_app import celery_app, REDIS_URL
from app.db.repository import (
    get_recent_transactions, query_db, save_chat_message, get_chat_history, 
    get_latest_report, delete_device_data
)
import json
import redis.asyncio as redis

router = APIRouter()
redis_client = redis.from_url(REDIS_URL)

class SyncSmsRequest(BaseModel):
    deviceId: str
    transactions: list[dict]

class ChatRequest(BaseModel):
    deviceId: str
    message: str

class QueryRequest(BaseModel):
    deviceId: str
    message: str

def _get_task_result(task_id: str) -> dict:
    result = AsyncResult(task_id, app=celery_app)
    state = result.state
    if state == "SUCCESS": return {"status": "completed", "result": result.result}
    elif state == "FAILURE": return {"status": "failed", "error": str(result.result)}
    elif state == "PENDING": return {"status": "waiting"}
    else: return {"status": "active"}

@router.get("/health")
def health():
    return {"status": "OK", "message": "Palfin Python backend running", "version": "2.0.0"}

@router.get("/api/events/{deviceId}")
async def event_stream(deviceId: str):
    async def event_generator():
        pubsub = redis_client.pubsub()
        channel = f"events:{deviceId}"
        await pubsub.subscribe(channel)
        try:
            yield f"data: {json.dumps({'event': 'connected', 'message': 'Connected to Palfin Pulse'})}\n\n"
            async for message in pubsub.listen():
                if message['type'] == 'message':
                    data = message['data'].decode('utf-8')
                    yield f"data: {data}\n\n"
        finally:
            await pubsub.unsubscribe(channel)
            await pubsub.close()
    return StreamingResponse(event_generator(), media_type="text/event-stream")

@router.post("/api/sync-sms")
async def sync_sms(req: SyncSmsRequest):
    if not req.deviceId or not req.transactions:
        raise HTTPException(400, "deviceId and transactions[] required")
    task = celery_app.send_task("classify_batch", args=[req.deviceId, req.transactions])
    return {"status": "queued", "synced": len(req.transactions), "taskId": task.id}

@router.post("/api/chat")
async def chat(req: ChatRequest):
    if not req.deviceId or not req.message:
        raise HTTPException(400, "deviceId and message required")
    save_chat_message(req.deviceId, "user", req.message)
    task = celery_app.send_task("process_chat", args=[req.deviceId, req.message])
    return {"status": "processing", "jobId": task.id}

@router.get("/api/chat/status/{job_id}")
async def chat_status(job_id: str):
    return _get_task_result(job_id)

@router.post("/api/query")
async def nl_query(req: QueryRequest):
    if not req.deviceId or not req.message:
        raise HTTPException(400, "deviceId and message required")
    save_chat_message(req.deviceId, "user", req.message)
    task = celery_app.send_task("nl_query", args=[req.deviceId, req.message])
    return {"status": "processing", "jobId": task.id}

@router.get("/api/query/status/{job_id}")
async def query_status(job_id: str):
    return _get_task_result(job_id)

@router.get("/api/history")
async def get_history(deviceId: str = Query(...)):
    return {"history": get_chat_history(deviceId)}

@router.get("/api/reports/latest")
async def get_report(deviceId: str = Query(...)):
    report = get_latest_report(deviceId)
    if not report: return {"status": "none", "message": "No reports generated yet."}
    
    try:
        data = json.loads(report["data"])
    except json.JSONDecodeError:
        data = {"error": "Report data is malformed.", "raw": report["data"]}
        
    return {"status": "success", "report": {**report, "data": data}}

@router.post("/api/reports/generate")
async def generate_report(req: dict):
    device_id = req.get("deviceId")
    if not device_id: raise HTTPException(400, "deviceId required")
    task = celery_app.send_task("generate_daily_report", args=[device_id])
    return {"status": "processing", "jobId": task.id}

@router.get("/api/transactions")
async def get_transactions(deviceId: str = Query(...), limit: int = Query(50), category: str = None, type: str = None):
    conditions = ["device_id = ?"]
    params = [deviceId]
    if category: conditions.append("LOWER(category) = LOWER(?)"); params.append(category)
    if type: conditions.append("type = ?"); params.append(type)
    sql = f"SELECT * FROM transactions WHERE {' AND '.join(conditions)} ORDER BY created_at DESC LIMIT ?"
    params.append(limit)
    return {"transactions": query_db(sql, tuple(params))}

@router.delete("/api/device/{deviceId}")
async def wipe_device(deviceId: str):
    delete_device_data(deviceId)
    return {"status": "success", "message": "Data wiped."}
