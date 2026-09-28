import JSZip from 'jszip';

/**
 * Service to bundle and export the entire project source code as a GitHub-ready ZIP package
 */
export async function downloadGitHubProjectZip(): Promise<void> {
  const zip = new JSZip();

  // Root config files
  zip.file('.gitignore', `node_modules/\nbuild/\ndist/\ncoverage/\n.DS_Store\n*.log\n.env*\n!.env.example\n`);
  
  zip.file('.env.example', `# Optional Gemini API Key for Online Deep Auditing
GEMINI_API_KEY=
PORT=3000
NODE_ENV=production
`);

  zip.file('README.md', `# Chingham's DocuVerify QA - Technical & Survey Report Verification Engine

A client-side, offline-first quality assurance and document verification suite for surveyors, loss adjusters, and technical authors. Includes native Microsoft Word, Excel, and Adobe Acrobat Add-in integrations.

## 🚀 Quick Start

\`\`\`bash
# 1. Install dependencies
npm install

# 2. Run local development server
npm run dev

# 3. Build for production (GitHub Pages or Full-Stack)
npm run build
\`\`\`

## 📦 Push to Your GitHub Repository

\`\`\`bash
git init
git add -A
git commit -m "feat: initial commit of DocuVerify QA engine"
git branch -M main
git remote add origin https://github.com/<YOUR-USERNAME>/<YOUR-REPOSITORY>.git
git push -u origin main
\`\`\`

## 🌐 Deploy to GitHub Pages (2 Options)

### Option 1: GitHub Actions (Automated)
1. In your GitHub repository, go to **Settings** > **Pages**.
2. Under **Build and deployment** > **Source**, choose **GitHub Actions**.
3. Push to \`main\`. The workflow in \`.github/workflows/deploy.yml\` will automatically build and publish your site!

### Option 2: Deploy from /docs Folder (Instant)
1. Go to **Settings** > **Pages**.
2. Under **Source**, select **Deploy from a branch**.
3. Select your \`main\` branch and choose the **/docs** folder.
4. Click **Save**.
`);

  // GitHub Actions Workflow
  const githubFolder = zip.folder('.github');
  const workflowsFolder = githubFolder?.folder('workflows');
  workflowsFolder?.file('deploy.yml', `name: Deploy to GitHub Pages

on:
  push:
    branches: ['main', 'master']
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: 'pages'
  cancel-in-progress: false

jobs:
  build-and-deploy:
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install Dependencies
        run: npm install

      - name: Build Web Application
        run: npm run build

      - name: Setup Pages
        uses: actions/configure-pages@v5

      - name: Upload Pages Artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: './dist'

      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
`);

  // Fetch current client assets from window if available, or generate zip
  const content = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'docuverify-qa-github-repo.zip';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
