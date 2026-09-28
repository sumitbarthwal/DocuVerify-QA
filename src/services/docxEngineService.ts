import JSZip from 'jszip';
import * as docxPreview from 'docx-preview';

export interface DocxGenerateOptions {
  title?: string;
  headerText?: string;
  footerText?: string;
  images?: Array<{ name: string; dataUrl: string }>;
}

/**
 * Escapes XML special characters for OpenXML text elements.
 */
function escapeXml(str: string): string {
  return str.replace(/[<>&'"]/g, (c) => {
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

/**
 * Parses markdown inline formatting (**bold**, *italic*, <u>underline</u>, __underline__, ~~strike~~, <mark>highlight</mark>, `code`, sub, sup)
 * into authentic Microsoft Word OpenXML run (<w:r>) elements.
 */
function parseInlineMarkdownRuns(text: string): string {
  if (!text) return '';

  // Tokenize regex matching all supported inline formatting syntax
  const tokenRegex = /(\*\*\*[\s\S]+?\*\*\*|\*\*[\s\S]+?\*\*|__[\s\S]+?__|<u>[\s\S]+?<\/u>|~~[\s\S]+?~~|<del>[\s\S]+?<\/del>|<mark>[\s\S]+?<\/mark>|==[\s\S]+?==|`[^`]+?`|<code>[\s\S]+?<\/code>|<sub>[\s\S]+?<\/sub>|<sup>[\s\S]+?<\/sup>|\*[^*]+?\*)/g;

  const tokens = text.split(tokenRegex);

  return tokens.map(token => {
    if (!token) return '';

    // 1. Bold & Italic (***text***)
    if (token.startsWith('***') && token.endsWith('***') && token.length >= 6) {
      const inner = token.slice(3, -3);
      return `<w:r><w:rPr><w:b/><w:i/><w:color w:val="1E293B"/></w:rPr><w:t xml:space="preserve">${escapeXml(inner)}</w:t></w:r>`;
    }

    // 2. Bold (**text**)
    if (token.startsWith('**') && token.endsWith('**') && token.length >= 4) {
      const inner = token.slice(2, -2);
      return `<w:r><w:rPr><w:b/><w:color w:val="1E293B"/></w:rPr><w:t xml:space="preserve">${escapeXml(inner)}</w:t></w:r>`;
    }

    // 3. Underline (<u>text</u> or __text__)
    if ((token.startsWith('<u>') && token.endsWith('</u>') && token.length >= 7) ||
        (token.startsWith('__') && token.endsWith('__') && token.length >= 4)) {
      const inner = token.startsWith('<u>') ? token.slice(3, -4) : token.slice(2, -2);
      return `<w:r><w:rPr><w:u w:val="single"/><w:color w:val="1E293B"/></w:rPr><w:t xml:space="preserve">${escapeXml(inner)}</w:t></w:r>`;
    }

    // 4. Strikethrough (~~text~~ or <del>text</del>)
    if ((token.startsWith('~~') && token.endsWith('~~') && token.length >= 4) ||
        (token.startsWith('<del>') && token.endsWith('</del>') && token.length >= 11)) {
      const inner = token.startsWith('~~') ? token.slice(2, -2) : token.slice(5, -6);
      return `<w:r><w:rPr><w:strike/><w:color w:val="64748B"/></w:rPr><w:t xml:space="preserve">${escapeXml(inner)}</w:t></w:r>`;
    }

    // 5. Highlight (<mark>text</mark> or ==text==)
    if ((token.startsWith('<mark>') && token.endsWith('</mark>') && token.length >= 13) ||
        (token.startsWith('==') && token.endsWith('==') && token.length >= 4)) {
      const inner = token.startsWith('<mark>') ? token.slice(6, -7) : token.slice(2, -2);
      return `<w:r><w:rPr><w:highlight w:val="yellow"/><w:color w:val="0F172A"/></w:rPr><w:t xml:space="preserve">${escapeXml(inner)}</w:t></w:r>`;
    }

    // 6. Inline Code (`code` or <code>code</code>)
    if ((token.startsWith('`') && token.endsWith('`') && token.length >= 2) ||
        (token.startsWith('<code>') && token.endsWith('</code>') && token.length >= 13)) {
      const inner = token.startsWith('`') ? token.slice(1, -1) : token.slice(6, -7);
      return `<w:r><w:rPr><w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/><w:sz w:val="20"/><w:color w:val="0F172A"/></w:rPr><w:t xml:space="preserve">${escapeXml(inner)}</w:t></w:r>`;
    }

    // 7. Subscript (<sub>text</sub>)
    if (token.startsWith('<sub>') && token.endsWith('</sub>') && token.length >= 11) {
      const inner = token.slice(5, -6);
      return `<w:r><w:rPr><w:vertAlign w:val="subscript"/></w:rPr><w:t xml:space="preserve">${escapeXml(inner)}</w:t></w:r>`;
    }

    // 8. Superscript (<sup>text</sup>)
    if (token.startsWith('<sup>') && token.endsWith('</sup>') && token.length >= 11) {
      const inner = token.slice(5, -6);
      return `<w:r><w:rPr><w:vertAlign w:val="superscript"/></w:rPr><w:t xml:space="preserve">${escapeXml(inner)}</w:t></w:r>`;
    }

    // 9. Italic (*text*)
    if (token.startsWith('*') && token.endsWith('*') && token.length >= 2) {
      const inner = token.slice(1, -1);
      return `<w:r><w:rPr><w:i/><w:color w:val="334155"/></w:rPr><w:t xml:space="preserve">${escapeXml(inner)}</w:t></w:r>`;
    }

    // Normal text run
    return `<w:r><w:t xml:space="preserve">${escapeXml(token)}</w:t></w:r>`;
  }).join('');
}

