import { QAIssue } from '../types';
import { getLineNumber } from './grammarRules';

interface HomophoneRule {
  pattern: RegExp;
  confusedWord: string;
  correctWord: string;
  explanation: string;
  severity?: 'critical' | 'warning' | 'suggestion';
}

const PROFESSIONAL_REGISTER_RULES: HomophoneRule[] = [
  {
    pattern: /\bto\s+(insure)\s+(?:that|quality|safety|compliance|integrity|accuracy|timely)\b/gi,
    confusedWord: 'insure',
    correctWord: 'ensure',
    explanation: '"Ensure" means to make certain. "Insure" means to issue or obtain insurance coverage.',
    severity: 'warning',
  },
  {
    pattern: /\bto\s+(assure)\s+(?:that|quality|safety|compliance|integrity|accuracy)\b/gi,
    confusedWord: 'assure',
    correctWord: 'ensure',
    explanation: '"Assure" means to tell someone something positively to dispel doubts. Use "ensure" to mean make certain.',
    severity: 'suggestion',
  },
  {
    pattern: /\b(?:claimant|insured)\s+(?:shall|agrees\s+to|must)\s+(indemnity)\b/gi,
    confusedWord: 'indemnity',
    correctWord: 'indemnify',
    explanation: '"Indemnity" is a noun. The verb form required here is "indemnify".',
    severity: 'warning',
  },
  {
    pattern: /\bphysical\s+(damages)\b/gi,
    confusedWord: 'damages',
    correctWord: 'damage',
    explanation: 'In insurance and technical surveys, "damage" refers to physical harm/loss, whereas "damages" refers to monetary legal compensation awarded by a court.',
    severity: 'warning',
  },
  {
    pattern: /\b(?:could|would|should|might)\s+(of)\b/gi,
    confusedWord: 'of',
    correctWord: 'have',
    explanation: 'Informal error: use "could have", "would have", or "should have", never "could of".',
    severity: 'critical',
  },
  {
    pattern: /\b(loose)\s+(?:coverage|claim|status|entitlement|eligibility|money|value)\b/gi,
    confusedWord: 'loose',
    correctWord: 'lose',
    explanation: '"Loose" means not tight. "Lose" means to suffer the loss of something.',
    severity: 'critical',
  },
  {
    pattern: /\b(stationary)\s+(?:items|supplies|paper|letterhead|invoices)\b/gi,
    confusedWord: 'stationary',
    correctWord: 'stationery',
    explanation: '"Stationary" means not moving. "Stationery" with an "e" refers to writing materials and paper.',
    severity: 'warning',
  },
  {
    pattern: /\b(compliment)\s+(?:the\s+system|the\s+structure|each\s+other|the\s+report)\b/gi,
    confusedWord: 'compliment',
    correctWord: 'complement',
    explanation: '"Compliment" means praise. "Complement" means to complete or enhance nicely.',
    severity: 'warning',
  },
  {
    pattern: /\b(principal)\s+(?:behind|of\s+insurance|of\s+indemnity|of\s+subrogation)\b/gi,
    confusedWord: 'principal',
    correctWord: 'principle',
    explanation: '"Principle" is a foundational rule, doctrine, or truth (e.g. Principle of Indemnity). "Principal" refers to a person or original capital sum.',
    severity: 'critical',
  },
  {
    pattern: /\b(precede)\s+with\s+(?:the\s+repair|the\s+survey|the\s+claim|the\s+investigation)\b/gi,
    confusedWord: 'precede',
    correctWord: 'proceed',
    explanation: '"Proceed" means to continue or go forward. "Precede" means to come before in time.',
    severity: 'warning',
  },
];

/**
 * Intelligent Professional Register & Homophone Quality Engine
 */
export function checkProfessionalRegister(documentText: string): QAIssue[] {
  const issues: QAIssue[] = [];
  let idCounter = 1;

  // 1. Homophones & Technical Confusions
  for (const rule of PROFESSIONAL_REGISTER_RULES) {
    let match: RegExpExecArray | null;
    const regex = new RegExp(rule.pattern.source, rule.pattern.flags);

    while ((match = regex.exec(documentText)) !== null) {
      const fullMatch = match[0];
      const confused = match[1];
      const corrected = fullMatch.replace(new RegExp(`\\b${confused}\\b`, 'i'), (m) => {
        // preserve casing
        return m[0] === m[0].toUpperCase()
          ? rule.correctWord.charAt(0).toUpperCase() + rule.correctWord.slice(1)
          : rule.correctWord;
      });

      const lineNum = getLineNumber(documentText, match.index);

      issues.push({
        id: `prof-homophone-${idCounter++}`,
        category: 'grammar',
        severity: rule.severity || 'warning',
        title: `Confusable Word: "${confused}" vs "${rule.correctWord}"`,
        description: rule.explanation,
        originalText: fullMatch,
        suggestedText: corrected,
        startOffset: match.index,
        endOffset: match.index + fullMatch.length,
        lineNumber: lineNum,
        ruleId: 'professional-homophone-precision',
        autoApplicable: true,
        explanation: rule.explanation,
      });
    }
  }

  // 2. Accidental Repeated Duplicated Words: "the the", "and and", "in in", "of of"
  const duplicateWordRegex = /\b(the|and|in|of|that|is|to|for|with|on|at|by|from|this|these)\s+(\1)\b/gi;
  let dupMatch: RegExpExecArray | null;

  while ((dupMatch = duplicateWordRegex.exec(documentText)) !== null) {
    const fullMatch = dupMatch[0];
    const singleWord = dupMatch[1];
    const lineNum = getLineNumber(documentText, dupMatch.index);

    issues.push({
      id: `prof-dup-word-${idCounter++}`,
      category: 'typography',
      severity: 'warning',
      title: `Accidental Duplicate Word: "${singleWord} ${singleWord}"`,
      description: `The word "${singleWord}" is duplicated consecutively.`,
      originalText: fullMatch,
      suggestedText: singleWord,
      startOffset: dupMatch.index,
      endOffset: dupMatch.index + fullMatch.length,
      lineNumber: lineNum,
      ruleId: 'duplicate-consecutive-word',
      autoApplicable: true,
      explanation: `Consecutive identical words are unintentional typing errors that detract from document quality.`,
    });
  }

  return issues;
}
