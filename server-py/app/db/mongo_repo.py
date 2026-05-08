import os
from pymongo import MongoClient, UpdateOne
from datetime import datetime

MONGO_URI = os.getenv("MONGO_URI", "mongodb://mongo:27017/palfin")
client = MongoClient(MONGO_URI)
db = client['palfin']
# Use 'chathistories' to match Mongoose default pluralization
chats_collection = db['chathistories']

def save_chat_message(device_id: str, role: str, content: str, msg_type: str = 'text', metadata: str = None):
    # Map 'assistant' to 'model' for Node.js compatibility
    db_role = 'model' if role == 'assistant' else role
    
    chats_collection.update_one(
        {"deviceId": device_id},
        {
            "$push": {
                "messages": {
                    "role": db_role,
                    "text": content,
                    "type": msg_type,
                    "metadata": metadata,
                    "timestamp": datetime.utcnow()
                }
            },
            "$setOnInsert": {"createdAt": datetime.utcnow()},
            "$set": {"updatedAt": datetime.utcnow()}
        },
        upsert=True
    )

def get_chat_history(device_id: str, limit: int = 50) -> list[dict]:
    doc = chats_collection.find_one({"deviceId": device_id}, {"_id": 0, "messages": {"$slice": -limit}})
    if not doc or "messages" not in doc:
        return []
    
    # Map 'model' back to 'assistant' for internal Python consistency
    # and rename 'text' to 'content' for the API handler
    history = []
    for msg in doc["messages"]:
        history.append({
            "role": "assistant" if msg["role"] == "model" else "user",
            "content": msg["text"],
            "type": msg.get("type", "text"),
            "metadata": msg.get("metadata")
        })
    return history

def delete_device_chats(device_id: str):
    chats_collection.delete_one({"deviceId": device_id})
