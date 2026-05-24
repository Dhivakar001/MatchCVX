import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000/api';

export interface AnalysisResponse {
  ats_score: number;
  score_label: string;
  score_color: string;
  resume_text: string;
  resume_word_count: number;
  jd_word_count: number;
  matching_scores: {
    tfidf_score: number;
    sbert_score: number;
    skill_score: number;
    combined_score: number;
  };
  skill_comparison: {
    match_percentage: number;
    category_scores: Record<string, number>;
    matched_skills: { name: string; category: string }[];
    missing_skills: { name: string; category: string }[];
    extra_skills: { name: string; category: string }[];
  };
  suggestions: {
    category: string;
    priority: 'high' | 'medium' | 'low';
    title: string;
    description: string;
  }[];
}

export const analyzeResume = async (resumeFile: File, jdText: string): Promise<AnalysisResponse> => {
  const formData = new FormData();
  formData.append('resume', resumeFile);
  formData.append('jd_text', jdText);

  try {
    const response = await axios.post<AnalysisResponse>(`${API_BASE_URL}/analyze`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response?.data?.detail) {
      throw new Error(error.response.data.detail);
    }
    throw new Error(error instanceof Error ? error.message : 'Failed to connect to the analysis server');
  }
};

/**
 * Downloads a modified PDF. Sends the original PDF file, original text,
 * and modified text to the backend. The backend applies the text changes
 * to the original PDF preserving design/layout and returns the new PDF.
 */
export const downloadModifiedPdf = async (
  originalPdf: File,
  originalText: string,
  modifiedText: string
): Promise<Blob> => {
  const formData = new FormData();
  formData.append('resume', originalPdf);
  formData.append('original_text', originalText);
  formData.append('modified_text', modifiedText);

  try {
    const response = await axios.post(`${API_BASE_URL}/download-pdf`, formData, {
      responseType: 'blob',
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response) {
      // The error response is a blob, so we need to parse it
      const text = await error.response.data.text();
      try {
        const json = JSON.parse(text);
        throw new Error(json.detail || 'PDF generation failed');
      } catch {
        throw new Error('PDF generation failed');
      }
    }
    throw new Error(error instanceof Error ? error.message : 'Failed to generate PDF');
  }
};

/**
 * Re-analyze modified resume text against a JD to get an updated score.
 * Used in the Review step so users can see their improved score before saving.
 */
export const reAnalyzeResume = async (
  resumeText: string,
  jdText: string
): Promise<AnalysisResponse> => {
  const formData = new FormData();
  formData.append('resume_text', resumeText);
  formData.append('jd_text', jdText);

  try {
    const response = await axios.post<AnalysisResponse>(`${API_BASE_URL}/re-analyze`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response?.data?.detail) {
      throw new Error(error.response.data.detail);
    }
    throw new Error(error instanceof Error ? error.message : 'Failed to re-analyze resume');
  }
};

/**
 * AI-powered suggestion from OpenRouter LLM.
 */
export interface AISuggestion {
  type: 'rewrite' | 'add_content' | 'keyword';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  original_text: string;
  improved_text: string;
  section: string;
}

/**
 * Fetch AI-powered resume optimization suggestions via OpenRouter.
export interface AISuggestionsResponse {
  suggestions: AISuggestion[];
  model_used: string;
}

/**
 * Fetch AI-powered resume optimization suggestions via OpenRouter.
 * Uses a fallback chain of free models for reliability.
 */
export const fetchAiSuggestions = async (
  resumeText: string,
  jdText: string,
  atsScore: number,
  matchedSkills: string[],
  missingSkills: string[]
): Promise<AISuggestionsResponse> => {
  const formData = new FormData();
  formData.append('resume_text', resumeText);
  formData.append('jd_text', jdText);
  formData.append('ats_score', atsScore.toString());
  formData.append('matched_skills', matchedSkills.join(', '));
  formData.append('missing_skills', missingSkills.join(', '));

  try {
    const response = await axios.post<AISuggestionsResponse>(
      `${API_BASE_URL}/ai-suggestions`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 65000 }
    );
    return response.data;
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response?.data?.detail) {
      throw new Error(error.response.data.detail);
    }
    throw new Error(error instanceof Error ? error.message : 'Failed to get AI suggestions');
  }
};
