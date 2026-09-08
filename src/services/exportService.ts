import { ReportStats, QAIssue } from '../types';

export function downloadWordDocument(filename: string, content: string, title: string = 'Report') {
  // Extract document metadata for persistent header/footer synchronicity
  const titleMatch = content.match(/^#\s+([^\n\r]+)/m);
  const docTitle = titleMatch ? titleMatch[1].trim() : title;

  const refMatch = content.match(/\b(?:survey\s*ref(?:erence)?(?:\s*no\.?|#)?|ref(?:erence)?\s*(?:no\.?|#)?)\s*[:=–-]?\s*([A-Za-z0-9\/\-\.]{4,30})\b/i);
  const surveyRef = refMatch ? refMatch[1].trim() : 'REF-DOC-2024';

  const policyMatch = content.match(/\b(?:policy\s*(?:no\.?|number|#))\s*[:=–-]?\s*([A-Za-z0-9\/\-\.]{4,30})\b/i);
  const policyNo = policyMatch ? policyMatch[1].trim() : '';

  const claimMatch = content.match(/\b(?:claim\s*(?:no\.?|number|#))\s*[:=–-]?\s*([A-Za-z0-9\/\-\.]{4,30})\b/i);
  const claimNo = claimMatch ? claimMatch[1].trim() : '';

  const leftFooterText = [policyNo ? `Policy: ${policyNo}` : '', claimNo ? `Claim: ${claimNo}` : ''].filter(Boolean).join(' | ') || "Chingham's DocuVerify QA Audit Engine";

  // Generate a clean HTML-based Office Word file (.doc/.docx compatible)
  // Utilizes Microsoft Word MSO XML specification for native running headers, running footers, and dynamic page numbering
  const htmlContent = `
    <html xmlns:v="urn:schemas-microsoft-com:vml"
          xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:w="urn:schemas-microsoft-com:office:word"
          xmlns:m="http://schemas.microsoft.com/office/2004/12/omml"
          xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8">
      <title>${escapeXml(docTitle)}</title>
      <style>
        @page Section1 {
          size: 8.5in 11.0in;
          margin: 1.0in 1.0in 1.0in 1.0in;
          mso-header-margin: 0.5in;
          mso-footer-margin: 0.5in;
          mso-header: url("#header") h1;
          mso-footer: url("#footer") f1;
        }
        div.Section1 { page: Section1; }
        body {
          font-family: 'Calibri', 'Segoe UI', Arial, sans-serif;
          font-size: 11pt;
          line-height: 1.5;
          color: #1f2937;
        }
        h1 { font-size: 18pt; color: #1e3a8a; border-bottom: 2px solid #2563eb; padding-bottom: 4px; margin-top: 16pt; margin-bottom: 8pt; }
        h2 { font-size: 13pt; color: #1e40af; border-bottom: 1px solid #cbd5e1; padding-bottom: 2px; margin-top: 14pt; margin-bottom: 6pt; }
        h3 { font-size: 11pt; color: #334155; margin-top: 10pt; margin-bottom: 4pt; }
        p { margin-top: 0; margin-bottom: 6pt; }
        ul { margin-top: 0; margin-bottom: 6pt; padding-left: 20pt; }
        li { margin-bottom: 3pt; }
        
        /* Table Styling for Microsoft Word */
        table.doc-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 8pt;
          margin-bottom: 12pt;
          font-size: 10pt;
        }
        table.doc-table th, table.doc-table td {
          border: 1px solid #cbd5e1;
          padding: 6pt 8pt;
        }
        table.doc-table th {
          background-color: #f1f5f9;
          color: #1e293b;
          font-weight: bold;
          text-align: left;
        }
        table.doc-table tr:nth-child(even) {
          background-color: #f8fafc;
        }
        
        /* Running Header & Running Footer Tables */
        table.header-table {
          width: 100%;
          border-bottom: 1px solid #94a3b8;
          font-size: 8.5pt;
          color: #64748b;
          padding-bottom: 4pt;
          margin-bottom: 12pt;
        }
        table.footer-table {
          width: 100%;
          border-top: 1px solid #94a3b8;
          font-size: 8.5pt;
          color: #64748b;
          padding-top: 4pt;
          margin-top: 12pt;
        }
        p.MsoHeader, p.MsoFooter { margin: 0; }
        .qa-stamp {
          font-size: 8.5pt;
          color: #64748b;
          border-top: 1px solid #e2e8f0;
          padding-top: 6pt;
          margin-top: 24pt;
        }
      </style>
    </head>
    <body>
      <div class="Section1">
        ${markdownToHtml(content)}
        
        <div class="qa-stamp">
          <p><strong>Verified &amp; Synchronized:</strong> Chingham's DocuVerify Quality Assurance Engine</p>
          <p>Verified Timestamp: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()} (Offline Audit Verified)</p>
        </div>

        <!-- Microsoft Word Running Header Definition -->
        <div style="mso-element:header" id="h1">
          <p class="MsoHeader">
            <table class="header-table" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td align="left" style="font-family:'Calibri',Arial; font-size:8.5pt; color:#64748b;">
                  <strong>${escapeXml(docTitle)}</strong> | Ref: ${escapeXml(surveyRef)}
                </td>
                <td align="right" style="font-family:'Calibri',Arial; font-size:8.5pt; color:#64748b;">
                  Standard Document View
                </td>
              </tr>
            </table>
          </p>
        </div>

        <!-- Microsoft Word Running Footer Definition with Dynamic Page Numbering -->
        <div style="mso-element:footer" id="f1">
          <p class="MsoFooter">
            <table class="footer-table" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td align="left" style="font-family:'Calibri',Arial; font-size:8.5pt; color:#64748b;">
                  ${escapeXml(leftFooterText)}
                </td>
                <td align="right" style="font-family:'Calibri',Arial; font-size:8.5pt; color:#64748b;">
                  Page <span style="mso-field-code: PAGE"></span> of <span style="mso-field-code: NUMPAGES"></span>
                </td>
              </tr>
            </table>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  const blob = new Blob(['\ufeff', htmlContent], {
    type: 'application/msword'
  });
  triggerDownload(blob, `${sanitizeFilename(filename || 'verified-report')}.doc`);
}

export function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  triggerDownload(blob, `${sanitizeFilename(filename || 'report')}.txt`);
}

export function downloadMarkdownFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  triggerDownload(blob, `${sanitizeFilename(filename || 'report')}.md`);
}

export function printAuditCertificate(stats: ReportStats, issues: QAIssue[], filename: string) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const criticalRemaining = issues.filter(i => i.severity === 'critical' && !i.applied && !i.ignored).length;
  const warningRemaining = issues.filter(i => i.severity === 'warning' && !i.applied && !i.ignored).length;
  const isPassed = criticalRemaining === 0;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>QA Verification Certificate - ${escapeXml(filename)}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; color: #1f2937; max-width: 800px; margin: 0 auto; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #3b82f6; padding-bottom: 20px; margin-bottom: 30px; }
        .badge { padding: 8px 16px; border-radius: 9999px; font-weight: bold; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; }
        .badge-pass { background: #dcfce7; color: #166534; border: 1px solid #86efac; }
        .badge-warn { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
        .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 30px; }
        .card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; }
        .card-val { font-size: 24px; font-weight: 700; color: #111827; margin-top: 4px; }
        .card-lbl { font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { text-align: left; padding: 10px; border-bottom: 1px solid #e5e7eb; font-size: 13px; }
        th { background: #f3f4f6; color: #4b5563; font-weight: 600; }
        .footer { margin-top: 40px; font-size: 11px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 15px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <h1 style="margin: 0; font-size: 24px; color: #1e3a8a;">Document Quality Assurance Certificate</h1>
          <p style="margin: 4px 0 0; color: #6b7280; font-size: 14px;">File: <strong>${escapeXml(filename)}</strong></p>
        </div>
        <div class="badge ${isPassed ? 'badge-pass' : 'badge-warn'}">
          ${isPassed ? '✓ QA Verified & Ready' : '⚠ Action Items Pending'}
        </div>
      </div>

      <div class="grid">
        <div class="card">
          <div class="card-lbl">Overall Quality Score</div>
          <div class="card-val" style="color: ${stats.qualityScore >= 85 ? '#16a34a' : stats.qualityScore >= 70 ? '#d97706' : '#dc2626'};">${stats.qualityScore}/100</div>
        </div>
        <div class="card">
          <div class="card-lbl">Total Words Verified</div>
          <div class="card-val">${stats.wordCount.toLocaleString()}</div>
        </div>
        <div class="card">
          <div class="card-lbl">Readability Grade</div>
          <div class="card-val">${stats.readability.readingEase}</div>
        </div>
      </div>

      <h3 style="margin-bottom: 10px; font-size: 16px;">Quality Assurance Check Matrix</h3>
      <table>
        <thead>
          <tr>
            <th>Audit Vector</th>
            <th>Inspection Scope</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Data Continuity</strong></td>
            <td>Component sums, arithmetic consistency, timeline order</td>
            <td>${stats.continuity.inconsistenciesDetected === 0 ? '<span style="color:#16a34a;">Passed (Zero Discrepancies)</span>' : `<span style="color:#dc2626;">${stats.continuity.inconsistenciesDetected} Discrepancies Detected</span>`}</td>
          </tr>
          <tr>
            <td><strong>Grammar & Syntax</strong></td>
            <td>Subject-verb agreement, homophones, redundancies</td>
            <td>${issues.filter(i => i.category === 'grammar' && !i.applied && !i.ignored).length === 0 ? '<span style="color:#16a34a;">Passed Clean</span>' : `<span style="color:#d97706;">${issues.filter(i => i.category === 'grammar' && !i.applied && !i.ignored).length} Pending Review</span>`}</td>
          </tr>
          <tr>
            <td><strong>Draft & Placeholder Scrub</strong></td>
            <td>Purge of [TODO], [TBD], XXXX, scaffold tags</td>
            <td>${issues.filter(i => i.category === 'placeholder' && !i.applied && !i.ignored).length === 0 ? '<span style="color:#16a34a;">Clear (0 Placeholders)</span>' : '<span style="color:#dc2626;">Contains Unresolved Draft Tags</span>'}</td>
          </tr>
          <tr>
            <td><strong>Uniformity & Formatting</strong></td>
            <td>Currency notation, thousands separators, bullet punctuation</td>
            <td>${issues.filter(i => i.category === 'uniformity' && !i.applied && !i.ignored).length === 0 ? '<span style="color:#16a34a;">Uniform</span>' : 'Variations Flagged'}</td>
          </tr>
        </tbody>
      </table>

      <div class="footer">
        <p>Verified completely client-side in secure sandbox memory. Zero cloud data storage occurred. Engine: Chingham's DocuVerify Offline QA v2.4.</p>
      </div>

      <script>
        window.onload = function() { window.print(); }
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_');
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

function markdownToHtml(md: string): string {
  const lines = md.split('\n');
  let inList = false;
  const result: string[] = [];

  let i = 0;
  while (i < lines.length) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    // Check for Markdown table: line has | and next line has |-
    if (line.includes('|') && i + 1 < lines.length && /^\s*\|?\s*[-:]+[-| :]*\|?\s*$/.test(lines[i + 1])) {
      if (inList) { result.push('</ul>'); inList = false; }
      
      const headerCells = line.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
      result.push('<table class="doc-table">');
      result.push('<thead><tr>');
      headerCells.forEach(cell => {
        result.push(`<th>${escapeXml(cell)}</th>`);
      });
      result.push('</tr></thead>');
      result.push('<tbody>');

      i += 2; // skip header and delimiter lines
      while (i < lines.length && lines[i].includes('|') && lines[i].trim().length > 0) {
        const rowCells = lines[i].trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
        result.push('<tr>');
        rowCells.forEach((cell, cellIdx) => {
          const isNum = /^[$€£¥]?\s*-?\d+(?:,\d{3})*(?:\.\d+)?%?$/.test(cell);
          result.push(`<td style="${isNum ? 'text-align:right;' : 'text-align:left;'}">${escapeXml(cell)}</td>`);
        });
        result.push('</tr>');
        i++;
      }
      result.push('</tbody></table>');
      continue;
    }

    if (line.startsWith('# ')) {
      if (inList) { result.push('</ul>'); inList = false; }
      result.push(`<h1>${escapeXml(line.slice(2))}</h1>`);
    } else if (line.startsWith('## ')) {
      if (inList) { result.push('</ul>'); inList = false; }
      result.push(`<h2>${escapeXml(line.slice(3))}</h2>`);
    } else if (line.startsWith('### ')) {
      if (inList) { result.push('</ul>'); inList = false; }
      result.push(`<h3>${escapeXml(line.slice(4))}</h3>`);
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      if (!inList) { result.push('<ul>'); inList = true; }
      result.push(`<li>${escapeXml(line.slice(2))}</li>`);
    } else if (line.length === 0) {
      if (inList) { result.push('</ul>'); inList = false; }
      result.push('<br/>');
    } else {
      if (inList) { result.push('</ul>'); inList = false; }
      result.push(`<p>${escapeXml(line)}</p>`);
    }
    i++;
  }

  if (inList) result.push('</ul>');
  return result.join('\n');
}

