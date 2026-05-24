import os
import sys
import io
import json
import difflib
import requests as http_requests
from contextlib import asynccontextmanager
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Dict, List, Any

# OpenRouter configuration
OPENROUTER_API_KEY = os.environ.get(
    "OPENROUTER_API_KEY",
    "REPLACE_WITH_YOUR_OPENROUTER_API_KEY"
)
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1/chat/completions"

# Model fallback chain — SPEED-OPTIMIZED ordering
# Fast small models first, large models as fallback
OPENROUTER_MODELS = [
    "google/gemma-4-26b-a4b-it:free",              # 26B, fast
    "nvidia/nemotron-3-nano-30b-a3b:free",          # 30B nano, fast
    "deepseek/deepseek-v4-flash:free",              # Fast flash variant
    "meta-llama/llama-3.3-70b-instruct:free",       # 70B fallback
    "nvidia/nemotron-3-super-120b-a12b:free",       # 120B last resort
]

# Add the parent directory to the path so we can import core
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.analyzer import Analyzer
from core.resume_parser import extract_text_from_pdf

# Global analyzer instance
analyzer = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup logic
    global analyzer
    print("Loading AI Models... This may take a moment on the first run.")
    analyzer = Analyzer()
    analyzer.preload()
    print("Models loaded successfully!")
    yield
    # Shutdown logic
    print("Shutting down...")

