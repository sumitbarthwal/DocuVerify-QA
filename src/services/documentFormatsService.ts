import mammoth from 'mammoth';
import JSZip from 'jszip';
import * as pdfjsLib from 'pdfjs-dist';
import { ReportStats, QAIssue } from '../types';
import { createStandardDocxPackage, downloadDocxFile } from './docxEngineService';

// Configure PDF.js worker if running in browser
if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '4.10.38'}/pdf.worker.min.mjs`;
  } catch {
    // Graceful fallback
  }
}

export interface ImportResult {
  content: string;
  filename: string;
  format: string;
  wordCount: number;
  headerText?: string;
  footerText?: string;
  images?: Array<{ name: string; dataUrl: string }>;
  rawDocxBuffer?: ArrayBuffer;
}

// Extract original Running Headers, Footers, and embedded media from docx zip package
export async function extractDocxMetadata(arrayBuffer: ArrayBuffer): Promise<{
  headerText: string;
  footerText: string;
  images: Array<{ name: string; dataUrl: string }>;
}> {
  let headerText = '';
  let footerText = '';
  const images: Array<{ name: string; dataUrl: string }> = [];

  try {
    const zip = await JSZip.loadAsync(arrayBuffer);

    // Extract headers (header1.xml, header2.xml, etc.)
    const headerFiles = Object.keys(zip.files).filter(k => /^word\/header\d*\.xml$/i.test(k)).sort();
    for (const hf of headerFiles) {
      const xml = await zip.files[hf].async('text');
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, 'application/xml');
      const textNodes = Array.from(doc.getElementsByTagName('w:t'));
      const text = textNodes.map(n => n.textContent || '').join(' ').replace(/\s+/g, ' ').trim();
      if (text && !headerText) {
        headerText = text;
      }
    }

    // Extract footers (footer1.xml, footer2.xml, etc.)
    const footerFiles = Object.keys(zip.files).filter(k => /^word\/footer\d*\.xml$/i.test(k)).sort();
    for (const ff of footerFiles) {
      const xml = await zip.files[ff].async('text');
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, 'application/xml');
      const textNodes = Array.from(doc.getElementsByTagName('w:t'));
      const text = textNodes.map(n => n.textContent || '').join(' ').replace(/\s+/g, ' ').trim();
      if (text && !footerText) {
        footerText = text;
      }
    }

    // Extract embedded media images (word/media/*) using lightweight Blob URLs
    // This avoids gigantic multi-megabyte base64 strings that freeze regex parsing and text rendering
    const mediaFiles = Object.keys(zip.files).filter(k => /^word\/media\//i.test(k));
    for (const mf of mediaFiles) {
      const uint8 = await zip.files[mf].async('uint8array');
      const ext = mf.split('.').pop()?.toLowerCase() || 'png';
      const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'png' ? 'image/png' : 'image/gif';
      const filename = mf.split('/').pop() || mf;
      const blob = new Blob([uint8], { type: mime });
      const blobUrl = URL.createObjectURL(blob);
      images.push({
        name: filename,
        dataUrl: blobUrl
      });
    }
  } catch (err) {
    console.warn('Docx metadata extraction notice:', err);
  }

  return { headerText, footerText, images };
}

// Convert HTML (from mammoth or .html files) to clean structured markdown with images
export function htmlToMarkdown(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const result: string[] = [];

  function processNode(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      return text;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return '';

    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    switch (tag) {
      case 'h1':
        return `\n\n# ${el.textContent?.trim()}\n\n`;
      case 'h2':
        return `\n\n## ${el.textContent?.trim()}\n\n`;
      case 'h3':
        return `\n\n### ${el.textContent?.trim()}\n\n`;
      case 'h4':
      case 'h5':
      case 'h6':
        return `\n\n#### ${el.textContent?.trim()}\n\n`;
      case 'img': {
        const src = el.getAttribute('src') || '';
        const alt = el.getAttribute('alt') || el.getAttribute('title') || 'Document Photo Plate';
        if (!src) return '';
        return `\n\n![${alt.replace(/[\[\]]/g, '')}](${src})\n\n`;
      }
      case 'figure': {
        const img = el.querySelector('img');
        const caption = el.querySelector('figcaption')?.textContent?.trim() || '';
        if (img) {
          const src = img.getAttribute('src') || '';
          const alt = caption || img.getAttribute('alt') || 'Document Photo Plate';
          return `\n\n![${alt.replace(/[\[\]]/g, '')}](${src})\n\n`;
        }
        return Array.from(el.childNodes).map(processNode).join('');
      }
      case 'p': {
        const text = Array.from(el.childNodes).map(processNode).join('').trim();
        return text ? `\n\n${text}\n\n` : '\n';
      }
      case 'ul': {
        const items = Array.from(el.querySelectorAll(':scope > li'))
          .map(li => `- ${Array.from(li.childNodes).map(processNode).join('').trim()}`)
          .join('\n');
        return `\n\n${items}\n\n`;
      }
      case 'ol': {
        const items = Array.from(el.querySelectorAll(':scope > li'))
          .map((li, idx) => `${idx + 1}. ${Array.from(li.childNodes).map(processNode).join('').trim()}`)
          .join('\n');
        return `\n\n${items}\n\n`;
      }
      case 'table': {
        const rows = Array.from(el.querySelectorAll('tr'));
        if (rows.length === 0) return '';
        
        const tableLines: string[] = [];
        let headerColsCount = 0;

        rows.forEach((tr, rIdx) => {
          const cells = Array.from(tr.querySelectorAll('th, td')).map(cell => 
            (cell.textContent || '').trim().replace(/\r?\n+/g, ' <br /> ').replace(/\|/g, '\\|')
          );
          if (rIdx === 0) {
            headerColsCount = Math.max(cells.length, 1);
            tableLines.push(`| ${cells.join(' | ')} |`);
            tableLines.push(`| ${cells.map(() => '---').join(' | ')} |`);
          } else {
            // Pad cells if mismatched
            while (cells.length < headerColsCount) cells.push('');
            tableLines.push(`| ${cells.join(' | ')} |`);
          }
        });
        return `\n\n${tableLines.join('\n')}\n\n`;
      }
      case 'hr':
        return '\n\n---\n\n';
      case 'strong':
      case 'b':
        return `**${el.textContent?.trim()}**`;
      case 'em':
      case 'i':
        return `*${el.textContent?.trim()}*`;
      case 'br':
        return '\n';
      default:
        return Array.from(el.childNodes).map(processNode).join('');
    }
  }

  const output = Array.from(doc.body.childNodes).map(processNode).join('');
  return output
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Convert CSV/TSV text into formatted markdown table
export function csvToMarkdownTable(csvText: string, delimiter: string = ','): string {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length === 0) return '';

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' || char === "'") {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const parsedRows = lines.map(parseLine);
  if (parsedRows.length === 0) return '';

  const colCount = Math.max(...parsedRows.map(r => r.length));
  const normalizedRows = parsedRows.map(row => {
    while (row.length < colCount) row.push('');
    return row;
  });

  const title = `Table 1: Data Table Summary`;
  const headerRow = `| ${normalizedRows[0].map(c => c || 'Column').join(' | ')} |`;
  const dividerRow = `| ${normalizedRows[0].map(() => '---').join(' | ')} |`;
  const dataRows = normalizedRows.slice(1).map(row => `| ${row.join(' | ')} |`).join('\n');

  return `# Tabular Data Import\n\n${title}\n${headerRow}\n${dividerRow}\n${dataRows}\n`;
}

