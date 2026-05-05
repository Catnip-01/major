"""
database.py — SQLite setup and helpers.
Handles all classified transaction storage.
"""
import os
import sqlite3
import uuid
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

SQLITE_PATH = os.getenv("SQLITE_PATH", "./data/transactions.db")

# Ensure the data directory exists
Path(SQLITE_PATH).parent.mkdir(parents=True, exist_ok=True)


def get_conn() -> sqlite3.Connection:
    """Return a thread-local SQLite connection with row_factory set."""
    conn = sqlite3.connect(SQLITE_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Create tables if they don't exist. Called once at startup."""
    conn = get_conn()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS transactions (
            id          TEXT PRIMARY KEY,
            device_id   TEXT NOT NULL,
            sms_id      TEXT NOT NULL,
            amount      REAL,
            currency    TEXT DEFAULT 'INR',
            merchant    TEXT,
            category    TEXT,
            type        TEXT CHECK(type IN ('credit', 'debit')),
            date        TEXT,
            bank        TEXT,
            account     TEXT,
            raw_msg_len INTEGER,
            created_at  TEXT DEFAULT (datetime('now')),
            UNIQUE(device_id, sms_id)
        )
    """)
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_device ON transactions(device_id)"
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_category ON transactions(category)"
    )
    conn.commit()
    conn.close()
    print("✅ SQLite DB initialised")


def upsert_transactions(rows: list[dict]):
    """
    Insert or replace transaction rows.
    Each row dict must have: device_id, sms_id, amount, currency,
    merchant, category, type, date, bank, account, raw_msg_len
    """
    if not rows:
        return
    conn = get_conn()
    conn.executemany(
        """
        INSERT INTO transactions
            (id, device_id, sms_id, amount, currency, merchant,
             category, type, date, bank, account, raw_msg_len)
        VALUES
            (:id, :device_id, :sms_id, :amount, :currency, :merchant,
             :category, :type, :date, :bank, :account, :raw_msg_len)
        ON CONFLICT(device_id, sms_id) DO UPDATE SET
            category    = excluded.category,
            merchant    = excluded.merchant,
            amount      = excluded.amount
        """,
        [{**row, "id": row.get("id") or str(uuid.uuid4())} for row in rows],
    )
    conn.commit()
    conn.close()


def query_db(sql: str, params: tuple = ()) -> list[dict]:
    """Execute a read-only SQL query and return list of row dicts."""
    conn = get_conn()
    try:
        cur = conn.execute(sql, params)
        rows = [dict(r) for r in cur.fetchall()]
        return rows
    finally:
        conn.close()


def get_recent_transactions(device_id: str, limit: int = 15) -> list[dict]:
    """Fetch recent transactions for a device (for AI context)."""
    return query_db(
        "SELECT * FROM transactions WHERE device_id = ? ORDER BY created_at DESC LIMIT ?",
        (device_id, limit),
    )


def get_schema() -> str:
    """Return the CREATE TABLE statement for Gemini's NL→SQL context."""
    return """
transactions table columns:
  id TEXT, device_id TEXT, sms_id TEXT,
  amount REAL (in INR), currency TEXT,
  merchant TEXT, category TEXT
    (values: 'Transportation', 'Food & Dining', 'Shopping & Retail',
     'Healthcare & Medical', 'Entertainment & Recreation',
     'Utilities & Bills', 'Income', 'Government & Legal',
     'Charity & Donations', 'Other'),
  type TEXT ('credit' or 'debit'),
  date TEXT (format: DD-MM-YY or similar),
  bank TEXT, account TEXT,
  created_at TEXT (ISO datetime)

IMPORTANT: Always filter by device_id = ? to scope results per user.
"""
