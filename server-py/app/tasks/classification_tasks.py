import uuid
from celery_app import celery_app
from app.db.repository import upsert_transactions
from classifier import predict_batch

@celery_app.task(name="classify_batch", bind=True, max_retries=2)
def classify_batch(self, device_id: str, transactions: list[dict]):
    try:
        if not transactions: return {"classified": 0}
        texts = [tx.get("raw") or tx.get("merchant", "") for tx in transactions]
        categories = predict_batch(texts)
        rows = []
        for tx, category in zip(transactions, categories):
            rows.append({
                "id": str(uuid.uuid4()),
                "device_id": device_id,
                "sms_id": tx.get("smsId") or tx.get("id", str(uuid.uuid4())),
                "amount": float(str(tx.get("amount", 0)).replace(",", "")),
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
