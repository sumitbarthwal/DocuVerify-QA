import { QAIssue, AISuggestionOption, AIExecutiveSummaryResult } from '../types';

export interface AIServiceStatus {
  online: boolean;
  aiAvailable: boolean;
  model: string;
  message?: string;
}

/**
 * Check if the backend AI service is online and Gemini API key is configured
 */
export async function checkAIServerStatus(): Promise<AIServiceStatus> {
  try {
    const res = await fetch('/api/health', {
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) {
      return { online: false, aiAvailable: false, model: 'gemini-3.8-flash', message: 'Server responded with error' };
    }
    const data = await res.json();
    return {
      online: true,
      aiAvailable: Boolean(data.aiAvailable),
      model: 'gemini-3.8-flash',
      message: data.aiAvailable 
        ? 'Gemini 3.8 Flash Online Engine Ready' 
        : 'Backend online, offline mode active (GEMINI_API_KEY optional)',
    };
  } catch (err: any) {
    return {
      online: false,
      aiAvailable: false,
      model: 'gemini-3.8-flash',
      message: 'Running in standalone offline client mode',
    };
  }
}

/**
 * Run extended deep audit on document using Gemini
 */
export async function runAIExtendedAudit(
  content: string,
  filename?: string
): Promise<{ success: boolean; issues: QAIssue[]; error?: string }> {
  try {
    const res = await fetch('/api/ai/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, filename }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const fallbackMsg = res.status === 503 
        ? 'Gemini is experiencing temporary high demand. Please retry in a few moments.'
        : `AI scan request failed (${res.status})`;
      return {
        success: false,
        issues: [],
        error: errData.error || fallbackMsg,
      };
    }

    const data = await res.json();
    return {
      success: true,
      issues: data.issues || [],
    };
  } catch (err: any) {
    return {
      success: false,
      issues: [],
      error: err.message || 'Network error during AI audit scan',
    };
  }
}

/**
 * Request smart alternative rewrite variations for a flagged issue
 */
export async function requestAISmartFix(
  originalText: string,
  context?: string,
  description?: string,
  issueType?: string
): Promise<{ success: boolean; suggestions: AISuggestionOption[]; error?: string }> {
  try {
    const res = await fetch('/api/ai/suggest-fix', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ originalText, context, description, issueType }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const fallbackMsg = res.status === 503 
        ? 'AI rewrite service is currently experiencing temporary high demand. Please try again in a moment.'
        : 'Failed to generate AI fix suggestions';
      return {
        success: false,
        suggestions: [],
        error: errData.error || fallbackMsg,
      };
    }

    const data = await res.json();
    return {
      success: true,
      suggestions: data.suggestions || [],
    };
  } catch (err: any) {
    return {
      success: false,
      suggestions: [],
      error: err.message || 'Network error generating fix suggestions',
    };
  }
}

/**
 * Generate high-level Executive Audit Summary using Gemini
 */
export async function generateAIExecutiveSummary(
  content: string,
  filename?: string,
  issuesCount?: number,
  qualityScore?: number
): Promise<{ success: boolean; summary?: AIExecutiveSummaryResult; error?: string }> {
  try {
    const res = await fetch('/api/ai/executive-summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, filename, issuesCount, qualityScore }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const fallbackMsg = res.status === 503 
        ? 'AI Executive Brief service is currently experiencing temporary high demand. Please try again in a moment.'
        : 'Failed to generate AI executive summary';
      return {
        success: false,
        error: errData.error || fallbackMsg,
      };
    }

    const data = await res.json();
    return {
      success: true,
      summary: data.summary,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Network error requesting executive brief',
    };
  }
}
