import { test } from 'node:test';
import assert from 'node:assert/strict';
import { instantAnswer } from '../src/lib/instant.js';
test('greeting is fast and honest', () => assert.match(instantAnswer('Hi'), /Hello/i));
test('document summary refers to actual file', () => {
  const answer=instantAnswer('summarize', [{name:'resume.pdf',text:'Jane Smith is a developer with five years of experience. She works with React and Python. Her degree is in computer science.'}], 'summary');
  assert.match(answer,/resume\.pdf/);
  assert.match(answer,/Jane Smith|React|developer/);
});
test('no attachment does not fabricate factual answers', () => assert.match(instantAnswer('What is the speed of light?'), /cannot reliably answer/i));
test('research metadata labeled as metadata', () => assert.match(instantAnswer('Find papers',[], 'research', [{title:'Example Study',year:2020,url:'https://example.org'}]),/metadata only/));
