import express from 'express';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';

const PORT = 3000;

// Lazy initialization of Gemini client with recommended telemetry User-Agent
let aiClient: GoogleGenAI | null = null;
function getAIClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not configured');
    }
    aiClient = new GoogleGenAI({ 
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// Allowed non-paid fallback models from @google/genai guidelines in priority order
const FALLBACK_MODELS = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];

function isHighDemandOrTransientError(error: any): boolean {
  if (!error) return false;
  const str = String(error.message || error.status || error || '').toLowerCase();
  const code = error.status || error.code || (error.error && error.error.code);
  return (
    code === 503 ||
    code === 429 ||
    code === 'UNAVAILABLE' ||
    code === 'RESOURCE_EXHAUSTED' ||
    str.includes('503') ||
    str.includes('high demand') ||
    str.includes('unavailable') ||
    str.includes('resource_exhausted') ||
    str.includes('overloaded') ||
    str.includes('try again later') ||
    str.includes('rate limit')
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Resilient Gemini caller that handles transient 503 high-demand spikes
 * via exponential jittered backoff and automatic model failover across supported models.
 */
async function callGeminiWithResilience(
  ai: GoogleGenAI,
  options: { contents: string; config?: any }
): Promise<{ text: string; modelUsed: string }> {
  let lastError: any = null;

  for (const model of FALLBACK_MODELS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: options.contents,
          config: options.config,
        });
        return {
          text: response.text || '',
          modelUsed: model,
        };
      } catch (err: any) {
        lastError = err;
        const isTransient = isHighDemandOrTransientError(err);
        console.warn(`[Gemini API] Model ${model} (attempt ${attempt}/2) encountered:`, err?.message || err);

        if (isTransient && attempt < 2) {
          // Brief jittered pause before retrying the same model
          const delay = 600 + Math.random() * 400;
          await sleep(delay);
          continue;
        }

        // If high demand, immediately break to fail over to next model
        if (isTransient) {
          break;
        }

        // Non-transient error (invalid prompt / syntax)
        throw err;
      }
    }
  }

  throw lastError;
}