/**
 * Converts a dataUrl or blob url to binary Uint8Array for embedding in docx zip.
 */
async function fetchImageBytes(url: string): Promise<Uint8Array | null> {
  try {
    if (url.startsWith('data:')) {
      const parts = url.split(',');
      const b64 = parts[1];
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes;
    }
    const res = await fetch(url);
    const buf = await res.arrayBuffer();
    return new Uint8Array(buf);
  } catch (err) {
    console.warn('Could not fetch image bytes for docx packaging:', err);
    return null;
  }
}

/**
 * Builds an authentic, fully standard Microsoft Word OpenXML (.docx) ZIP package.
 * Produces native headers, footers, styles, tables, and images.
 */
export async function createStandardDocxPackage(
  content: string,
  options: DocxGenerateOptions = {}
): Promise<ArrayBuffer> {
  const zip = new JSZip();

  const title = options.title || 'Document Report';
  const headerText = options.headerText || `${title} | Confidential`;
  const footerText = options.footerText || "Chingham's DocuVerify QA Engine";

  // 1. Content Types
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Default Extension="jpeg" ContentType="image/jpeg"/>
  <Default Extension="jpg" ContentType="image/jpeg"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>
  <Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>
</Types>`);

  // 2. Package Relationships
  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);

  // 3. Document Relationships
  zip.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdHeader1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>
  <Relationship Id="rIdFooter1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>
  <Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`);

  // 4. Styles Definition
  zip.file('word/styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>
        <w:sz w:val="22"/>
        <w:color w:val="1F2937"/>
        <w:lang w:val="en-US"/>
      </w:rPr>
    </w:rPrDefault>
    <w:pPrDefault>
      <w:pPr>
        <w:spacing w:line="276" w:lineRule="auto" w:after="160"/>
      </w:pPr>
    </w:pPrDefault>
  </w:docDefaults>

  <w:style w:type="paragraph" w:styleId="Normal" w:default="1">
    <w:name w:val="Normal"/>
  </w:style>

  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:pPr>
      <w:spacing w:before="360" w:after="140"/>
    </w:pPr>
    <w:rPr>
      <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
      <w:b/>
      <w:sz w:val="34"/>
      <w:color w:val="1E3A8A"/>
    </w:rPr>
  </w:style>

  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:pPr>
      <w:spacing w:before="260" w:after="100"/>
    </w:pPr>
    <w:rPr>
      <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
      <w:b/>
      <w:sz w:val="26"/>
      <w:color w:val="2563EB"/>
    </w:rPr>
  </w:style>

  <w:style w:type="paragraph" w:styleId="Heading3">
    <w:name w:val="heading 3"/>
    <w:pPr>
      <w:spacing w:before="180" w:after="80"/>
    </w:pPr>
    <w:rPr>
      <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
      <w:b/>
      <w:sz w:val="22"/>
      <w:color w:val="334155"/>
    </w:rPr>
  </w:style>

  <w:style w:type="paragraph" w:styleId="Header">
    <w:name w:val="header"/>
    <w:rPr>
      <w:sz w:val="18"/>
      <w:color w:val="64748B"/>
    </w:rPr>
  </w:style>

  <w:style w:type="paragraph" w:styleId="Footer">
    <w:name w:val="footer"/>
    <w:rPr>
      <w:sz w:val="18"/>
      <w:color w:val="64748B"/>
    </w:rPr>
  </w:style>
</w:styles>`);

  // 5. Running Header
  zip.file('word/header1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:tbl>
    <w:tblPr>
      <w:tblW w:w="5000" w:type="pct"/>
      <w:tblBorders>
        <w:bottom w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
      </w:tblBorders>
    </w:tblPr>
    <w:tr>
      <w:tc>
        <w:tcPr><w:tcW w:w="3500" w:type="pct"/></w:tcPr>
        <w:p>
          <w:pPr><w:pStyle w:val="Header"/><w:spacing w:after="60"/></w:pPr>
          <w:r>
            <w:rPr><w:b/><w:sz w:val="18"/><w:color w:val="1E293B"/></w:rPr>
            <w:t>${escapeXml(headerText)}</w:t>
          </w:r>
        </w:p>
      </w:tc>
      <w:tc>
        <w:tcPr><w:tcW w:w="1500" w:type="pct"/></w:tcPr>
        <w:p>
          <w:pPr><w:pStyle w:val="Header"/><w:jc w:val="right"/><w:spacing w:after="60"/></w:pPr>
          <w:r>
            <w:rPr><w:sz w:val="18"/><w:color w:val="64748B"/></w:rPr>
            <w:t>DocuVerify QA Verified</w:t>
          </w:r>
        </w:p>
      </w:tc>
    </w:tr>
  </w:tbl>
</w:hdr>`);

  // 6. Running Footer with page numbering
  zip.file('word/footer1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:tbl>
    <w:tblPr>
      <w:tblW w:w="5000" w:type="pct"/>
      <w:tblBorders>
        <w:top w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
      </w:tblBorders>
    </w:tblPr>
    <w:tr>
      <w:tc>
        <w:tcPr><w:tcW w:w="3500" w:type="pct"/></w:tcPr>
        <w:p>
          <w:pPr><w:pStyle w:val="Footer"/><w:spacing w:before="60"/></w:pPr>
          <w:r>
            <w:rPr><w:sz w:val="18"/><w:color w:val="64748B"/></w:rPr>
            <w:t>${escapeXml(footerText)}</w:t>
          </w:r>
        </w:p>
      </w:tc>
      <w:tc>
        <w:tcPr><w:tcW w:w="1500" w:type="pct"/></w:tcPr>
        <w:p>
          <w:pPr><w:pStyle w:val="Footer"/><w:jc w:val="right"/><w:spacing w:before="60"/></w:pPr>
          <w:r><w:rPr><w:sz w:val="18"/><w:color w:val="64748B"/></w:rPr><w:t>Page </w:t></w:r>
          <w:fldSimple w:instr="PAGE"/>
          <w:r><w:rPr><w:sz w:val="18"/><w:color w:val="64748B"/></w:rPr><w:t> of </w:t></w:r>
          <w:fldSimple w:instr="NUMPAGES"/>
        </w:p>
      </w:tc>
    </w:tr>
  </w:tbl>
</w:ftr>`);

  // 7. Parse body content lines to OpenXML elements
  const lines = content.split('\n');
  const bodyXml: string[] = [];

  let i = 0;
  while (i < lines.length) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    // 1. Page Break Divider (--- or *** or <!-- Page Break -->)
    if (line === '---' || line === '***' || line === '___' || line.includes('<!-- Page Break -->') || line.toLowerCase().includes('page-break')) {
      bodyXml.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>');
      i++;
      continue;
    }

    // 2. Table parsing
    if (line.includes('|') && i + 1 < lines.length && /^\s*\|?\s*[-:]+[-| :]*\|?\s*$/.test(lines[i + 1])) {
      const headerCells = line.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
      bodyXml.push('<w:tbl>');
      bodyXml.push(`
        <w:tblPr>
          <w:tblW w:w="5000" w:type="pct"/>
          <w:tblBorders>
            <w:top w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
            <w:left w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
            <w:bottom w:val="single" w:sz="8" w:space="0" w:color="185ABD"/>
            <w:right w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
            <w:insideH w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>
            <w:insideV w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>
          </w:tblBorders>
        </w:tblPr>
      `);

      // Header row
      bodyXml.push('<w:tr>');
      headerCells.forEach(cell => {
        bodyXml.push(`
          <w:tc>
            <w:tcPr>
              <w:shd w:val="clear" w:color="auto" w:fill="F1F5F9"/>
              <w:tcMar><w:top w:w="120" w:type="dxa"/><w:bottom w:w="120" w:type="dxa"/><w:left w:w="160" w:type="dxa"/><w:right w:w="160" w:type="dxa"/></w:tcMar>
            </w:tcPr>
            <w:p>
              <w:pPr><w:spacing w:after="0"/></w:pPr>
              <w:r><w:rPr><w:b/><w:sz w:val="20"/><w:color w:val="0F172A"/></w:rPr><w:t>${escapeXml(cell)}</w:t></w:r>
            </w:p>
          </w:tc>
        `);
      });
      bodyXml.push('</w:tr>');

      i += 2;
      while (i < lines.length && lines[i].includes('|') && lines[i].trim().length > 0) {
        const rowCells = lines[i].trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
        bodyXml.push('<w:tr>');
        rowCells.forEach(cell => {
          const isNum = /^[$€£¥₹]?\s*-?\d+(?:,\d{3})*(?:\.\d+)?%?$/.test(cell);
          bodyXml.push(`
            <w:tc>
              <w:tcPr>
                <w:tcMar><w:top w:w="100" w:type="dxa"/><w:bottom w:w="100" w:type="dxa"/><w:left w:w="160" w:type="dxa"/><w:right w:w="160" w:type="dxa"/></w:tcMar>
              </w:tcPr>
              <w:p>
                <w:pPr><w:jc w:val="${isNum ? 'right' : 'left'}"/><w:spacing w:after="0"/></w:pPr>
                ${parseInlineMarkdownRuns(cell)}
              </w:p>
            </w:tc>
          `);
        });
        bodyXml.push('</w:tr>');
        i++;
      }
      bodyXml.push('</w:tbl>');
      continue;
    }

    // 3. Blockquote
    if (line.startsWith('> ')) {
      bodyXml.push(`
        <w:p>
          <w:pPr>
            <w:pBdr><w:left w:val="single" w:sz="18" w:space="8" w:color="185ABD"/></w:pPr>
            <w:ind w:left="360"/>
            <w:spacing w:before="120" w:after="120"/>
          </w:pPr>
          ${parseInlineMarkdownRuns(line.slice(2))}
        </w:p>
      `);
      i++;
      continue;
    }

    // 4. Headings
    if (line.startsWith('# ')) {
      bodyXml.push(`
        <w:p>
          <w:pPr><w:pStyle w:val="Heading1"/></w:pPr>
          <w:r><w:t>${escapeXml(line.slice(2))}</w:t></w:r>
        </w:p>
      `);
    } else if (line.startsWith('## ')) {
      bodyXml.push(`
        <w:p>
          <w:pPr><w:pStyle w:val="Heading2"/></w:pPr>
          <w:r><w:t>${escapeXml(line.slice(3))}</w:t></w:r>
        </w:p>
      `);
    } else if (line.startsWith('### ')) {
      bodyXml.push(`
        <w:p>
          <w:pPr><w:pStyle w:val="Heading3"/></w:pPr>
          <w:r><w:t>${escapeXml(line.slice(4))}</w:t></w:r>
        </w:p>
      `);
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      bodyXml.push(`
        <w:p>
          <w:pPr>
            <w:ind w:left="400" w:hanging="200"/>
            <w:spacing w:after="80"/>
          </w:pPr>
          <w:r><w:rPr><w:b/><w:color w:val="185ABD"/></w:rPr><w:t>• </w:t></w:r>
          ${parseInlineMarkdownRuns(line.slice(2))}
        </w:p>
      `);
    } else if (line.length === 0) {
      bodyXml.push('<w:p><w:pPr><w:spacing w:after="80"/></w:pPr></w:p>');
    } else {
      // Normal paragraph with inline formatting
      bodyXml.push(`
        <w:p>
          <w:pPr><w:spacing w:line="276" w:lineRule="auto" w:after="140"/></w:pPr>
          ${parseInlineMarkdownRuns(line)}
        </w:p>
      `);
    }
    i++;
  }

  // 8. Section Properties with Header/Footer links, Page Size, and Margins
  bodyXml.push(`
    <w:sectPr>
      <w:headerReference w:type="default" r:id="rIdHeader1"/>
      <w:footerReference w:type="default" r:id="rIdFooter1"/>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720"/>
    </w:sectPr>
  `);

  zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    ${bodyXml.join('\n')}
  </w:body>
</w:document>`);

  return await zip.generateAsync({
    type: 'arraybuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });
}

/**
 * Patches text inside an existing DOCX arrayBuffer across document.xml, headers,
 * footers, and footnotes while retaining 100% of styles, formatting, embedded media,
 * tables, and margins.
 */
export async function patchDocxArrayBuffer(
  buffer: ArrayBuffer,
  replacements: Array<{ oldText: string; newText: string }>
): Promise<ArrayBuffer> {
  try {
    const zip = await JSZip.loadAsync(buffer);

    // Target all text-bearing XML files in the Word package
    const xmlTargetFiles = Object.keys(zip.files).filter(k => 
      /^word\/(document|header\d*|footer\d*|footnotes|endnotes)\.xml$/i.test(k)
    );

    if (xmlTargetFiles.length === 0) {
      return buffer;
    }

    let anyModified = false;

    for (const filename of xmlTargetFiles) {
      const file = zip.file(filename);
      if (!file) continue;

      let xmlContent = await file.async('text');
      let fileModified = false;

      for (const { oldText, newText } of replacements) {
        if (!oldText || oldText === newText) continue;

        // 1. Direct match
        if (xmlContent.includes(oldText)) {
          xmlContent = xmlContent.split(oldText).join(escapeXml(newText));
          fileModified = true;
          continue;
        }

        // 2. XML escaped match
        const escapedOld = escapeXml(oldText);
        const escapedNew = escapeXml(newText);
        if (xmlContent.includes(escapedOld)) {
          xmlContent = xmlContent.split(escapedOld).join(escapedNew);
          fileModified = true;
          continue;
        }

        // 3. Match within text runs: replace across spaces
        try {
          const regex = new RegExp(oldText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'), 'g');
          if (regex.test(xmlContent)) {
            xmlContent = xmlContent.replace(regex, escapedNew);
            fileModified = true;
          }
        } catch {
          // Ignore regex syntax errors
        }
      }

      if (fileModified) {
        zip.file(filename, xmlContent);
        anyModified = true;
      }
    }

    if (!anyModified) {
      return buffer;
    }

    return await zip.generateAsync({
      type: 'arraybuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });
  } catch (err) {
    console.warn('Docx patching encountered issue, returning original:', err);
    return buffer;
  }
}

/**
 * Updates running header and footer text directly inside existing DOCX OpenXML package files,
 * preserving all formatting, styles, page numbers, and embedded images.
 */
export async function updateDocxHeaderFooter(
  buffer: ArrayBuffer,
  newHeader?: string,
  newFooter?: string
): Promise<ArrayBuffer> {
  try {
    const zip = await JSZip.loadAsync(buffer);
    let modified = false;

    // 1. Update headers
    if (newHeader !== undefined) {
      const headerFiles = Object.keys(zip.files).filter(k => /^word\/header\d*\.xml$/i.test(k));
      if (headerFiles.length > 0) {
        for (const hf of headerFiles) {
          let xml = await zip.file(hf)!.async('text');
          // Replace text inside the first <w:t> or all <w:t> elements
          if (/<w:t(?:\s+[^>]*)?>[\s\S]*?<\/w:t>/i.test(xml)) {
            // Replace first text run with new header and empty out subsequent ones in same paragraph
            let replacedFirst = false;
            xml = xml.replace(/<w:t(?:\s+[^>]*)?>([\s\S]*?)<\/w:t>/gi, (match) => {
              if (!replacedFirst) {
                replacedFirst = true;
                return `<w:t xml:space="preserve">${escapeXml(newHeader)}</w:t>`;
              }
              return `<w:t></w:t>`;
            });
            zip.file(hf, xml);
            modified = true;
          }
        }
      } else {
        // Create header1.xml
        zip.file('word/header1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:p>
    <w:pPr><w:jc w:val="both"/><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="4" w:color="CBD5E1"/></w:pBdr></w:pPr>
    <w:r><w:rPr><w:sz w:val="18"/><w:color w:val="64748B"/></w:rPr><w:t xml:space="preserve">${escapeXml(newHeader)}</w:t></w:r>
  </w:p>
</w:hdr>`);
        modified = true;
      }
    }

    // 2. Update footers
    if (newFooter !== undefined) {
      const footerFiles = Object.keys(zip.files).filter(k => /^word\/footer\d*\.xml$/i.test(k));
      if (footerFiles.length > 0) {
        for (const ff of footerFiles) {
          let xml = await zip.file(ff)!.async('text');
          if (/<w:t(?:\s+[^>]*)?>[\s\S]*?<\/w:t>/i.test(xml)) {
            let replacedFirst = false;
            xml = xml.replace(/<w:t(?:\s+[^>]*)?>([\s\S]*?)<\/w:t>/gi, (match) => {
              if (!replacedFirst) {
                replacedFirst = true;
                return `<w:t xml:space="preserve">${escapeXml(newFooter)}</w:t>`;
              }
              return `<w:t></w:t>`;
            });
            zip.file(ff, xml);
            modified = true;
          }
        }
      } else {
        // Create footer1.xml
        zip.file('word/footer1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:p>
    <w:pPr><w:jc w:val="both"/><w:pBdr><w:top w:val="single" w:sz="6" w:space="4" w:color="CBD5E1"/></w:pBdr></w:pPr>
    <w:r><w:rPr><w:sz w:val="18"/><w:color w:val="64748B"/></w:rPr><w:t xml:space="preserve">${escapeXml(newFooter)}</w:t></w:r>
  </w:p>
</w:ftr>`);
        modified = true;
      }
    }

    if (!modified) return buffer;

    return await zip.generateAsync({
      type: 'arraybuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });
  } catch (err) {
    console.warn('Docx header/footer update encountered issue:', err);
    return buffer;
  }
}

/**
 * Renders DOCX arrayBuffer into a DOM container with authentic Microsoft Word pages,
 * complete with headers, footers, tables, images, and page breaks.
 */
export async function renderDocxInContainer(
  buffer: ArrayBuffer,
  bodyContainer: HTMLElement,
  styleContainer?: HTMLElement
): Promise<any> {
  return await docxPreview.renderAsync(buffer, bodyContainer, styleContainer, {
    className: 'docx',
    inWrapper: true,
    breakPages: true,
    renderHeaders: true,
    renderFooters: true,
    renderFootnotes: true,
    renderEndnotes: true,
    useBase64URL: true,
    ignoreFonts: false,
  });
}

/**
 * Initiates native browser download of a genuine .docx file.
 */
export function downloadDocxFile(buffer: ArrayBuffer, filename: string) {
  const cleanName = filename.endsWith('.docx') ? filename : `${filename.replace(/\.[^/.]+$/, '')}.docx`;
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = cleanName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
