import json
import logging
import uuid
from celery_app import celery_app
from app.db.repository import (
    upsert_transactions, get_recent_transactions, query_db, get_schema,
    save_chat_message, save_report, get_conn
)
from app.services.ai_service import ai_service
from classifier import predict_batch
import redis
from celery_app import REDIS_URL

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

def _safe_float(val) -> float:
    try:
        return float(str(val).replace(",", ""))
    except (ValueError, TypeError):
        return 0.0

def _format_transactions(transactions: list[dict]) -> str:
    if not transactions:
        return "No transaction data available."
    total_debit = sum(t.get("amount", 0) for t in transactions if t.get("type") == "debit")
    lines = []
    for i, t in enumerate(transactions[:15], 1):
        amt = t.get("amount", 0)
        merchant = t.get("merchant", "Unknown")
        category = t.get("category", "")
        date = t.get("date", "")
        tx_type = t.get("type", "debit")
        cat_str = f" [{category}]" if category else ""
        date_str = f" on {date}" if date else ""
        lines.append(f"{i}. {merchant}{cat_str} — ₹{amt:.2f}{date_str} ({tx_type})")
    return (
        f"Total debits across {len(transactions)} transactions: ₹{total_debit:.2f}\n\n"
        f"Recent transactions:\n" + "\n".join(lines)
    )

@celery_app.task(name="classify_batch", bind=True, max_retries=2)
def classify_batch(self, device_id: str, transactions: list[dict]):
    try:
        if not transactions:
            return {"classified": 0}
        texts = [tx.get("raw") or tx.get("merchant", "") for tx in transactions]
        categories = predict_batch(texts)
        rows = []
        for tx, category in zip(transactions, categories):
            rows.append({
                "id": str(uuid.uuid4()),
                "device_id": device_id,
                "sms_id": tx.get("smsId") or tx.get("id", str(uuid.uuid4())),
                "amount": _safe_float(tx.get("amount")),
                "currency": tx.get("currency", "INR"),
                "merchant": tx.get("merchant", "Unknown"),
                "category": category,
                "type": tx.get("type", "debit"),
                "date": tx.get("date", ""),
                "bank": tx.get("bank", ""),
                "account": tx.get("account", ""),
                "raw_msg_len": tx.get("rawMsgLength") or len(tx.get("raw", "")),
            })
        upsert_transactions(rows)
        return {"classified": len(rows)}
    except Exception as exc:
        raise self.retry(exc=exc, countdown=5)

@celery_app.task(name="process_chat", bind=True, max_retries=2)
def process_chat(self, device_id: str, message_text: str):
    try:
        emit_event(device_id, "chat_status", "Checking your latest spending...")
        recent_tx = get_recent_transactions(device_id, limit=15)
        tx_context = _format_transactions(recent_tx)
        system_instruction = f"You are Finize, a personal finance coach. Use the context below to help the user. Keep it friendly and concise.\nContext:\n{tx_context}"
        emit_event(device_id, "chat_status", "Thinking about your question...")
        response_text = ai_service.chat_completion([
            {"role": "system", "content": system_instruction},
            {"role": "user", "content": message_text}
        ])
        save_chat_message(device_id, "assistant", response_text)
        emit_event(device_id, "chat_complete", "Analysis complete!")
        return {"status": "success", "text": response_text}
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
        emit_event(device_id, "query_status", "Searching your records...")
        rows = query_db(raw_sql, (device_id,))
        emit_event(device_id, "query_status", "Summarizing results...")
        answer_prompt = f"Question: {question}\nData: {rows[:20]}\n\nSummarize clearly in 2 sentences:"
        answer_text = ai_service.chat_completion([{"role": "user", "content": answer_prompt}])
        save_chat_message(device_id, "assistant", answer_text, msg_type='sql_result', metadata=json.dumps({"sql": raw_sql}))
        emit_event(device_id, "query_complete", "Done!")
        return {"sql": raw_sql, "rows": rows, "answer": answer_text}
    except Exception as exc:
        emit_event(device_id, "error", "Analysis failed.")
        raise self.retry(exc=exc, countdown=3)

@celery_app.task(name="generate_daily_report")
def generate_daily_report(device_id: str = "all_active_devices"):
    try:
        devices = [r['device_id'] for r in query_db("SELECT DISTINCT device_id FROM transactions")] if device_id == "all_active_devices" else [device_id]
        for d_id in devices:
            emit_event(d_id, "report_status", "Building your daily financial report...")
            cat_sums = query_db("SELECT category, SUM(amount) as total FROM transactions WHERE device_id = ? GROUP BY category", (d_id,))
            bank_sums = query_db("SELECT bank, SUM(amount) as total FROM transactions WHERE device_id = ? GROUP BY bank", (d_id,))
            prompt = f"Generate a financial JSON report.\nAggregates: Categories: {cat_sums}, Banks: {bank_sums}.\nReturn JSON only: {{ \"total_spent\": float, \"tx_count\": int, \"summary\": \"...\", \"insights\": [\"...\", \"...\", \"...\"], \"graph_data\": {{ \"categories\": [...], \"banks\": [...] }} }}"
            report_json = ai_service.generate_report(prompt)
            save_report(d_id, "daily", report_json)
            emit_event(d_id, "report_complete", "Report ready!")
        return {"status": "success", "processed": len(devices)}
    except Exception as e:
        return {"status": "failed", "error": str(e)}
