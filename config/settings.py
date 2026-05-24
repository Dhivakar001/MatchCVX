"""
MatchCVX - Application Settings & Constants
Central configuration for all modules.
"""

import os

# ============================================
# APPLICATION INFO
# ============================================
APP_NAME = "MatchCVX"
APP_VERSION = "1.0.0"
APP_DESCRIPTION = "Smart ATS Resume Analyzer — AI-Powered Career Intelligence"
APP_ICON = "🎯"

# ============================================
# FILE PROCESSING
# ============================================
MAX_FILE_SIZE_MB = 10
SUPPORTED_FILE_TYPES = ["pdf"]

# ============================================
# PATHS
# ============================================
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
SKILLS_DATASET_PATH = os.path.join(DATA_DIR, "skills_dataset.json")

# ============================================
# MATCHING ENGINE WEIGHTS
# ============================================
# These weights determine how much each signal contributes to the final ATS score.
# They should sum to 1.0
SCORE_WEIGHTS = {
    "skill": 0.40,    # Skill matching score (most important for ATS)
    "tfidf": 0.30,    # TF-IDF keyword similarity
    "sbert": 0.30     # Sentence-BERT semantic similarity
}

# ============================================
# SENTENCE-BERT MODEL
# ============================================
# Lightweight model (~80MB) with good accuracy for semantic similarity
SBERT_MODEL_NAME = "all-MiniLM-L6-v2"

# ============================================
# TF-IDF SETTINGS
# ============================================
TFIDF_MAX_FEATURES = 5000
TFIDF_NGRAM_RANGE = (1, 2)   # Unigrams and bigrams

# ============================================
# SCORE INTERPRETATION THRESHOLDS
# ============================================
SCORE_THRESHOLDS = {
    "excellent": 85,    # Green - Excellent Match
    "strong": 70,       # Light green - Strong Match
    "good": 55,         # Yellow - Good Match
    "fair": 40,         # Orange - Fair Match
    "weak": 25,         # Red - Weak Match
    # Below 25 = Poor Match (Dark red)
}
