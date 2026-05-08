import requests
import time
import json

BASE_URL = "http://3.26.191.49:3000"
DEVICE_ID = "device_test_123"

def test_api():
    print(f"--- Starting API Verification for {BASE_URL} ---")

    # 1. Health Check
    print("\n[1/5] Testing Health Check...")
    try:
        res = requests.get(f"{BASE_URL}/api/health")
        print(f"Status: {res.status_code} | Data: {res.json()}")
    except Exception as e:
        print(f"Health Check Failed: {e}")

    # 2. Sync Transactions (The Core)
    print("\n[2/5] Testing Transaction Sync...")
    sample_txs = [
        {"raw": "INR 500 debited for Zomato on 08-05-26", "amount": 500, "merchant": "Zomato", "type": "debit"},
        {"raw": "INR 1000 credited to account", "amount": 1000, "merchant": "Employer", "type": "credit"}
    ]
    res = requests.post(f"{BASE_URL}/api/sync-sms", json={"deviceId": DEVICE_ID, "transactions": sample_txs})
    print(f"Sync Status: {res.status_code} | Response: {res.json()}")
    
    # 3. Trigger Behavioral Insights Generation
    print("\n[3/5] Triggering Behavioral Analysis...")
    res = requests.post(f"{BASE_URL}/api/reports/generate", json={"deviceId": DEVICE_ID})
    task_id = res.json().get("jobId")
    print(f"Trigger Status: {res.status_code} | Task ID: {task_id}")

    # 4. Poll for Report Status
    print("\n[4/5] Polling for Report Generation (sleeping 5s)...")
    time.sleep(5)
    res = requests.get(f"{BASE_URL}/api/reports/latest?deviceId={DEVICE_ID}")
    print(f"Report Fetch Status: {res.status_code}")
    if res.status_code == 200:
        data = res.json()
        print(f"Report Received: {json.dumps(data, indent=2)[:500]}...")

    # 5. Test Chat (Finize)
    print("\n[5/5] Testing Chat...")
    res = requests.post(f"{BASE_URL}/api/chat", json={"deviceId": DEVICE_ID, "message": "How am I doing financially?"})
    print(f"Chat Status: {res.status_code} | Response: {res.json()}")

test_api()
