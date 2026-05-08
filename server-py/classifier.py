"""
classifier.py — Local TF-IDF + Logistic Regression classifier.

Loads models from disk (models/transaction_model.pkl + models/vectorizer.pkl).
Zero network calls, ~50ms for a batch of 50 transactions.

Model was trained on 4.5M transactions (mitulshah/transaction-categorization
+ 500-row India-specific dataset). See train2.ipynb.
"""
import os
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

MODEL_DIR = Path(os.getenv("MODEL_DIR", "/app/models"))
MODEL_PATH = MODEL_DIR / "transaction_model.pkl"
VECTORIZER_PATH = MODEL_DIR / "vectorizer.pkl"

# Lazy-loaded singletons — loaded once per worker process
_model = None
_vectorizer = None


def _load_models():
    """Load model and vectorizer from disk on first call."""
    global _model, _vectorizer
    if _model is not None:
        return True

    try:
        import joblib
        if not MODEL_PATH.exists() or not VECTORIZER_PATH.exists():
            logger.error(
                f"Model files not found at {MODEL_DIR}. "
                "Place transaction_model.pkl and vectorizer.pkl there."
            )
            return False

        _model = joblib.load(MODEL_PATH)
        _vectorizer = joblib.load(VECTORIZER_PATH)
        logger.info(f"✅ Loaded local classifier from {MODEL_DIR}")
        return True
    except Exception as e:
        logger.error(f"Failed to load classifier: {e}")
        return False


def predict_batch(texts: list[str]) -> list[str]:
    """
    Classify a batch of transaction texts locally.
    Returns a list of category strings in the same order as input.
    Falls back to 'Other' if models are unavailable.

    Example:
        texts = ["Paid Uber for ride", "Zomato order"]
        → ["Transportation", "Food & Dining"]
    """
    if not texts:
        return []

    if not _load_models():
        logger.warning("Classifier unavailable — labelling all as 'Other'")
        return ["Other"] * len(texts)

    try:
        vecs = _vectorizer.transform(texts)
        predictions = _model.predict(vecs).tolist()
        logger.info(f"Classified {len(texts)} transactions locally")
        return predictions
    except Exception as e:
        logger.error(f"Classification failed: {e}")
        return ["Other"] * len(texts)
