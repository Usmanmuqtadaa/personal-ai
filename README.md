# Usman's Personal AI (Vercel-ready)

A personal study workspace with one source code project for a Vercel-hosted website and Windows local AI.

## What works where

| Feature | Public Vercel website | Windows localhost |
| --- | --- | --- |
| Interface and chat history | Yes | Yes |
| Text-based PDF/DOCX/PPTX/XLSX uploads | Yes | Yes |
| PDF, Word, PowerPoint, Excel and other exports | Yes | Yes |
| Research *metadata* lookup (Crossref/Wikipedia) | Yes (internet needed) | Yes (internet needed) |
| Instant Tools (extractive summary, outline, project template) | Yes, no model required | Yes |
| Generative AI using Qwen through Ollama | **No** | Yes, if Ollama is installed and running |
| Browser WebGPU LLM | Experimental; needs compatible GPU, can crash | Experimental; not recommended for Intel UHD 620 |

**Important:** Instant Tools are deterministic helpers, **not** ChatGPT-style AI. They cannot write accurate in-depth responses to any question. The free, no-API-key public website cannot guarantee unlimited fast generative AI: a model must run somewhere. On your i7-8650U/16 GB PC, the local CPU model may still take a while. Do not claim zero plagiarism or zero AI detection.

## Windows local instructions

1. Install Node.js LTS and Ollama: https://nodejs.org and https://ollama.com/download/windows
2. In Command Prompt run `ollama pull qwen2.5:1.5b` (already downloaded? skip).
3. Open this folder in VS Code.
4. In PowerShell run `npm.cmd install` and then `npm.cmd run dev`.
5. In Edge/Chrome visit **http://localhost:5173/** (not `192.168.x.x:5173` for auto-select).
6. At the bottom, choose **CPU · Faster & more stable** for actual generated answers. Ollama must stay running.
7. **Instant Tools** works even when Ollama is off. It is useful for outlines and extractive summaries, not as a general chatbot.

If `npm` is blocked in PowerShell, run `npm.cmd` instead. Do not modify your machine's script execution policy.

## Deploy to your EXISTING Vercel domain

1. **Back up** your existing repository/project before replacing it.
2. Extract this ZIP. Open the folder called `usmans-personal-ai`.
3. The recommended easiest way to replace all files is via **GitHub Desktop**:
   - Open GitHub Desktop → File → Clone repository → choose your existing `usmans-personal-ai` repository.
   - Open the cloned folder through Repository → Show in Explorer.
   - Copy **everything INSIDE** the extracted `usmans-personal-ai` folder into the cloned repository root. Replace files when Windows asks.
   - Delete stale project files from earlier versions that are **not** in the new package. Never delete `.git`.
   - Do **not** include `node_modules`, `dist`, `.env`, `.env.local`, or `.vercel`.
   - Back in GitHub Desktop: inspect changes → Summary `Replace with stable Vercel release` → **Commit to main** → **Push origin**.
4. In Vercel → open the **existing** project → Deployments. A new deployment should start automatically if GitHub is connected.
5. Confirm Production shows Ready. The existing `*.vercel.app` address/custom domain continues to point at that Vercel project. Do **not** create a new project or delete the existing domain.
6. Open your Vercel URL. **Instant Tools** should be selected. Ollama cannot work on the public Vercel domain without a separately hosted, secure inference backend. Browser GPU remains optional and may fail on older PCs.

If you only use the GitHub website, open the existing repository → Add file → Upload files. Upload all project contents with their folders intact and commit. Check you did not leave old conflicting files or forget `package.json` in the root. GitHub Desktop is safer for full replacements.

## Build checks

Run `npm.cmd run build` locally. This must finish before pushing to GitHub. `npm.cmd test` runs available source tests. A working build does not prove that Ollama, WebGPU, external academic searches, or all exports work on your hardware.

## Project layout

- `index.html`, `src/`: Vite/React UI and document tools.
- `src/lib/ai.js`: model choice, Ollama connection, optional browser AI.
- `src/lib/instant.js`: zero-key extractive tools available on Vercel.
- `src/lib/files.js`: file readers and export functions.
- `server/research-core.js`, `api/research.js`: public bibliography metadata search.
- `vite.config.js`: development-only Ollama proxy. This local proxy does NOT deploy as an Ollama server to Vercel.
- `vercel.json`: Vercel Vite build settings.

## Privacy and limitations

- Local Ollama requests pass through the Vite dev server to your locally running Ollama service.
- Instant Tools and file imports run client side. Research queries contact public services.
- Do not upload confidential documents to unfamiliar hosted inference services.
- Chat history is saved in that browser's local storage. File text is not persisted there.
- PDF text extraction requires selectable text. Scanned PDFs need OCR first.
- Imported text may be truncated; generated answers may use only an excerpt.
- Source search returns metadata and short descriptions; never treat it as a full-text literature review.
