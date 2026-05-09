import os
import re
import time
import logging
from groq import Groq, RateLimitError
from dotenv import load_dotenv

from app.core.config_loader import config_loader

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class AIService:
    def __init__(self):
        self.client = Groq(api_key=os.getenv("GROQ_API_KEY", ""))
        self.model = "llama-3.3-70b-versatile"
        self.fallback_model = "llama-3.1-8b-instant"

    def chat_completion(self, messages: list[dict], use_fallback=False) -> str:
        model = self.fallback_model if use_fallback else self.model
        retries = 3
        delay = 5

        for i in range(retries):
            try:
                completion = self.client.chat.completions.create(
                    messages=messages,
                    model=model,
                )
                return completion.choices[0].message.content
            except RateLimitError as e:
                logger.warning(f"Rate limit hit on {model} (attempt {i+1}/{retries}). Retrying in {delay}s...")
                if i == retries - 1 and not use_fallback:
                    logger.info(f"Switching to fallback model: {self.fallback_model}")
                    return self.chat_completion(messages, use_fallback=True)
                time.sleep(delay)
                delay *= 2
            except Exception as e:
                logger.error(f"Error during chat completion: {e}")
                raise e
        raise Exception("Max retries exceeded for AI service.")

    def nl_to_sql(self, schema: str, question: str) -> str:
        system_prompt = config_loader.get_prompt("sql_generator", "system_prompt")
        sql_prompt = f"Schema:\n{schema}\n\nUser: {question}\n\nSQL (SQLite, device_id = ?):"
        
        content = self.chat_completion([
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": sql_prompt}
        ])
        
        # Cleanup markdown and whitespace
        content = re.sub(r"```(?:sql)?\s*", "", content, flags=re.IGNORECASE).replace("```", "").strip()
        
        # Match starting from SELECT until the end or a semicolon
        match = re.search(r"(SELECT[\s\S]+)", content, re.IGNORECASE)
        sql = match.group(1).strip() if match else ""
        
        # Ensure it's not cut off - if it has a semicolon, keep everything before it
        if ";" in sql:
            sql = sql.split(";")[0] + ";"
            
        return sql

    def generate_report(self, prompt: str) -> str:
        system_prompt = "You are a financial analysis engine. Return ONLY a raw JSON object string. Do not use markdown, do not include any explanatory text, do not use backticks."
        content = self.chat_completion([
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt}
        ])
        
        # Remove markdown if it still slips through
        content = re.sub(r"```(?:json)?\s*", "", content, flags=re.IGNORECASE)
        content = content.replace("```", "")
        
        # Find the first { and the last } to isolate JSON
        start = content.find('{')
        end = content.rfind('}')
        if start != -1 and end != -1:
            content = content[start:end+1]
        
        return content.strip()

    def generate_tag_report(self, prompt: str) -> str:
        system_prompt = "You are a behavioral financial analyst. Follow the user's tagging structure exactly. Do not use JSON."
        return self.chat_completion([
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt}
        ])

# Singleton instance
ai_service = AIService()
