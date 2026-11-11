// Run on your Windows PC: node pc-bridge.js
// Cloudflare Tunnel forwards to this loopback-only HTTP server.
import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';

const token = process.env.AI_BRIDGE_TOKEN;
if (!token || token.length < 24) {
  console.error('Missing AI_BRIDGE_TOKEN (at least 24 characters). Set it in this terminal before starting.');
  process.exit(1);
}
const matches = (value) => {
  if (typeof value !== 'string') return false;
  const a = Buffer.from(value); const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
};
let active = false;
const app = http.createServer(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const error = (code, msg) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: msg })); };
  if (req.method !== 'POST' || req.url !== '/chat') return error(404, 'Not found');
  if (!matches(req.headers['x-bridge-token'])) return error(401, 'Unauthorized');
  if (active) return error(429, 'PC is already answering another request. Try again shortly.');
  let data = '';
  try {
    for await (const chunk of req) {
      data += chunk;
      if (data.length > 50000) return error(413, 'Request too large.');
    }
  } catch { return error(400, 'Invalid request.'); }
  let messages;
  try {
    messages = JSON.parse(data).messages;
    if (!Array.isArray(messages) || !messages.length || messages.length > 14 ||
        messages.some((m) => !['system', 'user', 'assistant'].includes(m.role) || typeof m.content !== 'string')) throw Error();
  } catch { return error(400, 'Invalid messages.'); }
  active = true;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 48000);
    try {
      const upstream = await fetch('http://127.0.0.1:11434/api/chat', {
        method: 'POST', signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'qwen2.5:1.5b', messages, stream: true,
          options: { temperature: 0.35, num_ctx: 3072, num_predict: 320, num_thread: 6 } })
      });
      if (!upstream.ok) return error(502, 'Ollama could not process this request. Check installed model.');
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      const decoder = new TextDecoder();
      let pending = '';
      for await (const chunk of upstream.body) {
        pending += decoder.decode(chunk, { stream: true });
        const lines = pending.split('\n'); pending = lines.pop() || '';
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const obj = JSON.parse(line);
            if (obj.error) { res.write(`\n[Ollama error: ${obj.error}]`); continue; }
            if (obj.message?.content) res.write(obj.message.content);
          } catch { /* wait for next chunk */ }
        }
      }
      res.end();
    } finally { clearTimeout(timeout); }
  } catch (e) {
    if (!res.headersSent) error(502, 'Ollama is stopped or the request timed out.');
    else res.end();
  } finally { active = false; }
});
app.listen(8787, '127.0.0.1', () => console.log('Private AI bridge listening at http://127.0.0.1:8787'));
