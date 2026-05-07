import google.generativeai as genai
import os

api_key = "AIzaSyCI6Wu4z7cyPJKzvenUdQV_NyXnLsr7tmg"

try:
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel('gemini-2.0-flash')
    response = model.generate_content("Hello, can you hear me?")
    print("Success! Response:", response.text)
except Exception as e:
    print("Error:", str(e))
