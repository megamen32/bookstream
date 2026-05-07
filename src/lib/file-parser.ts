import mammoth from 'mammoth';
import { marked } from 'marked';

export interface ParsedChapter {
  title: string;
  html: string;
}

export interface ParsedParagraph {
  text: string;
  stableKey: string;
  html: string;
  textAlign: 'left' | 'center' | 'right' | 'justify' | null;
  indentPx: number;
}

/**
 * Parse a DOCX file buffer into chapters.
 * Uses mammoth.js to convert to HTML, then detects chapters by
 * Heading1 styles or common chapter heading patterns.
 */
export async function parseDocx(buffer: ArrayBuffer): Promise<{ chapters: ParsedChapter[] }> {
  const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
  const html = result.value;

  // Try to split by Heading1 (<h1>...</h1>)
  const h1Regex = /<h1[^>]*>(.*?)<\/h1>/gi;
  const h1Matches = [...html.matchAll(h1Regex)];

  if (h1Matches.length > 1) {
    // Multiple H1 headings found — use them as chapter dividers
    const chapters: ParsedChapter[] = [];

    for (let i = 0; i < h1Matches.length; i++) {
      const title = h1Matches[i][1].replace(/<[^>]+>/g, '').trim();
      const startIdx = h1Matches[i].index! + h1Matches[i][0].length;
      const endIdx = i + 1 < h1Matches.length ? h1Matches[i + 1].index! : html.length;
      const content = html.slice(startIdx, endIdx).trim();
      chapters.push({ title: title || `Chapter ${i + 1}`, html: content });
    }

    return { chapters };
  }

  // Fallback: try to detect common chapter patterns in the raw text
  // First extract raw text for pattern detection
  const rawText = await mammoth.extractRawText({ arrayBuffer: buffer });
  const rawValue = rawText.value;

  const chapterPattern = /^(?:Глава\s+\d+|Chapter\s+\d+|Chapter\s+[IVXLCDM]+|CHAPTER\s+\d+)/gmi;
  const chapterMatches = [...rawValue.matchAll(chapterPattern)];

  if (chapterMatches.length > 1) {
    // Use chapter headings found in raw text to split the HTML
    // We'll split the HTML by looking for these patterns within HTML text nodes
    const chapters: ParsedChapter[] = [];
    const htmlParts = splitHtmlByChapterHeadings(html, chapterPattern);

    for (let i = 0; i < htmlParts.length; i++) {
      const part = htmlParts[i].trim();
      if (part) {
        const titleMatch = part.match(/^(?:Глава\s+\d+|Chapter\s+\d+|Chapter\s+[IVXLCDM]+|CHAPTER\s+\d+)/i);
        const title = titleMatch ? titleMatch[0] : `Chapter ${i + 1}`;
        // Remove the heading from content
        const content = part.replace(/^(?:<[^>]*>)*(?:Глава\s+\d+|Chapter\s+\d+|Chapter\s+[IVXLCDM]+|CHAPTER\s+\d+)(?:<\/[^>]+>)*/i, '').trim();
        chapters.push({ title, html: content });
      }
    }

    if (chapters.length > 0) {
      return { chapters };
    }
  }

  // No chapters detected — treat the entire document as a single chapter
  const titleMatch = html.match(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/i);
  const title = titleMatch
    ? titleMatch[1].replace(/<[^>]+>/g, '').trim()
    : 'Chapter 1';

  return { chapters: [{ title, html }] };
}

/**
 * Parse Markdown text into chapters.
 * Splits by ## or # headings.
 */
export function parseMarkdown(text: string): { chapters: ParsedChapter[] } {
  const chapters: ParsedChapter[] = [];

  // Split by ## or # headings (but not ### or deeper)
  const headingRegex = /^#{1,2}\s+(.+)$/gm;
  const matches = [...text.matchAll(headingRegex)];

  if (matches.length === 0) {
    // No headings found, treat as single chapter
    const html = marked.parse(text, { async: false }) as string;
    const title = 'Chapter 1';
    chapters.push({ title, html: typeof html === 'string' ? html : '' });
    return { chapters };
  }

  for (let i = 0; i < matches.length; i++) {
    const title = matches[i][1].trim();
    const startIdx = matches[i].index! + matches[i][0].length;
    const endIdx = i + 1 < matches.length ? matches[i + 1].index! : text.length;
    const content = text.slice(startIdx, endIdx).trim();
    const html = marked.parse(content, { async: false }) as string;
    chapters.push({
      title,
      html: typeof html === 'string' ? html : '',
    });
  }

  // If there's content before the first heading
  if (matches[0].index! > 0) {
    const preamble = text.slice(0, matches[0].index!).trim();
    if (preamble) {
      const html = marked.parse(preamble, { async: false }) as string;
      chapters.unshift({
        title: 'Chapter 1',
        html: typeof html === 'string' ? html : '',
      });
    }
  }

  return { chapters };
}

