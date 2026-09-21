#!/usr/bin/env node
/**
 * Markdown (+ Mermaid, images, tables) → Word.
 *
 *   node tools/docx.build.js <input.md> [output.docx]
 *   npm run docs:docx -- docs/anforderungskatalog/C2-Loesungskonzept-SLIM.md
 *
 * Supports the subset our docs use: `#`–`####` headings, paragraphs with
 * **bold** / *italic* / `code` / [links](url), `-`/`*` and `1.` lists (one
 * nested level), `> ` quotes, fenced code, ```mermaid blocks (rendered to PNG
 * with the project's Playwright Chromium + mermaid from jsdelivr, cached under
 * dist/docs/mermaid), images, pipe tables (`<br/>` = line break) and `---`.
 * The first `# Title` becomes the cover title; a TOC field follows the cover.
 * Extras: `![alt](img.png){width=60%}` and ````mermaid width=60%` scale a
 * figure to a share of the text width, `<!-- pagebreak -->` forces a new page,
 * `<!-- compact -->` right before a pipe table renders it in 8.5 pt with tight
 * cell padding (the two-page requirement matrix), other HTML comments are dropped.
 *
 * A4, 2 cm margins, Arial 10.5 pt, footer «<title> · Seite X von Y».
 *
 * `--pages` additionally prints an HTML/PDF preview (same page size, margins,
 * font) to dist/docs/<name>.preview.pdf and reports the page count in total and
 * per level-1 chapter – the tender caps the concept at 15 pages, the matrix at
 * 2 and the management summary at half a page. Word paginates slightly
 * differently, so keep a margin of about half a page.
 */
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const docx = require('docx');

const {
  AlignmentType, BorderStyle, Document, ExternalHyperlink, Footer, HeadingLevel, ImageRun,
  LevelFormat, PageBreak, PageNumber, Packer, Paragraph, ShadingType, Table, TableCell,
  TableOfContents, TableRow, TextRun, WidthType,
} = docx;

const MERMAID_URL = 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js';
const CACHE_DIR = path.resolve('dist/docs/mermaid');
/** Text width of A4 with 2 cm margins: 17 cm ≈ 643 px at 96 dpi. */
const TEXT_WIDTH_PX = 643;
const FONT = 'Arial';
const SIZE = 21; // half-points → 10.5 pt

// ---------------------------------------------------------------------------
// Markdown → block list
// ---------------------------------------------------------------------------

