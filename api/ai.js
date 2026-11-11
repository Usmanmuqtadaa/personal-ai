import { timingSafeEqual } from 'node:crypto';

// This Vercel endpoint is the only public route that can call your PC.
// Both passwords stay server-side. Never prefix these env vars with VITE_.
const checkSecret = (submitted, expected) => {
  if (!submitted || !expected) return false;
  const a = Buffer.from(submitted);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
};
const jsonError = (res, status, error) => res.status(status).json({ error });

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return jsonError(res, 405, 'POST only.');
  const { AI_TUNNEL_URL, AI_BRIDGE_TOKEN, AI_SITE_PASSWORD } = process.env;
  if (!AI_TUNNEL_URL || !AI_BRIDGE_TOKEN || !AI_SITE_PASSWORD) {
    return jsonError(res, 503, 'Online AI is not configured. Add the three Vercel environment variables.');
  }
  if (!checkSecret(req.headers['x-app-password'], AI_SITE_PASSWORD)) {
    return jsonError(res, 401, 'Incorrect AI website password.');
  }
  const messages = req.body?.messages;
  if (!Array.isArray(messages) || !messages.length || messages.length > 14 ||
      JSON.stringify(messages).length > 45000 ||
      messages.some((m) => !['system', 'user', 'assistant'].includes(m.role) || typeof m.content !== 'string')) {
    return jsonError(res, 400, 'Invalid or oversized conversation. Try a shorter document.');
  }
  let target;
  try {
    target = new URL(AI_TUNNEL_URL);
    if (target.protocol !== 'https:' || target.username || target.password || target.search || target.hash) throw Error();
    target.pathname = '/chat'; target.search = '';
  } catch { return jsonError(res, 500, 'AI_TUNNEL_URL must be a valid HTTPS tunnel URL.'); }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 52000);
    let upstream;
    try {
      upstream = await fetch(target, {
        method: 'POST', signal: controller.signal,
        headers: { 'content-type': 'application/json', 'x-bridge-token': AI_BRIDGE_TOKEN },
        body: JSON.stringify({ messages })
      });
      if (!upstream.ok) {
        const data = await upstream.json().catch(() => ({}));
        return jsonError(res, upstream.status >= 500 ? 502 : upstream.status, data.error || 'PC bridge not available.');
      }
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      if (!upstream.body) { res.end(); return; }
      for await (const chunk of upstream.body) res.write(chunk);
      res.end();
    } finally { clearTimeout(timeout); }
  } catch (error) {
    if (!res.headersSent) return jsonError(res, 502, 'Cannot reach your PC. Check Ollama, bridge, tunnel and tunnel URL.');
    res.end();
  }
}
