import { QAIssue } from '../types';
import { getLineNumber } from './grammarRules';

export interface NumberContextEvaluation {
  isIdentifier: boolean;
  identifierType?: string;
  identifierLabel?: string;
  isCurrency: boolean;
  currencySymbol?: string;
  currencyCode?: string;
  isIndianFormat?: boolean;
  financialKeyword?: string;
  isDateOrYear?: boolean;
  isMeasurementOrCode?: boolean;
}

/**
 * Keywords and labels identifying continuous numbers that MUST NOT have commas.
 * (Case ID, Policy No, PIN code, License No, Claim No, Registration No, etc.)
 */
export const IDENTIFIER_LABEL_PATTERNS = [
  {
    type: 'case_id',
    label: 'Case ID',
    regex: /(?:case\s*(?:id|no\.?|number|ref(?:erence)?|file)?|case\s*#)/i,
  },
  {
    type: 'policy_no',
    label: 'Policy Number',
    regex: /(?:policy\s*(?:no\.?|number|ref(?:erence)?|doc|certificate|schedule)?|policy\s*#|pol\s*(?:no\.?|#)?)/i,
  },
  {
    type: 'pin_code',
    label: 'PIN / Postal Code',
    regex: /(?:pin\s*(?:code)?|postal\s*(?:code)?|zip\s*(?:code)?|pincode)/i,
  },
  {
    type: 'license_no',
    label: 'License Number',
    regex: /(?:(?:driver'?s?\s*)?(?:driving\s*)?licen[sc]e\s*(?:no\.?|number|id)?|dl\s*(?:no\.?|number)?|licen[sc]e\s*#|dl\s*#|permit\s*(?:no\.?|number|#)?)/i,
  },
  {
    type: 'claim_no',
    label: 'Claim Number',
    regex: /(?:claim\s*(?:no\.?|number|ref(?:erence)?|dossier)?|claim\s*#|intimation\s*(?:no\.?|#)?)/i,
  },
  {
    type: 'registration_no',
    label: 'Registration / RC Number',
    regex: /(?:(?:vehicle\s*)?reg(?:istration)?\s*(?:no\.?|number)?|reg\s*#|rc\s*(?:no\.?|number|#)?|vehicle\s*(?:no\.?|number|reg)|vehicle\s*#)/i,
  },
  {
    type: 'chassis_engine_no',
    label: 'Chassis / Engine Number',
    regex: /(?:chassis\s*(?:no\.?|number|#)?|engine\s*(?:no\.?|number|#)?|vin\s*(?:no\.?|number|#)?)/i,
  },
  {
    type: 'account_no',
    label: 'Account Number',
    regex: /(?:account\s*(?:no\.?|number|#)?|a\/c\s*(?:no\.?|number|#)?|bank\s*a\/c|acc\s*(?:no\.?|number|#)?)/i,
  },
  {
    type: 'serial_part_no',
    label: 'Serial / Part / Model Number',
    regex: /(?:serial\s*(?:no\.?|number|#)?|sr\.?\s*no\.?|part\s*(?:no\.?|number|#)?|model\s*(?:no\.?|number|#)?|batch\s*(?:no\.?|number|#)?|lot\s*(?:no\.?|number|#)?)/i,
  },
  {
    type: 'invoice_bill_no',
    label: 'Invoice / Bill Number',
    regex: /(?:invoice\s*(?:no\.?|number|#)?|bill\s*(?:no\.?|number|#)?|receipt\s*(?:no\.?|number|#)?|challan\s*(?:no\.?|number|#)?|voucher\s*(?:no\.?|number|#)?)/i,
  },
  {
    type: 'order_tracking_no',
    label: 'Order / Tracking ID',
    regex: /(?:order\s*(?:id|no\.?|number|#)?|tracking\s*(?:id|no\.?|number|#)?|consignment\s*(?:no\.?|number|#)?|docket\s*(?:no\.?|number|#)?|awb\s*(?:no\.?|number|#)?)/i,
  },
  {
    type: 'identity_tax_no',
    label: 'ID / Tax Number',
    regex: /(?:aadhaar|pan\b|tin\b|gstin\b|ssn\b|tax\s*id|national\s*id|voter\s*id|passport\s*(?:no\.?|number|#)?|uid\s*(?:no\.?|number|#)?)/i,
  },
  {
    type: 'contact_phone_no',
    label: 'Phone / Contact Number',
    regex: /(?:phone\s*(?:no\.?|number|#)?|mobile\s*(?:no\.?|number|#)?|tel(?:ephone)?\s*(?:no\.?|number|#)?|fax\s*(?:no\.?|number|#)?|cell\s*(?:no\.?|number|#)?)/i,
  },
  {
    type: 'survey_ref_no',
    label: 'Survey Reference Number',
    regex: /(?:survey\s*(?:ref(?:erence)?|report\s*(?:no\.?|number|#)?)|file\s*(?:no\.?|number|#)?|dossier\s*(?:no\.?|number|#)?|ref(?:erence)?\s*(?:no\.?|number|#))/i,
  },
];

/**
 * Currency keywords, symbols, and ISO codes.
 * Comma separation (e.g., 10,000 vs 10000) is strictly for currency and financial figures.
 */
export const CURRENCY_SYMBOLS = ['$', '€', '£', '¥', '₹'];
export const CURRENCY_CODES = ['USD', 'EUR', 'GBP', 'INR', 'Rs', 'Rs.', 'CAD', 'AUD', 'SGD', 'CHF', 'AED', 'SAR'];

/**
 * Financial line-item keywords in loss assessment and corporate reporting.
 */
export const FINANCIAL_LINE_KEYWORDS = /\b(?:gross\s+loss|loss\s+assessed|net\s+assessed|assessed\s+liability|depreciation|salvage|excess|deductible|sum\s+insured|liability|premium|claimed\s+amount|invoice\s+amount|estimated\s+cost|repair\s+estimate|total\s+assessed|tax|gst|tds|net\s+payable|subtotal|grand\s+total|balance\s+due|fee|charges|cost|amount)\b/i;

/**
 * Evaluates whether a number at a given position in text represents an identifier, currency, date, or other.
 */
export function evaluateNumberContext(
  text: string,
  startOffset: number,
  endOffset: number,
  numStr: string
): NumberContextEvaluation {
  const result: NumberContextEvaluation = {
    isIdentifier: false,
    isCurrency: false,
  };

  // Find line boundaries
  const lineStart = text.lastIndexOf('\n', startOffset - 1) + 1;
  let lineEnd = text.indexOf('\n', endOffset);
  if (lineEnd === -1) lineEnd = text.length;
  const line = text.slice(lineStart, lineEnd);
  const offsetInLine = startOffset - lineStart;

  // Preceding snippet (up to 80 chars before the number on the same line)
  const preLine = line.slice(Math.max(0, offsetInLine - 80), offsetInLine);
  // Following snippet (up to 40 chars after the number on the same line)
  const postLine = line.slice(offsetInLine + numStr.length, Math.min(line.length, offsetInLine + numStr.length + 40));

  // 1. Check if preceded by identifier labels (e.g. "Policy No:", "Case ID:", "PIN code:", "License No:")
  for (const pattern of IDENTIFIER_LABEL_PATTERNS) {
    if (pattern.regex.test(preLine)) {
      result.isIdentifier = true;
      result.identifierType = pattern.type;
      result.identifierLabel = pattern.label;
      return result;
    }
  }

  // 2. Check for continuous identifier structural characteristics:
  // A. Leading zero (e.g. 012345, 00291) - currency amounts never have leading zeros
  if (/^0\d+/.test(numStr)) {
    result.isIdentifier = true;
    result.identifierType = 'code_with_leading_zero';
    result.identifierLabel = 'Code / Identifier';
    return result;
  }

  // B. Preceded by "#" or "No." or "Ref." or "ID."
  if (/[#№]|(?:no|id|ref|code)\s*[:=–.-]?\s*$/i.test(preLine.trim())) {
    result.isIdentifier = true;
    result.identifierType = 'generic_id';
    result.identifierLabel = 'Identifier Number';
    return result;
  }

  // C. Address PIN / ZIP code context (e.g. "New Delhi 110001", "Mumbai - 400001", "Beverly Hills, CA 90210")
  if (
    /(?:[A-Za-z]+(?:\s+[A-Za-z]+)?\s*[,-–]?\s*(?:[A-Z]{2}\s*)?)$/.test(preLine.trim()) &&
    /^(?:\d{5}|\d{6})$/.test(numStr)
  ) {
    // 5-digit ZIP or 6-digit PIN code following a location
    if (/(?:delhi|mumbai|bangalore|bengaluru|kolkata|chennai|hyderabad|pune|ahmedabad|jaipur|noida|gurgaon|chandigarh|california|texas|florida|york|ohio|chicago|london)\b/i.test(preLine)) {
      result.isIdentifier = true;
      result.identifierType = 'pin_code';
      result.identifierLabel = 'PIN / Postal Code';
      return result;
    }
  }

  // D. Date / Year context: 1900 - 2099
  const intVal = parseInt(numStr.replace(/,/g, ''), 10);
  if (intVal >= 1900 && intVal <= 2099 && numStr.length === 4) {
    if (/(?:in|since|during|year|yr|dated|from|to|between|until|before|after|fy|ay)\s*$/i.test(preLine.trim()) ||
        /^[-\/.]\d{1,2}/.test(postLine) || /\d{1,2}[-\/.]\s*$/.test(preLine)) {
      result.isDateOrYear = true;
      return result;
    }
  }

  // E. Time / Technical specs (e.g. "1000 hrs", "1430 hours", "1920x1080", "2400 MHz", "8080 port")
  if (/^\s*(?:hrs?|hours?|mhz|ghz|rpm|px|dpi|psi|port|kbps|mbps|bps|am|pm)\b/i.test(postLine)) {
    result.isMeasurementOrCode = true;
    return result;
  }
  if (/(?:section|clause|article|rule|act|form|iso|astm|schedule)\s*$/i.test(preLine.trim())) {
    result.isMeasurementOrCode = true;
    return result;
  }

  // 3. Check for Currency and Monetary Indicators
  // A. Currency Symbol immediately attached or separated by small whitespace
  const symbolBefore = preLine.trim().slice(-1);
  if (CURRENCY_SYMBOLS.includes(symbolBefore)) {
    result.isCurrency = true;
    result.currencySymbol = symbolBefore;
    if (symbolBefore === '₹') {
      result.isIndianFormat = true;
    }
    return result;
  }

  // B. Currency code prefix (e.g. "USD 50000", "INR 150000", "Rs. 45000", "Rs 50000")
  const codePrefixMatch = preLine.match(/\b(USD|EUR|GBP|INR|Rs\.?|CAD|AUD|SGD|CHF|AED|SAR)\s*$/i);
  if (codePrefixMatch) {
    result.isCurrency = true;
    result.currencyCode = codePrefixMatch[1];
    if (/^(?:INR|Rs\.?)$/i.test(codePrefixMatch[1])) {
      result.isIndianFormat = true;
    }
    return result;
  }

  // C. Currency code or words suffix (e.g. "50000 USD", "45000 INR", "50000 dollars", "150000 rupees")
  const codeSuffixMatch = postLine.match(/^\s*(USD|EUR|GBP|INR|dollars|euros|pounds|rupees|cents|bucks)\b/i);
  if (codeSuffixMatch) {
    result.isCurrency = true;
    result.currencyCode = codeSuffixMatch[1];
    if (/^(?:INR|rupees)$/i.test(codeSuffixMatch[1])) {
      result.isIndianFormat = true;
    }
    return result;
  }

  // D. Financial line keyword on same line (e.g. "Gross Loss Assessed: 140000", "Salvage Value: 12500")
  const finMatch = line.match(FINANCIAL_LINE_KEYWORDS);
  if (finMatch) {
    result.isCurrency = true;
    result.financialKeyword = finMatch[0];
    // Check document context for Indian currency vs International
    if (/\b(?:₹|INR|Rs\.?|lakh|crore)\b/i.test(text)) {
      result.isIndianFormat = true;
    }
    return result;
  }

  return result;
}

/**
 * Formats a number with comma separators.
 * - If isIndianFormat is true: Indian numbering format (e.g. 1,50,000, 12,50,000)
 * - Otherwise: International 3-digit comma format (e.g. 150,000, 1,250,000)
 */
export function formatNumberWithCommas(numStr: string, isIndianFormat: boolean = false): string {
  // Separate integer and fractional part if any
  const parts = numStr.split('.');
  let intPart = parts[0].replace(/,/g, '');
  const decimalPart = parts.length > 1 ? `.${parts[1]}` : '';

  if (isIndianFormat) {
    // Indian grouping: last 3 digits, then groups of 2 digits
    if (intPart.length <= 3) {
      return intPart + decimalPart;
    }
    const lastThree = intPart.slice(-3);
    const rest = intPart.slice(0, -3);
    const formattedRest = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    return `${formattedRest},${lastThree}${decimalPart}`;
  } else {
    // Standard international grouping: groups of 3 digits
    const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return formattedInt + decimalPart;
  }
}

/**
 * Robust scan for Continuous Identifiers that mistakenly have commas.
 * (e.g. Case ID: 104,928 -> 104928; Policy No: 98,451,203 -> 98451203; PIN: 110,001 -> 110001; License No: 48,39,201 -> 4839201)
 */
export function scanContinuousIdentifiersWithCommas(text: string): QAIssue[] {
  const issues: QAIssue[] = [];
  let idCounter = 1;
  const processedOffsets = new Set<number>();

  // Iterate through all identifier patterns
  for (const pattern of IDENTIFIER_LABEL_PATTERNS) {
    // Matches the identifier label followed by punctuation (: = - – — | . # or words like is/was/of)
    // and captures the number with commas
    const labelRegex = new RegExp(
      `\\b(${pattern.regex.source})(?:\\s*[:=–—|.-]|\\s+(?:is|was|of|#|no\\.?))*\\s*([A-Za-z0-9/–-]*\\b\\d{1,4}(?:,\\d{2,4})+(?:[A-Za-z0-9/–-]*\\b)?)`,
      'gi'
    );

    let match: RegExpExecArray | null;
    while ((match = labelRegex.exec(text)) !== null) {
      const fullSnippet = match[0];
      const rawNumberWithComma = match[match.length - 1]; // The captured number
      
      // Must contain a comma within digits (e.g. 104,928 or 48,39,201)
      if (!/\d,\d/.test(rawNumberWithComma)) continue;

      const numOffsetInSnippet = fullSnippet.lastIndexOf(rawNumberWithComma);
      const startOffset = match.index + numOffsetInSnippet;
      const endOffset = startOffset + rawNumberWithComma.length;

      // Avoid duplicate issues at the exact same offset
      if (processedOffsets.has(startOffset)) continue;

      // Verify that this is NOT preceded by currency symbols (e.g. "$104,928" or "₹110,001")
      const charBefore = text.slice(Math.max(0, startOffset - 2), startOffset).trim();
      if (CURRENCY_SYMBOLS.includes(charBefore)) continue;

      // Verify that this is NOT followed by currency codes/words (e.g. "104,928 USD" or "104,928 dollars")
      const snippetAfter = text.slice(endOffset, Math.min(text.length, endOffset + 15));
      if (/^\s*(?:USD|EUR|GBP|INR|dollars|euros|pounds|rupees|cents)\b/i.test(snippetAfter)) {
        continue;
      }

      processedOffsets.add(startOffset);
      const cleanNumber = rawNumberWithComma.replace(/,/g, '');
      const lineNumber = getLineNumber(text, startOffset);

      issues.push({
        id: `id-comma-${idCounter++}`,
        category: 'data-continuity',
        severity: 'warning',
        title: `Continuous Identifier with Erroneous Comma (${pattern.label})`,
        description: `${pattern.label} "${rawNumberWithComma}" contains comma separation. Continuous identification numbers (Case IDs, Policy numbers, PIN codes, License numbers, and Claim numbers) must remain contiguous without comma delimiters. Comma separators are reserved for currency amounts.`,
        originalText: rawNumberWithComma,
        suggestedText: cleanNumber,
        startOffset,
        endOffset,
        lineNumber,
        ruleId: 'continuous-identifier-comma',
        autoApplicable: true,
        explanation: `Continuous numbers such as Case IDs, Policy numbers, PIN codes, and Driving License numbers do not represent financial quantities. They must be written as unbroken contiguous digits without comma separation.`,
      });
    }
  }

  return issues;
}

/**
 * Robust scan for Currency and Financial Figures that are missing comma separators.
 * (e.g. $50000 -> $50,000; Rs. 45000 -> Rs. 45,000; USD 620000 -> USD 620,000; Salvage Value: 12500 -> Salvage Value: 12,500)
 * Strictly excludes continuous identifiers, years, dates, codes, and measurements.
 */
export function scanCurrencyThousandsSeparators(text: string): QAIssue[] {
  const issues: QAIssue[] = [];
  let idCounter = 1;

  // Determine dominant document currency convention (Indian format vs International)
  const isIndianDoc = /\b(?:₹|INR|Rs\.?|lakh|crore)\b/i.test(text);

  // Pattern A: Number directly attached to or preceded by a currency symbol ($50000, €25000, £12500, ₹150000)
  const symbolCurrencyRegex = /([$€£¥₹])\s*(\d{4,}(?:\.\d+)?)\b/g;
  let symMatch: RegExpExecArray | null;
  while ((symMatch = symbolCurrencyRegex.exec(text)) !== null) {
    const symbol = symMatch[1];
    const rawNum = symMatch[2];
    const matchIndex = symMatch.index;

    // Verify not an identifier context
    const evalCtx = evaluateNumberContext(text, matchIndex, matchIndex + symMatch[0].length, rawNum);
    if (evalCtx.isIdentifier || evalCtx.isDateOrYear || evalCtx.isMeasurementOrCode) {
      continue;
    }

    const isIndian = symbol === '₹' || isIndianDoc;
    const formattedNum = formatNumberWithCommas(rawNum, isIndian);
    if (formattedNum === rawNum) continue;

    const fullOriginal = symMatch[0];
    const fullSuggested = `${symbol}${formattedNum}`;

    issues.push({
      id: `curr-sep-${idCounter++}`,
      category: 'uniformity',
      severity: 'suggestion',
      title: 'Thousands Separator for Currency Amount',
      description: `Currency amount "${fullOriginal}" is missing thousands comma separator. Format as "${fullSuggested}".`,
      originalText: fullOriginal,
      suggestedText: fullSuggested,
      startOffset: matchIndex,
      endOffset: matchIndex + fullOriginal.length,
      lineNumber: getLineNumber(text, matchIndex),
      ruleId: 'currency-thousands-separator',
      autoApplicable: true,
      explanation: `Financial and currency figures must use comma separators (e.g. ${symbol}10,000) for clarity, whereas continuous identifiers (Case ID, Policy No, PIN code) do not.`,
    });
  }

  // Pattern B: Number preceded by Currency Code (e.g. "USD 620000", "Rs. 45000", "INR 150000", "EUR 25000")
  const codePrefixRegex = /\b(USD|EUR|GBP|INR|Rs\.?|CAD|AUD|SGD|CHF|AED)\s+(\d{4,}(?:\.\d+)?)\b/gi;
  let codeMatch: RegExpExecArray | null;
  while ((codeMatch = codePrefixRegex.exec(text)) !== null) {
    const code = codeMatch[1];
    const rawNum = codeMatch[2];
    const matchIndex = codeMatch.index;

    const evalCtx = evaluateNumberContext(text, matchIndex, matchIndex + codeMatch[0].length, rawNum);
    if (evalCtx.isIdentifier || evalCtx.isDateOrYear || evalCtx.isMeasurementOrCode) {
      continue;
    }

    const isIndian = /^(?:INR|Rs\.?)$/i.test(code) || isIndianDoc;
    const formattedNum = formatNumberWithCommas(rawNum, isIndian);
    if (formattedNum === rawNum) continue;

    const fullOriginal = codeMatch[0];
    const fullSuggested = `${code} ${formattedNum}`;

    issues.push({
      id: `curr-code-sep-${idCounter++}`,
      category: 'uniformity',
      severity: 'suggestion',
      title: 'Thousands Separator for Currency Amount',
      description: `Currency amount "${fullOriginal}" is missing thousands comma separator. Format as "${fullSuggested}".`,
      originalText: fullOriginal,
      suggestedText: fullSuggested,
      startOffset: matchIndex,
      endOffset: matchIndex + fullOriginal.length,
      lineNumber: getLineNumber(text, matchIndex),
      ruleId: 'currency-thousands-separator',
      autoApplicable: true,
      explanation: `Financial figures should use comma separators for clear presentation in official reports.`,
    });
  }

  // Pattern C: Number followed by Currency Code (e.g. "620000 USD", "45000 INR", "50000 dollars")
  const codeSuffixRegex = /\b(\d{4,}(?:\.\d+)?)\s+(USD|EUR|GBP|INR|dollars|euros|pounds|rupees)\b/gi;
  let suffixMatch: RegExpExecArray | null;
  while ((suffixMatch = codeSuffixRegex.exec(text)) !== null) {
    const rawNum = suffixMatch[1];
    const suffix = suffixMatch[2];
    const matchIndex = suffixMatch.index;

    const evalCtx = evaluateNumberContext(text, matchIndex, matchIndex + suffixMatch[0].length, rawNum);
    if (evalCtx.isIdentifier || evalCtx.isDateOrYear || evalCtx.isMeasurementOrCode) {
      continue;
    }

    const isIndian = /^(?:INR|rupees)$/i.test(suffix) || isIndianDoc;
    const formattedNum = formatNumberWithCommas(rawNum, isIndian);
    if (formattedNum === rawNum) continue;

    const fullOriginal = suffixMatch[0];
    const fullSuggested = `${formattedNum} ${suffix}`;

    issues.push({
      id: `curr-sfx-sep-${idCounter++}`,
      category: 'uniformity',
      severity: 'suggestion',
      title: 'Thousands Separator for Currency Amount',
      description: `Currency amount "${fullOriginal}" is missing thousands comma separator. Format as "${fullSuggested}".`,
      originalText: fullOriginal,
      suggestedText: fullSuggested,
      startOffset: matchIndex,
      endOffset: matchIndex + fullOriginal.length,
      lineNumber: getLineNumber(text, matchIndex),
      ruleId: 'currency-thousands-separator',
      autoApplicable: true,
      explanation: `Currency figures should include comma separators for standard financial reporting.`,
    });
  }

  // Pattern D: Explicit financial/loss assessment schedule line items without currency symbols:
  // e.g. "Salvage Value: 12500" or "Net Assessed Liability: 104500" or "Gross Loss Assessed: 140000"
  const finLineRegex = new RegExp(
    `(${FINANCIAL_LINE_KEYWORDS.source})\\s*[:=–-]?\\s*\\b(\\d{4,}(?:\\.\\d+)?)\\b`,
    'gi'
  );
  let finLineMatch: RegExpExecArray | null;
  while ((finLineMatch = finLineRegex.exec(text)) !== null) {
    const rawLabel = finLineMatch[1];
    const rawNum = finLineMatch[2];
    const fullSnippet = finLineMatch[0];
    const matchIndex = finLineMatch.index;

    // Verify it isn't an identifier
    const evalCtx = evaluateNumberContext(text, matchIndex, matchIndex + fullSnippet.length, rawNum);
    if (evalCtx.isIdentifier || evalCtx.isDateOrYear || evalCtx.isMeasurementOrCode) {
      continue;
    }

    const formattedNum = formatNumberWithCommas(rawNum, isIndianDoc);
    if (formattedNum === rawNum) continue;

    const numOffset = matchIndex + fullSnippet.lastIndexOf(rawNum);

    issues.push({
      id: `fin-line-sep-${idCounter++}`,
      category: 'uniformity',
      severity: 'suggestion',
      title: `Thousands Separator for Financial Line (${rawLabel})`,
      description: `Financial metric "${rawLabel}" specifies "${rawNum}" without thousands separators. Format as "${formattedNum}".`,
      originalText: rawNum,
      suggestedText: formattedNum,
      startOffset: numOffset,
      endOffset: numOffset + rawNum.length,
      lineNumber: getLineNumber(text, numOffset),
      ruleId: 'currency-thousands-separator',
      autoApplicable: true,
      explanation: `Financial assessment metrics should maintain consistent comma separators for readability.`,
    });
  }

  return issues;
}
