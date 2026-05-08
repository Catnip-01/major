import os
from pymongo import MongoClient, UpdateOne
from datetime import datetime

MONGO_URI = os.getenv("MONGO_URI", "mongodb://mongo:27017/palfin")
client = MongoClient(MONGO_URI)
db = client['palfin']
# Use 'chathistories' to match Mongoose default pluralization
chats_collection = db['chathistories']

def save_chat_message(device_id: str, role: str, content: str, session_id: str = "default", msg_type: str = 'text', metadata: str = None):
    # Map 'assistant' to 'model' for Node.js compatibility
    db_role = 'model' if role == 'assistant' else role
    
    chats_collection.update_one(
        {"deviceId": device_id, "sessionId": session_id},
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

def get_chat_history(device_id: str, session_id: str = "default", limit: int = 50) -> list[dict]:
    doc = chats_collection.find_one(
        {"deviceId": device_id, "sessionId": session_id}, 
        {"_id": 0, "messages": {"$slice": -limit}}
    )
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

def get_device_sessions(device_id: str) -> list[dict]:
    # Find all sessions for this device, return their ID, last message, and updatedAt
    cursor = chats_collection.find(
        {"deviceId": device_id},
        {"_id": 0, "sessionId": 1, "updatedAt": 1, "messages": {"$slice": -1}}
    ).sort("updatedAt", -1)
    
    sessions = []
    for doc in cursor:
        last_msg = doc["messages"][0]["text"] if doc.get("messages") else ""
        sessions.append({
            "sessionId": doc["sessionId"],
            "title": last_msg[:50] + ("..." if len(last_msg) > 50 else "") if last_msg else "New Conversation",
            "lastMessage": last_msg,
            "updatedAt": doc.get("updatedAt", doc.get("createdAt"))
        })
    return sessions

def delete_device_chats(device_id: str):
    chats_collection.delete_many({"deviceId": device_id})

def delete_session(device_id: str, session_id: str):
    chats_collection.delete_one({"deviceId": device_id, "sessionId": session_id})