app = FastAPI(
    title="MatchCVX API",
    description="Smart ATS Resume Analyzer API",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS for the frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust this in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AnalysisResponse(BaseModel):
    ats_score: float
    score_label: str
    score_color: str
    resume_text: str
    resume_word_count: int
    jd_word_count: int
    matching_scores: Dict[str, float]
    skill_comparison: Dict[str, Any]
    suggestions: List[Dict[str, str]]

@app.post("/api/analyze", response_model=AnalysisResponse)
async def analyze_match(
    resume: UploadFile = File(...),
    jd_text: str = Form(...)
):
    """
    Endpoint to analyze a resume against a job description.
    """
    if not resume.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")
    
    if not jd_text or not jd_text.strip():
        raise HTTPException(status_code=400, detail="Job description is required.")
        
    try:
        resume_text = extract_text_from_pdf(resume.file)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse PDF: {str(e)}")
        
    try:
        result = analyzer.analyze(resume_text, jd_text)
        skill_comp = result.skill_comparison
        
        return AnalysisResponse(
            ats_score=result.ats_score,
            score_label=result.score_label,
            score_color=result.score_color,
            resume_text=resume_text,
            resume_word_count=result.resume_word_count,
            jd_word_count=result.jd_word_count,
            matching_scores=result.matching_scores.to_dict(),
            skill_comparison={
                "match_percentage": skill_comp.match_percentage,
                "category_scores": skill_comp.category_scores,
                "matched_skills": [{"name": s.name, "category": s.category} for s in skill_comp.matched_skills],
                "missing_skills": [{"name": s.name, "category": s.category} for s in skill_comp.missing_skills],
                "extra_skills": [{"name": s.name, "category": s.category} for s in skill_comp.extra_skills],
            },
            suggestions=result.suggestions
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@app.post("/api/re-analyze", response_model=AnalysisResponse)
async def re_analyze_text(
    resume_text: str = Form(...),
    jd_text: str = Form(...)
):
    """
    Re-analyze modified resume text against the same job description.
    Used by the Resume Builder to let users check their improved score
    before confirming and downloading.
    """
    if not resume_text or not resume_text.strip():
        raise HTTPException(status_code=400, detail="Resume text is required.")
    if not jd_text or not jd_text.strip():
        raise HTTPException(status_code=400, detail="Job description is required.")

    try:
        result = analyzer.analyze(resume_text.strip(), jd_text.strip())
        skill_comp = result.skill_comparison

        return AnalysisResponse(
            ats_score=result.ats_score,
            score_label=result.score_label,
            score_color=result.score_color,
            resume_text=resume_text.strip(),
            resume_word_count=result.resume_word_count,
            jd_word_count=result.jd_word_count,
            matching_scores=result.matching_scores.to_dict(),
            skill_comparison={
                "match_percentage": skill_comp.match_percentage,
                "category_scores": skill_comp.category_scores,
                "matched_skills": [{"name": s.name, "category": s.category} for s in skill_comp.matched_skills],
                "missing_skills": [{"name": s.name, "category": s.category} for s in skill_comp.missing_skills],
                "extra_skills": [{"name": s.name, "category": s.category} for s in skill_comp.extra_skills],
            },
            suggestions=result.suggestions
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Re-analysis failed: {str(e)}")


@app.post("/api/ai-suggestions")
async def get_ai_suggestions(
    resume_text: str = Form(...),
    jd_text: str = Form(...),
    ats_score: float = Form(0),
    matched_skills: str = Form(""),
    missing_skills: str = Form(""),
):
    """
    Uses OpenRouter LLM to generate high-quality, specific resume
    improvement suggestions with exact text rewrites.
    """
    if not OPENROUTER_API_KEY:
        raise HTTPException(status_code=500, detail="OpenRouter API key is not configured.")

    # Trim inputs to keep prompt fast
    r_text = resume_text.strip()[:3000]
    j_text = jd_text.strip()[:2000]

    prompt = f"""Optimize this resume for ATS. Return ONLY valid JSON.

RESUME:
{r_text}

JOB DESCRIPTION:
{j_text}

Score: {ats_score}/100 | Matched: {matched_skills or 'None'} | Missing: {missing_skills or 'None'}

Give 5-7 suggestions as JSON. Each must have exact text. Schema:
{{"suggestions":[{{"type":"rewrite|add_content|keyword","priority":"high|medium|low","title":"short title","description":"why it helps","original_text":"exact text to replace (empty for add_content)","improved_text":"new text","section":"experience|skills|summary|education|projects"}}]}}

For rewrite: original_text must match resume exactly. For add_content: original_text is empty string. Use strong action verbs and metrics."""

    last_error = None
    for model_id in OPENROUTER_MODELS:
      try:
        print(f"[AI] Trying model: {model_id}")
        response = http_requests.post(
            OPENROUTER_BASE_URL,
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
                "HTTP-Referer": "http://localhost:5173",
                "X-Title": "MatchCVX Resume Analyzer",
            },
            json={
                "model": model_id,
                "messages": [
                    {
                        "role": "system",
                        "content": "You are an expert ATS resume optimizer. Always respond with valid JSON only, no markdown code fences."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                "temperature": 0.3,
                "max_tokens": 2500,
            },
            timeout=18,  # Fail fast to try next model quickly
        )

        if response.status_code != 200:
            try:
                err_body = response.json()
                last_error = err_body.get("error", {}).get("message", response.text)
            except Exception:
                last_error = response.text[:500]
            print(f"[AI] Model {model_id} failed ({response.status_code}): {last_error}")
            continue  # Try next model

        data = response.json()
        content = data["choices"][0]["message"]["content"].strip()

        # Strip markdown code fences if the model wraps its response
        if content.startswith("```"):
            content = content.split("\n", 1)[-1]
        if content.endswith("```"):
            content = content.rsplit("```", 1)[0]
        content = content.strip()

        parsed = json.loads(content)
        suggestions = parsed.get("suggestions", [])

        # Validate and sanitize each suggestion
        valid_types = {"rewrite", "add_content", "keyword"}
        valid_priorities = {"high", "medium", "low"}
        cleaned = []
        for s in suggestions:
            cleaned.append({
                "type": s.get("type", "rewrite") if s.get("type") in valid_types else "rewrite",
                "priority": s.get("priority", "medium") if s.get("priority") in valid_priorities else "medium",
                "title": s.get("title", "Improvement")[:120],
                "description": s.get("description", "")[:500],
                "original_text": s.get("original_text", ""),
                "improved_text": s.get("improved_text", ""),
                "section": s.get("section", "general"),
            })

        return {"suggestions": cleaned, "model_used": model_id}

      except json.JSONDecodeError:
        last_error = f"Model {model_id} returned invalid JSON"
        print(f"[AI] {last_error}")
        continue  # Try next model
      except http_requests.Timeout:
        last_error = f"Model {model_id} timed out"
        print(f"[AI] {last_error}")
        continue  # Try next model
      except HTTPException:
        raise
      except Exception as e:
        last_error = str(e)
        print(f"[AI] Model {model_id} error: {last_error}")
        continue  # Try next model

    # All models failed
    raise HTTPException(status_code=502, detail=f"All AI models failed. Last error: {last_error}")


@app.post("/api/download-pdf")
async def download_modified_pdf(
    resume: UploadFile = File(...),
    original_text: str = Form(...),
    modified_text: str = Form(...)
):
    """
    Accepts the original PDF, the original extracted text, and the user's
    modified text. Applies text-level changes to the PDF while preserving
    layout, fonts, and design, then returns the modified PDF.
    """
    try:
        import fitz  # PyMuPDF
    except ImportError:
        raise HTTPException(status_code=500, detail="PyMuPDF is not installed on the server.")

    try:
        pdf_bytes = await resume.read()
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to open PDF: {str(e)}")

    try:
        # -----------------------------------------------------------
        # 1. Compute a line-level diff between original and modified
        # -----------------------------------------------------------
        orig_lines = original_text.splitlines()
        mod_lines = modified_text.splitlines()

        replacements: list[tuple[str, str]] = []
        matcher = difflib.SequenceMatcher(None, orig_lines, mod_lines)
        for tag, i1, i2, j1, j2 in matcher.get_opcodes():
            if tag == "replace":
                # Map each changed original line to its replacement
                old_block = orig_lines[i1:i2]
                new_block = mod_lines[j1:j2]
                # Pair them up; if counts differ, handle gracefully
                for k in range(max(len(old_block), len(new_block))):
                    old = old_block[k].strip() if k < len(old_block) else None
                    new = new_block[k].strip() if k < len(new_block) else None
                    if old and new and old != new:
                        replacements.append((old, new))
            elif tag == "insert":
                # New lines that don't exist in the original PDF text.
                # We'll append them at the bottom of the last page.
                new_block = "\n".join(l.strip() for l in mod_lines[j1:j2] if l.strip())
                if new_block:
                    replacements.append(("__APPEND__", new_block))

        # -----------------------------------------------------------
        # 2. Apply replacements to the PDF
        # -----------------------------------------------------------
        for old_text, new_text in replacements:
            if old_text == "__APPEND__":
                # Append new content to the bottom of the last page
                last_page = doc[-1]
                rect = last_page.rect
                # Find the lowest existing text block to position below it
                blocks = last_page.get_text("dict")["blocks"]
                max_y = 0
                for block in blocks:
                    if "lines" in block:
                        for line in block["lines"]:
                            for span in line["spans"]:
                                max_y = max(max_y, span["bbox"][3])
                insert_y = min(max_y + 18, rect.height - 36)
                last_page.insert_text(
                    fitz.Point(rect.x0 + 36, insert_y),
                    new_text,
                    fontsize=10,
                    fontname="helv",
                    color=(0.15, 0.15, 0.15),
                )
                continue

            # For each page, search for the old text and replace it
            for page in doc:
                found_areas = page.search_for(old_text)
                if not found_areas:
                    continue

                for area in found_areas:
                    # Detect the font properties of existing text at this location
                    fontsize = 10
                    fontname = "helv"
                    color = (0.15, 0.15, 0.15)

                    # Try to extract font info from the text blocks at this area
                    blocks = page.get_text("dict")["blocks"]
                    for block in blocks:
                        if "lines" not in block:
                            continue
                        for line in block["lines"]:
                            for span in line["spans"]:
                                span_rect = fitz.Rect(span["bbox"])
                                if span_rect.intersects(area):
                                    fontsize = span["size"]
                                    # Use a standard font that PyMuPDF can embed
                                    fontname = "helv"
                                    rgb = span.get("color", 0)
                                    if isinstance(rgb, int):
                                        r = ((rgb >> 16) & 0xFF) / 255
                                        g = ((rgb >> 8) & 0xFF) / 255
                                        b = (rgb & 0xFF) / 255
                                        color = (r, g, b)
                                    break

                    # Redact the old text (white it out)
                    page.add_redact_annot(area, fill=(1, 1, 1))

                page.apply_redactions()

                # Now write the new text at the same positions
                found_areas_new = page.search_for(old_text)
                # Since we redacted, the old text is gone. Use the original area.
                for area in found_areas:
                    page.insert_text(
                        fitz.Point(area.x0, area.y1 - 2),
                        new_text,
                        fontsize=fontsize,
                        fontname=fontname,
                        color=color,
                    )
                break  # Only replace on the first page found

        # -----------------------------------------------------------
        # 3. Return the modified PDF
        # -----------------------------------------------------------
        output = io.BytesIO()
        doc.save(output)
        doc.close()
        output.seek(0)

        return StreamingResponse(
            output,
            media_type="application/pdf",
            headers={
                "Content-Disposition": "attachment; filename=resume_improved.pdf"
            }
        )

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"PDF modification failed: {str(e)}")


@app.get("/api/health")
async def health_check():
    """Health check endpoint to verify backend and models are ready."""
    return {"status": "ok", "models_loaded": analyzer is not None}