// Parse RTF string into clean text
export function parseRtfToText(rtf: string): string {
  let text = rtf;
  // Strip RTF font tables, color tables, and style sheets
  text = text.replace(/\{\\fonttbl[\s\S]*?\}/g, '');
  text = text.replace(/\{\\colortbl[\s\S]*?\}/g, '');
  text = text.replace(/\{\\stylesheet[\s\S]*?\}/g, '');
  text = text.replace(/\{\\info[\s\S]*?\}/g, '');
  // Replace newlines and tabs
  text = text.replace(/\\par[d]?\s*/g, '\n');
  text = text.replace(/\\tab\s*/g, '\t');
  text = text.replace(/\\line\s*/g, '\n');
  // Handle unicode escapes \u1234?
  text = text.replace(/\\u(\d+)\??/g, (_, code) => String.fromCharCode(parseInt(code, 10)));
  // Handle hex escapes \'xx
  text = text.replace(/\\'([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  // Remove remaining RTF control words
  text = text.replace(/\\[a-zA-Z]+(-?\d+)?\s?/g, '');
  // Remove curly braces
  text = text.replace(/[{}]/g, '');
  return text.trim();
}

// Helper: Extract text from PDF document preserving page boundaries and structure
export async function parsePdfDocument(
  arrayBuffer: ArrayBuffer,
  onProgress?: (status: string, percent?: number) => void
): Promise<{ content: string; pageCount: number }> {
  try {
    const loadingTask = pdfjsLib.getDocument({
      data: arrayBuffer,
      useSystemFonts: true,
      stopAtErrors: false,
    });
    const pdfDoc = await loadingTask.promise;
    const numPages = pdfDoc.numPages;
    const pageTexts: string[] = [];

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      try {
        if (onProgress && (pageNum % 2 === 0 || pageNum === 1 || pageNum === numPages)) {
          const pct = Math.round((pageNum / numPages) * 100);
          onProgress(`Extracting text from PDF page ${pageNum} of ${numPages}...`, pct);
          // Cooperative yield to keep browser event loop responsive
          await new Promise(r => setTimeout(r, 0));
        }

        const page = await pdfDoc.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        // Group items by vertical position (Y coordinate) to reconstruct lines and tables
        const items = textContent.items as Array<{ str: string; transform?: number[] }>;
        if (items.length === 0) continue;

        const linesMap = new Map<number, Array<{ x: number; str: string }>>();
        for (const item of items) {
          if (!item.str || item.str.trim().length === 0) continue;
          const y = Math.round((item.transform ? item.transform[5] : 0) / 4) * 4; // Bucket lines within ~4pt
          const x = item.transform ? item.transform[4] : 0;
          if (!linesMap.has(y)) {
            linesMap.set(y, []);
          }
          linesMap.get(y)!.push({ x, str: item.str });
        }

        // Sort Y descending (PDF coordinates start from bottom)
        const sortedY = Array.from(linesMap.keys()).sort((a, b) => b - a);
        const pageLines: string[] = [];

        for (const y of sortedY) {
          const lineItems = linesMap.get(y)!.sort((a, b) => a.x - b.x);
          const lineStr = lineItems.map(it => it.str).join(' ').replace(/\s{2,}/g, ' ').trim();
          if (lineStr) pageLines.push(lineStr);
        }

        let pageContent = pageLines.join('\n');
        if (pageNum === 1 && pageLines.length > 0 && pageLines[0].length < 80 && !pageLines[0].startsWith('#')) {
          pageLines[0] = `# ${pageLines[0]}`;
          pageContent = pageLines.join('\n');
        }

        if (pageContent.trim().length > 0) {
          pageTexts.push(pageContent);
        }
      } catch (pageErr) {
        console.warn(`Error reading PDF page ${pageNum}:`, pageErr);
      }
    }

    if (pageTexts.length > 0) {
      return {
        content: pageTexts.join('\n\n---\n\n'),
        pageCount: numPages
      };
    }
  } catch (err) {
    console.warn('pdfjs-dist parsing error, falling back to binary stream extractor:', err);
  }

  // Fallback: extract text from PDF binary streams
  const fallbackText = extractTextFromPdfStream(arrayBuffer);
  return {
    content: fallbackText || '# PDF Document\n\n[Text-based PDF content extracted]',
    pageCount: 1
  };
}

