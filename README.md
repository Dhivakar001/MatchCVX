# 🎯 MatchCVX — Smart ATS Resume Analyzer

**AI-Powered ATS system that compares your resume with job descriptions and provides actionable insights.**

![Python](https://img.shields.io/badge/Python-3.9+-blue?style=flat-square&logo=python)
![Streamlit](https://img.shields.io/badge/Streamlit-1.30+-red?style=flat-square&logo=streamlit)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

---

## ✨ Features

- **ATS Match Score (0–100%)** — Combined AI scoring using skill matching, TF-IDF, and Sentence-BERT
- **Skill Matching Analysis** — Identifies matched, missing, and extra skills using a 500+ skill dataset
- **Category Breakdown** — Visual radar chart showing match rates across skill categories
- **AI Suggestions** — Actionable improvement recommendations prioritized by impact
- **Premium Dashboard** — Dark-themed SaaS-quality UI with glassmorphism effects

## 🏗️ Architecture

```
MatchCVX/
├── app.py                    # Main Streamlit application
├── requirements.txt          # Python dependencies
├── .streamlit/config.toml    # Theme configuration
├── config/settings.py        # Application settings
├── data/skills_dataset.json  # 500+ industry skills dataset
├── core/
│   ├── resume_parser.py      # PDF text extraction
│   ├── text_preprocessor.py  # Text cleaning & tokenization
│   ├── skill_extractor.py    # Rule-based skill matching
│   ├── matching_engine.py    # TF-IDF + Sentence-BERT
│   └── analyzer.py           # Analysis orchestrator
├── ui/
│   ├── styles.py             # Custom CSS styling
│   ├── components.py         # UI components
│   └── charts.py             # Plotly visualizations
└── utils/helpers.py          # Utility functions
```

## 🚀 Quick Start

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Run the Application

```bash
streamlit run app.py
```

### 3. Use the App

1. **Upload** your resume (PDF)
2. **Paste** the job description
3. **Click** "Analyze Match"
4. **Review** your ATS score, matched/missing skills, and suggestions

## ⚙️ Scoring Method

The ATS score is a weighted combination of three signals:

| Signal | Weight | Description |
|--------|--------|-------------|
| Skill Match | 40% | Skills found in both resume and JD |
| TF-IDF Similarity | 30% | Keyword overlap analysis |
| Sentence-BERT | 30% | Semantic meaning similarity |

## 📊 Skills Dataset

The built-in dataset covers **500+ skills** across **15 categories**:
- Programming Languages, AI/ML, Data Science, Data Engineering
- Web Frontend & Backend, Databases, Cloud & Infrastructure
- DevOps, Version Control, Software Engineering, Testing
- Cybersecurity, Mobile Development, Project Management, Soft Skills

You can extend or replace the dataset by editing `data/skills_dataset.json`.

## 🛠️ Tech Stack

- **UI**: Streamlit + Custom CSS
- **PDF Processing**: pdfplumber
- **ML**: scikit-learn (TF-IDF), sentence-transformers (SBERT)
- **Visualization**: Plotly
- **Model**: all-MiniLM-L6-v2

---

**MatchCVX v1.0.0** — Built with ❤️ for job seekers
