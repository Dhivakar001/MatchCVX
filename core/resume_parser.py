"""
MatchCVX - Resume Parser Module
Extracts clean text from PDF resume files using pdfplumber.
"""

import pdfplumber
import re
import io
from typing import Optional


def extract_text_from_pdf(uploaded_file) -> str:
    """
    Extract text content from an uploaded PDF file.
    
    Args:
        uploaded_file: Streamlit UploadedFile object or file-like object
    
    Returns:
        Cleaned text extracted from all pages of the PDF
    
    Raises:
        ValueError: If the file is empty or cannot be processed
    """
    try:
        # Handle Streamlit uploaded file
        if hasattr(uploaded_file, 'read'):
            pdf_bytes = uploaded_file.read()
            uploaded_file.seek(0)  # Reset file pointer
            file_obj = io.BytesIO(pdf_bytes)
        else:
            file_obj = uploaded_file
        
        full_text = []
        
        with pdfplumber.open(file_obj) as pdf:
            if len(pdf.pages) == 0:
                raise ValueError("The PDF file contains no pages.")
            
            for page_num, page in enumerate(pdf.pages, 1):
                # Extract text from each page
                page_text = page.extract_text()
                
                if page_text:
                    full_text.append(page_text)
                
                # Also try to extract text from tables
                tables = page.extract_tables()
                if tables:
                    for table in tables:
                        for row in table:
                            if row:
                                # Filter None values and join
                                row_text = ' | '.join(
                                    [str(cell).strip() for cell in row if cell]
                                )
                                if row_text.strip():
                                    full_text.append(row_text)
        
        if not full_text:
            raise ValueError(
                "Could not extract any text from the PDF. "
                "The file may be image-based or corrupted."
            )
        
        # Join all text and clean it
        raw_text = '\n'.join(full_text)
        return _clean_extracted_text(raw_text)
        
    except pdfplumber.pdfminer.pdfparser.PDFSyntaxError:
        raise ValueError(
            "Invalid PDF file. The file may be corrupted or not a valid PDF."
        )
    except Exception as e:
        if isinstance(e, ValueError):
            raise
        raise ValueError(f"Error processing PDF: {str(e)}")


def _clean_extracted_text(text: str) -> str:
    """
    Clean and normalize extracted PDF text.
    
    Removes excessive whitespace, fixes encoding issues,
    and normalizes line breaks.
    """
    # Fix common encoding artifacts
    text = text.replace('\x00', '')
    text = text.replace('\ufeff', '')
    
    # Normalize various dash types
    text = re.sub(r'[\u2013\u2014\u2015]', '-', text)
    
    # Normalize quotes
    text = re.sub(r'[\u2018\u2019]', "'", text)
    text = re.sub(r'[\u201c\u201d]', '"', text)
    
    # Normalize bullet points
    text = re.sub(r'[\u2022\u2023\u25aa\u25cf\u25cb\u25e6\u2043]', '•', text)
    
    # Remove excessive blank lines (keep max 2)
    text = re.sub(r'\n{3,}', '\n\n', text)
    
    # Remove excessive spaces
    text = re.sub(r'[ \t]{2,}', ' ', text)
    
    # Clean up lines
    lines = [line.strip() for line in text.split('\n')]
    text = '\n'.join(lines)
    
    return text.strip()


def get_pdf_metadata(uploaded_file) -> dict:
    """
    Extract metadata from a PDF file (page count, author, etc.).
    
    Args:
        uploaded_file: Streamlit UploadedFile or file-like object
    
    Returns:
        Dictionary containing PDF metadata
    """
    try:
        if hasattr(uploaded_file, 'read'):
            pdf_bytes = uploaded_file.read()
            uploaded_file.seek(0)
            file_obj = io.BytesIO(pdf_bytes)
        else:
            file_obj = uploaded_file
        
        with pdfplumber.open(file_obj) as pdf:
            metadata = {
                'page_count': len(pdf.pages),
                'metadata': pdf.metadata if pdf.metadata else {}
            }
            return metadata
    except Exception:
        return {'page_count': 0, 'metadata': {}}
