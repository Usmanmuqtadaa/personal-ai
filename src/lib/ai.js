import { CreateMLCEngine, prebuiltAppConfig } from '@mlc-ai/web-llm';

const wishlist = [
  ['Qwen2.5-0.5B-Instruct-q4f16_1-MLC', 'Compact · lower memory'],
  ['Qwen2.5-1.5B-Instruct-q4f16_1-MLC', 'Balanced · recommended'],
  ['Llama-3.2-3B-Instruct-q4f16_1-MLC', 'Stronger · more memory']
];
const listed = new Set(prebuiltAppConfig.model_list.map((model) => model.model_id));
export const MODEL_CHOICES = wishlist.filter(([id]) => listed.has(id)).map(([id, label]) => ({ id, label }));
if (!MODEL_CHOICES.length) {
  const other = prebuiltAppConfig.model_list.find((model) => /instruct/i.test(model.model_id));
  if (other) MODEL_CHOICES.push({ id: other.model_id, label: 'Available local model' });
}
export const DEFAULT_MODEL = MODEL_CHOICES.find((model) => model.id.includes('1.5B'))?.id || MODEL_CHOICES[0]?.id || '';

let currentEngine = null;
let currentId = '';
let initializing = null;

export async function deviceSupportsAI() {
  if (!navigator.gpu) return false;
  try { return Boolean(await navigator.gpu.requestAdapter()); }
  catch { return false; }
}

export async function initializeAI(modelId, onProgress = () => {}) {
  if (!modelId) throw new Error('No compatible built-in model is available in this version.');
  if (currentEngine && currentId === modelId) return currentEngine;
  if (initializing) {
    await initializing;
    if (currentEngine && currentId === modelId) return currentEngine;
  }
  initializing = (async () => {
    if (!await deviceSupportsAI()) {
      throw new Error('WebGPU is unavailable. Use a recent Chrome or Edge browser on a device with WebGPU graphics support.');
    }
    if (currentEngine) {
      await currentEngine.unload();
      currentEngine = null;
    }
    const engine = await CreateMLCEngine(modelId, {
      initProgressCallback: (progress) => onProgress({ percent: Math.round((progress.progress || 0) * 100), text: progress.text || 'Loading the AI model…' })
    });
    currentEngine = engine;
    currentId = modelId;
    return engine;
  })();
  try { return await initializing; }
  finally { initializing = null; }
}

export async function streamReply({ modelId, messages, onToken, onProgress }) {
  const engine = await initializeAI(modelId, onProgress);
  const stream = await engine.chat.completions.create({
    messages,
    temperature: 0.65,
    max_tokens: 1500,
    stream: true
  });
  let full = '';
  for await (const chunk of stream) {
    const next = chunk.choices?.[0]?.delta?.content || '';
    if (next) { full += next; onToken(full); }
  }
  return full.trim();
}

const baseRules = `You are Usman's Personal AI, a practical writing and study assistant.
Write in clear, natural, original language. Vary rhythm naturally, prioritize accuracy, and do not add filler or stock chatbot phrases.
Create genuinely new wording, not copied passages. You cannot guarantee detector scores or that any draft is plagiarism-free; never claim otherwise.
Support responsible academic learning. Do not invent experiments, interviews, collected data, page numbers, quotations, references, DOIs, journal titles, or source details. Clearly label hypothetical examples and placeholders.
If sources are provided, cite only those sources, with URLs/DOIs if appropriate. A bibliographic metadata result does not mean you have read the full paper. Say when source verification is needed.
Follow the user's requested structure, length, format, and audience. When the prompt is underspecified, make sensible assumptions and produce a usable draft. Do not refer to yourself as an AI unless relevant.`;

const modeRules = {
  general: 'Answer the request helpfully. Use concise practical explanations unless the user asks for a longer response.',
  assignment: 'Produce a well-organized assignment draft with an informative title, introduction, meaningful sections, conclusion and references only when backed by supplied or verified sources. Avoid invented citations. Include an originality/checking note only when needed.',
  research: 'Explain the research question, what the available sources actually support, a synthesis, limitations, and potential next steps. Treat Crossref results as bibliographic metadata only, not full-text findings. Cite only the provided sources. Make uncertainty explicit.',
  presentation: 'Create a presentation outline in this exact format: ## Slide 1: [title], then 3 to 5 short bullets under each slide, continue for a suitable number of slides (default 8). Include a final sources slide only if genuine sources are available. Make every slide focused.',
  project: 'Develop a practical project plan with goal, deliverables, stages, milestones, risks and quality checks. If the user asks for code, provide working code or a clear implementation path rather than promises.',
  summary: 'Summarize the provided material accurately without making up details. Use structured, easy-to-understand headings and key points.',
  humanize: 'Rewrite the supplied text in clear, natural, readable language. Preserve its meaning, evidence, original quotations and existing accurate citations. Do not fabricate facts, attempt to defeat AI detectors, or pretend the rewrite was produced without assistance.'
};

export function systemPrompt(mode, sources = []) {
  const sourceSection = sources.length ? `\nVERIFIED PUBLIC LOOKUP RESULTS (some are metadata only):\n${sources.map((s, i) => `[${i + 1}] ${s.title} | ${s.authors.join(', ')} | ${s.year || 'n.d.'} | ${s.journal} | ${s.url}\nDescription: ${s.description}`).join('\n')}\nDo not cite unlisted sources or treat paper descriptions as paper findings.` : '\nNo external sources were supplied. Do not fabricate citations.';
  return `${baseRules}\n\nTASK MODE: ${modeRules[mode] || modeRules.general}${sourceSection}`;
}
