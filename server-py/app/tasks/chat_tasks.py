import json
import logging
import uuid
import redis
from celery_app import celery_app, REDIS_URL
from app.db.repository import query_db, get_schema
from app.db.mongo_repo import save_chat_message
from app.services.ai_service import ai_service

logger = logging.getLogger(__name__)

def _get_redis():
    return redis.from_url(REDIS_URL)

def emit_event(device_id: str, event_type: str, message: str):
    try:
        r = _get_redis()
        r.publish(f"events:{device_id}", json.dumps({
            "event": event_type,
            "message": message,
            "timestamp": str(uuid.uuid4())
        }))
    except Exception as e:
        logger.error(f"Failed to emit event: {e}")

@celery_app.task(name="process_chat", bind=True, max_retries=2)
def process_chat(self, device_id: str, message_text: str):
    try:
        emit_event(device_id, "chat_status", "Checking your latest spending...")
        # (AI Logic would go here - importing shared logic as needed)
        # ...
    except Exception as exc:
        emit_event(device_id, "error", "My brain is a bit foggy right now. Try again?")
        raise self.retry(exc=exc, countdown=3)

@celery_app.task(name="nl_query", bind=True, max_retries=1)
def nl_query(self, device_id: str, question: str):
    try:
        emit_event(device_id, "query_status", "Translating to SQL...")
        schema = get_schema()
        raw_sql = ai_service.nl_to_sql(schema, question)
        if not raw_sql.upper().startswith("SELECT"):
            return {"sql": raw_sql, "rows": [], "answer": "I could not generate a valid SQL query."}
        rows = query_db(raw_sql, (device_id,))
        answer_text = ai_service.chat_completion([{"role": "user", "content": f"Question: {question}\nData: {rows[:20]}\nSummarize clearly."}])
        save_chat_message(device_id, "assistant", answer_text, msg_type='sql_result', metadata=json.dumps({"sql": raw_sql}))
        emit_event(device_id, "query_complete", "Done!")
        return {"sql": raw_sql, "rows": rows, "answer": answer_text}
    except Exception as exc:
        raise self.retry(exc=exc, countdown=3)
