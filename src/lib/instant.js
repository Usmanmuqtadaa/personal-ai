// Offline, deterministic writing aids. Not an LLM, and never represented as one.
const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const splitSentences = (s) => (String(s || '').match(/[^.!?\n]+(?:[.!?]+|$)/g) || []).map(clean).filter(x => x.length > 25);
const stop = new Set('the and for with from that this have into your about were been they them their also only will what when where which shall could would should does some more than because while there these those each used using based important provide please help document attached summary summarize main points write create give suggest ideas project assignment research presentation'.split(' '));
const keywords = (s) => clean(s.toLowerCase()).match(/[a-z]{3,}/g)?.filter(w => !stop.has(w)) || [];
const titleCase = s => clean(s).replace(/^./,c=>c.toUpperCase());
function topSentences(text, query, limit=6) {
  const sentences = splitSentences(text).slice(0, 450);
  const queryWords = new Set(keywords(query));
  const frequency = new Map();
  for (const word of keywords(text).slice(0, 15000)) frequency.set(word, (frequency.get(word)||0)+1);
  const scored = sentences.map((sentence, i) => {
    const words = keywords(sentence);
    const relevance = words.reduce((n,w)=>n + (queryWords.has(w)?8:0) + Math.min(frequency.get(w)||0, 12)/(words.length+1),0);
    return { sentence, i, relevance: relevance + (i < 4 ? 1 : 0) };
  }).filter(x => x.sentence.length < 650);
  return scored.sort((a,b)=>b.relevance-a.relevance).slice(0,limit).sort((a,b)=>a.i-b.i).map(x=>x.sentence);
}
export function instantAnswer(prompt, files=[], mode='general', sources=[]) {
  const question = clean(prompt);
  const sourceText = files.map(f=>`\n${f.name}\n${f.text || ''}`).join('\n').slice(0,60000);
  if (files.length) {
    if (!sourceText.trim() || sourceText.trim().length < 75) return 'I received the attachment, but it contains too little readable text to summarize. Please upload a searchable PDF, Word document, or pasted text.';
    const selected = topSentences(sourceText, question, 7);
    return `## Quick document overview\n\n**Files:** ${files.map(f=>f.name).join(', ')}\n\n${selected.length ? selected.map(x=>`- ${x}`).join('\n') : sourceText.slice(0,1200)}\n\n*This is an extractive overview based on readable text, not a full AI interpretation. Check the original file for details. Longer documents may be truncated during import.*`;
  }
  if (/^(hi|hey|hello|salam|assalam|good morning|good evening)[!. ]*$/i.test(question)) return "Hello! I'm Usman's Personal AI. I can help you summarize files, plan projects, find public research references, and export documents. For generated AI answers, use Local AI with Ollama.";
  const topic = titleCase(question.replace(/^(?:give me|write|make|create|suggest|prepare|help me with|i need|please|a|an|the)\s+/gi,'').replace(/\b(\d+)\b/g,'').slice(0,110)) || 'Your topic';
  if (mode === 'research' || /research|papers|citations|literature review/i.test(question)) {
    let output = `## Research planning: ${topic}\n\n**Possible guiding question:** What are the main issues, existing evidence, and research gaps related to ${topic.toLowerCase()}?\n\n**Suggested process**\n- Define the population, setting, and key terms.\n- Search academic databases using synonyms and precise keywords.\n- Compare study methods, findings, limitations, and conflicting evidence.\n- Write a synthesis supported by sources you have actually read.\n- Verify all DOI links and publication details before citing.\n`;
    if (sources.length) output += `\n**Public lookup results (metadata only):**\n${sources.slice(0,6).map(s=>`- ${s.title} (${s.year || 'n.d.'}) ${s.url}`).join('\n')}\n`;
    return output+'\n*This is a structured research starting point, not a review of full papers.*';
  }
  if (mode === 'presentation' || /powerpoint|slides|presentation/i.test(question)) return `# ${topic}\n\n## Slide 1: Title\n- ${topic}\n- Purpose and audience\n\n## Slide 2: Background\n- Introduce the topic\n- Explain why it matters\n\n## Slide 3: Key concepts\n- Define relevant terms\n- Explain the main ideas\n\n## Slide 4: Examples\n- Add a relevant real-world example\n- Explain how it relates to the topic\n\n## Slide 5: Challenges\n- Discuss limitations and risks\n- Consider alternative viewpoints\n\n## Slide 6: Conclusion\n- Recap main ideas\n- State practical next steps\n\n*Fill in verified subject facts before submitting. Use Local AI for a fully drafted presentation.*`;
  if (mode === 'project' || /project|proposal|software|app|website/i.test(question)) return `# Project plan: ${topic}\n\n## Objective\nDescribe the problem, intended users, and measurable outcome.\n\n## Requirements\n- Identify users and their main tasks\n- List must-have and nice-to-have features\n- Identify constraints, cost, and privacy needs\n\n## Work plan\n1. Research and define the problem\n2. Design a basic prototype\n3. Build the core features\n4. Test against requirements\n5. Fix problems and document results\n6. Present the finished work\n\n## Deliverables\n- Requirements document\n- Working prototype\n- Test results\n- Final report and presentation\n\n*This is a planning template. It does not claim to have built or tested a project.*`;
  if (mode === 'assignment' || /assignment|essay|report|write/i.test(question)) return `# ${topic}\n\n## Introduction\nIntroduce the topic, explain its relevance, and state the focus of the assignment.\n\n## Background\nDefine important terms using reliable course or academic sources.\n\n## Main discussion\n1. Present the first key point with evidence and an example.\n2. Explain a second perspective or important factor.\n3. Compare viewpoints and address limitations.\n\n## Conclusion\nSummarize the evidence and explain its implications.\n\n## References\nAdd only references you have verified and consulted.\n\n*This is an original outline, not a fact-checked full essay. Select Local AI for drafted paragraphs.*`;
  if (/^(what|how|why|who|when|where|can|does|is|are)\b/i.test(question)) return `I can help with **${question}**, but Instant Tools cannot reliably answer open-ended factual questions. Choose **Local AI (Ollama)** on your computer, or use Research mode to retrieve public reference metadata. I won't invent an answer.`;
  return `## Ideas for ${topic}\n\n1. **Explore the basics:** Define the main problem and its context.\n2. **Find an example:** Choose a concrete case or application.\n3. **Compare approaches:** Identify at least two methods or perspectives.\n4. **Develop a solution:** Describe realistic next steps or an experiment.\n5. **Evaluate:** Decide how to measure results and address limitations.\n\n*Instant Tools creates outlines and extracts information. For conversational AI generation, select Local AI on your computer.*`;
}