// Fallback text extractor from raw PDF stream
export function extractTextFromPdfStream(buffer: ArrayBuffer): string {
  try {
    const bytes = new Uint8Array(buffer);
    let str = '';
    const chunk = 8192;
    for (let i = 0; i < bytes.length; i += chunk) {
      str += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
    }

    const textPieces: string[] = [];
    const btRegex = /BT[\s\S]*?ET/g;
    let match;
    while ((match = btRegex.exec(str)) !== null) {
      const block = match[0];
      const strMatches = block.match(/\(([^)]+)\)/g);
      if (strMatches) {
        const line = strMatches.map(s => s.slice(1, -1).replace(/\\([()\\])/g, '$1')).join(' ');
        if (line.trim().length > 0) {
          textPieces.push(line.trim());
        }
      }
    }

    if (textPieces.length > 0) {
      return textPieces.join('\n\n');
    }
  } catch (e) {
    console.warn('PDF stream extraction error:', e);
  }
  return '';
}

// Universal File Importer Supporting All Required Formats
export async function parseImportedDocument(
  file: File,
  onProgress?: (status: string, percent?: number) => void
): Promise<ImportResult> {
  const name = file.name;
  const extension = name.split('.').pop()?.toLowerCase() || '';

  let content = '';
  let format = extension.toUpperCase();
  let headerText = '';
  let footerText = '';
  let images: Array<{ name: string; dataUrl: string }> = [];
  let rawDocxBuffer: ArrayBuffer | undefined = undefined;

  try {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    onProgress?.(`Reading ${file.name} (${sizeMb} MB)...`, 15);
    await new Promise(r => setTimeout(r, 10));

    if (extension === 'docx') {
      onProgress?.('Extracting document package and media archives...', 30);
      await new Promise(r => setTimeout(r, 10));

      const arrayBuffer = await file.arrayBuffer();
      rawDocxBuffer = arrayBuffer.slice(0);

      // Extract original running headers, footers, and media images directly from docx XML zip
      try {
        const metadata = await extractDocxMetadata(arrayBuffer);
        headerText = metadata.headerText;
        footerText = metadata.footerText;
        images = metadata.images;
      } catch (metaErr) {
        console.warn('Docx header/footer extraction warning:', metaErr);
      }

      onProgress?.('Converting Word structure, tables, and styles...', 55);
      await new Promise(r => setTimeout(r, 10));

      // Configure Mammoth to convert embedded images into lightweight Blob URLs
      // This prevents multi-megabyte base64 strings from locking up regex scanners and React rendering
      const mammothOptions = {
        convertImage: mammoth.images.imgElement((image: any) => {
          return image.read("base64").then((imageBuffer: string) => {
            try {
              const byteCharacters = atob(imageBuffer);
              const byteNumbers = new Array(byteCharacters.length);
              for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
              }
              const byteArray = new Uint8Array(byteNumbers);
              const blob = new Blob([byteArray], { type: image.contentType });
              const blobUrl = URL.createObjectURL(blob);
              return { src: blobUrl };
            } catch {
              return { src: "data:" + image.contentType + ";base64," + imageBuffer };
            }
          });
        })
      };

      // Convert Word document body to structured HTML preserving images & tables
      try {
        const htmlResult = await mammoth.convertToHtml({ arrayBuffer }, mammothOptions);
        if (htmlResult && htmlResult.value && htmlResult.value.length > 30) {
          content = htmlToMarkdown(htmlResult.value);
        } else {
          const rawResult = await mammoth.extractRawText({ arrayBuffer });
          content = rawResult.value || '';
        }
      } catch {
        const rawResult = await mammoth.extractRawText({ arrayBuffer });
        content = rawResult.value || '';
      }

      // If there were media images in the docx that weren't referenced in the converted HTML body,
      // append them as authentic document photo plates at the bottom using lightweight blob URLs
      if (images.length > 0) {
        const unreferenced = images.filter(img => !content.includes(img.dataUrl.slice(0, 40)));
        if (unreferenced.length > 0) {
          const photoPlates = unreferenced.map((img, idx) => 
            `![Photo Plate ${idx + 1}: ${img.name}](${img.dataUrl})\n*Photo Plate ${idx + 1}: ${img.name} (Extracted from Original Document)*`
          ).join('\n\n');
          content = `${content.trim()}\n\n## Document Evidence & Photo Plates\n\n${photoPlates}\n`;
        }
      }

      format = 'DOCX';
    } else if (extension === 'pdf') {
      const arrayBuffer = await file.arrayBuffer();
      const pdfData = await parsePdfDocument(arrayBuffer, (msg, pct) => {
        onProgress?.(msg, pct);
      });
      content = pdfData.content;
      format = 'PDF';
    } else if (extension === 'doc') {
      // Old Word binary format: read text strings or fallback to binary extraction
      const text = await file.text();
      if (text.startsWith('{\\rtf')) {
        content = parseRtfToText(text);
      } else if (text.includes('<html') || text.includes('<body')) {
        content = htmlToMarkdown(text);
      } else {
        const clean = text.replace(/[^\x20-\x7E\n\r\t]/g, ' ').replace(/\s{3,}/g, ' ');
        content = clean.trim() || 'Imported Word Document (Binary Content Extracted)';
      }
      format = 'DOC';
    } else if (extension === 'rtf') {
      const raw = await file.text();
      content = parseRtfToText(raw);
      format = 'RTF';
    } else if (extension === 'html' || extension === 'htm') {
      const html = await file.text();
      content = htmlToMarkdown(html);
      format = 'HTML';
    } else if (extension === 'csv') {
      const csvText = await file.text();
      content = csvToMarkdownTable(csvText, ',');
      format = 'CSV';
    } else if (extension === 'tsv') {
      const tsvText = await file.text();
      content = csvToMarkdownTable(tsvText, '\t');
      format = 'TSV';
    } else if (extension === 'json') {
      const raw = await file.text();
      try {
        const parsed = JSON.parse(raw);
        if (parsed.content && typeof parsed.content === 'string') {
          content = parsed.content;
          if (parsed.headerText) headerText = parsed.headerText;
          if (parsed.footerText) footerText = parsed.footerText;
        } else if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object') {
          const keys = Object.keys(parsed[0]);
          const header = `| ${keys.join(' | ')} |`;
          const divider = `| ${keys.map(() => '---').join(' | ')} |`;
          const rows = parsed.map(item => `| ${keys.map(k => String(item[k] ?? '')).join(' | ')} |`).join('\n');
          content = `# JSON Data Import\n\n${header}\n${divider}\n${rows}\n`;
        } else {
          content = `# JSON Document Data\n\n\`\`\`json\n${JSON.stringify(parsed, null, 2)}\n\`\`\``;
        }
      } catch {
        content = raw;
      }
      format = 'JSON';
    } else {
      content = await file.text();
      format = extension ? extension.toUpperCase() : 'TXT';
    }
  } catch (err) {
    console.error('Document format parsing error:', err);
    content = await file.text();
  }

  const wordCount = (content.trim().match(/\S+/g) || []).length;
  return {
    content,
    filename: name,
    format,
    wordCount,
    headerText: headerText || undefined,
    footerText: footerText || undefined,
    images: images.length > 0 ? images : undefined,
    rawDocxBuffer,
  };
}

