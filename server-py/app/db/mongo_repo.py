import os
from pymongo import MongoClient
from datetime import datetime

MONGO_URI = os.getenv("MONGO_URI", "mongodb://mongo:27017")
client = MongoClient(MONGO_URI)
db = client['palfin']
chats_collection = db['chats']

def save_chat_message(device_id: str, role: str, content: str, msg_type: str = 'text', metadata: str = None):
    chats_collection.insert_one({
        "device_id": device_id,
        "role": role,
        "content": content,
        "type": msg_type,
        "metadata": metadata,
        "created_at": datetime.utcnow()
    })

def get_chat_history(device_id: str, limit: int = 50) -> list[dict]:
    cursor = chats_collection.find({"device_id": device_id}, {"_id": 0}) \
                             .sort("created_at", 1) \
                             .limit(limit)
    return list(cursor)

def delete_device_chats(device_id: str):
    chats_collection.delete_many({"device_id": device_id})
