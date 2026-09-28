/**
 * Office & Native Editor Add-in Integration Service
 * 
 * Supports:
 * 1. Microsoft Word (Desktop, Mac, Web / Office 365) via Office.js
 * 2. Microsoft Excel (Desktop, Mac, Web) via Office.js
 * 3. Adobe Acrobat Pro (Action Wizard & Folder-Level JavaScript)
 * 4. Google Docs / Workspace via Apps Script
 */

declare const Office: any;
declare const Word: any;
declare const Excel: any;

export interface OfficeHostInfo {
  isOfficeHost: boolean;
  hostType: 'Word' | 'Excel' | 'PowerPoint' | 'Outlook' | 'Unknown' | 'Browser';
  platform: string;
  isReady: boolean;
}

let cachedHostInfo: OfficeHostInfo | null = null;

/**
 * Dynamically loads the official Office.js SDK only when taskpane mode is explicitly active.
 */
export async function loadOfficeScript(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if ((window as any).Office) return true;

  return new Promise<boolean>((resolve) => {
    const existing = document.getElementById('office-js-sdk');
    if (existing) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.id = 'office-js-sdk';
    script.src = 'https://appsforoffice.microsoft.com/lib/1/hosted/office.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

/**
 * Initializes and detects whether running inside a real Microsoft Office application.
 * In a standard browser, resolves immediately with zero delay.
 */
export async function detectOfficeHost(): Promise<OfficeHostInfo> {
  if (cachedHostInfo) return cachedHostInfo;

  if (typeof window === 'undefined') {
    return { isOfficeHost: false, hostType: 'Browser', platform: 'WebBrowser', isReady: true };
  }

  // Only attempt Office.js detection if explicitly requested or if Office is present
  const isTaskpaneUrl = window.location.search.includes('taskpane') || window.location.search.includes('addin');
  if (!isTaskpaneUrl && !(window as any).Office) {
    cachedHostInfo = {
      isOfficeHost: false,
      hostType: 'Browser',
      platform: 'WebBrowser',
      isReady: true,
    };
    return cachedHostInfo;
  }

  if (!(window as any).Office && isTaskpaneUrl) {
    await loadOfficeScript();
  }

  if (!(window as any).Office) {
    cachedHostInfo = {
      isOfficeHost: false,
      hostType: 'Browser',
      platform: 'WebBrowser',
      isReady: true,
    };
    return cachedHostInfo;
  }

  try {
    const info = await new Promise<any>((resolve) => {
      // Safe 800ms timeout
      const timer = setTimeout(() => {
        resolve({ host: null, platform: null });
      }, 800);

      try {
        Office.onReady((result: any) => {
          clearTimeout(timer);
          resolve(result);
        });
      } catch {
        clearTimeout(timer);
        resolve({ host: null, platform: null });
      }
    });

    if (info && info.host) {
      let hostType: OfficeHostInfo['hostType'] = 'Unknown';
      if (info.host === Office.HostType?.Word || String(info.host).toLowerCase() === 'word') {
        hostType = 'Word';
      } else if (info.host === Office.HostType?.Excel || String(info.host).toLowerCase() === 'excel') {
        hostType = 'Excel';
      }

      cachedHostInfo = {
        isOfficeHost: hostType !== 'Unknown',
        hostType,
        platform: String(info.platform || 'OfficeClient'),
        isReady: true,
      };
      return cachedHostInfo;
    }
  } catch (err) {
    console.warn('[DocuVerify Office.js] Detection notice:', err);
  }

  cachedHostInfo = {
    isOfficeHost: false,
    hostType: 'Browser',
    platform: 'WebBrowser',
    isReady: true,
  };
  return cachedHostInfo;
}

/**
 * Reads live text from active Microsoft Word document via Word.run
 */
export async function readWordDocument(): Promise<{ title: string; text: string } | null> {
  if (typeof Word === 'undefined') return null;

  try {
    return await Word.run(async (context: any) => {
      const body = context.document.body;
      body.load(['text']);
      await context.sync();

      let title = 'Active Word Document.docx';
      try {
        const properties = context.document.properties;
        properties.load(['title']);
        await context.sync();
        if (properties.title && properties.title.trim().length > 0) {
          title = properties.title.trim() + '.docx';
        }
      } catch {
        // Properties might not be supported in older hosts
      }

      return {
        title,
        text: body.text || '',
      };
    });
  } catch (err) {
    console.error('[DocuVerify Word.run] Failed to read Word document:', err);
    return null;
  }
}

/**
 * Highlights a specific text string directly inside the open Microsoft Word document
 */
export async function highlightInNativeWord(targetText: string, colorHex = '#FEF08A'): Promise<boolean> {
  if (typeof Word === 'undefined' || !targetText) return false;

  try {
    return await Word.run(async (context: any) => {
      const searchResults = context.document.body.search(targetText, {
        matchCase: false,
        matchWholeWord: false,
      });
      searchResults.load(['items']);
      await context.sync();

      if (searchResults.items && searchResults.items.length > 0) {
        const range = searchResults.items[0];
        range.select();
        range.font.highlightColor = colorHex;
        await context.sync();
        return true;
      }
      return false;
    });
  } catch (err) {
    console.warn('[DocuVerify Word.run] Highlight notice:', err);
    return false;
  }
}

/**
 * Replaces a flagged text run directly in the active native Microsoft Word document
 */
export async function fixInNativeWord(originalText: string, replacementText: string): Promise<boolean> {
  if (typeof Word === 'undefined' || !originalText) return false;

  try {
    return await Word.run(async (context: any) => {
      const searchResults = context.document.body.search(originalText, {
        matchCase: true,
        matchWholeWord: false,
      });
      searchResults.load(['items']);
      await context.sync();

      if (searchResults.items && searchResults.items.length > 0) {
        const range = searchResults.items[0];
        range.insertText(replacementText, 'Replace');
        range.select();
        await context.sync();
        return true;
      }
      return false;
    });
  } catch (err) {
    console.error('[DocuVerify Word.run] Failed to fix text in Word:', err);
    return false;
  }
}

/**
 * Inserts a native Microsoft Word comment attached to the flagged phrase
 */
export async function addCommentInNativeWord(originalText: string, commentBody: string): Promise<boolean> {
  if (typeof Word === 'undefined' || !originalText) return false;

  try {
    return await Word.run(async (context: any) => {
      const searchResults = context.document.body.search(originalText, {
        matchCase: false,
        matchWholeWord: false,
      });
      searchResults.load(['items']);
      await context.sync();

      if (searchResults.items && searchResults.items.length > 0) {
        const range = searchResults.items[0];
        range.insertComment(`[DocuVerify QA]: ${commentBody}`);
        await context.sync();
        return true;
      }
      return false;
    });
  } catch (err) {
    console.warn('[DocuVerify Word.run] Comment notice:', err);
    return false;
  }
}

/**
 * Generates the official Microsoft Office Add-in manifest XML.
 * Fully compatible with Microsoft Word Desktop (Windows/Mac) and Word Online (Office 365).
 */
export function generateOfficeManifestXml(baseUrl: string): string {
  // Ensure clean HTTPS base URL without trailing slash
  const cleanUrl = baseUrl.replace(/\/+$/, '');
  const hostDomain = cleanUrl.replace(/^https?:\/\//i, '').split('/')[0];

  return `<?xml version="1.0" encoding="UTF-8"?>
<OfficeApp 
  xmlns="http://schemas.microsoft.com/office/appforoffice/1.1" 
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
  xmlns:bt="http://schemas.microsoft.com/office/officeappbasictypes/1.0" 
  xmlns:ov="http://schemas.microsoft.com/office/taskpaneappversionoverrides" 
  xsi:type="TaskPaneApp">

  <!-- Unique Add-in ID -->
  <Id>e4d891c1-8ebb-465d-b3a6-66c7655f755f</Id>
  <Version>1.0.0.0</Version>
  <ProviderName>DocuVerify QA Systems</ProviderName>
  <DefaultLocale>en-US</DefaultLocale>
  <DisplayName DefaultValue="DocuVerify QA Assistant" />
  <Description DefaultValue="Professional document auditing, continuous data integrity, and compliance proofing directly inside Microsoft Word and Excel." />
  
  <IconUrl DefaultValue="${cleanUrl}/favicon.ico" />
  <HighResolutionIconUrl DefaultValue="${cleanUrl}/favicon.ico" />
  <SupportUrl DefaultValue="${cleanUrl}" />

  <AppDomains>
    <AppDomain>${cleanUrl}</AppDomain>
    <AppDomain>https://${hostDomain}</AppDomain>
  </AppDomains>

  <!-- Supported Native Office Hosts -->
  <Hosts>
    <Host Name="Document" />
    <Host Name="Workbook" />
  </Hosts>

  <!-- Default Settings for Legacy Office -->
  <DefaultSettings>
    <SourceLocation DefaultValue="${cleanUrl}/?mode=taskpane" />
  </DefaultSettings>

  <!-- Read and Write Permissions to allow in-place highlight and 1-click fixing -->
  <Permissions>ReadWriteDocument</Permissions>

  <!-- Ribbon & Taskpane Version Overrides (Modern Office 365 & Office 2019/2021) -->
  <VersionOverrides xmlns="http://schemas.microsoft.com/office/taskpaneappversionoverrides" xsi:type="VersionOverridesV1_0">
    <Hosts>
      <Host xsi:type="Document">
        <DesktopFormFactor>
          <ExtensionPoint xsi:type="PrimaryCommandSurface">
            <CustomTab id="DocuVerifyTab">
              <Group id="DocuVerifyGroup">
                <Label resid="GroupLabel" />
                <Icon>
                  <bt:Image size="16" resid="Icon16" />
                  <bt:Image size="32" resid="Icon32" />
                  <bt:Image size="80" resid="Icon80" />
                </Icon>

                <!-- Primary Taskpane Button in Word Ribbon -->
                <Control xsi:type="Button" id="ShowTaskpaneButton">
                  <Label resid="ButtonLabel" />
                  <Supertip>
                    <Title resid="ButtonTitle" />
                    <Description resid="ButtonDesc" />
                  </Supertip>
                  <Icon>
                    <bt:Image size="16" resid="Icon16" />
                    <bt:Image size="32" resid="Icon32" />
                    <bt:Image size="80" resid="Icon80" />
                  </Icon>
                  <Action xsi:type="ShowTaskpane">
                    <TaskpaneId>DocuVerifyTaskpane</TaskpaneId>
                    <SourceLocation resid="TaskpaneUrl" />
                  </Action>
                </Control>
              </Group>
              <Label resid="TabLabel" />
            </CustomTab>
          </ExtensionPoint>
        </DesktopFormFactor>
      </Host>
    </Hosts>

    <Resources>
      <bt:Images>
        <bt:Image id="Icon16" DefaultValue="${cleanUrl}/favicon.ico" />
        <bt:Image id="Icon32" DefaultValue="${cleanUrl}/favicon.ico" />
        <bt:Image id="Icon80" DefaultValue="${cleanUrl}/favicon.ico" />
      </bt:Images>
      <bt:Urls>
        <bt:Url id="TaskpaneUrl" DefaultValue="${cleanUrl}/?mode=taskpane" />
      </bt:Urls>
      <bt:ShortStrings>
        <bt:String id="GroupLabel" DefaultValue="Quality Assurance" />
        <bt:String id="TabLabel" DefaultValue="DocuVerify QA" />
        <bt:String id="ButtonLabel" DefaultValue="DocuVerify Assistant" />
        <bt:String id="ButtonTitle" DefaultValue="DocuVerify Document QA" />
      </bt:ShortStrings>
      <bt:LongStrings>
        <bt:String id="ButtonDesc" DefaultValue="Inspect document for calculation continuity, repetitive data discrepancies, grammar, and typography with 1-click in-place fixing directly inside Word." />
      </bt:LongStrings>
    </Resources>
  </VersionOverrides>
</OfficeApp>
`;
}

/**
 * Generates Adobe Acrobat Folder-Level JavaScript / Action Wizard Automation
 */
export function generateAcrobatScript(baseUrl: string): string {
  return `/*
 * DocuVerify QA - Adobe Acrobat Pro Automation Script
 * Place this file in Acrobat's JavaScripts directory:
 * Windows: C:\\Users\\[User]\\AppData\\Roaming\\Adobe\\Acrobat\\Privileged\\DC\\JavaScripts\\
 * Mac: ~/Library/Application Support/Adobe/Acrobat/DC/JavaScripts/
 */

app.addMenuItem({
  cName: "DocuVerifyQA",
  cUser: "DocuVerify QA Audit...",
  cParent: "Tools",
  cExec: "runDocuVerifyAudit();",
  cEnable: "event.rc = (event.target != null);",
  nPos: 0
});

function runDocuVerifyAudit() {
  if (!this.numPages) {
    app.alert("No PDF document is currently open.", 3);
    return;
  }

  app.beginPriv();
  
  // Extract document text and metadata
  var fullText = "";
  var maxPages = Math.min(this.numPages, 100);
  for (var i = 0; i < maxPages; i++) {
    var pageWords = this.getPageNumWords(i);
    for (var w = 0; w < pageWords; w++) {
      fullText += this.getPageNthWord(i, w, false) + " ";
    }
    fullText += "\\n--- PAGE " + (i + 1) + " ---\\n";
  }

  // Preflight Quality Checks
  var issuesFound = 0;
  var report = "=== DOCUVERIFY QA AUDIT FOR: " + this.documentFileName + " ===\\n\\n";
  
  // 1. Placeholder & TBD Scan
  var placeholderRegex = /\\[(TBD|TODO|PENDING|INSERT|DRAFT)\\]/gi;
  var match;
  while ((match = placeholderRegex.exec(fullText)) !== null) {
    issuesFound++;
    report += "[CRITICAL] Unresolved placeholder found: '" + match[0] + "'\\n";
  }

  // 2. Trailing decimal & currency uniformity
  if (fullText.indexOf("$$") !== -1 || fullText.indexOf("Rs. Rs.") !== -1) {
    issuesFound++;
    report += "[WARNING] Duplicate currency symbol detected.\\n";
  }

  // 3. Document Metadata Audit
  report += "\\n--- METADATA AUDIT ---\\n";
  report += "Title: " + (this.info.title || "(Missing - Non-compliant)") + "\\n";
  report += "Author: " + (this.info.author || "(Missing)") + "\\n";
  report += "Security/Permissions: " + (this.securityHandler ? "Restricted" : "Standard") + "\\n";
  report += "Total Pages: " + this.numPages + "\\n";

  report += "\\n=== RESULT: " + (issuesFound === 0 ? "PASSED (100% Ready)" : issuesFound + " ISSUES DETECTED") + " ===\\n";
  report += "For full interactive taskpane editing & auto-fix, open DocuVerify Web Hub at:\\n" + "${baseUrl}";

  app.alert(report, issuesFound === 0 ? 3 : 1);
  app.endPriv();
}
`;
}

/**
 * Generates Google Apps Script for Google Docs Sidebar Integration
 */
export function generateGoogleDocsScript(baseUrl: string): string {
  return `/**
 * DocuVerify QA - Google Docs & Workspace Add-on
 * Extensions > Apps Script -> Paste into Code.gs
 */

function onOpen(e) {
  DocumentApp.getUi()
    .createMenu('DocuVerify QA')
    .addItem('Open QA Taskpane', 'showSidebar')
    .addItem('Audit Document Text', 'quickAudit')
    .addToUi();
}

function showSidebar() {
  var html = HtmlService.createHtmlOutput(
    '<iframe src="${baseUrl}/?mode=taskpane" style="width:100%;height:100%;border:none;"></iframe>'
  )
  .setTitle('DocuVerify QA Assistant')
  .setWidth(360);
  
  DocumentApp.getUi().showSidebar(html);
}

function quickAudit() {
  var doc = DocumentApp.getActiveDocument();
  var body = doc.getBody();
  var text = body.getText();
  
  var issues = [];
  if (/\\[(TBD|TODO|PENDING)\\]/i.test(text)) {
    issues.push("Unresolved placeholders found");
  }
  
  DocumentApp.getUi().alert("Quick Audit complete. Issues: " + issues.length);
}
`;
}
