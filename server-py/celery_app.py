"""
celery_app.py — Celery instance connected to Redis.
Shared by tasks.py and main.py.
"""
import os
from celery import Celery
from dotenv import load_dotenv

load_dotenv()

REDIS_URL = os.getenv("REDIS_URL", "redis://127.0.0.1:6379/0")

celery_app = Celery(
    "palfin",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=["tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    result_expires=3600,          # job results kept for 1 hour
    task_acks_late=True,          # only ack after task completes (safer)
    worker_prefetch_multiplier=1, # one task at a time per worker slot
    task_soft_time_limit=60,      # raises SoftTimeLimitExceeded after 60s
    task_time_limit=90,           # hard kill after 90s
)

celery_app.conf.beat_schedule = {
    "generate-daily-reports": {
        "task": "generate_daily_report",
        "schedule": 86400.0, # Every 24 hours
        "args": ("all_active_devices",) # In a real app, you'd loop over active users
    },
}
