from fastapi import APIRouter, HTTPException, Query
from app.db.mongo_repo import save_chat_message, get_chat_history
from celery_app import celery_app
from pydantic import BaseModel

router = APIRouter()

class ChatRequest(BaseModel):
    deviceId: str
    message: str

@router.post("/chat")
async def chat(req: ChatRequest):
    if not req.deviceId or not req.message:
        raise HTTPException(400, "deviceId and message required")
    save_chat_message(req.deviceId, "user", req.message)
    task = celery_app.send_task("process_chat", args=[req.deviceId, req.message])
    return {"status": "processing", "jobId": task.id}

@router.get("/history")
async def get_history(deviceId: str = Query(...)):
    return {"history": get_chat_history(deviceId)}
