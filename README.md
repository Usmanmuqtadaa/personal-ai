# Usman's Personal AI

An installable, Vercel-ready AI workspace for assignments, research, project planning and file creation. **No OpenAI API key, payment card or other AI API key is required.** Text generation runs in the user's browser through [WebLLM](https://github.com/mlc-ai/web-llm) and a downloadable open-weight model. Vercel only hosts the website and a small, key-free research lookup function.

## Features

- **On-device AI chat:** a local model runs with WebGPU inside Chrome/Edge (or another supported browser). No user prompts or documents are sent to a hosted AI provider.
- **Writing:** assignments, original drafts, natural rewrites, study summaries, project plans, outlines and slide-by-slide presentation content.
- **Public-source research:** Crossref paper metadata (title, authors, year, DOI) and introductory Wikipedia summaries. The app shows the links and tells the model not to invent references. It does **not** claim to have read article full text.
- **Import:** `.pdf`, `.docx`, `.pptx`, `.xlsx`, `.xls`, `.csv`, `.txt`, `.md`, `.json`, `.html`, `.xml`, `.rtf`, and English OCR of `.png`, `.jpg`, `.jpeg`, `.webp`.
- **Export:** `.pdf`, `.docx`, `.pptx`, `.xlsx`, `.md`, `.txt`, `.html`, `.csv`, `.json`, `.zip` (Markdown + HTML bundle).
- **Local history:** chats are stored in browser localStorage; uploaded document content is kept in the current tab only.
- **Vercel deployment:** works from a GitHub repository without configuring environment variables.

## 1. Run it on your computer

Requirements: Node.js 20+, a WebGPU-capable device and an up-to-date Chrome or Edge browser.

```bash
npm install
npm run dev
```

Open the local URL printed in the terminal, usually `http://localhost:5173`. Click **Load AI**, or send your first message to start the model download. The initial AI model download can be hundreds of MB or several GB depending on the selected model, and takes time. Downloads are generally cached for subsequent use.

## 2. Host it on Vercel

1. Unzip this project and put its contents into a new GitHub repository. Make sure `package.json`, `api/`, `src/`, `server/`, and `vercel.json` are at the repository root.
2. Log in at [vercel.com](https://vercel.com), choose **Add New → Project**, and import the GitHub repository.
3. Keep the detected **Vite** framework. Build command `npm run build`; output directory `dist`.
4. Click **Deploy**. No API key or environment variables are needed.
5. Open the deployed website in Chrome or Edge on a WebGPU-enabled device. Select the model and click **Load AI**.

Public source lookup is served through `/api/research` using Vercel Functions, or through an equivalent dev middleware during `npm run dev`.

## 3. Typical workflows

**Assignment:** Select **Assignments**, enter the subject, grade, desired length, rubric and any sources. Review the draft, then export to Word or PDF.

**Research:** Select **Research**, type a focused topic or research question. The app looks up Crossref and Wikipedia and passes those references to the local model. Open each DOI yourself to check the full paper before citing its findings. Export the result to DOCX or Markdown.

**PowerPoint:** Select **Presentations**, ask for 8–12 slides with 3–5 bullets each, then choose **PowerPoint slides (.pptx)** from the download menu. Slides use a clean, editable template.

**Excel:** Ask for a Markdown table, CSV, or JSON data table, then export to `.xlsx`. This creates an editable workbook; it does not independently calculate or verify financial or statistical results.

**Uploaded documents:** Click **Attach** to add documents, then ask for summaries, explanations or drafts based on the extracted text. Text is limited to protect the small local model's context window.

## Important limitations

- **No API key does not mean unlimited cloud AI.** The model is downloaded and executed on **each visitor's device**. Hardware capability, browser WebGPU support, memory, model size and model quality determine what the app can do. A phone or unsupported browser may not run it.
- Internet is needed for the initial model download, installing dependencies, and live research. Previously cached models may run without an internet connection, but the research feature will not.
- The research tool only searches **Crossref** and **Wikipedia**. It is not a comprehensive scholarly database, citation verifier, live news engine or general-purpose web browsing agent. Public providers can rate-limit or temporarily reject requests.
- **Original writing is an aim, not a guarantee.** No tool can promise a 0% plagiarism score or that an AI detector will label text as human. You must review, personalize and cite the work appropriately and follow your school's academic rules.
- **Format limitations:** scans inside PDFs are not OCR'd, images are OCR'd in English only, and other formats (video, audio, Photoshop, InDesign, etc.) are not supported. Complex graphs, mathematical typesetting and advanced DOCX/PPTX styling are not fully preserved on import/export. PDF export's built-in font is best for Latin text; use DOCX for Urdu and other complex scripts.
- The app is a browser application, not an autonomous agent with permission to operate your Google account, use paid sites, or deliver ongoing background work.
- Importing material does not imply the content is true. Check citations and quotations against original publications.

## Project structure

```text
usmans-personal-ai/
├── api/research.js           # key-free Vercel research function
├── server/research-core.js   # public Crossref & Wikipedia requests
├── src/App.jsx               # workspace UI
├── src/styles.css            # responsive design
├── src/lib/ai.js             # local WebLLM model and writing modes
├── src/lib/files.js          # import and export formats
├── src/lib/research.js       # research client
├── src/main.jsx
├── index.html
├── package.json
├── vite.config.js            # dev research API
└── vercel.json
```

## Privacy and production guidance

The local model performs inference in the browser. To look up public research, the query itself is sent to your Vercel function and from there to Crossref/Wikipedia, which may log requests. The model weights are downloaded from the publisher's model host. By default, conversation history is saved in the current browser's localStorage, so do not use shared computers for sensitive chats. There is no user login, team storage, billing, moderation service, or cross-device sync.

If you publish this for unrestricted use, add rate limiting and abuse controls to the research endpoint, review dependency updates and license terms for the model, and provide clear privacy and acceptable-use policies.

## License

This example project's source code may be freely modified for personal and educational use. Third-party packages and model weights retain their own separate licenses and terms.