// -------------------------------------------------------------
// EXPORT FUNCTIONS SUPPORTING ALL STANDARD DOCUMENT FORMATS
// -------------------------------------------------------------

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

// Convert markdown to styled HTML body for exports
export function markdownToStyledHtml(md: string): string {
  const lines = md.split('\n');
  let inList = false;
  const result: string[] = [];

  let i = 0;
  while (i < lines.length) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    // Image support: ![alt](src)
    const imgMatch = line.match(/^!\[(.*?)\]\((.*?)\)$/);
    if (imgMatch) {
      if (inList) { result.push('</ul>'); inList = false; }
      const alt = imgMatch[1] || 'Document Photo Plate';
      const src = imgMatch[2];
      result.push(`
        <div class="doc-photo-plate" style="text-align: center; margin: 16pt 0; page-break-inside: avoid;">
          <img src="${src}" alt="${escapeXml(alt)}" style="max-width: 95%; max-height: 380px; border-radius: 6px; border: 1px solid #cbd5e1; box-shadow: 0 4px 8px -2px rgba(0,0,0,0.1); object-fit: contain;" />
          <div style="font-size: 8.5pt; color: #64748b; margin-top: 5pt; font-family: 'Calibri', Arial, sans-serif; font-style: italic;">
            ${escapeXml(alt)}
          </div>
        </div>
      `);
      i++;
      continue;
    }

    // Markdown table
    if (line.includes('|') && i + 1 < lines.length && /^\s*\|?\s*[-:]+[-| :]*\|?\s*$/.test(lines[i + 1])) {
      if (inList) { result.push('</ul>'); inList = false; }
      
      const headerCells = line.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
      result.push('<table class="doc-table">');
      result.push('<thead><tr>');
      headerCells.forEach(cell => {
        result.push(`<th>${escapeXml(cell)}</th>`);
      });
      result.push('</tr></thead><tbody>');

      i += 2; // skip header and delimiter lines
      while (i < lines.length && lines[i].includes('|') && lines[i].trim().length > 0) {
        const rowCells = lines[i].trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
        result.push('<tr>');
        rowCells.forEach((cell) => {
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
      result.push('<div class="spacer"></div>');
    } else {
      if (inList) { result.push('</ul>'); inList = false; }
      result.push(`<p>${escapeXml(line)}</p>`);
    }
    i++;
  }

  if (inList) result.push('</ul>');
  return result.join('\n');
}

// 1. Export Microsoft Word (.docx native OpenXML package)
export async function exportToWordDocument(
  content: string, 
  filename: string, 
  customHeader?: string, 
  customFooter?: string,
  existingDocxBuffer?: ArrayBuffer | null
) {
  const baseName = filename.replace(/\.[^/.]+$/, '');

  // If we already have the active DOCX buffer (preserving original formatting, images, headers & footers), download it directly
  if (existingDocxBuffer && existingDocxBuffer.byteLength > 100) {
    downloadDocxFile(existingDocxBuffer, `${sanitizeFilename(baseName)}_Verified.docx`);
    return;
  }

  const titleMatch = content.match(/^#\s+([^\n\r]+)/m);
  const docTitle = titleMatch ? titleMatch[1].trim() : 'Survey & Assessment Report';

  const refMatch = content.match(/\b(?:survey\s*ref(?:erence)?(?:\s*no\.?|#)?|ref(?:erence)?\s*(?:no\.?|#)?)\s*[:=–-]?\s*([A-Za-z0-9\/\-\.]{4,30})\b/i);
  const surveyRef = refMatch ? refMatch[1].trim() : 'SRV-REF-AUTO';

  const policyMatch = content.match(/\b(?:policy\s*(?:no\.?|number|#))\s*[:=–-]?\s*([A-Za-z0-9\/\-\.]{4,30})\b/i);
  const policyNo = policyMatch ? policyMatch[1].trim() : '';

  const claimMatch = content.match(/\b(?:claim\s*(?:no\.?|number|#))\s*[:=–-]?\s*([A-Za-z0-9\/\-\.]{4,30})\b/i);
  const claimNo = claimMatch ? claimMatch[1].trim() : '';

  const defaultHeader = `${docTitle} | Ref: ${surveyRef}`;
  const defaultFooter = [policyNo ? `Policy: ${policyNo}` : '', claimNo ? `Claim: ${claimNo}` : ''].filter(Boolean).join(' | ') || "Chingham's DocuVerify QA Audit Engine";

  const effectiveHeader = (customHeader && customHeader.trim()) ? customHeader.trim() : defaultHeader;
  const effectiveFooter = (customFooter && customFooter.trim()) ? customFooter.trim() : defaultFooter;

  try {
    const docxBuffer = await createStandardDocxPackage(content, {
      title: docTitle,
      headerText: effectiveHeader,
      footerText: effectiveFooter,
    });
    downloadDocxFile(docxBuffer, `${sanitizeFilename(baseName)}_Verified.docx`);
  } catch (err) {
    console.warn('Native DOCX generation fallback to legacy MSO:', err);
    // Legacy MSO fallback if zip packaging encounters environment errors
    const msoHtml = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office'
            xmlns:w='urn:schemas-microsoft-com:office:word'
            xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset="utf-8">
        <title>${escapeXml(docTitle)}</title>
        <style>
          @page Section1 {
            size: 8.5in 11.0in;
            margin: 1.0in 1.0in 1.0in 1.0in;
          }
          div.Section1 { page: Section1; }
          body { font-family: 'Calibri', Arial, sans-serif; font-size: 11pt; }
        </style>
      </head>
      <body>
        <div class="Section1">
          ${markdownToStyledHtml(content)}
        </div>
      </body>
      </html>
    `;
    const blob = new Blob(['\ufeff', msoHtml], { type: 'application/msword' });
    triggerDownload(blob, `${sanitizeFilename(baseName)}_Verified.doc`);
  }
}

// 2. Export / Print PDF with Standard Running Headers & Footers
export function exportToPDF(content: string, filename: string, customHeader?: string, customFooter?: string) {
  const titleMatch = content.match(/^#\s+([^\n\r]+)/m);
  const docTitle = titleMatch ? titleMatch[1].trim() : 'Assessment & Audit Report';
  const refMatch = content.match(/\b(?:survey\s*ref(?:erence)?(?:\s*no\.?|#)?|ref(?:erence)?\s*(?:no\.?|#)?)\s*[:=–-]?\s*([A-Za-z0-9\/\-\.]{4,30})\b/i);
  const surveyRef = refMatch ? refMatch[1].trim() : 'SRV-REF-AUTO';

  const defaultHeader = `${docTitle} | Ref: ${surveyRef}`;
  const defaultFooter = "Chingham's DocuVerify QA Engine - Verified Standard Document";

  const effectiveHeader = (customHeader && customHeader.trim()) ? customHeader.trim() : defaultHeader;
  const effectiveFooter = (customFooter && customFooter.trim()) ? customFooter.trim() : defaultFooter;

  const printWindow = window.open('', '_blank', 'width=900,height=1000');
  if (!printWindow) return;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${escapeXml(docTitle)} - Print & PDF</title>
      <style>
        @page {
          size: letter portrait;
          margin: 20mm 15mm 20mm 15mm;
          @top-left {
            content: "${escapeXml(effectiveHeader)}";
            font-size: 8pt;
            color: #64748b;
          }
          @top-right {
            content: "Standard Document View";
            font-size: 8pt;
            color: #64748b;
          }
          @bottom-left {
            content: "${escapeXml(effectiveFooter)}";
            font-size: 8pt;
            color: #64748b;
          }
          @bottom-right {
            content: "Page " counter(page) " of " counter(pages);
            font-size: 8pt;
            color: #64748b;
          }
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          font-size: 10pt;
          line-height: 1.6;
          color: #1e293b;
          margin: 0;
          padding: 24px;
        }
        .header-bar {
          display: flex;
          justify-content: space-between;
          border-bottom: 1.5px solid #cbd5e1;
          padding-bottom: 8px;
          margin-bottom: 24px;
          font-size: 9pt;
          color: #64748b;
        }
        .footer-bar {
          display: flex;
          justify-content: space-between;
          border-top: 1.5px solid #cbd5e1;
          padding-top: 8px;
          margin-top: 32px;
          font-size: 9pt;
          color: #64748b;
        }
        h1 { font-size: 18pt; color: #1e3a8a; border-bottom: 2px solid #2563eb; padding-bottom: 4px; margin-top: 0; }
        h2 { font-size: 13pt; color: #1e40af; border-bottom: 1px solid #cbd5e1; padding-bottom: 2px; margin-top: 16px; }
        h3 { font-size: 11pt; color: #334155; margin-top: 12px; }
        table.doc-table {
          width: 100%;
          border-collapse: collapse;
          margin: 12px 0;
          font-size: 9pt;
        }
        table.doc-table th, table.doc-table td {
          border: 1px solid #cbd5e1;
          padding: 6px 8px;
        }
        table.doc-table th {
          background-color: #f1f5f9;
          font-weight: bold;
          text-align: left;
        }
        table.doc-table tr:nth-child(even) {
          background-color: #f8fafc;
        }
        .spacer { height: 12px; }
        @media print {
          body { padding: 0; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="header-bar">
        <span><strong>${escapeXml(effectiveHeader)}</strong></span>
        <span>Standard Document View</span>
      </div>
      
      <div>
        ${markdownToStyledHtml(content)}
      </div>

      <div class="footer-bar">
        <span>${escapeXml(effectiveFooter)}</span>
        <span>Printed: ${new Date().toLocaleDateString()}</span>
      </div>

      <script>
        window.onload = function() {
          window.print();
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
}

// 3. Export RTF (Rich Text Format)
export function exportToRTF(content: string, filename: string) {
  const baseName = filename.replace(/\.[^/.]+$/, '');
  const lines = content.split('\n');

  let rtf = '{\\rtf1\\ansi\\deff0\n';
  rtf += '{\\fonttbl{\\f0\\fnil\\fcharset0 Calibri;}{\\f1\\fnil\\fcharset0 Arial;}}\n';
  rtf += '{\\colortbl ;\\red30\\green58\\blue138;\\red100\\green116\\blue139;}\n';
  rtf += '\\viewkind4\\uc1\\pard\\lang1033\\f0\\fs22\n';

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.startsWith('# ')) {
      rtf += `\\par\\b\\fs36\\cf1 ${line.slice(2)}\\cf0\\b0\\fs22\\par\n`;
    } else if (line.startsWith('## ')) {
      rtf += `\\par\\b\\fs26\\cf1 ${line.slice(3)}\\cf0\\b0\\fs22\\par\n`;
    } else if (line.startsWith('### ')) {
      rtf += `\\par\\b\\fs22 ${line.slice(4)}\\b0\\par\n`;
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      rtf += `\\bullet  ${line.slice(2)}\\par\n`;
    } else if (line.includes('|')) {
      // Table row representation
      const cells = line.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim()).join(' \\tab ');
      rtf += `\\f1\\fs20 ${cells}\\f0\\fs22\\par\n`;
    } else if (line.length === 0) {
      rtf += '\\par\n';
    } else {
      rtf += `${line}\\par\n`;
    }
  }

  rtf += '\\par\\pard\\cf2\\fs18 Verified via Chingham\'s DocuVerify QA Engine\\par}\n';

  const blob = new Blob([rtf], { type: 'application/rtf' });
  triggerDownload(blob, `${sanitizeFilename(baseName)}_Verified.rtf`);
}

// 4. Export Standalone Styled HTML Document
export function exportToHTMLDocument(content: string, filename: string) {
  const baseName = filename.replace(/\.[^/.]+$/, '');
  const titleMatch = content.match(/^#\s+([^\n\r]+)/m);
  const docTitle = titleMatch ? titleMatch[1].trim() : 'Document Report';

  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeXml(docTitle)} - Standard Document View</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f8fafc;
      color: #1e293b;
      margin: 0;
      padding: 32px 16px;
      display: flex;
      justify-content: center;
    }
    .page-sheet {
      background: #ffffff;
      width: 100%;
      max-width: 820px;
      padding: 48px 56px;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
    }
    .header-bar {
      display: flex;
      justify-content: space-between;
      border-bottom: 1px solid #cbd5e1;
      padding-bottom: 10px;
      margin-bottom: 28px;
      font-size: 12px;
      color: #64748b;
    }
    .footer-bar {
      display: flex;
      justify-content: space-between;
      border-top: 1px solid #cbd5e1;
      padding-top: 10px;
      margin-top: 40px;
      font-size: 11px;
      color: #64748b;
    }
    h1 { font-size: 24px; color: #1e3a8a; border-bottom: 2px solid #2563eb; padding-bottom: 6px; margin-top: 0; }
    h2 { font-size: 18px; color: #1e40af; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; margin-top: 24px; }
    h3 { font-size: 15px; color: #334155; margin-top: 16px; }
    p { font-size: 14px; line-height: 1.6; margin: 8px 0; }
    ul { font-size: 14px; line-height: 1.6; padding-left: 24px; }
    table.doc-table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
      font-size: 13px;
    }
    table.doc-table th, table.doc-table td {
      border: 1px solid #cbd5e1;
      padding: 8px 10px;
    }
    table.doc-table th {
      background-color: #f1f5f9;
      font-weight: 600;
      color: #0f172a;
    }
    table.doc-table tr:nth-child(even) {
      background-color: #f8fafc;
    }
    .spacer { height: 12px; }
  </style>
</head>
<body>
  <div class="page-sheet">
    <div class="header-bar">
      <span><strong>${escapeXml(docTitle)}</strong></span>
      <span>Standard Document View</span>
    </div>
    <div>
      ${markdownToStyledHtml(content)}
    </div>
    <div class="footer-bar">
      <span>Chingham's DocuVerify QA Engine</span>
      <span>Standard Verified Document Record</span>
    </div>
  </div>
</body>
</html>`;

  const blob = new Blob([fullHtml], { type: 'text/html' });
  triggerDownload(blob, `${sanitizeFilename(baseName)}_Verified.html`);
}

// 5. Export Structured Tables to CSV (Extracts all data tables for Excel)
export function exportToCSVExtract(content: string, filename: string) {
  const baseName = filename.replace(/\.[^/.]+$/, '');
  const lines = content.split('\n');
  const csvRows: string[] = [];

  let inTable = false;
  let tableIdx = 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.includes('|') && i + 1 < lines.length && /^\s*\|?\s*[-:]+[-| :]*\|?\s*$/.test(lines[i + 1])) {
      if (!inTable) {
        csvRows.push(`--- Table ${tableIdx} ---`);
        tableIdx++;
        inTable = true;
      }
      const headerCells = line.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => `"${c.trim().replace(/"/g, '""')}"`);
      csvRows.push(headerCells.join(','));
      i++; // Skip delimiter row
      continue;
    }

    if (inTable) {
      if (line.includes('|') && line.length > 0) {
        const rowCells = line.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => `"${c.trim().replace(/"/g, '""')}"`);
        csvRows.push(rowCells.join(','));
      } else {
        inTable = false;
        csvRows.push(''); // Empty line between tables
      }
    }
  }

  // If no tables found in document, export paragraphs as text rows
  if (csvRows.length === 0) {
    csvRows.push('"Section","Content"');
    lines.filter(l => l.trim().length > 0).forEach((l, idx) => {
      csvRows.push(`"Line ${idx + 1}","${l.replace(/"/g, '""')}"`);
    });
  }

  const csvContent = csvRows.join('\r\n');
  const blob = new Blob(['\ufeff', csvContent], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, `${sanitizeFilename(baseName)}_Tables.csv`);
}

// 6. Export Full QA Audit JSON Archive
export function exportToAuditJSON(
  content: string, 
  filename: string, 
  stats: ReportStats, 
  issues: QAIssue[]
) {
  const baseName = filename.replace(/\.[^/.]+$/, '');
  const titleMatch = content.match(/^#\s+([^\n\r]+)/m);
  const docTitle = titleMatch ? titleMatch[1].trim() : filename;

  const payload = {
    archiveType: 'Chinghams_DocuVerify_Audit_Package_v2.5',
    exportedAt: new Date().toISOString(),
    filename,
    title: docTitle,
    qualityScore: stats.qualityScore,
    wordCount: stats.wordCount,
    characterCount: stats.charCount,
    activeIssuesCount: issues.filter(i => !i.ignored).length,
    readability: stats.readability,
    dataContinuityStats: stats.continuity,
    detectedIssues: issues.map(issue => ({
      id: issue.id,
      category: issue.category,
      severity: issue.severity,
      title: issue.title,
      description: issue.description,
      lineNumber: issue.lineNumber,
      originalText: issue.originalText,
      suggestedText: issue.suggestedText,
      autoApplicable: issue.autoApplicable,
      ruleId: issue.ruleId,
      applied: issue.applied ?? false,
      ignored: issue.ignored ?? false,
    })),
    content,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  triggerDownload(blob, `${sanitizeFilename(baseName)}_Audit_Archive.json`);
}

// 7. Plain Text (.txt)
export function exportToPlainText(content: string, filename: string) {
  const baseName = filename.replace(/\.[^/.]+$/, '');
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  triggerDownload(blob, `${sanitizeFilename(baseName)}_Verified.txt`);
}

// 8. Markdown (.md)
export function exportToMarkdownFile(content: string, filename: string) {
  const baseName = filename.replace(/\.[^/.]+$/, '');
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  triggerDownload(blob, `${sanitizeFilename(baseName)}_Verified.md`);
}

// 9. Print Official QA Audit Certificate
export function printAuditCertificate(
  stats: ReportStats,
  issues: QAIssue[],
  filename: string
) {
  const printWindow = window.open('', '_blank', 'width=850,height=900');
  if (!printWindow) return;

  const remainingActive = issues.filter(i => !i.ignored).length;
  const criticalCount = issues.filter(i => !i.ignored && i.severity === 'critical').length;
  const warningCount = issues.filter(i => !i.ignored && i.severity === 'warning').length;
  const suggestionCount = issues.filter(i => !i.ignored && i.severity === 'suggestion').length;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>QA Audit Verification Certificate - ${escapeXml(filename)}</title>
  <style>
    @page { size: letter portrait; margin: 15mm; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background: #f8fafc;
      color: #1e293b;
      margin: 0;
      padding: 30px 20px;
      display: flex;
      justify-content: center;
    }
    .cert-frame {
      background: #ffffff;
      border: 6px double #0284c7;
      border-radius: 12px;
      padding: 40px;
      max-width: 720px;
      width: 100%;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      box-sizing: border-box;
    }
    .header { text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 24px; margin-bottom: 24px; }
    .badge { display: inline-block; padding: 4px 14px; background: #e0f2fe; color: #0369a1; border-radius: 20px; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; }
    h1 { margin: 12px 0 6px; font-size: 26px; color: #0f172a; }
    .subtitle { color: #64748b; font-size: 13px; margin: 0; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin: 24px 0; }
    .stat-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center; }
    .stat-label { font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 700; }
    .stat-val { font-size: 22px; font-weight: 800; margin-top: 4px; color: #0f172a; }
    .score-high { color: #15803d; }
    .score-med { color: #b45309; }
    .score-low { color: #b91c1c; }
    .details { font-size: 13px; line-height: 1.6; margin: 20px 0; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; background: #fafafa; }
    .footer { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 36px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; }
    .sig-line { width: 180px; border-top: 1px solid #94a3b8; margin-top: 24px; text-align: center; padding-top: 4px; font-size: 11px; color: #475569; }
    @media print {
      body { background: #fff; padding: 0; }
      .cert-frame { box-shadow: none; border-color: #0284c7; }
    }
  </style>
</head>
<body>
  <div class="cert-frame">
    <div class="header">
      <span class="badge">Official QA Verification Seal</span>
      <h1>Quality Assurance Certificate</h1>
      <p class="subtitle">Chingham's DocuVerify Automated Quality Assurance Inspection Report</p>
    </div>

    <p style="font-size: 14px; text-align: center; margin: 16px 0 24px;">
      This document certifies that the record <strong>${escapeXml(filename)}</strong> has undergone comprehensive deterministic rule inspection covering typography, table structure, running headers/footers, and metric continuity.
    </p>

    <div class="grid">
      <div class="stat-card">
        <div class="stat-label">Quality Score</div>
        <div class="stat-val ${stats.qualityScore >= 85 ? 'score-high' : stats.qualityScore >= 70 ? 'score-med' : 'score-low'}">${stats.qualityScore}/100</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Words</div>
        <div class="stat-val">${stats.wordCount.toLocaleString()}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Active Issues</div>
        <div class="stat-val">${remainingActive}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Data Continuity</div>
        <div class="stat-val score-high">${(stats.continuity?.conflictingMetricsFound ?? 0) === 0 ? 'Verified' : 'Flagged'}</div>
      </div>
    </div>

    <div class="details">
      <div><strong>Issue Breakdown:</strong> ${criticalCount} Critical, ${warningCount} Warnings, ${suggestionCount} Suggestions</div>
      <div style="margin-top: 6px;"><strong>Readability Ease:</strong> ${stats.readability?.readingEase ?? 'Professional'} (Reading time ~${stats.readingTimeMinutes} min)</div>
      <div style="margin-top: 6px;"><strong>Audit Timestamp:</strong> ${new Date().toLocaleString()}</div>
    </div>

    <div class="footer">
      <div>
        <div><strong>DocuVerify QA Engine v2.5</strong></div>
        <div style="font-size: 10px; margin-top: 2px;">Automated Document Integrity & Assurance</div>
      </div>
      <div>
        <div class="sig-line">Automated QA Signature</div>
      </div>
    </div>
  </div>

  <script>
    window.onload = function() {
      window.print();
    };
  </script>
</body>
</html>`;

  printWindow.document.write(html);
  printWindow.document.close();
}

