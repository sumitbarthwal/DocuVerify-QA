# Chingham's DocuVerify QA - Technical & Survey Report Verification Engine

A client-side, offline-first quality assurance and document verification suite for surveyors, loss adjusters, and technical authors. 

## 🚀 GitHub Deployment Options

This application is built with React 19, TypeScript, and Vite. It is designed to work **both** as a static web application (on **GitHub Pages**) and as a full-stack Node.js application (with optional Gemini 3.8 Flash AI support).

### Option 1: GitHub Pages via GitHub Actions (Recommended)
1. In your GitHub repository, go to **Settings** > **Pages**.
2. Under **Build and deployment** > **Source**, choose **GitHub Actions**.
3. Push to your `main` or `master` branch.
4. The workflow in `.github/workflows/deploy.yml` will automatically build the site with `npm run build` and deploy to `https://<username>.github.io/<repo-name>/`.

### Option 2: GitHub Pages via `/docs` Folder (Instant)
1. Go to **Settings** > **Pages**.
2. Under **Build and deployment** > **Source**, select **Deploy from a branch**.
3. Select your branch (`main` or `master`) and specify the **/docs** folder.
4. Click **Save**. The pre-bundled production assets in `/docs` will immediately serve the application.

---

## 🛠️ Local Development & Running from Clone

If you clone this repository to run locally:

```bash
# 1. Install dependencies
npm install

# 2. Start the local development server (with full Express backend & optional Gemini AI proxy)
npm run dev

# Open http://localhost:3000 in your browser
```

### Optional: Gemini 3.8 Flash Integration
To enable deep online AI scanning alongside the deterministic rule engine, create a `.env` file:
```env
GEMINI_API_KEY=your_gemini_api_key_here
```
*(If no API key is provided, the full deterministic offline QA engine, Microsoft Word layout preview, and document exports remain 100% operational.)*

---

## ✨ Features
- **Authentic Microsoft Word Layout**: Interactive Dual Ruler, margins (Normal, Narrow, Wide), unclipped zoom & horizontal scrolling, page break visualization.
- **Client-Side Privacy**: 100% in-browser deterministic QA validation; documents never leave your machine unless optional online AI is triggered.
- **Auto-Apply & 1-Click Fixes**: Correct grammatical inconsistencies, number mismatch, date format errors, duplicate words, and stale copy-paste metrics.
- **Multi-Format Import & Export**: Import `.docx`, `.doc`, `.pdf`, `.rtf`, `.html`, `.csv`, `.tsv`, `.txt`, `.md`. Export to authentic Microsoft Word (`.docx`), `.pdf`, `.html`, `.csv`, and `.json`.
