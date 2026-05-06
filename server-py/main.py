"""
main.py — FastAPI application.

Routes (1:1 parity with existing Node.js server so React Native client
needs zero changes):

  GET  /health
  POST /api/sync-sms
  POST /api/chat
  GET  /api/chat/status/{job_id}
  POST /api/query
  GET  /api/query/status/{job_id}
  GET  /api/transactions
"""
import os
import logging
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, HTTPException, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from celery.result import AsyncResult
import asyncio
from dotenv import load_dotenv

import redis.asyncio as redis
from celery_app import celery_app, REDIS_URL
from database import (
    init_db, get_recent_transactions, query_db,
    save_chat_message, get_chat_history, get_latest_report
)

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# App lifespan — init DB on startup
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    logger.info("🚀 Palfin Python server started")
    yield
    logger.info("👋 Palfin Python server shutting down")


app = FastAPI(
    title="Palfin API",
    description="Financial coaching backend with ML transaction classification",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Shared Redis connection for SSE
redis_client = redis.from_url(REDIS_URL)




# ---------------------------------------------------------------------------
# Request / Response Models
# ---------------------------------------------------------------------------

class SyncSmsRequest(BaseModel):
    deviceId: str
    transactions: list[dict]


class ChatRequest(BaseModel):
    deviceId: str
    message: str


class QueryRequest(BaseModel):
    deviceId: str
    question: str


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    return {"status": "OK", "message": "Palfin Python backend running", "version": "2.0.0"}


@app.post("/api/sync-sms")
async def sync_sms(req: SyncSmsRequest):
    """
    Receive extracted transactions from the client.
    Immediately enqueues them for ML classification (fire-and-forget).
    The client doesn't wait — categories appear in SQLite after ~1-3s.
    """
    if not req.deviceId or not req.transactions:
        raise HTTPException(400, "deviceId and transactions[] required")

    # Enqueue classification task
    task = celery_app.send_task(
        "classify_batch",
        args=[req.deviceId, req.transactions],
    )

    logger.info(
        f"Enqueued classify_batch task {task.id} for {len(req.transactions)} txns"
    )
    return {
        "status": "queued",
        "synced": len(req.transactions),
        "taskId": task.id,
    }


@app.post("/api/chat")
async def chat(req: ChatRequest):
    """Enqueue a chat message for Gemini processing. Returns jobId for polling."""
    if not req.deviceId or not req.message:
        raise HTTPException(400, "deviceId and message required")

    # Save user message to history
    save_chat_message(req.deviceId, "user", req.message)

    task = celery_app.send_task(
        "process_chat",
        args=[req.deviceId, req.message],
    )
    return {"status": "processing", "jobId": task.id}


@app.get("/api/chat/status/{job_id}")
async def chat_status(job_id: str):
    """Poll for chat job result (same polling pattern as Node.js)."""
    return _get_task_result(job_id)


@app.post("/api/query")
async def nl_query(req: QueryRequest):
    """
    Enqueue a natural language query.
    Gemini converts it to SQL, runs it, and generates a human answer.
    """
    if not req.deviceId or not req.question:
        raise HTTPException(400, "deviceId and question required")

    # Save user question to history
    save_chat_message(req.deviceId, "user", req.question)

    task = celery_app.send_task(
        "nl_query",
        args=[req.deviceId, req.question],
    )
    return {"status": "processing", "jobId": task.id}


@app.get("/api/query/status/{job_id}")
async def query_status(job_id: str):
    """Poll for NL query result."""
    return _get_task_result(job_id)


@app.get("/api/history")
async def get_history(deviceId: str = Query(...)):
    """Fetch persistent chat history."""
    history = get_chat_history(deviceId)
    return {"history": history}


@app.get("/api/reports/latest")
async def get_report(deviceId: str = Query(...)):
    """Fetch the latest pre-computed report."""
    report = get_latest_report(deviceId)
    if not report:
        return {"status": "none", "message": "No reports generated yet."}
    return {"status": "success", "report": report}


@app.get("/api/events/{deviceId}")
async def event_stream(deviceId: str):
    """SSE endpoint for real-time background updates."""
    from fastapi.responses import StreamingResponse
    import json

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


@app.get("/api/transactions")
async def get_transactions(
    deviceId: str = Query(..., description="Device ID"),
    limit: int = Query(50, le=200),
    category: str | None = Query(None),
    type: str | None = Query(None, pattern="^(credit|debit)$"),
):
    """
    Fetch classified transactions for a device directly from SQLite.
    Supports optional filtering by category and type.
    """
    conditions = ["device_id = ?"]
    params: list[Any] = [deviceId]

    if category:
        conditions.append("LOWER(category) = LOWER(?)")
        params.append(category)
    if type:
        conditions.append("type = ?")
        params.append(type)

    where = " AND ".join(conditions)
    sql = f"SELECT * FROM transactions WHERE {where} ORDER BY created_at DESC LIMIT ?"
    params.append(limit)

    rows = query_db(sql, tuple(params))
    return {"transactions": rows, "count": len(rows)}


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _get_task_result(task_id: str) -> dict:
    """Unified Celery task state → JSON response (mirrors BullMQ polling)."""
    result = AsyncResult(task_id, app=celery_app)
    state = result.state  # PENDING, STARTED, SUCCESS, FAILURE, RETRY

    if state == "SUCCESS":
        return {"status": "completed", "result": result.result}
    elif state == "FAILURE":
        return {"status": "failed", "error": str(result.result)}
    elif state == "PENDING":
        return {"status": "waiting"}
    else:
        return {"status": "active"}


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 3000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
