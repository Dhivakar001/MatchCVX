"""
MatchCVX - AI Matching Engine
Computes similarity scores between resume and job description
using TF-IDF (baseline) and Sentence-BERT (advanced).
"""

import numpy as np
from typing import Dict, Optional, Tuple
from dataclasses import dataclass
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


@dataclass
class MatchingScores:
    """Container for all matching scores."""
    tfidf_score: float = 0.0
    sbert_score: float = 0.0
    skill_score: float = 0.0
    combined_score: float = 0.0
    
    def to_dict(self) -> dict:
        return {
            'tfidf_score': round(self.tfidf_score, 4),
            'sbert_score': round(self.sbert_score, 4),
            'skill_score': round(self.skill_score, 4),
            'combined_score': round(self.combined_score, 4)
        }


class MatchingEngine:
    """
    AI-powered matching engine that computes similarity between
    resume and job description using multiple approaches.
    """
    
    # Default score weights
    DEFAULT_WEIGHTS = {
        'skill': 0.40,   # Skill match weight (most important for ATS)
        'tfidf': 0.30,   # TF-IDF cosine similarity weight
        'sbert': 0.30    # Sentence-BERT semantic similarity weight
    }
    
    def __init__(self, weights: Optional[Dict[str, float]] = None):
        """
        Initialize the matching engine.
        
        Args:
            weights: Custom weights for score combination.
                     Keys: 'skill', 'tfidf', 'sbert'. Values should sum to 1.0.
        """
        self.weights = weights or self.DEFAULT_WEIGHTS
        self._sbert_model = None  # Lazy-loaded
    
    def compute_tfidf_score(self, resume_text: str, jd_text: str) -> float:
        """
        Compute TF-IDF cosine similarity between resume and JD.
        
        Uses n-gram range (1,2) to capture phrase-level matching
        and sublinear TF for better term frequency normalization.
        
        Args:
            resume_text: Preprocessed resume text
            jd_text: Preprocessed job description text
        
        Returns:
            Cosine similarity score between 0.0 and 1.0
        """
        if not resume_text.strip() or not jd_text.strip():
            return 0.0
        
        try:
            vectorizer = TfidfVectorizer(
                ngram_range=(1, 2),       # Unigrams and bigrams
                max_features=5000,         # Limit feature space
                stop_words='english',      # Remove English stopwords
                sublinear_tf=True,         # Apply log normalization
                min_df=1,                  # Include all terms
                smooth_idf=True            # Prevent division by zero
            )
            
            # Fit and transform both texts
            tfidf_matrix = vectorizer.fit_transform([jd_text, resume_text])
            
            # Compute cosine similarity between JD (index 0) and Resume (index 1)
            score = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])[0][0]
            
            # Ensure score is in valid range
            return float(np.clip(score, 0.0, 1.0))
            
        except Exception as e:
            print(f"TF-IDF computation error: {e}")
            return 0.0
    
    def compute_sbert_score(self, resume_text: str, jd_text: str) -> float:
        """
        Compute Sentence-BERT semantic similarity between resume and JD.
        
        Uses 'all-MiniLM-L6-v2' model for encoding. Handles long texts
        by chunking and averaging embeddings.
        
        Args:
            resume_text: Resume text
            jd_text: Job description text
        
        Returns:
            Semantic similarity score between 0.0 and 1.0
        """
        if not resume_text.strip() or not jd_text.strip():
            return 0.0
        
        try:
            model = self._get_sbert_model()
            
            # Chunk long texts to handle model's token limit
            resume_chunks = self._chunk_text(resume_text, max_chars=1000)
            jd_chunks = self._chunk_text(jd_text, max_chars=1000)
            
            # Encode all chunks
            resume_embeddings = model.encode(resume_chunks, show_progress_bar=False)
            jd_embeddings = model.encode(jd_chunks, show_progress_bar=False)
            
            # Average embeddings for each document
            resume_embedding = np.mean(resume_embeddings, axis=0, keepdims=True)
            jd_embedding = np.mean(jd_embeddings, axis=0, keepdims=True)
            
            # Compute cosine similarity
            score = cosine_similarity(resume_embedding, jd_embedding)[0][0]
            
            # Ensure score is in valid range
            return float(np.clip(score, 0.0, 1.0))
            
        except ImportError:
            print("Warning: sentence-transformers not installed. SBERT score = 0.")
            return 0.0
        except Exception as e:
            print(f"SBERT computation error: {e}")
            return 0.0
    
    def _get_sbert_model(self):
        """
        Lazy-load the Sentence-BERT model.
        Caches the model instance for reuse.
        """
        if self._sbert_model is None:
            from sentence_transformers import SentenceTransformer
            self._sbert_model = SentenceTransformer('all-MiniLM-L6-v2')
        return self._sbert_model
    
    def preload_model(self):
        """Force load the model into memory. Useful for app startup."""
        self._get_sbert_model()
    
    def _chunk_text(self, text: str, max_chars: int = 1000) -> list:
        """
        Split text into chunks for processing by the SBERT model.
        Splits on sentence boundaries when possible.
        
        Args:
            text: Input text
            max_chars: Maximum characters per chunk
        
        Returns:
            List of text chunks
        """
        if len(text) <= max_chars:
            return [text]
        
        # Try to split on sentence boundaries
        import re
        sentences = re.split(r'(?<=[.!?])\s+', text)
        
        chunks = []
        current_chunk = ""
        
        for sentence in sentences:
            if len(current_chunk) + len(sentence) <= max_chars:
                current_chunk += " " + sentence if current_chunk else sentence
            else:
                if current_chunk:
                    chunks.append(current_chunk.strip())
                current_chunk = sentence
        
        if current_chunk:
            chunks.append(current_chunk.strip())
        
        # If no chunks were created (e.g., one very long sentence)
        if not chunks:
            # Force split by character count
            for i in range(0, len(text), max_chars):
                chunks.append(text[i:i + max_chars])
        
        return chunks
    
    def compute_combined_score(
        self,
        resume_text: str,
        jd_text: str,
        skill_match_percentage: float
    ) -> MatchingScores:
        """
        Compute the final combined ATS match score.
        
        Combines three signals:
        - Skill match score (from skill extractor)
        - TF-IDF cosine similarity (keyword matching)
        - Sentence-BERT semantic similarity (meaning matching)
        
        Args:
            resume_text: Preprocessed resume text
            jd_text: Preprocessed job description text
            skill_match_percentage: Skill match percentage from SkillExtractor (0-100)
        
        Returns:
            MatchingScores with all individual and combined scores
        """
        # Normalize skill score to 0-1 range
        skill_score = skill_match_percentage / 100.0
        
        # Compute individual scores
        tfidf_score = self.compute_tfidf_score(resume_text, jd_text)
        sbert_score = self.compute_sbert_score(resume_text, jd_text)
        
        # Weighted combination
        combined = (
            self.weights['skill'] * skill_score +
            self.weights['tfidf'] * tfidf_score +
            self.weights['sbert'] * sbert_score
        )
        
        # Clamp to valid range
        combined = float(np.clip(combined, 0.0, 1.0))
        
        return MatchingScores(
            tfidf_score=tfidf_score,
            sbert_score=sbert_score,
            skill_score=skill_score,
            combined_score=combined
        )
