from fastapi import APIRouter
from app.api import chat, reports, transactions
from celery_app import celery_app, REDIS_URL
from fastapi.responses import StreamingResponse
import redis.asyncio as redis
import json

router = APIRouter()
redis_client = redis.from_url(REDIS_URL)

def _get_task_result(task_id: str) -> dict:
    from celery.result import AsyncResult
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

@router.get("/api/query/status/{job_id}")
async def query_status(job_id: str):
    return _get_task_result(job_id)

@router.get("/api/chat/status/{job_id}")
async def chat_status(job_id: str):
    return _get_task_result(job_id)

router.include_router(chat.router, prefix="/api")
router.include_router(reports.router, prefix="/api")
router.include_router(transactions.router, prefix="/api")
