"""
MatchCVX - Utility Helper Functions
Common utility functions used across the application.
"""

import re
from typing import List, Optional


def truncate_text(text: str, max_length: int = 500) -> str:
    """
    Truncate text to a maximum length, adding ellipsis if needed.
    Tries to break at word boundaries.
    
    Args:
        text: Input text
        max_length: Maximum character length
    
    Returns:
        Truncated text string
    """
    if len(text) <= max_length:
        return text
    
    # Find last space before max_length
    truncated = text[:max_length]
    last_space = truncated.rfind(' ')
    
    if last_space > max_length * 0.8:  # Only break at word if reasonable
        truncated = truncated[:last_space]
    
    return truncated.strip() + "..."


def format_percentage(value: float, decimals: int = 1) -> str:
    """
    Format a value as a percentage string.
    
    Args:
        value: Numeric value (0-100)
        decimals: Number of decimal places
    
    Returns:
        Formatted percentage string (e.g., "75.5%")
    """
    return f"{value:.{decimals}f}%"


def count_words(text: str) -> int:
    """
    Count the number of words in a text string.
    
    Args:
        text: Input text
    
    Returns:
        Word count
    """
    if not text or not text.strip():
        return 0
    return len(text.split())


def extract_email(text: str) -> Optional[str]:
    """
    Extract the first email address from text.
    
    Args:
        text: Input text
    
    Returns:
        Email address string or None
    """
    pattern = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
    match = re.search(pattern, text)
    return match.group(0) if match else None


def extract_phone(text: str) -> Optional[str]:
    """
    Extract the first phone number from text.
    
    Args:
        text: Input text
    
    Returns:
        Phone number string or None
    """
    pattern = r'[\+]?[(]?[0-9]{1,4}[)]?[-\s\./0-9]{7,}'
    match = re.search(pattern, text)
    return match.group(0).strip() if match else None


def get_score_color(score: float) -> str:
    """
    Get the appropriate color hex code for a given score.
    
    Args:
        score: Score value (0-100)
    
    Returns:
        Hex color string
    """
    if score >= 85:
        return "#10B981"   # Green
    elif score >= 70:
        return "#34D399"   # Light green
    elif score >= 55:
        return "#FBBF24"   # Yellow
    elif score >= 40:
        return "#F97316"   # Orange
    elif score >= 25:
        return "#EF4444"   # Red
    else:
        return "#DC2626"   # Dark red


def sanitize_text(text: str) -> str:
    """
    Sanitize text to prevent XSS in HTML rendering.
    
    Args:
        text: Input text
    
    Returns:
        Sanitized text safe for HTML display
    """
    # Replace HTML special characters
    text = text.replace('&', '&amp;')
    text = text.replace('<', '&lt;')
    text = text.replace('>', '&gt;')
    text = text.replace('"', '&quot;')
    text = text.replace("'", '&#39;')
    return text