async function startServer() {
  const app = express();

  // Middleware for parsing JSON with generous payload limits for reports
  app.use(express.json({ limit: '15mb' }));

  // -------------------------------------------------------------
  // API ROUTES (Always before Vite / static fallback)
  // -------------------------------------------------------------

  // Health & AI capability check
  app.get('/api/health', (req, res) => {
    const hasKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0);
    res.json({
      status: 'ok',
      service: "Chingham's DocuVerify QA Engine",
      aiAvailable: hasKey,
      timestamp: new Date().toISOString(),
    });
  });

  // POST /api/ai/audit - Extended Online AI QA Audit
  app.post('/api/ai/audit', async (req, res) => {
    try {
      const { content, filename } = req.body;
      if (!content || typeof content !== 'string') {
        return res.status(400).json({ error: 'Document content is required for AI audit' });
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.status(503).json({ 
          error: 'AI service currently offline. GEMINI_API_KEY secret is not configured in settings.',
          aiAvailable: false
        });
      }

      const ai = getAIClient();

      const prompt = `You are a world-class Quality Assurance, Insurance Survey, and Technical Document Audit Expert.
Analyze the following document and identify critical inconsistencies, calculation errors, grammar mistakes, ambiguous statements, missing annexures/photos, and formatting issues.

DOCUMENT TO AUDIT (${filename || 'Document'}):
"""
${content.slice(0, 24000)}
"""

Respond ONLY with a JSON array of issues (maximum 12 most important issues).
Each object MUST have this exact schema:
{
  "category": "grammar" | "data-continuity" | "uniformity" | "placeholder" | "typography",
  "severity": "critical" | "warning" | "suggestion",
  "title": "Short title (3-6 words)",
  "description": "Clear explanation of the error or discrepancy",
  "originalText": "The exact verbatim substring in the document that contains the issue",
  "suggestedText": "The precise professional replacement text",
  "explanation": "Why this change is needed",
  "autoApplicable": boolean
}
Do not wrap in markdown quotes if possible, output pure JSON array.`;

      const result = await callGeminiWithResilience(ai, {
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      });

      const responseText = result.text || '[]';
      let parsedIssues: any[] = [];
      try {
        parsedIssues = JSON.parse(responseText);
      } catch (parseErr) {
        // Fallback cleanup if response contains markdown block
        const cleaned = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
        parsedIssues = JSON.parse(cleaned);
      }

      // Format and locate offsets in document content
      const validatedIssues = (Array.isArray(parsedIssues) ? parsedIssues : []).map((item, idx) => {
        const originalText = String(item.originalText || '').trim();
        let startOffset = -1;
        let endOffset = -1;
        let lineNumber = 1;

        if (originalText && content.includes(originalText)) {
          startOffset = content.indexOf(originalText);
          endOffset = startOffset + originalText.length;
          const textBefore = content.slice(0, startOffset);
          lineNumber = (textBefore.match(/\n/g) || []).length + 1;
        }

        return {
          id: `ai-issue-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
          category: item.category || 'data-continuity',
          severity: item.severity || 'warning',
          title: item.title || 'AI Audit Finding',
          description: item.description || '',
          originalText: originalText,
          suggestedText: String(item.suggestedText || originalText),
          startOffset: startOffset,
          endOffset: endOffset,
          lineNumber: lineNumber,
          ruleId: `ai-extended-${item.category || 'scan'}`,
          autoApplicable: Boolean(item.autoApplicable ?? (startOffset >= 0 && item.suggestedText)),
          explanation: item.explanation || 'Identified via Gemini Extended Audit scan',
          isAiGenerated: true,
          aiConfidence: 0.94,
        };
      });

      res.json({
        success: true,
        issues: validatedIssues,
        count: validatedIssues.length,
        model: result.modelUsed,
      });
    } catch (error: any) {
      console.error('Gemini Audit API error:', error);
      const isHighDemand = isHighDemandOrTransientError(error);
      const statusCode = isHighDemand ? 503 : 500;
      const userMessage = isHighDemand
        ? 'The Gemini AI model is currently experiencing high demand. Spikes are temporary—please try again in a moment.'
        : (error.message || 'Failed to complete AI document audit');

      res.status(statusCode).json({ 
        error: userMessage,
        isHighDemand,
        details: String(error)
      });
    }
  });

  // POST /api/ai/suggest-fix - Smart Rewrite & Fix Variations
  app.post('/api/ai/suggest-fix', async (req, res) => {
    try {
      const { originalText, context, description, issueType } = req.body;
      if (!originalText) {
        return res.status(400).json({ error: 'originalText is required' });
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.status(503).json({ error: 'AI service unavailable - GEMINI_API_KEY not set' });
      }

      const ai = getAIClient();

      const prompt = `You are a professional survey and document editor.
An issue was flagged in a document:
- Original Text: "${originalText}"
- Context: "${(context || '').slice(0, 300)}"
- Issue Description: "${description || ''}"
- Issue Type: "${issueType || 'correction'}"

Provide exactly 3 distinct replacement options for "${originalText}":
1. "Formal/Technical": Highly formal, rigorous, insurance or corporate standard
2. "Direct/Concise": Clear, succinct, and eliminating redundancy
3. "Contextual Best Fit": Natural phrasing that preserves surrounding syntax

Respond ONLY with a JSON array of 3 objects:
[
  { "label": "Formal Technical", "replacementText": "...", "reason": "..." },
  { "label": "Direct & Concise", "replacementText": "...", "reason": "..." },
  { "label": "Contextual Fit", "replacementText": "...", "reason": "..." }
]`;

      const result = await callGeminiWithResilience(ai, {
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.3,
        },
      });

      const responseText = result.text || '[]';
      let suggestions: any[] = [];
      try {
        suggestions = JSON.parse(responseText);
      } catch {
        const cleaned = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
        suggestions = JSON.parse(cleaned);
      }

      res.json({
        success: true,
        suggestions: Array.isArray(suggestions) ? suggestions : [],
        model: result.modelUsed,
      });
    } catch (error: any) {
      console.error('Gemini Suggest Fix API error:', error);
      const isHighDemand = isHighDemandOrTransientError(error);
      const statusCode = isHighDemand ? 503 : 500;
      const userMessage = isHighDemand
        ? 'AI rewrite service is currently experiencing high demand. Please try again in a moment.'
        : (error.message || 'Failed to generate AI fix suggestions');

      res.status(statusCode).json({ 
        error: userMessage,
        isHighDemand,
      });
    }
  });

  // POST /api/ai/executive-summary - Generate Executive Audit Brief
  app.post('/api/ai/executive-summary', async (req, res) => {
    try {
      const { content, filename, issuesCount, qualityScore } = req.body;
      if (!content) {
        return res.status(400).json({ error: 'Document content is required' });
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.status(503).json({ error: 'AI service unavailable - GEMINI_API_KEY not set' });
      }

      const ai = getAIClient();

      const prompt = `You are a Senior Lead Auditor and Surveyor Executive.
Review the following document and QA assessment metrics:
- Filename: ${filename || 'Report.docx'}
- Detected Inconsistencies/Errors: ${issuesCount ?? 0}
- Current Quality Score: ${qualityScore ?? 85}%

DOCUMENT EXCERPT:
"""
${content.slice(0, 18000)}
"""

Produce an Executive Audit Brief in JSON with the following structure:
{
  "executiveOverview": "A 2-3 sentence high-level executive summary of the document purpose and overall compliance status.",
  "keyFindings": ["Finding 1 with data points", "Finding 2 with figures", "Finding 3"],
  "riskFlags": ["Risk or liability gap 1", "Risk 2"],
  "dataQualityScore": number between 0 and 100,
  "recommendations": ["Recommendation 1 for surveyor/underwriter", "Recommendation 2"]
}`;

      const result = await callGeminiWithResilience(ai, {
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.25,
        },
      });

      const responseText = result.text || '{}';
      let summaryResult: any = {};
      try {
        summaryResult = JSON.parse(responseText);
      } catch {
        const cleaned = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
        summaryResult = JSON.parse(cleaned);
      }

      res.json({
        success: true,
        summary: summaryResult,
        model: result.modelUsed,
      });
    } catch (error: any) {
      console.error('Gemini Executive Summary API error:', error);
      const isHighDemand = isHighDemandOrTransientError(error);
      const statusCode = isHighDemand ? 503 : 500;
      const userMessage = isHighDemand
        ? 'AI Executive Brief service is currently experiencing high demand. Please try again in a moment.'
        : (error.message || 'Failed to generate AI executive summary');

      res.status(statusCode).json({ 
        error: userMessage,
        isHighDemand,
      });
    }
  });

  // -------------------------------------------------------------
  // VITE / STATIC CLIENT DELIVERY
  // -------------------------------------------------------------
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Chingham's DocuVerify QA Server running on port ${PORT}`);
  });
}

startServer();
