import requests
import time
import json

key = "REPLACE_WITH_YOUR_OPENROUTER_API_KEY"

# 1. Fetch all free models
try:
    r = requests.get('https://openrouter.ai/api/v1/models')
    all_models = r.json().get('data', [])
    free_models = [m['id'] for m in all_models if ':free' in m['id']]
    print(f"Found {len(free_models)} free models.")
except Exception as e:
    print("Failed to fetch models:", e)
    free_models = [
        "google/gemini-2.0-flash-lite-preview-02-05:free",
        "google/gemini-2.0-pro-exp-02-05:free",
        "deepseek/deepseek-chat:free",
        "deepseek/deepseek-r1:free",
        "mistralai/mistral-nemo:free",
        "meta-llama/llama-3.3-70b-instruct:free",
        "nvidia/nemotron-4-340b-instruct:free",
        "qwen/qwen-2.5-72b-instruct:free"
    ]

# 2. Test a sample of known good/fast free models
test_models = [
    "google/gemini-2.0-pro-exp-02-05:free",
    "google/gemini-2.0-flash-lite-preview-02-05:free",
    "deepseek/deepseek-r1:free",
    "meta-llama/llama-3.3-70b-instruct:free",
    "qwen/qwen-2.5-72b-instruct:free",
    "google/gemma-4-26b-a4b-it:free",
    "nvidia/nemotron-3-nano-30b-a3b:free"
]

url = "https://openrouter.ai/api/v1/chat/completions"

for m in test_models:
    print(f"Testing {m}...")
    start = time.time()
    try:
        r = requests.post(
            url,
            headers={
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json",
            },
            json={
                "model": m,
                "messages": [{"role": "user", "content": "Say 'OK' and nothing else."}],
                "max_tokens": 10,
                "temperature": 0,
            },
            timeout=10,
        )
        elapsed = time.time() - start
        print(f"  [{elapsed:.2f}s] STATUS: {r.status_code}")
        if r.status_code == 200:
            print(f"  Response: {r.json()['choices'][0]['message']['content'].strip()}")
        else:
            print(f"  Error: {r.text[:200]}")
    except Exception as e:
        print(f"  Exception: {e}")
    print()
