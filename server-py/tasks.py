"""
tasks.py — All Celery background tasks.

Three task types:
  1. classify_batch  → classify SMS transactions via HF API → store in SQLite
  2. process_chat    → Gemini AI chat with transaction context
  3. nl_query        → Natural language → SQL → AI answer
"""
import os
import logging
import uuid
import re

import json
import redis
from groq import Groq
from dotenv import load_dotenv

from celery_app import celery_app, REDIS_URL
from classifier import predict_batch
from database import (
    upsert_transactions, get_recent_transactions, query_db, get_schema,
    save_chat_message, save_report
)

load_dotenv()

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Shared clients (initialised once per worker process)
# ---------------------------------------------------------------------------

_redis_client = None
_groq_client = None


def _get_redis():
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.from_url(REDIS_URL)
    return _redis_client


def emit_event(device_id: str, event_type: str, message: str):
    """Push a real-time update to the client via Redis Pub/Sub."""
    try:
        r = _get_redis()
        r.publish(f"events:{device_id}", json.dumps({
            "event": event_type,
            "message": message,
            "timestamp": str(uuid.uuid4())
        }))
    except Exception as e:
        logger.error(f"Failed to emit event: {e}")


def _get_groq():
    global _groq_client
    if _groq_client is None:
        _groq_client = Groq(api_key=os.getenv("GROQ_API_KEY", ""))
    return _groq_client


# ---------------------------------------------------------------------------
# Task 1: Classify & store transactions
# ---------------------------------------------------------------------------

@celery_app.task(name="classify_batch", bind=True, max_retries=2)
def classify_batch(self, device_id: str, transactions: list[dict]):
    """
    Receives a list of extracted transaction dicts, classifies them via
    the HF Spaces API (in parallel), and upserts results into SQLite.

    transaction dict fields:
      smsId, raw, amount, currency, merchant, date, type, account, bank, rawMsgLength
    """
    try:
        if not transactions:
            return {"classified": 0}

        # Build texts for the classifier — use the raw SMS for best accuracy
        texts = [tx.get("raw") or tx.get("merchant", "") for tx in transactions]

        logger.info(f"Classifying batch of {len(texts)} for device {device_id}")
        categories = predict_batch(texts)

        # Build rows for SQLite
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
        logger.info(f"✅ Stored {len(rows)} classified transactions for {device_id}")
        return {"classified": len(rows)}

    except Exception as exc:
        logger.error(f"classify_batch failed: {exc}")
        raise self.retry(exc=exc, countdown=5)


# ---------------------------------------------------------------------------
# Task 2: Chat with Gemini (financial coach)
# ---------------------------------------------------------------------------

@celery_app.task(name="process_chat", bind=True, max_retries=2)
def process_chat(self, device_id: str, message_text: str):
    """
    Processes a chat message with Groq and persists to SQLite.
    """
    try:
        emit_event(device_id, "chat_status", "Checking your latest spending...")
        groq = _get_groq()

        # --- Fetch recent transactions for context ---
        recent_tx = get_recent_transactions(device_id, limit=15)
        tx_context = _format_transactions(recent_tx)

        # --- Build system prompt ---
        system_instruction = f"""You are Finize, a personal finance coach. 
Use the context below to help the user. Keep it friendly and concise.
Context:
{tx_context}"""

        emit_event(device_id, "chat_status", "Thinking about your question...")
        
        chat_completion = groq.chat.completions.create(
            messages=[
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": message_text}
            ],
            model="llama-3.3-70b-versatile",
        )
        response_text = chat_completion.choices[0].message.content

        # --- Save to SQLite Persistence ---
        save_chat_message(device_id, "assistant", response_text)

        emit_event(device_id, "chat_complete", "Analysis complete!")
        return {"status": "success", "text": response_text}

    except Exception as exc:
        logger.error(f"process_chat failed: {exc}")
        emit_event(device_id, "error", "My brain is a bit foggy right now. Try again?")
        raise self.retry(exc=exc, countdown=3)


# ---------------------------------------------------------------------------
# Task 3: Natural Language → SQL → AI Answer
# ---------------------------------------------------------------------------

