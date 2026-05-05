import requests
import time

device_id = "test-device-123"
base_url = "http://13.239.4.192:3000"

# 1. Start Chat
chat_url = f"{base_url}/api/chat"
payload = {
    "deviceId": device_id,
    "message": "Hello! Who are you?"
}

print(f"--- Starting Chat ---")
response = requests.post(chat_url, json=payload)
job_id = response.json().get("jobId")
print(f"Job ID: {job_id}")

# 2. Poll for Status
status_url = f"{base_url}/api/chat/status/{job_id}"
print(f"\n--- Polling for Result ---")

for i in range(10):
    res = requests.get(status_url)
    data = res.json()
    status = data.get("status")
    print(f"Attempt {i+1}: Status = {status}")
    
    if status == "completed":
        print(f"\nAI Response:\n{data['result']['text']}")
        break
    elif status == "failed":
        print(f"\nError: {data.get('error')}")
        break
    
    time.sleep(3)
else:
    print("\nTimeout reached.")
