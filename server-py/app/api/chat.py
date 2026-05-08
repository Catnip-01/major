from fastapi import APIRouter, HTTPException, Query
from app.db.mongo_repo import save_chat_message, get_chat_history, get_device_sessions
from celery_app import celery_app
from pydantic import BaseModel
import json

router = APIRouter()

class ChatRequest(BaseModel):
    deviceId: str
    message: str
    sessionId: str = "default"

class QueryRequest(BaseModel):
    deviceId: str
    message: str # Client sends 'message' even for queries
    sessionId: str = "default"

@router.post("/chat")
async def chat(req: ChatRequest):
    if not req.deviceId or not req.message:
        raise HTTPException(400, "deviceId and message required")
    save_chat_message(req.deviceId, "user", req.message, session_id=req.sessionId)
    task = celery_app.send_task("process_chat", args=[req.deviceId, req.message, req.sessionId])
    return {"status": "processing", "jobId": task.id}

@router.post("/query")
async def query(req: QueryRequest):
    if not req.deviceId or not req.message:
        raise HTTPException(400, "deviceId and message required")
    # For queries, we still save to chat history as 'user'
    save_chat_message(req.deviceId, "user", req.message, session_id=req.sessionId)
    task = celery_app.send_task("nl_query", args=[req.deviceId, req.message, req.sessionId])
    return {"status": "processing", "jobId": task.id}

@router.get("/history")
async def get_history(deviceId: str = Query(...), sessionId: str = Query("default")):
    # The client expects a list of objects with 'role' and 'content'
    # mongo_repo.get_chat_history already returns this format
    history = get_chat_history(deviceId, session_id=sessionId)
    return {"history": history}

@router.get("/sessions")
async def get_sessions(deviceId: str = Query(...)):
    sessions = get_device_sessions(deviceId)
    return {"sessions": sessions}