/** Parses the markdown into a flat list of typed blocks. */
function parseBlocks(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let compactNext = false;
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    const fence = /^```(\w*)(?:\s+width=(\d+)%)?\s*$/.exec(line);
    if (fence) {
      const body = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) body.push(lines[i++]);
      i++;
      const width = fence[2] ? Number(fence[2]) / 100 : 1;
      blocks.push(fence[1] === 'mermaid' ? { type: 'mermaid', code: body.join('\n'), width } : { type: 'code', code: body.join('\n') });
      continue;
    }
    if (/^<!--\s*pagebreak\s*-->\s*$/.test(line)) { blocks.push({ type: 'pagebreak' }); i++; continue; }
    if (/^<!--\s*compact\s*-->\s*$/.test(line)) { compactNext = true; i++; continue; }
    if (/^<!--.*-->\s*$/.test(line)) { i++; continue; }
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) { blocks.push({ type: 'heading', level: heading[1].length, text: heading[2].trim() }); i++; continue; }
    if (/^(-{3,}|\*{3,})\s*$/.test(line)) { blocks.push({ type: 'hr' }); i++; continue; }
    const image = /^!\[([^\]]*)\]\(([^)]+)\)(?:\{width=(\d+)%\})?\s*$/.exec(line);
    if (image) { blocks.push({ type: 'image', alt: image[1], src: image[2], width: image[3] ? Number(image[3]) / 100 : 1 }); i++; continue; }
    if (/^\s*\|/.test(line)) {
      const rows = [];
      // Tables may sit indented inside a list item – trim before parsing.
      while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(lines[i++].trim());
      blocks.push({ type: 'table', rows: rows.filter((r) => !/^\|\s*:?-{2,}/.test(r)).map(splitRow), compact: compactNext });
      compactNext = false;
      continue;
    }
    if (/^>\s?/.test(line)) {
      const body = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) body.push(lines[i++].replace(/^>\s?/, ''));
      blocks.push({ type: 'quote', text: body.join(' ') });
      continue;
    }
    if (/^(\s*)([-*]|\d+\.)\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^(\s*)([-*]|\d+\.)\s+/.test(lines[i])) {
        const m = /^(\s*)([-*]|\d+\.)\s+(.*)$/.exec(lines[i]);
        const item = { level: m[1].length >= 2 ? 1 : 0, ordered: /\d/.test(m[2]), text: m[3] };
        i++;
        // Continuation lines of the same item (indented, no marker).
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*([-*]|\d+\.|\|)\s*/.test(lines[i])) item.text += ' ' + lines[i++].trim();
        items.push(item);
      }
      blocks.push({ type: 'list', items });
      continue;
    }
    // Paragraph: consecutive plain lines.
    const body = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|```|\s*\||>|!\[|<!--|(\s*)([-*]|\d+\.)\s|-{3,}\s*$)/.test(lines[i])) body.push(lines[i++].trim());
    if (body.length) blocks.push({ type: 'paragraph', text: body.join(' ') });
    else i++;
  }
  return blocks;
}

function splitRow(row) {
  return row.replace(/^\|/, '').replace(/\|\s*$/, '').split(/(?<!\\)\|/).map((c) => c.replace(/\\\|/g, '|').trim());
}

// ---------------------------------------------------------------------------
// Inline markdown → runs
// ---------------------------------------------------------------------------

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\)|(?<![\w*])\*[^*\s][^*]*\*(?![\w*])|(?<!\w)_[^_\s][^_]*_(?!\w)|<br\s*\/?>)/g;

/** Turns inline markdown into TextRun / ExternalHyperlink children. */
function runs(text, base = {}) {
  const out = [];
  const clean = text.replace(/<(?!br\s*\/?>)[^>]+>/g, '');
  let last = 0;
  for (const m of clean.matchAll(INLINE)) {
    if (m.index > last) out.push(new TextRun({ text: decode(clean.slice(last, m.index)), ...base }));
    const t = m[0];
    if (t.startsWith('**')) out.push(new TextRun({ text: decode(t.slice(2, -2)), bold: true, ...base }));
    else if (t.startsWith('`')) out.push(new TextRun({ text: t.slice(1, -1), font: 'Consolas', size: base.size ? base.size - 1 : SIZE - 1, ...base, shading: { type: ShadingType.CLEAR, fill: 'F2F2F2' } }));
    else if (t.startsWith('[')) {
      const l = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(t);
      if (/^https?:/.test(l[2])) out.push(new ExternalHyperlink({ link: l[2], children: [new TextRun({ text: decode(l[1]), style: 'Hyperlink', ...base })] }));
      else out.push(new TextRun({ text: decode(l[1]), ...base }), new TextRun({ text: ` (${l[2]})`, color: '666666', ...base }));
    } else if (/^<br/.test(t)) out.push(new TextRun({ break: 1 }));
    else out.push(new TextRun({ text: decode(t.slice(1, -1)), italics: true, ...base }));
    last = m.index + t.length;
  }
  if (last < clean.length) out.push(new TextRun({ text: decode(clean.slice(last)), ...base }));
  return out;
}

function decode(s) {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&shy;/g, '');
}

// ---------------------------------------------------------------------------
// Mermaid → PNG (Playwright Chromium + mermaid from the CDN, cached by hash)
// ---------------------------------------------------------------------------

let browserPromise = null;

