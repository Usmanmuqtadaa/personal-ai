// Public, metadata-only research. No third-party credentials are needed.
// Papers are discovered via Crossref, and topic introductions via Wikipedia.
const clean = (value) => String(value ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const unique = (arr) => [...new Set(arr)];

async function fetchJSON(url) {
  const res = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'UsmansPersonalAI/1.0 (educational research assistant; Vercel app)'
    },
    signal: AbortSignal.timeout(11000)
  });
  if (!res.ok) throw new Error(`Source returned HTTP ${res.status}`);
  return res.json();
}

function paperFromCrossref(item) {
  const title = clean(item.title?.[0] || 'Untitled paper');
  const doi = clean(item.DOI || '');
  const year = item.published?.['date-parts']?.[0]?.[0] || item.issued?.['date-parts']?.[0]?.[0] || null;
  const authors = (item.author || []).slice(0, 6).map((a) => [a.given, a.family].filter(Boolean).join(' '));
  const journal = clean(item['container-title']?.[0] || '');
  return {
    id: `doi:${doi || title}`,
    kind: 'paper',
    title,
    authors,
    year,
    journal,
    doi,
    url: doi ? `https://doi.org/${encodeURIComponent(doi)}` : (item.URL || ''),
    description: journal ? `Published in ${journal}. Metadata only; full text was not checked.` : 'Bibliographic metadata only; full text was not checked.'
  };
}

async function crossrefSearch(query) {
  const url = new URL('https://api.crossref.org/works');
  url.searchParams.set('query.bibliographic', query);
  url.searchParams.set('rows', '6');
  const json = await fetchJSON(url);
  return (json.message?.items || []).map(paperFromCrossref).filter((p) => p.title && p.url);
}

async function wikiSearch(query) {
  const url = new URL('https://en.wikipedia.org/w/api.php');
  const params = {
    action: 'query', generator: 'search', gsrsearch: query,
    gsrlimit: '3', prop: 'extracts|info', exintro: '1', explaintext: '1',
    exsentences: '3', inprop: 'url', format: 'json', formatversion: '2'
  };
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const json = await fetchJSON(url);
  return (json.query?.pages || []).filter((p) => !p.missing).map((p) => ({
    id: `wiki:${p.pageid}`,
    kind: 'encyclopedia',
    title: clean(p.title),
    authors: ['Wikipedia contributors'],
    year: null,
    journal: 'Wikipedia',
    doi: '',
    url: p.fullurl || `https://en.wikipedia.org/?curid=${p.pageid}`,
    description: clean(p.extract || '').slice(0, 720)
  }));
}

export async function researchSources(topic) {
  const query = clean(topic).slice(0, 220);
  if (query.length < 3) return { topic: query, sources: [], warnings: ['Use a more specific research topic.'] };
  const results = await Promise.allSettled([crossrefSearch(query), wikiSearch(query)]);
  const sources = [], warnings = [];
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === 'fulfilled') sources.push(...result.value);
    else warnings.push(`${i === 0 ? 'Crossref' : 'Wikipedia'} is temporarily unavailable.`);
  }
  const seen = new Set();
  return {
    topic: query,
    sources: sources.filter((s) => {
      const key = s.doi || s.url;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 9),
    warnings: unique(warnings),
    note: 'Public metadata and encyclopedic summaries only. This is not full-text reading or comprehensive web search.'
  };
}
