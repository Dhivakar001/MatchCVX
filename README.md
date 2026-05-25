# 🎯 MatchCVX — Premium ATS Resume Optimizer

**An advanced, AI-powered ATS system that analyzes your resume against job descriptions, provides real-time scoring, and leverages elite AI models to automatically write high-impact resume improvements.**

![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)
![React](https://img.shields.io/badge/Frontend-React%20%7C%20Vite-blue?style=flat-square)
![FastAPI](https://img.shields.io/badge/Backend-FastAPI-teal?style=flat-square)

---

## ✨ Features

- **Real-Time ATS Scoring (0–100%)** — Advanced matching engine evaluating Skills (35%), Keywords (25%), Content (25%), and Formatting (15%).
- **AI-Powered Suggestions** — Leverages OpenRouter AI to deeply weave missing skills and exact JD terminology into your resume to guarantee a 90+ score.
- **One-Click Apply** — Accept AI suggestions and instantly see your score increase in real-time.
- **Premium Dashboard** — Breathtaking, world-class UI with glassmorphism, dynamic gradients, and smooth framer-motion animations.
- **PDF Export** — Make edits and securely download your polished resume directly as a PDF.

## 🏗️ Architecture

```text
MatchCVX/
├── frontend/                 # React + Vite Frontend
│   ├── src/
│   │   ├── ResumeBuilder.tsx # Main application UI
│   │   ├── index.css         # Premium design system and animations
│   │   └── api.ts            # Axios API client
├── backend/                  # FastAPI + Python Backend
│   ├── main.py               # API Endpoints & OpenRouter AI logic
│   ├── requirements.txt      # Python dependencies
│   └── .env                  # Secrets (API Keys)
├── core/                     # ATS Logic Engine
│   ├── analyzer.py           # Orchestration
│   └── matching_engine.py    # TF-IDF, SBERT, Formatting logic
└── data/
    └── skills_dataset.json   # Comprehensive 500+ tech skills dataset
```

---

## 🚀 Quick Start

### ⚠️ Prerequisites: Configure your AI
MatchCVX uses OpenRouter to access elite AI models (like Gemma and Llama) for free. **You must provide your own API key.**

1. Get a free API key from [OpenRouter.ai](https://openrouter.ai/)
2. Create a `.env` file inside the `backend/` directory:
   ```bash
   cd backend
   touch .env
   ```
3. Add your key to the `.env` file:
   ```env
   OPENROUTER_API_KEY=sk-or-v1-your-key-here...
   ```

### 1. Start the Backend (FastAPI)

Open a terminal and run:
```bash
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```
*Note: On the first run, the system will download the Sentence-BERT ML model (~80MB).*

### 2. Start the Frontend (React/Vite)

Open a new terminal and run:
```bash
cd frontend
npm install
npm run dev
```

### 3. Use the App
Navigate to `http://localhost:5173`. Upload your PDF resume, paste your target Job Description, and click **AI Optimize ✨** to skyrocket your ATS score!

---

**MatchCVX** — Built with ❤️ for job seekers to beat the bots.