async function renderMermaid(code) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const file = path.join(CACHE_DIR, createHash('sha1').update(code).digest('hex') + '.png');
  if (fs.existsSync(file)) return fs.readFileSync(file);

  if (!browserPromise) {
    const { chromium } = require('@playwright/test');
    browserPromise = chromium.launch();
  }
  const browser = await browserPromise;
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 2 });
  await page.setContent('<!doctype html><html><body style="margin:0;background:#fff"><div id="host" style="width:1400px;padding:12px;box-sizing:border-box"></div></body></html>');
  try {
    await page.addScriptTag({ url: MERMAID_URL });
  } catch (error) {
    throw new Error(`mermaid could not be loaded from ${MERMAID_URL} — no network? (${error.message})`);
  }
  await page.evaluate(() => window.mermaid.initialize({ startOnLoad: false, theme: 'neutral', securityLevel: 'loose', fontFamily: 'Arial' }));
  const ok = await page.evaluate(async (src) => {
    try {
      const { svg } = await window.mermaid.render('m' + Date.now(), src);
      document.getElementById('host').innerHTML = svg;
      const el = document.querySelector('#host svg');
      el.style.maxWidth = 'none';
      el.style.width = '1376px';
      el.style.height = 'auto';
      return true;
    } catch (e) {
      return String(e && e.message ? e.message : e);
    }
  }, code);
  if (ok !== true) throw new Error(`mermaid render failed: ${ok}\n${code.slice(0, 200)}`);
  const png = await page.locator('#host').screenshot({ type: 'png' });
  await page.close();
  fs.writeFileSync(file, png);
  return png;
}

/** Width/height of a PNG from its IHDR chunk. */
function pngSize(buf) {
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

/** ImageRun scaled to the text width (or its own width when smaller). */
function imageParagraph(buf, alt, scale = 1, share = 1) {
  const { width, height } = pngSize(buf);
  const w = Math.min(Math.round(TEXT_WIDTH_PX * share), Math.round((width * scale) / 2));
  const h = Math.round((height / width) * w);
  const children = [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120, after: alt ? 40 : 160 }, children: [new ImageRun({ type: 'png', data: buf, transformation: { width: w, height: h } })] })];
  if (alt) children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 }, children: [new TextRun({ text: alt, italics: true, size: SIZE - 3, color: '555555' })] }));
  return children;
}

// ---------------------------------------------------------------------------
// Blocks → docx paragraphs
// ---------------------------------------------------------------------------

const HEADINGS = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4];

async function toDocx(blocks, baseDir, stats) {
  const children = [];
  for (const b of blocks) {
    switch (b.type) {
      case 'heading':
        children.push(new Paragraph({ heading: HEADINGS[b.level - 1], children: runs(b.text) }));
        break;
      case 'paragraph':
        children.push(new Paragraph({ spacing: { after: 120 }, children: runs(b.text) }));
        break;
      case 'quote':
        children.push(new Paragraph({ indent: { left: 567 }, spacing: { after: 120 }, border: { left: { style: BorderStyle.SINGLE, size: 12, color: 'BBBBBB', space: 8 } }, children: runs(b.text, { color: '444444' }) }));
        break;
      case 'code':
        for (const line of b.code.split('\n')) {
          children.push(new Paragraph({ spacing: { after: 0 }, shading: { type: ShadingType.CLEAR, fill: 'F5F5F5' }, children: [new TextRun({ text: line || ' ', font: 'Consolas', size: SIZE - 3 })] }));
        }
        children.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
        break;
      case 'list':
        for (const item of b.items) {
          children.push(new Paragraph({
            numbering: { reference: item.ordered ? 'ordered' : 'bullets', level: item.level },
            spacing: { after: 40 },
            children: runs(item.text),
          }));
        }
        children.push(new Paragraph({ spacing: { after: 80 }, children: [] }));
        break;
      case 'hr':
        children.push(new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'BBBBBB', space: 1 } }, spacing: { after: 160 }, children: [] }));
        break;
      case 'image': {
        const file = path.resolve(baseDir, b.src);
        if (!fs.existsSync(file)) throw new Error(`image not found: ${file}`);
        stats.images++;
        // Screenshots are 1× (device scale 1): scale = 2 keeps their pixel width.
        children.push(...imageParagraph(fs.readFileSync(file), b.alt, 2, b.width));
        break;
      }
      case 'mermaid':
        stats.diagrams++;
        children.push(...imageParagraph(await renderMermaid(b.code), '', 1, b.width));
        break;
      case 'pagebreak':
        children.push(new Paragraph({ children: [new PageBreak()] }));
        break;
      case 'table':
        children.push(table(b.rows, b.compact), new Paragraph({ spacing: { after: 120 }, children: [] }));
        break;
    }
  }
  return children;
}

