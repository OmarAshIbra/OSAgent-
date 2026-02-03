
import os
import requests
import json
from dotenv import load_dotenv

load_dotenv()

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/v1")
MODEL = os.getenv("OLLAMA_MODEL", "llama3.1")

print(f"Checking Ollama at {OLLAMA_BASE_URL} with model {MODEL}...")

try:
    # 1. Check if Ollama is running (health check or list models)
    # The OpenAI-compatible endpoint usually corresponds to /v1/chat/completions
    # But let's check the base Ollama API first to be sure
    base_url = OLLAMA_BASE_URL.replace("/v1", "")
    resp = requests.get(f"{base_url}/api/tags")
    if resp.status_code == 200:
        print("Ollama is reachable.")
        models = [m['name'] for m in resp.json()['models']]
        print(f"Available models: {models}")
        # Check for partial match (e.g. llama3.1:8b matching llama3.1)
        if any(MODEL in m for m in models):
             print(f"Model {MODEL} found!")
        else:
             print(f"WARNING: Model {MODEL} not found in list, but might be aliased.")
    else:
        print(f"Ollama reachable but returned {resp.status_code}")

    # 2. Test Generation using the OpenAI client used in main.py
    from openai import OpenAI
    
    client = OpenAI(
        base_url=OLLAMA_BASE_URL,
        api_key="ollama"
    )
    
    print("Testing generation...")
    response = client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "user", "content": "Say 'Ollama is working' and nothing else."}
        ]
    )
    print("Response:")
    print(response.choices[0].message.content)
    
except Exception as e:
    print(f"Error: {e}")
