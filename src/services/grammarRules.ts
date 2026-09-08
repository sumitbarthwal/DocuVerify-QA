import { QAIssue } from '../types';

interface SimpleReplacementRule {
  pattern: RegExp;
  title: string;
  description: string;
  replacement: string | ((match: string, ...args: any[]) => string);
  severity: 'critical' | 'warning' | 'suggestion';
  ruleId: string;
}

// High-confidence commonly confused words and typos
const TYPOS_AND_CONFUSIONS: Array<{
  regex: RegExp;
  fix: string | ((m: string) => string);
  title: string;
  desc: string;
  severity: 'critical' | 'warning';
}> = [
  {
    regex: /\b(definately|definitly)\b/gi,
    fix: (m) => preserveCase(m, 'definitely'),
    title: 'Spelling Correction',
    desc: 'Misspelling of "definitely".',
    severity: 'critical',
  },
  {
    regex: /\b(seperate|seperately)\b/gi,
    fix: (m) => m.toLowerCase().includes('ly') ? preserveCase(m, 'separately') : preserveCase(m, 'separate'),
    title: 'Spelling Correction',
    desc: 'Misspelling of "separate".',
    severity: 'critical',
  },
  {
    regex: /\b(occured|occurrance|occurance)\b/gi,
    fix: (m) => m.toLowerCase().includes('ance') ? preserveCase(m, 'occurrence') : preserveCase(m, 'occurred'),
    title: 'Spelling Correction',
    desc: 'Spelling error in "occurred" or "occurrence".',
    severity: 'critical',
  },
  {
    regex: /\b(recieve|recieved|recieving)\b/gi,
    fix: (m) => {
      if (m.toLowerCase().endsWith('ing')) return preserveCase(m, 'receiving');
      if (m.toLowerCase().endsWith('ed')) return preserveCase(m, 'received');
      return preserveCase(m, 'receive');
    },
    title: 'Spelling Correction ("i before e")',
    desc: 'Misspelling of "receive". Remember: "i before e except after c".',
    severity: 'critical',
  },
  {
    regex: /\b(untill)\b/gi,
    fix: (m) => preserveCase(m, 'until'),
    title: 'Spelling Correction',
    desc: '"until" is spelled with a single "l".',
    severity: 'critical',
  },
  {
    regex: /\b(enviroment|enviromental)\b/gi,
    fix: (m) => m.toLowerCase().endsWith('al') ? preserveCase(m, 'environmental') : preserveCase(m, 'environment'),
    title: 'Spelling Correction',
    desc: 'Missing "n" in "environment".',
    severity: 'critical',
  },
  {
    regex: /\b(goverment)\b/gi,
    fix: (m) => preserveCase(m, 'government'),
    title: 'Spelling Correction',
    desc: 'Missing "n" in "government".',
    severity: 'critical',
  },
  {
    regex: /\b(maintainance)\b/gi,
    fix: (m) => preserveCase(m, 'maintenance'),
    title: 'Spelling Correction',
    desc: 'Misspelling of "maintenance".',
    severity: 'critical',
  },
  {
    regex: /\b(accomodate|accomodation)\b/gi,
    fix: (m) => m.toLowerCase().endsWith('ion') ? preserveCase(m, 'accommodation') : preserveCase(m, 'accommodate'),
    title: 'Spelling Correction',
    desc: '"accommodate" requires double "c" and double "m".',
    severity: 'critical',
  },
  {
    regex: /\b(priviledge|priviledged)\b/gi,
    fix: (m) => m.toLowerCase().endsWith('ed') ? preserveCase(m, 'privileged') : preserveCase(m, 'privilege'),
    title: 'Spelling Correction',
    desc: 'Misspelling of "privilege".',
    severity: 'critical',
  },
  {
    regex: /\b(arguement|arguements)\b/gi,
    fix: (m) => m.toLowerCase().endsWith('s') ? preserveCase(m, 'arguments') : preserveCase(m, 'argument'),
    title: 'Spelling Correction',
    desc: 'Drop the "e" in "argument".',
    severity: 'critical',
  },
  {
    regex: /\b(alot)\b/gi,
    fix: (m) => preserveCase(m, 'a lot'),
    title: 'Two Words Required',
    desc: '"a lot" is always two words, not "alot".',
    severity: 'critical',
  },
  {
    regex: /\b(inorder to)\b/gi,
    fix: (m) => preserveCase(m, 'in order to'),
    title: 'Spacing Correction',
    desc: '"in order to" should be written as separate words.',
    severity: 'warning',
  },
  {
    regex: /\b(their is|their are)\b/gi,
    fix: (m) => m.toLowerCase().includes('are') ? preserveCase(m, 'there are') : preserveCase(m, 'there is'),
    title: 'Homophone Confusion (their vs there)',
    desc: 'Possessive "their" used instead of existential "there".',
    severity: 'critical',
  },
  {
    regex: /\b(its a|its an|its not|its been)\b/gi,
    fix: (m) => `it's ${m.slice(4)}`,
    title: 'Contraction Apostrophe (it\'s vs its)',
    desc: 'Use "it\'s" for "it is" or "it has". "Its" is the possessive pronoun.',
    severity: 'warning',
  },
  {
    regex: /\b(lead to the|has lead to|have lead to|had lead to)\b/gi,
    fix: (m) => m.replace(/lead/i, (w) => preserveCase(w, 'led')),
    title: 'Past Tense (led vs lead)',
    desc: 'The past tense of "lead" is spelled "led".',
    severity: 'critical',
  },
  {
    regex: /\b(more then|less then|better then|worse then|greater then|higher then|lower then)\b/gi,
    fix: (m) => m.replace(/then/i, (w) => preserveCase(w, 'than')),
    title: 'Comparison (than vs then)',
    desc: 'Use "than" for comparisons. "Then" relates to time sequence.',
    severity: 'critical',
  },
  {
    regex: /\b(effecting the outcome|effecting our|effecting results)\b/gi,
    fix: (m) => m.replace(/effecting/i, (w) => preserveCase(w, 'affecting')),
    title: 'Word Choice (affect vs effect)',
    desc: '"Affect" is generally a verb meaning to influence; "effect" is typically a noun meaning result.',
    severity: 'warning',
  }
];