function table(rows, compact = false) {
  const cols = Math.max(...rows.map((r) => r.length));
  const size = compact ? SIZE - 4 : SIZE - 2;
  const margins = compact ? { top: 20, bottom: 20, left: 60, right: 60 } : { top: 60, bottom: 60, left: 90, right: 90 };
  const border = { style: BorderStyle.SINGLE, size: 4, color: 'BFBFBF' };
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border },
    rows: rows.map((cells, r) => new TableRow({
      tableHeader: r === 0,
      children: Array.from({ length: cols }, (_, c) => new TableCell({
        shading: r === 0 ? { type: ShadingType.CLEAR, fill: 'E7E6E6' } : undefined,
        margins,
        children: [new Paragraph({ spacing: { after: 0 }, children: runs(cells[c] ?? '', { size, bold: r === 0 || undefined }) })],
      })),
    })),
  });
}

// ---------------------------------------------------------------------------
// Page-count preview (HTML with the same metrics, printed by Chromium)
// ---------------------------------------------------------------------------

function inlineHtml(text) {
  const esc = (s) => s.replace(/&(?!(lt|gt|amp|shy);)/g, '&amp;').replace(/<(?!br\s*\/?>)/g, '&lt;');
  return esc(text)
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/(?<![\w*])\*([^*\s][^*]*)\*(?![\w*])/g, '<i>$1</i>');
}

/** Same blocks as HTML; figures become boxes of the size the docx uses. */
async function toHtml(blocks, baseDir) {
  const parts = [];
  const fig = (buf, share, scale, alt) => {
    const { width, height } = pngSize(buf);
    const w = Math.min(Math.round(TEXT_WIDTH_PX * share), Math.round((width * scale) / 2));
    const h = Math.round((height / width) * w);
    parts.push(`<figure><div style="width:${w}px;height:${h}px"></div>${alt ? `<figcaption>${inlineHtml(alt)}</figcaption>` : ''}</figure>`);
  };
  for (const b of blocks) {
    switch (b.type) {
      case 'heading': parts.push(`<h${b.level} data-title="${b.text.replace(/"/g, '')}">${inlineHtml(b.text)}</h${b.level}>`); break;
      case 'paragraph': parts.push(`<p>${inlineHtml(b.text)}</p>`); break;
      case 'quote': parts.push(`<blockquote>${inlineHtml(b.text)}</blockquote>`); break;
      case 'code': parts.push(`<pre>${b.code.replace(/</g, '&lt;')}</pre>`); break;
      case 'list': parts.push('<ul>' + b.items.map((it) => `<li class="l${it.level}">${inlineHtml(it.text)}</li>`).join('') + '</ul>'); break;
      case 'hr': parts.push('<hr>'); break;
      case 'image': fig(fs.readFileSync(path.resolve(baseDir, b.src)), b.width, 2, b.alt); break;
      case 'mermaid': fig(await renderMermaid(b.code), b.width, 1, ''); break;
      case 'pagebreak': parts.push('<div class="pb"></div>'); break;
      case 'table': parts.push(`<table${b.compact ? ' class="compact"' : ''}>` + b.rows.map((r, i) => '<tr>' + r.map((c) => `<${i ? 'td' : 'th'}>${inlineHtml(c)}</${i ? 'td' : 'th'}>`).join('') + '</tr>').join('') + '</table>'); break;
    }
  }
  return parts.join('\n');
}

