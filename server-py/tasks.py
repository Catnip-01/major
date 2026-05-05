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

import pymongo
import google.generativeai as genai
from dotenv import load_dotenv

from celery_app import celery_app
from classifier import predict_batch
from database import upsert_transactions, get_recent_transactions, query_db, get_schema

load_dotenv()

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Shared clients (initialised once per worker process)
# ---------------------------------------------------------------------------

_mongo_client: pymongo.MongoClient | None = None
_gemini_model = None


def _get_mongo():
    global _mongo_client
    if _mongo_client is None:
        _mongo_client = pymongo.MongoClient(
            os.getenv("MONGO_URI", "mongodb://localhost:27017/palfin")
        )
    return _mongo_client["palfin"]


def _get_gemini():
    global _gemini_model
    if _gemini_model is None:
        genai.configure(api_key=os.getenv("GEMINI_API_KEY", ""))
        _gemini_model = genai.GenerativeModel("gemini-2.5-flash")
    return _gemini_model


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
    Processes a chat message:
      - Fetches recent transactions from SQLite for context
      - Fetches chat history from MongoDB
      - Calls Gemini with full context
      - Saves response to MongoDB
      - Returns the AI response text
    """
    try:
        db = _get_mongo()
        gemini = _get_gemini()

        # --- Load or create chat history ---
        history_col = db["chat_histories"]
        history_doc = history_col.find_one({"deviceId": device_id})
        if not history_doc:
            history_doc = {"deviceId": device_id, "messages": []}
            history_col.insert_one(history_doc)

        messages = history_doc.get("messages", [])

        # --- Fetch recent transactions for context ---
        recent_tx = get_recent_transactions(device_id, limit=15)
        tx_context = _format_transactions(recent_tx)

        # --- Build system prompt ---
        system_instruction = f"""You are Finize, a personal finance coach for Indian users.
- Give short, practical, rupee-denominated advice based on the user's actual transactions.
- Never invent numbers that aren't in the data.
- Never say you are an AI.
- Be conversational, not preachy.
- When relevant, mention the spending category (Food & Dining, Transportation, etc.)

User's Transaction Context:
{tx_context}"""

        # --- Build history for Gemini ---
        past_contents = [
            {"role": m["role"], "parts": [{"text": m["text"]}]}
            for m in messages
        ]

        # --- Call Gemini ---
        chat_session = gemini.start_chat(
            history=past_contents,
        )
        # Note: system_instruction must be set at model level; workaround:
        # prepend it to the first message if no history, else send directly
        if not past_contents:
            full_message = f"[Context for you only - do not repeat this]\n{system_instruction}\n\n{message_text}"
        else:
            full_message = message_text

        result = chat_session.send_message(full_message)
        response_text = result.text

        # --- Save to MongoDB ---
        messages.append({"role": "user", "text": message_text})
        messages.append({"role": "model", "text": response_text})
        history_col.update_one(
            {"deviceId": device_id},
            {"$set": {"messages": messages}},
            upsert=True,
        )

        return {"status": "success", "text": response_text}

    except Exception as exc:
        logger.error(f"process_chat failed: {exc}")
        raise self.retry(exc=exc, countdown=3)


# ---------------------------------------------------------------------------
# Task 3: Natural Language → SQL → AI Answer
# ---------------------------------------------------------------------------

@celery_app.task(name="nl_query", bind=True, max_retries=1)
def nl_query(self, device_id: str, question: str):
    """
    Converts a natural language question to SQL, runs it against SQLite,
    then turns the raw results into a human-readable answer via Gemini.

    Returns: { "sql": str, "rows": list, "answer": str }
    """
    try:
        gemini = _get_gemini()
        schema = get_schema()

        # --- Step 1: NL → SQL ---
        sql_prompt = f"""You are a SQL expert. Convert the user's question to a valid SQLite query.

Schema:
{schema}

Rules:
- ALWAYS include WHERE device_id = '<DEVICE_ID>' — replace <DEVICE_ID> with the literal placeholder ?
- Only use SELECT statements (no INSERT/UPDATE/DELETE)
- Return ONLY the SQL query, no explanation, no markdown fences
- Use LOWER() for case-insensitive category matching where needed
- Limit results to 100 rows max unless user specifies otherwise

User question: {question}

SQL query:"""

        sql_response = gemini.generate_content(sql_prompt)
        raw_sql = sql_response.text.strip()

        # Clean up any markdown code fences Gemini might add
        raw_sql = re.sub(r"```(?:sql)?", "", raw_sql).strip().rstrip("`").strip()

        # Safety: only allow SELECT
        if not raw_sql.upper().startswith("SELECT"):
            return {
                "sql": raw_sql,
                "rows": [],
                "answer": "I can only answer questions by reading your data, not modifying it.",
            }

        # --- Step 2: Execute SQL ---
        try:
            rows = query_db(raw_sql, (device_id,))
        except Exception as db_err:
            logger.error(f"SQL execution error: {db_err}\nSQL: {raw_sql}")
            return {
                "sql": raw_sql,
                "rows": [],
                "answer": f"I had trouble running that query. Try rephrasing your question.",
            }

        # --- Step 3: Results → Human Answer ---
        if not rows:
            return {
                "sql": raw_sql,
                "rows": [],
                "answer": "I couldn't find any matching transactions for that question.",
            }

        rows_preview = rows[:20]  # Cap context size
        answer_prompt = f"""You are Finize, a personal finance coach for Indian users.

The user asked: "{question}"

Here are the query results from their transaction database:
{rows_preview}

Give a clear, concise, friendly answer in plain English. Use ₹ for rupee amounts. 
Don't mention SQL or databases. Keep it under 3 sentences unless the data warrants more detail."""

        answer_response = gemini.generate_content(answer_prompt)

        return {
            "sql": raw_sql,
            "rows": rows,
            "answer": answer_response.text.strip(),
        }

    except Exception as exc:
        logger.error(f"nl_query failed: {exc}")
        raise self.retry(exc=exc, countdown=3)


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
