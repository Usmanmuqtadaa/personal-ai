import { researchSources } from '../server/research-core.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'GET only.' });
  }
  const q = String(req.query?.q ?? '').slice(0, 220);
  if (!q.trim() || q.trim().length < 3) return res.status(400).json({ error: 'Enter a research topic (3+ characters).' });
  res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=3600');
  try {
    return res.status(200).json(await researchSources(q));
  } catch {
    return res.status(502).json({ error: 'Public research sources could not be reached.' });
  }
}