/**
 * Parse plain text into chapters.
 * Splits by double newlines or chapter heading patterns.
 */
export function parseTxt(text: string): { chapters: ParsedChapter[] } {
  const chapters: ParsedChapter[] = [];

  // Try to detect chapter headings
  const chapterPattern = /^(?:Глава\s+\d+|Chapter\s+\d+|Chapter\s+[IVXLCDM]+|CHAPTER\s+\d+)$/gmi;
  const lines = text.split('\n');
  const chapterIndices: { title: string; lineIndex: number }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (chapterPattern.test(trimmed)) {
      chapterIndices.push({ title: trimmed, lineIndex: i });
    }
  }

  if (chapterIndices.length > 1) {
    for (let i = 0; i < chapterIndices.length; i++) {
      const startLine = chapterIndices[i].lineIndex + 1;
      const endLine = i + 1 < chapterIndices.length
        ? chapterIndices[i + 1].lineIndex
        : lines.length;
      const content = lines
        .slice(startLine, endLine)
        .join('\n')
        .trim();
      const html = content
        .split(/\n\n+/)
        .map((p) => `<p>${escapeHtml(p.replace(/\n/g, '<br>'))}</p>`)
        .join('\n');
      chapters.push({
        title: chapterIndices[i].title,
        html,
      });
    }
    return { chapters };
  }

  // No chapter headings — split by double newlines into paragraphs,
  // and group every ~50 paragraphs as a chapter
  const paragraphs = text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) {
    return { chapters: [{ title: 'Chapter 1', html: '' }] };
  }

  const PARAGRAPHS_PER_CHAPTER = 50;

  if (paragraphs.length <= PARAGRAPHS_PER_CHAPTER) {
    const html = paragraphs
      .map((p) => `<p>${escapeHtml(p.replace(/\n/g, '<br>'))}</p>`)
      .join('\n');
    chapters.push({ title: 'Chapter 1', html });
    return { chapters };
  }

  for (let i = 0; i < paragraphs.length; i += PARAGRAPHS_PER_CHAPTER) {
    const chunk = paragraphs.slice(i, i + PARAGRAPHS_PER_CHAPTER);
    const html = chunk
      .map((p) => `<p>${escapeHtml(p.replace(/\n/g, '<br>'))}</p>`)
      .join('\n');
    chapters.push({
      title: `Chapter ${Math.floor(i / PARAGRAPHS_PER_CHAPTER) + 1}`,
      html,
    });
  }

  return { chapters };
}

/**
 * Split HTML content into individual paragraphs, each with a stable key.
 * The stable key is based on a hash of the paragraph's position and first 50 characters.
 */
export function splitHtmlIntoParagraphs(html: string): ParsedParagraph[] {
  // Split HTML by <p> tags
  const paragraphs: ParsedParagraph[] = [];
  const pRegex = /<p([^>]*)>([\s\S]*?)<\/p>/gi;
  const matches = [...html.matchAll(pRegex)];

  if (matches.length === 0) {
    // No <p> tags found — try splitting by <div>, <br>, or treat whole thing as one paragraph
    const divRegex = /<div([^>]*)>([\s\S]*?)<\/div>/gi;
    const divMatches = [...html.matchAll(divRegex)];

    if (divMatches.length > 0) {
      for (let i = 0; i < divMatches.length; i++) {
        const innerHtml = sanitizeParagraphHtml(divMatches[i][2]);
        const text = htmlBlockToText(innerHtml);
        if (text) {
          const formatting = extractBlockFormatting(divMatches[i][1] || '');
          paragraphs.push({
            text,
            stableKey: generateStableKey(i, text),
            html: innerHtml,
            textAlign: formatting.textAlign,
            indentPx: formatting.indentPx,
          });
        }
      }
    } else {
      // Split by double <br> or treat as single paragraph
      const parts = html.split(/<br\s*\/?>\s*<br\s*\/?>/i);
      for (let i = 0; i < parts.length; i++) {
        const innerHtml = sanitizeParagraphHtml(parts[i]);
        const text = htmlBlockToText(innerHtml);
        if (text) {
          paragraphs.push({
            text,
            stableKey: generateStableKey(i, text),
            html: innerHtml,
            textAlign: null,
            indentPx: 0,
          });
        }
      }
    }

    if (paragraphs.length === 0 && html.trim()) {
      const innerHtml = sanitizeParagraphHtml(html);
      const text = htmlBlockToText(innerHtml);
      paragraphs.push({
        text,
        stableKey: generateStableKey(0, text),
        html: innerHtml,
        textAlign: null,
        indentPx: 0,
      });
    }

    return paragraphs;
  }

  for (let i = 0; i < matches.length; i++) {
    const innerHtml = sanitizeParagraphHtml(matches[i][2]);
    const text = htmlBlockToText(innerHtml);
    if (text) {
      const formatting = extractBlockFormatting(matches[i][1] || '');
      paragraphs.push({
        text,
        stableKey: generateStableKey(i, text),
        html: innerHtml,
        textAlign: formatting.textAlign,
        indentPx: formatting.indentPx,
      });
    }
  }

  return paragraphs;
}

