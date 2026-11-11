import assert from 'node:assert/strict';
import { test } from 'node:test';
import { researchSources } from '../server/research-core.js';

test('returns real-looking Crossref metadata only from supplied API fields', async () => {
  const prior = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes('crossref')) return {
      ok: true,
      json: async () => ({ message: { items: [{
        DOI: '10.1234/example', title: ['Classroom assessment practices'],
        author: [{ given: 'Amina', family: 'Khan' }],
        published: { 'date-parts': [[2023]] },
        'container-title': ['Education Journal']
      }] } })
    };
    return { ok: true, json: async () => ({ query: { pages: [{
      pageid: 123, title: 'Assessment in education', extract: 'A general educational topic.',
      fullurl: 'https://en.wikipedia.org/wiki/Assessment_in_education'
    }] } }) };
  };
  try {
    const data = await researchSources('classroom assessment');
    assert.equal(data.sources.length, 2);
    assert.equal(data.sources[0].doi, '10.1234/example');
    assert.equal(data.sources[0].authors[0], 'Amina Khan');
    assert.equal(data.sources[0].year, 2023);
    assert.match(data.sources[0].description, /Metadata only/);
    assert.equal(data.sources[1].kind, 'encyclopedia');
  } finally { globalThis.fetch = prior; }
});

test('reports partial outage without inventing missing paper sources', async () => {
  const prior = globalThis.fetch;
  globalThis.fetch = async (input) => {
    if (String(input).includes('crossref')) throw new Error('offline');
    return { ok: true, json: async () => ({ query: { pages: [] } }) };
  };
  try {
    const data = await researchSources('teacher assessment');
    assert.equal(data.sources.length, 0);
    assert.ok(data.warnings.some((warning) => warning.includes('Crossref')));
  } finally { globalThis.fetch = prior; }
});

test('does not call external services for an empty topic', async () => {
  const data = await researchSources('ab');
  assert.deepEqual(data.sources, []);
  assert.ok(data.warnings.length);
});