// Redundant phrases (conciseness & professional polish)
const REDUNDANCIES: Array<{
  regex: RegExp;
  fix: string;
  title: string;
  desc: string;
}> = [
  {
    regex: /\bpast history\b/gi,
    fix: 'history',
    title: 'Tautology / Redundancy',
    desc: '"History" is already in the past. Use "history" directly.',
  },
  {
    regex: /\bcompletely eliminate\b/gi,
    fix: 'eliminate',
    title: 'Redundant Modifier',
    desc: '"Eliminate" is absolute; "completely" is redundant.',
  },
  {
    regex: /\bend result\b/gi,
    fix: 'result',
    title: 'Redundancy',
    desc: '"Result" implies the end. Simplify to "result" or "outcome".',
  },
  {
    regex: /\bclose proximity\b/gi,
    fix: 'proximity',
    title: 'Redundancy',
    desc: '"Proximity" means closeness. Use "proximity" or "near".',
  },
  {
    regex: /\brevert back\b/gi,
    fix: 'revert',
    title: 'Redundancy',
    desc: '"Revert" already means to return back. Use "revert".',
  },
  {
    regex: /\bfuture plans\b/gi,
    fix: 'plans',
    title: 'Redundancy',
    desc: 'Plans are inherently future-oriented. Use "plans".',
  },
  {
    regex: /\bcollaborate together\b/gi,
    fix: 'collaborate',
    title: 'Redundancy',
    desc: '"Collaborate" means to work together. Use "collaborate".',
  },
  {
    regex: /\bbasic fundamentals\b/gi,
    fix: 'fundamentals',
    title: 'Redundancy',
    desc: '"Fundamentals" are basic principles. Use "fundamentals".',
  },
  {
    regex: /\bsum total\b/gi,
    fix: 'total',
    title: 'Redundancy',
    desc: 'Use "total" or "sum", not both.',
  },
  {
    regex: /\bunexpected surprise\b/gi,
    fix: 'surprise',
    title: 'Redundancy',
    desc: 'A surprise is inherently unexpected. Use "surprise".',
  },
  {
    regex: /\bfree gift\b/gi,
    fix: 'gift',
    title: 'Redundancy',
    desc: 'Gifts are free by definition. Use "gift".',
  },
  {
    regex: /\badvance planning\b/gi,
    fix: 'planning',
    title: 'Redundancy',
    desc: 'Planning occurs in advance. Use "planning".',
  },
  {
    regex: /\btrue facts\b/gi,
    fix: 'facts',
    title: 'Redundancy',
    desc: 'Facts are inherently true. Use "facts".',
  }
];

