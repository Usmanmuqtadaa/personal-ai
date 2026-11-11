import * as XLSX from 'xlsx';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import JSZip from 'jszip';
import * as mammoth from 'mammoth';
import { jsPDF } from 'jspdf';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import pptxgen from 'pptxgenjs';

const LIMIT = 24000;
const sanitize = (value) => String(value || '').replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim();
const truncate = (text, limit = LIMIT) => text.length > limit ? `${text.slice(0, limit)}\n\n[Only the first ${limit.toLocaleString()} characters were imported.]` : text;
const dec = (s) => String(s).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

export const EXPORT_TYPES = [
  { ext: 'pdf', name: 'PDF document' },
  { ext: 'docx', name: 'Word document' },
  { ext: 'pptx', name: 'PowerPoint slides' },
  { ext: 'xlsx', name: 'Excel spreadsheet' },
  { ext: 'md', name: 'Markdown' },
  { ext: 'txt', name: 'Plain text' },
  { ext: 'html', name: 'HTML page' },
  { ext: 'csv', name: 'CSV table' },
  { ext: 'json', name: 'JSON' },
  { ext: 'zip', name: 'ZIP bundle' }
];

export const ACCEPTED_EXTENSIONS = '.pdf,.docx,.pptx,.xlsx,.xls,.csv,.txt,.md,.markdown,.json,.html,.htm,.xml,.rtf,.png,.jpg,.jpeg,.webp';

