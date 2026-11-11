import { instantAnswer } from './instant.js';
import { CreateMLCEngine, prebuiltAppConfig } from '@mlc-ai/web-llm';

// On older Intel graphics, WebGPU may reset even for tiny models. CPU via Ollama is default.
const browserModels = [
  ['Qwen2.5-0.5B-Instruct-q4f16_1-MLC', 'Browser GPU · small (experimental)'],
  ['Qwen2.5-1.5B-Instruct-q4f16_1-MLC', 'Browser GPU · medium (experimental)']
];
const supported = new Set(prebuiltAppConfig.model_list.map((m) => m.model_id));
export const MODEL_CHOICES = [
  { id: 'instant:tools', label: 'Instant Tools · Vercel compatible (no model)' },
  { id: 'ollama:qwen2.5:1.5b', label: 'CPU · Faster & more stable (recommended)' },
  { id: 'ollama:qwen2.5:0.5b', label: 'CPU · Tiny (fastest, less capable)' },
  { id: 'ollama:qwen2.5:3b', label: 'CPU · Better writing (slower)' },
  ...browserModels.filter(([id]) => supported.has(id)).map(([id, label]) => ({ id, label }))
];
export const DEFAULT_MODEL = (typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname)) ? 'ollama:qwen2.5:1.5b' : 'instant:tools';
let engine = null;
let engineId = '';
let initializing = null;
const isCPU = (model) => model.startsWith('ollama:');

export async function deviceSupportsAI() {
  if (!navigator.gpu) return false;
  try { return Boolean(await navigator.gpu.requestAdapter()); } catch { return false; }
}

async function cpuRequest(path, options = {}) {
  let res;
  try { res = await fetch(`/api/local-ai/${path}`, options); }
  catch { throw new Error('Local AI server is not reachable. Open this project locally with npm run dev, and install Ollama.'); }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    if (res.status === 404 && !body.includes('model')) throw new Error('CPU AI works only on the local computer, not directly on Vercel. Run npm run dev on your PC.');
    if (res.status === 503 || res.status === 502) throw new Error('Ollama is not running. Open Ollama on your computer, then retry.');
    if (body.includes('model') && body.includes('not found')) throw new Error('Model not installed. Run: ollama pull qwen2.5:1.5b');
    throw new Error(`Local AI error (${res.status}): ${body.slice(0, 240)}`);
  }
  return res;
}

export async function initializeAI(modelId, onProgress = () => {}) {
  if (modelId === 'instant:tools') return true;
  if (isCPU(modelId)) {
    onProgress({ percent: 0, text: 'Connecting to local CPU AI…' });
    const res = await cpuRequest('tags');
    const data = await res.json();
    const requested = modelId.slice('ollama:'.length);
    if (!data.models?.some((m) => m.name === requested || m.name.startsWith(`${requested}:`))) {
      throw new Error(`Install the selected model first. In Command Prompt, run: ollama pull ${requested}`);
    }
    return true;
  }
  if (engine && engineId === modelId) return engine;
  if (initializing) await initializing;
  if (engine && engineId === modelId) return engine;
  initializing = (async () => {
    if (!await deviceSupportsAI()) throw new Error('WebGPU is unavailable. Use CPU mode on your local computer instead.');
    if (engine) { await engine.unload(); engine = null; engineId = ''; }
    engine = await CreateMLCEngine(modelId, {
      initProgressCallback: (p) => onProgress({ percent: Math.round((p.progress || 0) * 100), text: p.text || 'Loading model…' })
    });
    engineId = modelId;
  })();
  try { await initializing; return engine; } finally { initializing = null; }
}

async function cpuStream(modelId, messages, onToken, onProgress) {
  onProgress({ percent: 0, text: 'Connecting to CPU AI…' });
  const res = await cpuRequest('chat', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: modelId.slice(7), messages, stream: true,
      options: { temperature: 0.35, num_ctx: 4096, num_predict: 450, num_thread: 6 } })
  });
  if (!res.body) throw new Error('Streaming is unavailable.');
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = ''; let text = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.trim()) continue;
      let part;
      try { part = JSON.parse(line); } catch { continue; }
      if (part.error) throw new Error(part.error);
      const delta = part.message?.content || '';
      if (delta) { text += delta; onToken(text); }
    }
  }
  return text.trim();
}

export async function streamReply({ modelId, messages, onToken, onProgress, files = [], mode = 'general', sources = [] }) {
  if (modelId === 'instant:tools') {
    const answer = instantAnswer(messages[messages.length - 1]?.content || '', files, mode, sources);
    onToken(answer);
    return answer;
  }
  if (isCPU(modelId)) return cpuStream(modelId, messages, onToken, onProgress);
  const active = await initializeAI(modelId, onProgress);
  const stream = await active.chat.completions.create({ messages, temperature: 0.4, max_tokens: 700, stream: true });
  let full = '';
  for await (const part of stream) {
    const token = part.choices?.[0]?.delta?.content || '';
    if (token) { full += token; onToken(full); }
  }
  return full.trim();
}

const rules = `You are Usman's Personal AI, a helpful study, writing and project assistant.
Answer straightforward questions directly and briefly. Use clear, natural, original language.
For longer assignments, give useful structure and explain your reasoning simply.
Accuracy matters more than fluency: say when you do not know, do not invent sources, findings, DOI identifiers or quotations.
If the user attaches a document and its text appears in the message, work from that text and never ask for it again. If only an excerpt is available, say so. When sources are supplied, cite only those sources. A Crossref result gives metadata, not proof that you read the full paper.
Never claim a zero plagiarism or zero AI-detection score. Follow user instructions and academic integrity requirements.`;
const modes = {
  general: 'Help with the request. For simple greetings, reply in one sentence.',
  assignment: 'Create a structured, original assignment draft. Do not invent references.',
  research: 'Ground claims in provided verified lookup results, identify uncertainties, and distinguish metadata from full texts.',
  presentation: 'Output slides as ## Slide 1: Title with 3–5 concise bullets per slide.',
  project: 'Provide realistic milestones, deliverables, risks and working implementation steps.',
  summary: 'Summarize only the supplied content without hallucinating missing details.',
  humanize: 'Improve flow and clarity while keeping original meaning and authentic citations.'
};
export function systemPrompt(mode, sources = []) {
  const refs = sources.length ? '\nPUBLIC LOOKUP RESULTS (metadata and summaries only):\n' + sources.map((s, i) => `[${i+1}] ${s.title} | ${s.authors?.join(', ') || ''} | ${s.year || ''} | ${s.url}\n${s.description || ''}`).join('\n') : '\nNo verified references provided. Do not invent any.';
  return `${rules}\nTASK: ${modes[mode] || modes.general}\n${refs}`;
}
