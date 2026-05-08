import os
import re
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

class AIService:
    def __init__(self):
        self.client = Groq(api_key=os.getenv("GROQ_API_KEY", ""))
        self.model = "llama-3.3-70b-versatile"

    def chat_completion(self, messages: list[dict]) -> str:
        completion = self.client.chat.completions.create(
            messages=messages,
            model=self.model,
        )
        return completion.choices[0].message.content

    def nl_to_sql(self, schema: str, question: str) -> str:
        system_prompt = "You are a SQL expert. Output ONLY valid SQL code starting with SELECT. Do not include any conversational text, explanations, or markdown."
        sql_prompt = f"Schema:\n{schema}\n\nUser: {question}\n\nSQL (SQLite, device_id = ?):"
        
        content = self.chat_completion([
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": sql_prompt}
        ])
        
        match = re.search(r"(SELECT[\s\S]*?(?:;|(?=\n|$)))", content, re.IGNORECASE)
        return match.group(0) if match else ""

    def generate_report(self, prompt: str) -> str:
        system_prompt = "You are a financial analysis engine. Return ONLY a valid JSON object. Do not include conversational filler, markdown, or explanations."
        content = self.chat_completion([
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt}
        ])
        # Find the first { and the last }
        match = re.search(r"\{[\s\S]*\}", content)
        json_str = match.group(0) if match else content
        return re.sub(r"```(?:json)?", "", json_str).strip().rstrip("`").strip()

# Singleton instance
ai_service = AIService()
