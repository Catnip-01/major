from fastapi import APIRouter, HTTPException, Query
from app.db.mongo_repo import save_chat_message, get_chat_history
from celery_app import celery_app
from pydantic import BaseModel
import json

router = APIRouter()

class ChatRequest(BaseModel):
    deviceId: str
    message: str

class QueryRequest(BaseModel):
    deviceId: str
    question: str

@router.post("/chat")
async def chat(req: ChatRequest):
    if not req.deviceId or not req.message:
        raise HTTPException(400, "deviceId and message required")
    save_chat_message(req.deviceId, "user", req.message)
    task = celery_app.send_task("process_chat", args=[req.deviceId, req.message])
    return {"status": "processing", "jobId": task.id}

@router.post("/query")
async def query(req: QueryRequest):
    if not req.deviceId or not req.question:
        raise HTTPException(400, "deviceId and question required")
    # Note: For queries, we don't necessarily save the "question" to chat history 
    # until the task completes (to avoid showing raw SQL questions if they fail)
    task = celery_app.send_task("nl_query", args=[req.deviceId, req.question])
    return {"status": "processing", "jobId": task.id}

@router.get("/history")
async def get_history(deviceId: str = Query(...)):
    raw_history = get_chat_history(deviceId)
    # Map to format expected by mobile app (from/text)
    formatted = []
    for msg in raw_history:
        formatted_msg = {
            "from": "user" if msg["role"] == "user" else "finize",
            "text": msg["content"]
        }
        # Include SQL if it's a query result
        if msg.get("type") == "sql_result" and msg.get("metadata"):
            try:
                meta = json.loads(msg["metadata"])
                formatted_msg["sql"] = meta.get("sql")
            except:
                pass
        formatted.append(formatted_msg)
    return {"history": formatted}
