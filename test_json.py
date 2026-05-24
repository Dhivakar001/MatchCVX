import requests
import json

key = "REPLACE_WITH_YOUR_OPENROUTER_API_KEY"
url = "https://openrouter.ai/api/v1/chat/completions"

prompt = """Optimize this resume for ATS. Return ONLY valid JSON.
RESUME: Software Engineer with 5 years of experience. Python, Java, C++. Worked at Google.
JOB DESCRIPTION: We need a Senior Software Engineer with Python and AWS experience.
Score: 60/100 | Matched: Python | Missing: AWS
Give 5-7 suggestions as JSON. Each must have exact text. Schema:
{"suggestions":[{"type":"rewrite|add_content|keyword","priority":"high|medium|low","title":"short title","description":"why it helps","original_text":"exact text to replace (empty for add_content)","improved_text":"new text","section":"experience|skills|summary|education|projects"}]}
"""

models = [
    "openai/gpt-oss-20b:free",
    "z-ai/glm-4.5-air:free",
    "google/gemma-4-26b-a4b-it:free"
]

for m in models:
    try:
        r = requests.post(
            url,
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            json={"model": m, "messages": [{"role": "user", "content": prompt}], "max_tokens": 1000, "temperature": 0.3},
            timeout=30,
        )
        if r.status_code == 200:
            content = r.json()['choices'][0]['message'].get('content')
            if content:
                print(f"{m} SUCCESS. Length: {len(content)}")
                try:
                    c = content.replace("```json", "").replace("```", "").strip()
                    json.loads(c)
                    print("JSON OK!")
                except Exception as e:
                    print(f"JSON Error: {e}")
            else:
                print(f"{m} SUCCESS but empty content.")
        else:
            print(f"{m} ERROR: {r.status_code}")
    except Exception as e:
        print(f"{m} EXCEPTION: {e}")
