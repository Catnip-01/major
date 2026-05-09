import json
import logging
from abc import ABC, abstractmethod
from typing import List
import classifier as local_classifier
from app.services.ai_service import ai_service
from app.core.config_loader import config_loader

logger = logging.getLogger(__name__)

class BaseClassifier(ABC):
    @abstractmethod
    def predict(self, texts: List[str]) -> List[str]:
        pass

class LocalClassifierProvider(BaseClassifier):
    def predict(self, texts: List[str]) -> List[str]:
        return local_classifier.predict_batch(texts)

class LLMClassifierProvider(BaseClassifier):
    def predict(self, texts: List[str]) -> List[str]:
        try:
            # Construct a request to categorize the transactions
            system_prompt = config_loader.get_prompt("transaction_classifier", "system_prompt")
            prompt = system_prompt + " Descriptions: " + json.dumps({str(i): t for i, t in enumerate(texts)})

            response = ai_service.generate_report(prompt)
            data = json.loads(response)

            # Map results to ordered list
            results = []
            for i in range(len(texts)):
                results.append(data.get(str(i), "Other"))
            return results
        except Exception as e:
            logger.error(f"LLM classification failed, falling back: {e}")
            # Fallback to local model if LLM fails
            return local_classifier.predict_batch(texts)

def get_classifier(provider_type: str = "local") -> BaseClassifier:
    if provider_type == "llm":
        return LLMClassifierProvider()
    return LocalClassifierProvider()