const PREVIEW_CSS = `
@page { size: A4; margin: 2cm; }
html { font: 10.5pt/1.25 Arial, Helvetica, sans-serif; color: #1f1f1f; }
body { margin: 0; }
h1 { font-size: 16pt; margin: 18pt 0 8pt; } h2 { font-size: 13pt; margin: 14pt 0 6pt; } h3 { font-size: 11.5pt; margin: 11pt 0 5pt; } h4 { font-size: 10.5pt; font-style: italic; margin: 8pt 0 4pt; }
p { margin: 0 0 6pt; } ul { margin: 0 0 4pt; padding-left: 18pt; } li { margin-bottom: 2pt; } li.l1 { margin-left: 18pt; }
blockquote { margin: 0 0 6pt 20pt; padding-left: 8pt; border-left: 2px solid #bbb; }
pre { font: 9pt Consolas, monospace; background: #f5f5f5; margin: 0 0 6pt; padding: 4pt; white-space: pre-wrap; }
code { font: 9.5pt Consolas, monospace; background: #f2f2f2; }
table { border-collapse: collapse; width: 100%; margin: 0 0 6pt; font-size: 9.5pt; }
th, td { border: 1px solid #bfbfbf; padding: 3pt 4.5pt; vertical-align: top; text-align: left; } th { background: #e7e6e6; }
table.compact { font-size: 8.5pt; } table.compact th, table.compact td { padding: 1pt 3pt; }
figure { margin: 6pt 0 8pt; text-align: center; } figure div { display: inline-block; background: #eee; } figcaption { font-size: 9pt; font-style: italic; color: #555; margin-top: 2pt; }
hr { border: 0; border-top: 1px solid #bbb; margin: 0 0 8pt; }
.pb { break-before: page; }
`;