function preserveCase(original: string, replacement: string): string {
  if (!original || !replacement) return replacement;
  if (original === original.toUpperCase()) {
    return replacement.toUpperCase();
  }
  if (original[0] === original[0].toUpperCase()) {
    return replacement[0].toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

export function detectGrammarAndPunctuationIssues(text: string): QAIssue[] {
  const issues: QAIssue[] = [];
  let idCounter = 1;

  // 1. Double repeated words ("the the", "is is", "in in", etc.)
  const doubleWordRegex = /\b([a-zA-Z]{2,})\s+\1\b/gi;
  let match: RegExpExecArray | null;
  while ((match = doubleWordRegex.exec(text)) !== null) {
    const word = match[1];
    // Ignore legitimate double words like "had had" in certain tenses if needed, but flag standard ones
    if (word.toLowerCase() !== 'that') {
      issues.push({
        id: `g-dup-${idCounter++}`,
        category: 'grammar',
        severity: 'critical',
        title: 'Repeated Word',
        description: `The word "${word}" is duplicated consecutively.`,
        originalText: match[0],
        suggestedText: word,
        startOffset: match.index,
        endOffset: match.index + match[0].length,
        lineNumber: getLineNumber(text, match.index),
        ruleId: 'repeated-words',
        autoApplicable: true,
      });
    }
  }

  // 2. Typos & Common Confusions
  for (const rule of TYPOS_AND_CONFUSIONS) {
    rule.regex.lastIndex = 0;
    while ((match = rule.regex.exec(text)) !== null) {
      const orig = match[0];
      const fix = typeof rule.fix === 'function' ? rule.fix(orig) : rule.fix;
      if (orig !== fix) {
        issues.push({
          id: `g-typo-${idCounter++}`,
          category: 'grammar',
          severity: rule.severity,
          title: rule.title,
          description: rule.desc,
          originalText: orig,
          suggestedText: fix,
          startOffset: match.index,
          endOffset: match.index + orig.length,
          lineNumber: getLineNumber(text, match.index),
          ruleId: 'common-typos',
          autoApplicable: true,
        });
      }
    }
  }

  // 3. Redundancies
  for (const rule of REDUNDANCIES) {
    rule.regex.lastIndex = 0;
    while ((match = rule.regex.exec(text)) !== null) {
      const orig = match[0];
      const fix = preserveCase(orig, rule.fix);
      issues.push({
        id: `g-red-${idCounter++}`,
        category: 'grammar',
        severity: 'suggestion',
        title: rule.title,
        description: rule.desc,
        originalText: orig,
        suggestedText: fix,
        startOffset: match.index,
        endOffset: match.index + orig.length,
        lineNumber: getLineNumber(text, match.index),
        ruleId: 'redundancy',
        autoApplicable: true,
      });
    }
  }

  // 4. Punctuation spacing: Space before punctuation (`word , next`)
  const spaceBeforePunctRegex = /(\w+)\s+([,;:?.!])/g;
  while ((match = spaceBeforePunctRegex.exec(text)) !== null) {
    const orig = match[0];
    const fix = `${match[1]}${match[2]}`;
    issues.push({
      id: `p-spc-bef-${idCounter++}`,
      category: 'typography',
      severity: 'warning',
      title: 'Unnecessary Space Before Punctuation',
      description: `Remove space before "${match[2]}".`,
      originalText: orig,
      suggestedText: fix,
      startOffset: match.index,
      endOffset: match.index + orig.length,
      lineNumber: getLineNumber(text, match.index),
      ruleId: 'space-before-punctuation',
      autoApplicable: true,
    });
  }

  // 5. Missing space after comma/semicolon (`word,next` when not a number/url)
  const missingSpaceAfterCommaRegex = /([a-zA-Z]),([a-zA-Z])/g;
  while ((match = missingSpaceAfterCommaRegex.exec(text)) !== null) {
    const orig = match[0];
    const fix = `${match[1]}, ${match[2]}`;
    issues.push({
      id: `p-spc-aft-${idCounter++}`,
      category: 'typography',
      severity: 'warning',
      title: 'Missing Space After Comma',
      description: 'Add a space after the comma to ensure proper readability.',
      originalText: orig,
      suggestedText: fix,
      startOffset: match.index,
      endOffset: match.index + orig.length,
      lineNumber: getLineNumber(text, match.index),
      ruleId: 'missing-space-after-comma',
      autoApplicable: true,
    });
  }

  // 6. Double space within sentences (excluding indentation)
  const doubleSpaceRegex = /([^\n\r ])  +([^\n\r ])/g;
  while ((match = doubleSpaceRegex.exec(text)) !== null) {
    const orig = match[0];
    const fix = `${match[1]} ${match[2]}`;
    issues.push({
      id: `p-dbl-spc-${idCounter++}`,
      category: 'typography',
      severity: 'suggestion',
      title: 'Multiple Consecutive Spaces',
      description: 'Replace double space with a single space.',
      originalText: orig,
      suggestedText: fix,
      startOffset: match.index,
      endOffset: match.index + orig.length,
      lineNumber: getLineNumber(text, match.index),
      ruleId: 'consecutive-spaces',
      autoApplicable: true,
    });
  }

  // 7. Double punctuation (`..` or `,,` or `??`) except ellipsis `...`
  const doublePunctRegex = /([a-zA-Z0-9])([,;])\2+/g;
  while ((match = doublePunctRegex.exec(text)) !== null) {
    const orig = match[0];
    const fix = `${match[1]}${match[2]}`;
    issues.push({
      id: `p-dbl-pct-${idCounter++}`,
      category: 'typography',
      severity: 'warning',
      title: 'Duplicate Punctuation',
      description: `Remove duplicate "${match[2]}" mark.`,
      originalText: orig,
      suggestedText: fix,
      startOffset: match.index,
      endOffset: match.index + orig.length,
      lineNumber: getLineNumber(text, match.index),
      ruleId: 'duplicate-punctuation',
      autoApplicable: true,
    });
  }

  // 8. Subject-verb agreement rules
  const svAgreementRules: Array<{ regex: RegExp; fix: string; title: string; desc: string }> = [
    {
      regex: /\b(there is several|there is many|there is multiple)\b/gi,
      fix: 'there are several',
      title: 'Subject-Verb Agreement',
      desc: 'Plural subject requires "there are" instead of "there is".',
    },
    {
      regex: /\b(these criteria is)\b/gi,
      fix: 'these criteria are',
      title: 'Subject-Verb Agreement (Plural)',
      desc: '"Criteria" is plural (singular: criterion), so use "are".',
    },
    {
      regex: /\b(this phenomenon are)\b/gi,
      fix: 'this phenomenon is',
      title: 'Subject-Verb Agreement (Singular)',
      desc: '"Phenomenon" is singular (plural: phenomena), so use "is".',
    },
    {
      regex: /\b(each of the reports have)\b/gi,
      fix: 'each of the reports has',
      title: 'Subject-Verb Agreement',
      desc: '"Each" takes a singular verb "has", not "have".',
    }
  ];

  for (const rule of svAgreementRules) {
    rule.regex.lastIndex = 0;
    while ((match = rule.regex.exec(text)) !== null) {
      const orig = match[0];
      const fix = preserveCase(orig, rule.fix);
      issues.push({
        id: `g-sv-${idCounter++}`,
        category: 'grammar',
        severity: 'critical',
        title: rule.title,
        description: rule.desc,
        originalText: orig,
        suggestedText: fix,
        startOffset: match.index,
        endOffset: match.index + orig.length,
        lineNumber: getLineNumber(text, match.index),
        ruleId: 'subject-verb-agreement',
        autoApplicable: true,
      });
    }
  }

  return issues;
}

// Fast line number lookup with memoized newline offset cache
let cachedTextForLines: string | null = null;
let cachedLineOffsets: number[] = [];

export function getLineOffsets(text: string): number[] {
  if (cachedTextForLines === text) {
    return cachedLineOffsets;
  }
  const offsets: number[] = [0];
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 10) { // '\n'
      offsets.push(i + 1);
    }
  }
  cachedTextForLines = text;
  cachedLineOffsets = offsets;
  return offsets;
}

export function getLineNumber(text: string, offset: number): number {
  if (offset <= 0) return 1;
  const offsets = getLineOffsets(text);
  let low = 0;
  let high = offsets.length - 1;
  let result = 0;

  while (low <= high) {
    const mid = (low + high) >> 1;
    if (offsets[mid] <= offset) {
      result = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return result + 1;
}
