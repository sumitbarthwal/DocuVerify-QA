import { QAIssue } from '../types';
import { getLineNumber } from './grammarRules';

export interface CitationAuditItem {
  id: string;
  type: 'table' | 'photo' | 'figure' | 'annexure' | 'exhibit';
  refIdentifier: string;
  citedInText: boolean;
  definedInDoc: boolean;
  citationLineNumber?: number;
  definitionLineNumber?: number;
  status: 'matched' | 'missing_definition' | 'uncited_element';
  summary: string;
}

/**
 * Intelligent Cross-Reference, Citation & Sequence Tracker
 */
export function auditDocumentCitations(documentText: string): {
  issues: QAIssue[];
  citationItems: CitationAuditItem[];
} {
  const issues: QAIssue[] = [];
  const citationItems: CitationAuditItem[] = [];
  let idCounter = 1;

  // 1. Detect all Defined Tables in the document
  const definedTables = new Set<number>();
  const tableTitleRegex = /(?:table|schedule)\s*(\d+)[:–-]/gi;
  let tMatch: RegExpExecArray | null;
  while ((tMatch = tableTitleRegex.exec(documentText)) !== null) {
    definedTables.add(parseInt(tMatch[1], 10));
  }

  // Also count markdown table blocks
  const tableBlocks = (documentText.match(/\n\|[^\n]+\|\n\|[-:\s|]+\|\n/g) || []).length;
  for (let i = 1; i <= tableBlocks; i++) {
    definedTables.add(i);
  }

  // 2. Detect all Defined Photos / Images in document
  const definedPhotos = new Set<number>();
  const photoPlateRegex = /(?:photo(?:graph)?\s*(?:plate)?|plate)\s*(?:no\.?|#)?\s*(\d+)/gi;
  let pMatch: RegExpExecArray | null;
  while ((pMatch = photoPlateRegex.exec(documentText)) !== null) {
    definedPhotos.add(parseInt(pMatch[1], 10));
  }
  const embeddedImagesCount = (documentText.match(/!\[.*?\]\(.*?\)/g) || []).length;
  for (let i = 1; i <= embeddedImagesCount; i++) {
    definedPhotos.add(i);
  }

  // 3. Detect all Defined Annexures / Exhibits
  const definedAnnexures = new Set<string>();
  const annexureRegex = /(?:annexure|exhibit|appendix)\s*([A-Za-z0-9]+)[:–-]/gi;
  let aMatch: RegExpExecArray | null;
  while ((aMatch = annexureRegex.exec(documentText)) !== null) {
    definedAnnexures.add(aMatch[1].toUpperCase());
  }

  // 4. Scan narrative citations in text: e.g. "refer to Table 4", "as seen in Table 3"
  const tableCitationRegex = /\b(?:refer\s+to|see|in|per|detailed\s+in|shown\s+in|table)\s+table\s+(\d+)\b/gi;
  let tcMatch: RegExpExecArray | null;
  const citedTables = new Set<number>();

  while ((tcMatch = tableCitationRegex.exec(documentText)) !== null) {
    const tableNum = parseInt(tcMatch[1], 10);
    citedTables.add(tableNum);
    const lineNum = getLineNumber(documentText, tcMatch.index);

    if (!definedTables.has(tableNum) && tableNum > definedTables.size) {
      issues.push({
        id: `cite-table-missing-${idCounter++}`,
        category: 'data-continuity',
        severity: 'critical',
        title: `Broken Cross-Reference: Table ${tableNum}`,
        description: `Text cites "Table ${tableNum}", but the document only contains ${definedTables.size} defined tables (Tables ${Array.from(definedTables).sort((a,b)=>a-b).join(', ') || 'none'}).`,
        originalText: tcMatch[0],
        suggestedText: tcMatch[0],
        startOffset: tcMatch.index,
        endOffset: tcMatch.index + tcMatch[0].length,
        lineNumber: lineNum,
        ruleId: 'broken-cross-reference-table',
        autoApplicable: false,
        explanation: `All cross-references in technical reports must correspond to actual tables present in the document.`,
      });

      citationItems.push({
        id: `cite-tbl-${tableNum}`,
        type: 'table',
        refIdentifier: `Table ${tableNum}`,
        citedInText: true,
        definedInDoc: false,
        citationLineNumber: lineNum,
        status: 'missing_definition',
        summary: `Cited in text on line ${lineNum}, but Table ${tableNum} is missing from document body.`,
      });
    } else {
      citationItems.push({
        id: `cite-tbl-${tableNum}`,
        type: 'table',
        refIdentifier: `Table ${tableNum}`,
        citedInText: true,
        definedInDoc: true,
        citationLineNumber: lineNum,
        status: 'matched',
        summary: `Successfully verified reference to Table ${tableNum}.`,
      });
    }
  }

  // 5. Scan narrative citations for Photo Plates: e.g. "refer to Photo Plate 6"
  const photoCitationRegex = /\b(?:see|refer\s+to|shown\s+in|photograph\s+in)?\s*(?:photo(?:graph)?\s*(?:plate)?|plate)\s*(?:no\.?|#)?\s*(\d+)\b/gi;
  let pcMatch: RegExpExecArray | null;
  const citedPhotos = new Set<number>();

  while ((pcMatch = photoCitationRegex.exec(documentText)) !== null) {
    const photoNum = parseInt(pcMatch[1], 10);
    // Ignore if this is the definition line itself (e.g. "Photo Plate 1: Frontal Damage")
    const preText = documentText.slice(Math.max(0, pcMatch.index - 20), pcMatch.index);
    if (/^[#\*\s]*$/.test(preText)) continue;

    citedPhotos.add(photoNum);
    const lineNum = getLineNumber(documentText, pcMatch.index);

    if (!definedPhotos.has(photoNum) && photoNum > definedPhotos.size) {
      issues.push({
        id: `cite-photo-missing-${idCounter++}`,
        category: 'data-continuity',
        severity: 'warning',
        title: `Unlinked Photographic Plate Citation: Plate ${photoNum}`,
        description: `Narrative references "Photo Plate ${photoNum}", but there is no corresponding plate or image # ${photoNum} in the document.`,
        originalText: pcMatch[0],
        suggestedText: pcMatch[0],
        startOffset: pcMatch.index,
        endOffset: pcMatch.index + pcMatch[0].length,
        lineNumber: lineNum,
        ruleId: 'unlinked-photo-plate-reference',
        autoApplicable: false,
        explanation: `Survey and forensic reports require that every referenced photographic evidence plate is appended to the document.`,
      });

      citationItems.push({
        id: `cite-photo-${photoNum}`,
        type: 'photo',
        refIdentifier: `Photo Plate ${photoNum}`,
        citedInText: true,
        definedInDoc: false,
        citationLineNumber: lineNum,
        status: 'missing_definition',
        summary: `Photo Plate ${photoNum} referenced in text, but missing from photographic exhibit section.`,
      });
    }
  }

  // 6. Sequential numbering gap detection: e.g. Table 1, Table 2, Table 4 (missing Table 3)
  const sortedTableNums = Array.from(definedTables).sort((a, b) => a - b);
  for (let i = 0; i < sortedTableNums.length - 1; i++) {
    const current = sortedTableNums[i];
    const next = sortedTableNums[i + 1];
    if (next > current + 1) {
      issues.push({
        id: `seq-table-gap-${idCounter++}`,
        category: 'uniformity',
        severity: 'warning',
        title: `Table Sequence Jump: Table ${current} to ${next}`,
        description: `Document sequence jumps from Table ${current} to Table ${next} without a Table ${current + 1}.`,
        originalText: `Table ${next}`,
        suggestedText: `Table ${current + 1}`,
        startOffset: documentText.indexOf(`Table ${next}`),
        endOffset: documentText.indexOf(`Table ${next}`) + `Table ${next}`.length,
        lineNumber: getLineNumber(documentText, Math.max(0, documentText.indexOf(`Table ${next}`))),
        ruleId: 'sequential-table-numbering',
        autoApplicable: false,
        explanation: `Tables must be numbered sequentially without missing index numbers.`,
      });
    }
  }

  return { issues, citationItems };
}