// --- Utility functions ---

function generateStableKey(position: number, text: string): string {
  const prefix = stripHtml(text).slice(0, 50);
  const raw = `${position}:${prefix}`;
  return simpleHash(raw);
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').trim();
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'");
}

function collapseWhitespace(text: string): string {
  return text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ').trim();
}

function htmlBlockToText(html: string): string {
  const withLineBreaks = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|li|blockquote|h[1-6])>/gi, '\n');

  return collapseWhitespace(decodeHtmlEntities(stripHtml(withLineBreaks)));
}

function sanitizeParagraphHtml(html: string): string {
  return html
    .replace(/<(script|style|iframe|object|embed)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '')
    .replace(/\s(href|src)\s*=\s*(['"])\s*javascript:[\s\S]*?\2/gi, '');
}

function extractBlockFormatting(attributes: string): {
  textAlign: 'left' | 'center' | 'right' | 'justify' | null;
  indentPx: number;
} {
  const styleMatch = attributes.match(/\sstyle=(["'])(.*?)\1/i);
  const style = styleMatch?.[2] || '';
  const textAlignValue = style.match(/text-align\s*:\s*(left|center|right|justify)/i)?.[1]?.toLowerCase();
  const textAlign = (
    textAlignValue === 'left' ||
    textAlignValue === 'center' ||
    textAlignValue === 'right' ||
    textAlignValue === 'justify'
  )
    ? textAlignValue
    : null;

  const marginLeft = parseCssLengthToPx(style.match(/margin-left\s*:\s*([^;]+)/i)?.[1]);
  const paddingLeft = parseCssLengthToPx(style.match(/padding-left\s*:\s*([^;]+)/i)?.[1]);
  const textIndent = parseCssLengthToPx(style.match(/text-indent\s*:\s*([^;]+)/i)?.[1]);
  const indentPx = Math.max(0, Math.round(marginLeft + paddingLeft + Math.max(0, textIndent)));

  return {
    textAlign,
    indentPx,
  };
}

function parseCssLengthToPx(value: string | undefined): number {
  if (!value) {
    return 0;
  }

  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)(px|pt|pc|in|cm|mm|em|rem)?$/i);
  if (!match) {
    return 0;
  }

  const numericValue = Number.parseFloat(match[1]);
  const unit = (match[2] || 'px').toLowerCase();

  if (unit === 'px') return numericValue;
  if (unit === 'pt') return numericValue * (96 / 72);
  if (unit === 'pc') return numericValue * 16;
  if (unit === 'in') return numericValue * 96;
  if (unit === 'cm') return numericValue * (96 / 2.54);
  if (unit === 'mm') return numericValue * (96 / 25.4);
  if (unit === 'em' || unit === 'rem') return numericValue * 16;
  return numericValue;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Split HTML content by chapter heading patterns found in text nodes.
 */
function splitHtmlByChapterHeadings(
  html: string,
  _pattern: RegExp
): string[] {
  // We look for text content matching chapter patterns and split around them
  const regex = /(?:Глава\s+\d+|Chapter\s+\d+|Chapter\s+[IVXLCDM]+|CHAPTER\s+\d+)/gi;
  const parts: string[] = [];
  let lastIndex = 0;

  // Find positions within HTML text content
  let match: RegExpExecArray | null;
  const combined = new RegExp(regex.source, regex.flags);
  while ((match = combined.exec(html)) !== null) {
    if (match.index > lastIndex) {
      parts.push(html.slice(lastIndex, match.index));
    }
    lastIndex = match.index;
  }

  if (lastIndex < html.length) {
    parts.push(html.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [html];
}