/** Prints the preview PDF and reports pages in total and per level-1 chapter. */
async function pagePreview(blocks, baseDir, pdfFile) {
  const html = await toHtml(blocks, baseDir);
  if (!browserPromise) browserPromise = require('@playwright/test').chromium.launch();
  const browser = await browserPromise;
  const page = await browser.newPage();
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${PREVIEW_CSS}</style></head><body>${html}</body></html>`);
  await page.pdf({ path: pdfFile, format: 'A4', margin: { top: '2cm', right: '2cm', bottom: '2cm', left: '2cm' }, printBackground: true });
  // Chapter starts are estimated from the flow height (25.7 cm of text per
  // A4 page); the total comes from the printed PDF.
  const marks = await page.evaluate(() => {
    const pageHeightPx = ((29.7 - 4) / 2.54) * 96;
    return {
      flowPages: document.body.scrollHeight / pageHeightPx,
      // Chapters = the top-most heading level in the body (the title is a level-1 heading and removed).
      h1: [...document.querySelectorAll(document.querySelector('h1') ? 'h1' : 'h2')].map((h) => ({ title: h.dataset.title, at: h.offsetTop / pageHeightPx })),
    };
  });
  await page.close();
  const pdf = fs.readFileSync(pdfFile);
  const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page(?![s\w])/g) || []).length;
  return { pages, ...marks };
}

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------

async function build(input, output, { pages = false } = {}) {
  const md = fs.readFileSync(input, 'utf8');
  const blocks = parseBlocks(md);
  const titleIndex = blocks.findIndex((b) => b.type === 'heading' && b.level === 1);
  const title = titleIndex >= 0 ? blocks[titleIndex].text.replace(/[*`]/g, '') : path.basename(input, '.md');
  if (titleIndex >= 0) blocks.splice(titleIndex, 1);
  const stats = { diagrams: 0, images: 0 };
  if (pages) {
    const pdfFile = path.resolve('dist/docs', path.basename(input, '.md') + '.preview.pdf');
    fs.mkdirSync(path.dirname(pdfFile), { recursive: true });
    stats.preview = await pagePreview(blocks, path.dirname(input), pdfFile);
    stats.preview.file = pdfFile;
  }

  const body = await toDocx(blocks, path.dirname(input), stats);
  const cover = [
    new Paragraph({ spacing: { before: 3600, after: 240 }, children: [new TextRun({ text: title, bold: true, size: 56 })] }),
    new Paragraph({ spacing: { after: 240 }, children: [new TextRun({ text: `Stand ${new Date().toLocaleDateString('de-CH')}`, size: SIZE + 2, color: '555555' })] }),
    new Paragraph({ children: [new PageBreak()] }),
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('Inhalt')] }),
    new TableOfContents('Inhalt', { hyperlink: true, headingStyleRange: '1-3' }),
    new Paragraph({ children: [new PageBreak()] }),
  ];

  const doc = new Document({
    creator: 'SLIM docs',
    title,
    features: { updateFields: true },
    styles: {
      default: { document: { run: { font: FONT, size: SIZE } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 32, bold: true, color: '1F1F1F' }, paragraph: { spacing: { before: 360, after: 160 }, outlineLevel: 0 } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 26, bold: true, color: '1F1F1F' }, paragraph: { spacing: { before: 280, after: 120 }, outlineLevel: 1 } },
        { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 23, bold: true, color: '333333' }, paragraph: { spacing: { before: 220, after: 100 }, outlineLevel: 2 } },
        { id: 'Heading4', name: 'Heading 4', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: SIZE, bold: true, italics: true }, paragraph: { spacing: { before: 160, after: 80 }, outlineLevel: 3 } },
      ],
    },
    numbering: {
      config: [
        { reference: 'bullets', levels: [
          { level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 567, hanging: 283 } } } },
          { level: 1, format: LevelFormat.BULLET, text: '–', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1134, hanging: 283 } } } },
        ] },
        { reference: 'ordered', levels: [
          { level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 567, hanging: 283 } } } },
          { level: 1, format: LevelFormat.LOWER_LETTER, text: '%2)', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1134, hanging: 283 } } } },
        ] },
      ],
    },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 } } },
      footers: {
        default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [
          new TextRun({ text: `${title} · Seite `, size: SIZE - 4, color: '666666' }),
          new TextRun({ children: [PageNumber.CURRENT], size: SIZE - 4, color: '666666' }),
          new TextRun({ text: ' von ', size: SIZE - 4, color: '666666' }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], size: SIZE - 4, color: '666666' }),
        ] })] }),
      },
      children: [...cover, ...body],
    }],
  });

  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, await Packer.toBuffer(doc));
  return stats;
}

async function main() {
  const args = process.argv.slice(2);
  const pages = args.includes('--pages');
  const [input, outArg] = args.filter((a) => !a.startsWith('--'));
  if (!input) {
    console.error('usage: node tools/docx.build.js <input.md> [output.docx] [--pages]');
    process.exit(1);
  }
  const output = outArg ? path.resolve(outArg) : path.resolve(path.dirname(input), path.basename(input, '.md') + '.docx');
  try {
    const stats = await build(path.resolve(input), output, { pages });
    console.log(`${output} — ${stats.diagrams} diagrams, ${stats.images} images`);
    if (stats.preview) {
      const p = stats.preview;
      console.log(`preview ${p.file}: ${p.pages} pages printed (flow ≈ ${p.flowPages.toFixed(1)}), chapters start at:`);
      for (const h of p.h1) console.log(`  page ${(h.at + 1).toFixed(1).padStart(5)}  ${h.title}`);
    }
  } finally {
    if (browserPromise) await (await browserPromise).close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
