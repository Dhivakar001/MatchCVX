"""
MatchCVX - Skill Extractor Module
Extracts and matches skills from text using the custom skills dataset.
Uses rule-based matching with support for aliases and multi-word phrases.
"""

import json
import re
import os
from typing import Dict, List, Set, Tuple, Optional
from dataclasses import dataclass, field


@dataclass
class SkillMatch:
    """Represents a matched skill with metadata."""
    name: str
    category: str
    weight: float = 1.0
    matched_via: str = "exact"  # exact, alias, or fuzzy


@dataclass
class SkillComparisonResult:
    """Result of comparing skills between resume and job description."""
    matched_skills: List[SkillMatch] = field(default_factory=list)
    missing_skills: List[SkillMatch] = field(default_factory=list)
    extra_skills: List[SkillMatch] = field(default_factory=list)
    resume_skills: List[SkillMatch] = field(default_factory=list)
    jd_skills: List[SkillMatch] = field(default_factory=list)
    match_percentage: float = 0.0
    category_scores: Dict[str, float] = field(default_factory=dict)


class SkillExtractor:
    """
    Extracts skills from text using a comprehensive skills dataset.
    Supports exact matching, alias matching, and multi-word phrases.
    """
    
    def __init__(self, dataset_path: Optional[str] = None):
        """
        Initialize the skill extractor with a skills dataset.
        
        Args:
            dataset_path: Path to skills JSON file. If None, uses default dataset.
        """
        if dataset_path is None:
            # Default to the built-in dataset
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            dataset_path = os.path.join(base_dir, 'data', 'skills_dataset.json')
        
        self.dataset = self._load_dataset(dataset_path)
        self.skill_index = self._build_skill_index()
    
    def _load_dataset(self, path: str) -> dict:
        """
        Load the skills dataset from a JSON file.
        
        Args:
            path: Path to the JSON dataset file
        
        Returns:
            Parsed dataset dictionary
        """
        try:
            with open(path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except FileNotFoundError:
            print(f"Warning: Skills dataset not found at {path}. Using empty dataset.")
            return {"categories": {}}
        except json.JSONDecodeError as e:
            print(f"Warning: Invalid JSON in skills dataset: {e}. Using empty dataset.")
            return {"categories": {}}
    
    def _build_skill_index(self) -> Dict[str, dict]:
        """
        Build a fast lookup index mapping lowercase skill names and
        aliases to their full skill info.
        
        Returns:
            Dictionary mapping lowercase terms to skill metadata
        """
        index = {}
        
        for category_name, category_data in self.dataset.get('categories', {}).items():
            skills = category_data.get('skills', [])
            
            for skill in skills:
                skill_name = skill.get('name', '')
                aliases = skill.get('aliases', [])
                weight = skill.get('weight', 1.0)
                
                # Create skill info dict
                skill_info = {
                    'name': skill_name,
                    'category': category_name,
                    'weight': weight,
                    'aliases': aliases
                }
                
                # Index by primary name (lowercase)
                name_lower = skill_name.lower().strip()
                if name_lower:
                    index[name_lower] = skill_info
                
                # Index by all aliases (lowercase)
                for alias in aliases:
                    alias_lower = alias.lower().strip()
                    if alias_lower and alias_lower not in index:
                        index[alias_lower] = skill_info
        
        return index
    
    def extract_skills(self, text: str) -> List[SkillMatch]:
        """
        Extract all recognized skills from the given text.
        
        Uses multi-pass matching:
        1. Multi-word phrases first (longest match)
        2. Single-word matches
        3. Abbreviation/alias matches
        
        Args:
            text: Input text (resume or job description)
        
        Returns:
            List of SkillMatch objects found in the text
        """
        if not text:
            return []
        
        text_lower = text.lower()
        found_skills = {}  # Use dict to deduplicate by canonical name
        
        # Sort skills by length (longest first) to prioritize multi-word matches
        sorted_terms = sorted(self.skill_index.keys(), key=len, reverse=True)
        
        for term in sorted_terms:
            skill_info = self.skill_index[term]
            canonical_name = skill_info['name']
            
            # Skip if we already found this skill
            if canonical_name.lower() in found_skills:
                continue
            
            # Build regex pattern for matching
            # Handle special characters in skill names (C++, C#, .NET, etc.)
            escaped_term = re.escape(term)
            
            # Use word boundaries, but handle special chars at boundaries
            # For terms with special chars (C++, C#), use lookaround assertions
            if re.search(r'[^a-z0-9]', term):
                pattern = r'(?:^|\s|[,;(])' + escaped_term + r'(?:$|\s|[,;).:])'
            else:
                pattern = r'\b' + escaped_term + r'\b'
            
            if re.search(pattern, text_lower):
                match_type = "exact" if term == canonical_name.lower() else "alias"
                found_skills[canonical_name.lower()] = SkillMatch(
                    name=canonical_name,
                    category=skill_info['category'],
                    weight=skill_info['weight'],
                    matched_via=match_type
                )
        
        return list(found_skills.values())
    
    def compare_skills(
        self,
        resume_text: str,
        jd_text: str
    ) -> SkillComparisonResult:
        """
        Compare skills found in resume vs job description.
        
        Args:
            resume_text: Resume text content
            jd_text: Job description text content
        
        Returns:
            SkillComparisonResult with matched, missing, and extra skills
        """
        resume_skills = self.extract_skills(resume_text)
        jd_skills = self.extract_skills(jd_text)
        
        # Create sets of canonical skill names for comparison
        resume_skill_names = {s.name.lower() for s in resume_skills}
        jd_skill_names = {s.name.lower() for s in jd_skills}
        
        # Find matches, missing, and extra
        matched_names = resume_skill_names & jd_skill_names
        missing_names = jd_skill_names - resume_skill_names
        extra_names = resume_skill_names - jd_skill_names
        
        # Build result lists with full skill info
        matched = [s for s in jd_skills if s.name.lower() in matched_names]
        missing = [s for s in jd_skills if s.name.lower() in missing_names]
        extra = [s for s in resume_skills if s.name.lower() in extra_names]
        
        # Calculate match percentage (weighted)
        if jd_skills:
            total_weight = sum(s.weight for s in jd_skills)
            matched_weight = sum(s.weight for s in matched)
            match_percentage = (matched_weight / total_weight) * 100 if total_weight > 0 else 0
        else:
            match_percentage = 100.0 if resume_skills else 0.0
        
        # Calculate per-category scores
        category_scores = self._calculate_category_scores(matched, missing, jd_skills)
        
        return SkillComparisonResult(
            matched_skills=matched,
            missing_skills=missing,
            extra_skills=extra,
            resume_skills=resume_skills,
            jd_skills=jd_skills,
            match_percentage=round(match_percentage, 1),
            category_scores=category_scores
        )
    
    def _calculate_category_scores(
        self,
        matched: List[SkillMatch],
        missing: List[SkillMatch],
        jd_skills: List[SkillMatch]
    ) -> Dict[str, float]:
        """
        Calculate match scores per skill category.
        
        Args:
            matched: List of matched skills
            missing: List of missing skills
            jd_skills: All skills from job description
        
        Returns:
            Dictionary mapping category names to match percentages
        """
        category_totals = {}
        category_matched = {}
        
        for skill in jd_skills:
            cat = skill.category
            category_totals[cat] = category_totals.get(cat, 0) + 1
        
        for skill in matched:
            cat = skill.category
            category_matched[cat] = category_matched.get(cat, 0) + 1
        
        scores = {}
        for cat, total in category_totals.items():
            matched_count = category_matched.get(cat, 0)
            scores[cat] = round((matched_count / total) * 100, 1) if total > 0 else 0
        
        return scores
    
    def get_all_categories(self) -> List[str]:
        """Get list of all skill categories in the dataset."""
        return list(self.dataset.get('categories', {}).keys())
    
    def get_skills_by_category(self, category: str) -> List[dict]:
        """Get all skills for a specific category."""
        return self.dataset.get('categories', {}).get(category, {}).get('skills', [])
