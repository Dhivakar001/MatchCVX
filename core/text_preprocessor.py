"""
MatchCVX - Text Preprocessor Module
Cleans, tokenizes, and normalizes text for analysis.
Preserves technical terms and skill names during processing.
"""

import re
import string
from typing import List, Optional

# Common English stopwords (avoid NLTK download requirement)
STOPWORDS = {
    'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', "you're",
    "you've", "you'll", "you'd", 'your', 'yours', 'yourself', 'yourselves',
    'he', 'him', 'his', 'himself', 'she', "she's", 'her', 'hers', 'herself',
    'it', "it's", 'its', 'itself', 'they', 'them', 'their', 'theirs', 'themselves',
    'what', 'which', 'who', 'whom', 'this', 'that', "that'll", 'these', 'those',
    'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
    'having', 'do', 'does', 'did', 'doing', 'a', 'an', 'the', 'and', 'but', 'if',
    'or', 'because', 'as', 'until', 'while', 'of', 'at', 'by', 'for', 'with',
    'about', 'against', 'between', 'through', 'during', 'before', 'after',
    'above', 'below', 'to', 'from', 'up', 'down', 'in', 'out', 'on', 'off',
    'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when',
    'where', 'why', 'how', 'all', 'both', 'each', 'few', 'more', 'most', 'other',
    'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than',
    'too', 'very', 's', 't', 'can', 'will', 'just', 'don', "don't", 'should',
    "should've", 'now', 'd', 'll', 'm', 'o', 're', 've', 'y', 'ain',
    'aren', "aren't", 'couldn', "couldn't", 'didn', "didn't", 'doesn', "doesn't",
    'hadn', "hadn't", 'hasn', "hasn't", 'haven', "haven't", 'isn', "isn't",
    'ma', 'mightn', "mightn't", 'mustn', "mustn't", 'needn', "needn't",
    'shan', "shan't", 'shouldn', "shouldn't", 'wasn', "wasn't", 'weren',
    "weren't", 'won', "won't", 'wouldn', "wouldn't",
    'also', 'would', 'could', 'may', 'might', 'shall', 'must',
    'etc', 'e.g', 'i.e', 'eg', 'ie', 'including', 'include', 'includes',
    'work', 'working', 'worked', 'use', 'used', 'using', 'well',
    'experience', 'experienced', 'years', 'year', 'strong', 'good',
    'able', 'ability', 'knowledge', 'understanding', 'required', 'preferred',
    'responsibilities', 'responsibility', 'role', 'position', 'job',
}

# Technical terms to preserve (never remove these)
PRESERVE_TERMS = {
    'c', 'c++', 'c#', 'r', 'go', 'ai', 'ml', 'dl', 'nlp', 'cv',
    'ui', 'ux', 'qa', 'ci', 'cd', 'db', 'os', 'api', 'aws', 'gcp',
    'sql', 'nosql', 'html', 'css', 'js', 'ts', 'php', 'ios',
    '.net', 'node.js', 'vue.js', 'react.js', 'next.js',
}


def clean_text(text: str) -> str:
    """
    Clean raw text by removing special characters while preserving
    technical terms and meaningful content.
    
    Args:
        text: Raw input text
    
    Returns:
        Cleaned text string
    """
    if not text or not text.strip():
        return ""
    
    # Convert to lowercase
    text = text.lower()
    
    # Preserve URLs by removing them (they add noise)
    text = re.sub(r'https?://\S+', ' ', text)
    text = re.sub(r'www\.\S+', ' ', text)
    
    # Preserve email addresses by removing them
    text = re.sub(r'\S+@\S+\.\S+', ' ', text)
    
    # Preserve phone numbers by removing them
    text = re.sub(r'[\+]?[(]?[0-9]{1,4}[)]?[-\s\./0-9]{7,}', ' ', text)
    
    # Replace common separators with spaces
    text = re.sub(r'[|/\\]', ' ', text)
    
    # Keep alphanumeric, spaces, dots, hyphens, plus signs, hashes
    # (important for tech terms like C++, C#, .NET, Node.js)
    text = re.sub(r'[^a-z0-9\s\.\-\+\#]', ' ', text)
    
    # Normalize whitespace
    text = re.sub(r'\s+', ' ', text)
    
    return text.strip()


def tokenize(text: str) -> List[str]:
    """
    Tokenize text into words, handling technical terms specially.
    
    Args:
        text: Cleaned text string
    
    Returns:
        List of tokens
    """
    if not text:
        return []
    
    # Split on whitespace
    tokens = text.split()
    
    # Filter empty tokens and very short non-technical tokens
    result = []
    for token in tokens:
        token = token.strip('.').strip('-')
        if not token:
            continue
        # Keep technical short terms
        if token in PRESERVE_TERMS:
            result.append(token)
        # Keep tokens with 2+ characters
        elif len(token) >= 2:
            result.append(token)
    
    return result


def remove_stopwords(tokens: List[str]) -> List[str]:
    """
    Remove stopwords while preserving technical terms.
    
    Args:
        tokens: List of word tokens
    
    Returns:
        Filtered list of tokens with stopwords removed
    """
    return [
        token for token in tokens
        if token in PRESERVE_TERMS or token not in STOPWORDS
    ]


def preprocess_pipeline(text: str, remove_stops: bool = True) -> str:
    """
    Full text preprocessing pipeline.
    
    Args:
        text: Raw input text
        remove_stops: Whether to remove stopwords (default True)
    
    Returns:
        Preprocessed text as a single string
    """
    cleaned = clean_text(text)
    tokens = tokenize(cleaned)
    
    if remove_stops:
        tokens = remove_stopwords(tokens)
    
    return ' '.join(tokens)


def extract_sections(text: str) -> dict:
    """
    Attempt to extract common resume sections from text.
    
    Identifies sections like Education, Experience, Skills, Projects, etc.
    
    Args:
        text: Raw resume text
    
    Returns:
        Dictionary mapping section names to their content
    """
    # Common resume section headers
    section_patterns = [
        r'(?i)\b(education|academic|qualification)s?\b',
        r'(?i)\b(experience|employment|work\s*history)\b',
        r'(?i)\b(skills?|technical\s*skills?|core\s*competenc)\b',
        r'(?i)\b(projects?|portfolio)\b',
        r'(?i)\b(certifications?|licenses?)\b',
        r'(?i)\b(summary|objective|profile|about)\b',
        r'(?i)\b(achievements?|awards?|honors?)\b',
        r'(?i)\b(publications?|research)\b',
        r'(?i)\b(languages?)\b',
        r'(?i)\b(volunteer|extracurricular)\b',
    ]
    
    section_names = [
        'education', 'experience', 'skills', 'projects',
        'certifications', 'summary', 'achievements',
        'publications', 'languages', 'volunteer'
    ]
    
    sections = {}
    lines = text.split('\n')
    current_section = 'header'
    current_content = []
    
    for line in lines:
        line_stripped = line.strip()
        if not line_stripped:
            current_content.append('')
            continue
        
        # Check if this line is a section header
        found_section = False
        for pattern, name in zip(section_patterns, section_names):
            if re.match(pattern, line_stripped) and len(line_stripped) < 50:
                # Save previous section
                if current_content:
                    sections[current_section] = '\n'.join(current_content).strip()
                current_section = name
                current_content = []
                found_section = True
                break
        
        if not found_section:
            current_content.append(line_stripped)
    
    # Save last section
    if current_content:
        sections[current_section] = '\n'.join(current_content).strip()
    
    return sections
