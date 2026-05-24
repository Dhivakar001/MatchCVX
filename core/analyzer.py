"""
MatchCVX - Analysis Orchestrator Module
Coordinates the full analysis pipeline and generates
actionable improvement suggestions.
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional

from .resume_parser import extract_text_from_pdf
from .text_preprocessor import preprocess_pipeline, extract_sections
from .skill_extractor import SkillExtractor, SkillComparisonResult, SkillMatch
from .matching_engine import MatchingEngine, MatchingScores


@dataclass
class AnalysisResult:
    """Complete analysis result container."""
    # Core scores
    ats_score: float = 0.0  # Final ATS score (0-100)
    matching_scores: Optional[MatchingScores] = None
    
    # Skill analysis
    skill_comparison: Optional[SkillComparisonResult] = None
    
    # Text data
    resume_text: str = ""
    jd_text: str = ""
    
    # Suggestions
    suggestions: List[Dict[str, str]] = field(default_factory=list)
    
    # Score interpretation
    score_label: str = ""
    score_color: str = ""
    
    # Metadata
    resume_word_count: int = 0
    jd_word_count: int = 0


class Analyzer:
    """
    Main analysis orchestrator that runs the complete ATS analysis pipeline.
    """
    
    def __init__(self, skills_dataset_path: Optional[str] = None):
        """
        Initialize the analyzer with all required engines.
        
        Args:
            skills_dataset_path: Optional custom path to skills dataset JSON
        """
        self.skill_extractor = SkillExtractor(skills_dataset_path)
        self.matching_engine = MatchingEngine()
    
    def preload(self):
        """Preloads the heavy ML models into memory to prevent request hangs."""
        self.matching_engine.preload_model()
    
    def analyze(self, resume_text: str, jd_text: str) -> AnalysisResult:
        """
        Run the complete ATS analysis pipeline.
        
        Pipeline steps:
        1. Preprocess both texts
        2. Extract and compare skills
        3. Compute TF-IDF and SBERT similarity
        4. Calculate combined ATS score
        5. Generate improvement suggestions
        
        Args:
            resume_text: Raw resume text
            jd_text: Raw job description text
        
        Returns:
            AnalysisResult with all analysis outputs
        """
        # Step 1: Preprocess texts for matching
        processed_resume = preprocess_pipeline(resume_text)
        processed_jd = preprocess_pipeline(jd_text)
        
        # Step 2: Extract and compare skills (use raw text for better matching)
        skill_comparison = self.skill_extractor.compare_skills(
            resume_text, jd_text
        )
        
        # Step 3 & 4: Compute combined matching scores
        matching_scores = self.matching_engine.compute_combined_score(
            processed_resume,
            processed_jd,
            skill_comparison.match_percentage
        )
        
        # Calculate final ATS score (0-100)
        ats_score = round(matching_scores.combined_score * 100, 1)
        
        # Step 5: Generate suggestions
        suggestions = self._generate_suggestions(
            skill_comparison, matching_scores, ats_score, resume_text
        )
        
        # Get score interpretation
        score_label, score_color = self._interpret_score(ats_score)
        
        return AnalysisResult(
            ats_score=ats_score,
            matching_scores=matching_scores,
            skill_comparison=skill_comparison,
            resume_text=resume_text,
            jd_text=jd_text,
            suggestions=suggestions,
            score_label=score_label,
            score_color=score_color,
            resume_word_count=len(resume_text.split()),
            jd_word_count=len(jd_text.split())
        )
    
    def _generate_suggestions(
        self,
        skill_comparison: SkillComparisonResult,
        matching_scores: MatchingScores,
        ats_score: float,
        resume_text: str
    ) -> List[Dict[str, str]]:
        """
        Generate actionable improvement suggestions based on analysis.
        
        Args:
            skill_comparison: Skill comparison results
            matching_scores: Matching score breakdown
            ats_score: Final ATS score
            resume_text: Original resume text
        
        Returns:
            List of suggestion dictionaries with 'category', 'priority',
            'title', and 'description' keys
        """
        suggestions = []
        
        # --- Skill-based suggestions ---
        missing_skills = skill_comparison.missing_skills
        
        if missing_skills:
            # Group missing skills by category
            missing_by_category = {}
            for skill in missing_skills:
                cat = skill.category
                if cat not in missing_by_category:
                    missing_by_category[cat] = []
                missing_by_category[cat].append(skill.name)
            
            # High-priority missing skills (weight >= 1.0)
            critical_missing = [s for s in missing_skills if s.weight >= 1.0]
            
            if critical_missing:
                skill_names = ', '.join([s.name for s in critical_missing[:8]])
                suggestions.append({
                    'category': 'Skills',
                    'priority': 'high',
                    'title': '🔴 Add Critical Missing Skills',
                    'description': (
                        f'Your resume is missing these key skills from the job description: '
                        f'**{skill_names}**. Adding these skills (with supporting experience) '
                        f'could significantly improve your ATS score.'
                    )
                })
            
            # Category-specific suggestions
            for cat, skills in missing_by_category.items():
                if len(skills) >= 2:
                    skill_list = ', '.join(skills[:5])
                    suggestions.append({
                        'category': 'Skills',
                        'priority': 'medium',
                        'title': f'📋 Strengthen {cat} Skills',
                        'description': (
                            f'The job requires these {cat} skills that are missing '
                            f'from your resume: **{skill_list}**. Consider adding relevant '
                            f'experience, projects, or certifications in this area.'
                        )
                    })
        
        # --- Keyword optimization suggestions ---
        if matching_scores.tfidf_score < 0.3:
            suggestions.append({
                'category': 'Keywords',
                'priority': 'high',
                'title': '🔑 Improve Keyword Alignment',
                'description': (
                    'Your resume has low keyword overlap with the job description. '
                    'Mirror the exact terminology used in the JD. For example, if the JD says '
                    '"project management," use that exact phrase instead of alternatives like '
                    '"managed projects."'
                )
            })
        elif matching_scores.tfidf_score < 0.5:
            suggestions.append({
                'category': 'Keywords',
                'priority': 'medium',
                'title': '🔑 Optimize Keywords Further',
                'description': (
                    'Your keyword alignment is moderate. Review the job description '
                    'for specific phrases and incorporate them naturally into your '
                    'experience descriptions and skills section.'
                )
            })
        
        # --- Semantic content suggestions ---
        if matching_scores.sbert_score < 0.4:
            suggestions.append({
                'category': 'Content',
                'priority': 'high',
                'title': '📝 Align Resume Content with Job Requirements',
                'description': (
                    'The overall content of your resume doesn\'t strongly align with '
                    'this job description. Consider restructuring your experience bullets '
                    'to emphasize responsibilities and achievements that directly relate '
                    'to what this role requires.'
                )
            })
        
        # --- Resume length suggestions ---
        word_count = len(resume_text.split())
        if word_count < 200:
            suggestions.append({
                'category': 'Format',
                'priority': 'medium',
                'title': '📏 Resume Too Short',
                'description': (
                    f'Your resume contains only ~{word_count} words. Most effective '
                    f'resumes contain 400-800 words. Add more details about your '
                    f'experience, achievements, and technical projects.'
                )
            })
        elif word_count > 1500:
            suggestions.append({
                'category': 'Format',
                'priority': 'low',
                'title': '📏 Consider Condensing Resume',
                'description': (
                    f'Your resume is quite long (~{word_count} words). Consider focusing '
                    f'on the most relevant experience for this specific role. '
                    f'ATS systems may deprioritize less relevant content.'
                )
            })
        
        # --- Overall score-based suggestions ---
        if ats_score >= 75:
            suggestions.append({
                'category': 'Overall',
                'priority': 'low',
                'title': '✅ Strong Match',
                'description': (
                    'Your resume is a strong match for this position! '
                    'Focus on fine-tuning your cover letter and preparing '
                    'for interviews based on the matched skills and requirements.'
                )
            })
        elif ats_score >= 50:
            suggestions.append({
                'category': 'Overall',
                'priority': 'medium',
                'title': '⚡ Good Foundation, Room for Improvement',
                'description': (
                    'Your resume has a reasonable match with this job. '
                    'Addressing the missing skills and keyword gaps above '
                    'could push your score significantly higher.'
                )
            })
        else:
            suggestions.append({
                'category': 'Overall',
                'priority': 'high',
                'title': '🎯 Significant Customization Needed',
                'description': (
                    'This resume needs substantial tailoring for this specific role. '
                    'Focus on adding the missing skills, matching the job\'s terminology, '
                    'and restructuring your experience to highlight relevant accomplishments.'
                )
            })
        
        # Sort by priority
        priority_order = {'high': 0, 'medium': 1, 'low': 2}
        suggestions.sort(key=lambda x: priority_order.get(x['priority'], 3))
        
        return suggestions
    
    def _interpret_score(self, score: float) -> tuple:
        """
        Interpret the ATS score into a human-readable label and color.
        
        Args:
            score: ATS score (0-100)
        
        Returns:
            Tuple of (label_string, hex_color)
        """
        if score >= 85:
            return "Excellent Match", "#10B981"  # Green
        elif score >= 70:
            return "Strong Match", "#34D399"     # Light green
        elif score >= 55:
            return "Good Match", "#FBBF24"       # Yellow
        elif score >= 40:
            return "Fair Match", "#F97316"       # Orange
        elif score >= 25:
            return "Weak Match", "#EF4444"       # Red
        else:
            return "Poor Match", "#DC2626"       # Dark red