export async function readAttachment(file, onProgress = () => {}) {
  const sizeLimit = 18 * 1024 * 1024;
  if (file.size > sizeLimit) throw new Error(`${file.name}: maximum file size is 18 MB.`);
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  let text = '';
  if (['txt', 'md', 'markdown', 'csv', 'json', 'xml', 'html', 'htm', 'rtf'].includes(ext)) {
    text = await file.text();
    if (ext === 'html' || ext === 'htm' || ext === 'xml') {
      const doc = new DOMParser().parseFromString(text, ext === 'xml' ? 'text/xml' : 'text/html');
      text = doc.body?.textContent || doc.documentElement?.textContent || text;
    }
    if (ext === 'rtf') text = text.replace(/\\par\b/g, '\n').replace(/\\'[a-fA-F0-9]{2}/g, ' ').replace(/\\[a-zA-Z]+-?\d*\s?/g, '').replace(/[{}]/g, '');
  } else if (ext === 'docx') {
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    text = result.value;
  } else if (ext === 'pdf') {
    const pdfjs = await import('pdfjs-dist/build/pdf.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const pageCount = Math.min(pdf.numPages, 45);
    const sections = [];
    for (let i = 1; i <= pageCount; i++) {
      const page = await pdf.getPage(i);
      const pageText = await page.getTextContent();
      sections.push(`Page ${i}\n${pageText.items.map((item) => item.str || '').join(' ')}`);
      if (i % 5 === 0) onProgress(`Reading PDF page ${i}/${pageCount}…`);
    }
    text = sections.join('\n\n');
    if (pdf.numPages > pageCount) text += '\n[Additional PDF pages were not loaded.]';
    if (!text.replace(/Page \d+/g, '').trim()) text = 'This PDF appears to contain scanned pages. Image-based PDF OCR is not yet supported.';
  } else if (['xlsx', 'xls'].includes(ext)) {
    const book = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    text = book.SheetNames.slice(0, 10).map((name) => `Sheet: ${name}\n${XLSX.utils.sheet_to_csv(book.Sheets[name])}`).join('\n\n');
  } else if (ext === 'pptx') {
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const slideNames = Object.keys(zip.files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
      .sort((a, b) => Number(a.match(/slide(\d+)/)[1]) - Number(b.match(/slide(\d+)/)[1]));
    const slides = [];
    for (const name of slideNames.slice(0, 60)) {
      const xml = new DOMParser().parseFromString(await zip.file(name).async('string'), 'text/xml');
      const nodes = Array.from(xml.getElementsByTagName('a:t'));
      slides.push(`${name.match(/slide(\d+)/)[1]}: ${nodes.map((n) => dec(n.textContent)).join(' | ')}`);
    }
    text = slides.join('\n');
  } else if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) {
    onProgress(`Running English OCR on ${file.name}…`);
    const { recognize } = await import('tesseract.js');
    const result = await recognize(file, 'eng');
    text = result.data.text || '[No readable English text found in this image.]';
  } else {
    throw new Error(`.${ext} is not a supported upload. Use PDF, DOCX, PPTX, Excel, text or an image with text.`);
  }
  const extracted = String(text || '').trim();
  const warning = extracted.includes('Image-based PDF OCR is not yet supported')
    ? 'This PDF contains scanned images. This version cannot read scanned PDF pages. Convert it to a searchable PDF using OCR, then upload it again.'
    : extracted.length < 30
      ? 'Almost no readable text was found in this file. Try a searchable PDF or a DOCX version.'
      : '';
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name: file.name, size: file.size, text: truncate(extracted), readable: !warning, warning };
}

function cleanMarkdown(text) {
  return text.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1').replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '$1 ($2)')
    .replace(/^\s*>\s?/gm, '');
}

function markdownLines(text) {
  return text.replace(/\r\n/g, '\n').split('\n').map((raw) => {
    const line = raw.trim();
    if (/^#{1,4}\s/.test(line)) {
      const level = line.match(/^#+/)[0].length;
      return { type: 'heading', level, text: cleanMarkdown(line.replace(/^#{1,4}\s*/, '')) };
    }
    if (/^[-*•]\s+/.test(line) || /^\d+\.\s+/.test(line)) return { type: 'bullet', text: cleanMarkdown(line.replace(/^(?:[-*•]|\d+\.)\s+/, '')) };
    return { type: line ? 'text' : 'blank', text: cleanMarkdown(line) };
  });
}

async function createWord(title, content) {
  const paras = [new Paragraph({ text: title, heading: HeadingLevel.TITLE, spacing: { after: 260 } })];
  for (const line of markdownLines(content)) {
    if (line.type === 'blank') { paras.push(new Paragraph({ text: '', spacing: { after: 85 } })); continue; }
    if (line.type === 'heading') {
      paras.push(new Paragraph({ text: line.text, heading: line.level === 1 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2, spacing: { before: 170, after: 80 } }));
    } else if (line.type === 'bullet') {
      paras.push(new Paragraph({ text: line.text, bullet: { level: 0 }, spacing: { after: 70 } }));
    } else {
      paras.push(new Paragraph({ children: [new TextRun({ text: line.text, size: 22 })], spacing: { after: 100, line: 310 } }));
    }
  }
  const doc = new Document({
    creator: "Usman's Personal AI",
    title,
    styles: { default: { document: { run: { font: 'Aptos', size: 22 } } } },
    sections: [{ properties: {}, children: paras }]
  });
  return Packer.toBlob(doc);
}

function createPDF(title, content) {
  const pdf = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
  const pageWidth = 595.28, pageHeight = 841.89;
  const left = 54, right = 52, bottom = 60, width = pageWidth - left - right;
  let y = 65;
  const ensure = (height) => { if (y + height > pageHeight - bottom) { pdf.addPage(); y = 58; } };
  function write(text, fontSize = 11, bold = false, extra = 10) {
    pdf.setFont('helvetica', bold ? 'bold' : 'normal');
    pdf.setFontSize(fontSize);
    pdf.setTextColor(35, 47, 67);
    const lines = pdf.splitTextToSize(String(text || ' '), width);
    const lineHeight = fontSize * 1.45;
    for (const line of lines) { ensure(lineHeight); pdf.text(line, left, y); y += lineHeight; }
    y += extra;
  }
  write(title, 19, true, 16);
  for (const line of markdownLines(content)) {
    if (line.type === 'blank') y += 6;
    else if (line.type === 'heading') write(line.text, line.level === 1 ? 15 : 13, true, 10);
    else if (line.type === 'bullet') write(`• ${line.text}`, 11, false, 4);
    else write(line.text, 11, false, 6);
  }
  const pages = pdf.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    pdf.setPage(i);
    pdf.setDrawColor(225, 229, 238); pdf.line(left, 803, pageWidth - right, 803);
    pdf.setFontSize(9); pdf.setTextColor(130, 140, 155);
    pdf.text(`${i} / ${pages}`, pageWidth - right, 817, { align: 'right' });
  }
  return pdf.output('blob');
}

function slidesFromText(title, content) {
  const lines = markdownLines(content);
  const slides = [];
  let active = null;
  for (const line of lines) {
    const slideHeading = line.type === 'heading' && (/(?:^slide\s*\d+\b)/i.test(line.text) || line.level <= 2);
    if (slideHeading) {
      if (active && active.bullets.length) slides.push(active);
      active = { title: line.text.replace(/^slide\s*\d+\s*[:.\-]?\s*/i, '') || 'Key points', bullets: [] };
    } else if (line.type !== 'blank') {
      if (!active) active = { title, bullets: [] };
      const text = line.text.trim();
      if (text) active.bullets.push(text);
    }
  }
  if (active && active.bullets.length) slides.push(active);
  if (!slides.length) return [{ title, bullets: ['No content was available to turn into slides.'] }];
  const expanded = [];
  for (const slide of slides) {
    const batches = [];
    for (let i = 0; i < slide.bullets.length; i += 6) batches.push(slide.bullets.slice(i, i + 6));
    batches.forEach((bullets, idx) => expanded.push({ title: `${slide.title}${idx ? ' (continued)' : ''}`, bullets }));
  }
  return expanded.slice(0, 35);
}

async function createPowerPoint(title, content) {
  const pptx = new pptxgen();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = "Usman's Personal AI";
  pptx.subject = title;
  pptx.title = title;
  pptx.lang = 'en-US';
  const slides = slidesFromText(title, content);
  for (let i = 0; i < slides.length; i++) {
    const item = slides[i];
    const slide = pptx.addSlide();
    slide.background = { color: 'F7F9FC' };
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 0.12, line: { color: '615BF7' }, fill: { color: '615BF7' } });
    slide.addText(item.title.slice(0, 95), { x: 0.82, y: 0.64, w: 11.7, h: 0.95, fontFace: 'Aptos Display', fontSize: 30, bold: true, color: '192541', margin: 0.02, breakLine: false, fit: 'shrink' });
    slide.addShape(pptx.ShapeType.line, { x: 0.83, y: 1.63, w: 11.6, h: 0, line: { color: 'DEE4EE', width: 1.5 } });
    const count = Math.min(6, item.bullets.length);
    const rowH = Math.min(0.81, 4.85 / Math.max(1, count));
    item.bullets.slice(0, count).forEach((bullet, j) => {
      slide.addShape(pptx.ShapeType.ellipse, { x: 0.91, y: 1.94 + j * rowH + 0.14, w: 0.13, h: 0.13, line: { color: '7366F4' }, fill: { color: '7366F4' } });
      slide.addText(bullet.slice(0, 235), { x: 1.25, y: 1.88 + j * rowH, w: 11.05, h: rowH - 0.08, fontFace: 'Aptos', fontSize: 19, color: '34415A', margin: 0.02, fit: 'shrink', valign: 'mid', breakLine: false });
    });
    slide.addText("USMAN'S PERSONAL AI", { x: 0.84, y: 7.05, w: 3.2, h: 0.2, fontFace: 'Aptos', fontSize: 8.5, charSpacing: 1.3, color: '99A2B1', margin: 0 });
    slide.addText(String(i + 1).padStart(2, '0'), { x: 12.04, y: 7.01, w: 0.42, h: 0.27, fontSize: 10, color: '8994A6', margin: 0, align: 'right' });
  }
  const output = await pptx.write({ outputType: 'blob' });
  return output instanceof Blob ? output : new Blob([output], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
}

function parseCsvLine(line) {
  const arr = []; let cell = '', quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"' && quoted && line[i + 1] === '"') { cell += '"'; i++; }
    else if (c === '"') quoted = !quoted;
    else if (c === ',' && !quoted) { arr.push(cell.trim()); cell = ''; }
    else cell += c;
  }
  arr.push(cell.trim()); return arr;
}

function matrixFromText(content) {
  const lines = content.trim().split(/\r?\n/).filter(Boolean);
  const table = lines.filter((line) => /^\|.+\|$/.test(line.trim()));
  if (table.length >= 2) {
    const matrix = table.map((line) => line.trim().replace(/^\||\|$/g, '').split('|').map((v) => cleanMarkdown(v.trim())));
    return matrix.filter((row) => !row.every((cell) => /^:?-{2,}:?$/.test(cell)));
  }
  try {
    const json = JSON.parse(content.trim());
    if (Array.isArray(json) && json.every((a) => a && typeof a === 'object' && !Array.isArray(a))) {
      const keys = [...new Set(json.flatMap((row) => Object.keys(row)))];
      return [keys, ...json.map((row) => keys.map((key) => String(row[key] ?? '')))];
    }
    if (Array.isArray(json) && json.every((a) => Array.isArray(a))) return json;
  } catch { /* not JSON */ }
  const csvLines = lines.filter((line) => line.includes(','));
  if (csvLines.length >= 2 && csvLines.length / Math.max(1, lines.length) > 0.7) return csvLines.map(parseCsvLine);
  return [['Section', 'Content'], ...markdownLines(content).filter((l) => l.text).map((l) => [l.type, l.text])];
}

function createExcel(content) {
  const book = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(matrixFromText(content));
  sheet['!cols'] = [{ wch: 24 }, { wch: 78 }, { wch: 32 }, { wch: 26 }];
  XLSX.utils.book_append_sheet(book, sheet, 'AI Output');
  const data = XLSX.write(book, { bookType: 'xlsx', type: 'array' });
  return new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

function escapeHTML(text) { return String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function createHTML(title, content) {
  const body = markdownLines(content).map((line) => {
    const text = escapeHTML(line.text);
    if (line.type === 'blank') return '';
    if (line.type === 'heading') return `<h${Math.min(line.level + 1, 4)}>${text}</h${Math.min(line.level + 1, 4)}>`;
    if (line.type === 'bullet') return `<p class="bullet">• ${text}</p>`;
    return `<p>${text}</p>`;
  }).join('\n');
  return `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHTML(title)}</title><style>body{max-width:840px;margin:60px auto;padding:0 24px;font:17px/1.75 Arial,sans-serif;color:#202a3f}h1{color:#171f34;font-size:36px}h2,h3{margin-top:30px;color:#222b42}.bullet{margin-left:20px}</style></head><body><h1>${escapeHTML(title)}</h1>${body}</body></html>`;
}

function downloadBlob(blob, filename) {
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 60000);
}

export async function exportContent({ title, content, format }) {
  if (!String(content || '').trim()) throw new Error('There is no generated content to export yet.');
  const base = (sanitize(title).slice(0, 64) || 'usmans-personal-ai-output').replace(/\.+$/, '');
  let blob;
  if (format === 'docx') blob = await createWord(title, content);
  else if (format === 'pdf') blob = createPDF(title, content);
  else if (format === 'pptx') blob = await createPowerPoint(title, content);
  else if (format === 'xlsx') blob = createExcel(content);
  else if (format === 'html') blob = new Blob([createHTML(title, content)], { type: 'text/html;charset=utf-8' });
  else if (format === 'csv') {
    const matrix = matrixFromText(content);
    const csv = matrix.map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
    blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' });
  } else if (format === 'json') blob = new Blob([JSON.stringify({ title, content, generatedBy: "Usman's Personal AI", exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' });
  else if (format === 'md' || format === 'txt') blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  else throw new Error('Unsupported export format.');
  downloadBlob(blob, `${base}.${format}`);
  return `${base}.${format}`;
}