@celery_app.task(name="nl_query", bind=True, max_retries=1)
def nl_query(self, device_id: str, question: str):
    """
    Converts a natural language question to SQL, runs it against SQLite.
    """
    try:
        emit_event(device_id, "query_status", "Translating to SQL...")
        groq = _get_groq()
        schema = get_schema()

        # --- Step 1: NL → SQL ---
        sql_prompt = f"You are a SQL expert. Schema:\n{schema}\n\nUser: {question}\n\nSQL (SQLite, device_id = ?):"
        sql_completion = groq.chat.completions.create(
            messages=[{"role": "user", "content": sql_prompt}],
            model="llama-3.3-70b-versatile",
        )
        raw_sql = sql_completion.choices[0].message.content.strip()
        raw_sql = re.sub(r"```(?:sql)?", "", raw_sql).strip().rstrip("`").strip()

        if not raw_sql.upper().startswith("SELECT"):
            return {"sql": raw_sql, "rows": [], "answer": "I can only read data."}

        # --- Step 2: Execute SQL ---
        emit_event(device_id, "query_status", "Searching your records...")
        rows = query_db(raw_sql, (device_id,))

        # --- Step 3: Results → Human Answer ---
        emit_event(device_id, "query_status", "Summarizing results...")
        answer_prompt = f"Question: {question}\nData: {rows[:20]}\n\nSummarize clearly in 2 sentences:"
        
        answer_completion = groq.chat.completions.create(
            messages=[{"role": "user", "content": answer_prompt}],
            model="llama-3.3-70b-versatile",
        )
        answer_text = answer_completion.choices[0].message.content.strip()

        # Save to SQLite
        save_chat_message(device_id, "assistant", answer_text, msg_type='sql_result', metadata=json.dumps({"sql": raw_sql}))

        emit_event(device_id, "query_complete", "Done!")
        return {
            "sql": raw_sql,
            "rows": rows,
            "answer": answer_text,
        }

    except Exception as exc:
        logger.error(f"nl_query failed: {exc}")
        emit_event(device_id, "error", "Analysis failed.")
        raise self.retry(exc=exc, countdown=3)


# ---------------------------------------------------------------------------
# Task 4: Proactive Reporting Engine
# ---------------------------------------------------------------------------

@celery_app.task(name="generate_daily_report")
def generate_daily_report(device_id: str = "all_active_devices"):
    """
    Background job to generate a rich JSON report for the user(s).
    """
    try:
        devices = []
        if device_id == "all_active_devices":
            # Find all unique device IDs in the DB
            rows = query_db("SELECT DISTINCT device_id FROM transactions")
            devices = [r['device_id'] for r in rows]
        else:
            devices = [device_id]

        for d_id in devices:
            emit_event(d_id, "report_status", "Building your daily financial report...")
            groq = _get_groq()

            # 1. Gather Aggregates
            cat_sums = query_db(
                "SELECT category, SUM(amount) as total FROM transactions WHERE device_id = ? GROUP BY category",
                (d_id,)
            )
            bank_sums = query_db(
                "SELECT bank, SUM(amount) as total FROM transactions WHERE device_id = ? GROUP BY bank",
                (d_id,)
            )

            # 2. Get Insights from LLM
            prompt = f"""Generate a financial JSON report. 
Aggregates: Categories: {cat_sums}, Banks: {bank_sums}.
Return JSON only: {{ "total_spent": float, "tx_count": int, "summary": "...", "insights": ["...", "...", "..."], "graph_data": {{ "categories": [...], "banks": [...] }} }}"""
            
            completion = groq.chat.completions.create(
                messages=[{"role": "user", "content": prompt}],
                model="llama-3.3-70b-versatile",
            )
            report_json = re.sub(r"```(?:json)?", "", completion.choices[0].message.content).strip().rstrip("`").strip()

            # 3. Save to DB
            save_report(d_id, "daily", report_json)
            emit_event(d_id, "report_complete", "Report ready!")

        return {"status": "success", "processed": len(devices)}
    except Exception as e:
        logger.error(f"Report generation failed: {e}")
        return {"status": "failed", "error": str(e)}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

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
