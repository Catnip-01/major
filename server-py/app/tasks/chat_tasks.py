import json
import logging
import uuid
import redis
from celery_app import celery_app, REDIS_URL
from app.db.repository import query_db, get_schema, get_recent_transactions
from app.db.mongo_repo import save_chat_message, get_chat_history
from app.core.config_loader import config_loader
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
        emit_event(device_id, "chat_status", "Thinking...")
        
        # 1. Fetch Context
        history = get_chat_history(device_id, limit=10)
        recent_txs = get_recent_transactions(device_id, limit=15)
        
        # 2. Build Prompt
        system_prompt = config_loader.get_prompt("finance_coach", "system_prompt")
        messages = [
            {"role": "system", "content": system_prompt}
        ]
        
        if recent_txs:
            tx_context = "\n".join([f"- {tx['date']}: {tx['merchant']} - {tx['currency']} {tx['amount']} ({tx['category']})" for tx in recent_txs])
            messages.append({"role": "system", "content": f"Recent Transactions:\n{tx_context}"})
            
        for msg in history:
            messages.append({"role": msg['role'], "content": msg['content']})
        
        # Add the current message if it's not already in history (though it usually is saved by the API)
        # Check if last msg in history is the same to avoid duplication
        if not history or history[-1]['content'] != message_text:
             messages.append({"role": "user", "content": message_text})

        # 3. Call AI
        answer = ai_service.chat_completion(messages)
        
        # 4. Save & Emit
        save_chat_message(device_id, "assistant", answer)
        emit_event(device_id, "chat_complete", answer)
        
        # Mobile app expects 'text' for chat results
        return {"text": answer}
        
    except Exception as exc:
        logger.error(f"Chat processing failed: {exc}")
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
        
        # Mobile app expects 'answer' and 'sql' for query results
        return {"sql": raw_sql, "rows": rows, "answer": answer_text}
    except Exception as exc:
        raise self.retry(exc=exc, countdown=3)
