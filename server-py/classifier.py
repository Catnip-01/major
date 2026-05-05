"""
classifier.py — Transaction category classifier using HuggingFace Spaces API.

Uses the Gradio client to call the deployed model at:
  https://huggingface.co/spaces/tanu0410/expense-classifier2

Batches multiple texts in parallel using ThreadPoolExecutor for speed.
"""
import os
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from gradio_client import Client
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

HF_SPACE = os.getenv("HF_SPACE", "tanu0410/expense-classifier2")
MAX_WORKERS = int(os.getenv("CLASSIFIER_WORKERS", "10"))

# Lazily created per-thread client (Gradio Client is not thread-safe to share)
_client_cache: dict[int, Client] = {}


def _get_client() -> Client:
    """Return a thread-local Gradio client (creates one per thread)."""
    import threading
    tid = threading.get_ident()
    if tid not in _client_cache:
        _client_cache[tid] = Client(HF_SPACE)
    return _client_cache[tid]


def _classify_one(text: str) -> str:
    """Call HF Space for a single text. Returns category string."""
    try:
        client = _get_client()
        result = client.predict(text, api_name="/predict")
        return str(result).strip()
    except Exception as e:
        logger.warning(f"Classifier error for text '{text[:40]}': {e}")
        return "Other"


def predict_batch(texts: list[str]) -> list[str]:
    """
    Classify a batch of transaction texts in parallel.
    Returns a list of category strings in the same order as input.

    Example:
        texts = ["Paid Uber for ride", "Zomato order"]
        → ["Transportation", "Food & Dining"]
    """
    if not texts:
        return []

    results = ["Other"] * len(texts)

    with ThreadPoolExecutor(max_workers=min(MAX_WORKERS, len(texts))) as executor:
        # Submit all tasks, tracking original index
        future_to_idx = {
            executor.submit(_classify_one, text): i
            for i, text in enumerate(texts)
        }

        for future in as_completed(future_to_idx):
            idx = future_to_idx[future]
            try:
                results[idx] = future.result()
            except Exception as e:
                logger.error(f"Batch classification failed at index {idx}: {e}")
                results[idx] = "Other"

    logger.info(f"Classified {len(texts)} transactions via HF Space")
    return results
