import _sanitize from 'sanitize-html';
import type { IOptions } from 'sanitize-html';

/**
 * Sanitizes an HTML string for safe rendering via dangerouslySetInnerHTML.
 *
 * Allowed: standard editorial content tags (headings, paragraphs, lists, tables, links, images, etc.)
 * Removed: <script>, <style>, <iframe>, <frame>, <form>, <input>, <button>, <object>, <embed>,
 *          all event handler attributes (onclick, onload, etc.), javascript: URIs, data: URIs.
 *
 * Use this everywhere HTML from external sources (agent callbacks, AI output) is rendered.
 */

const SANITIZE_OPTIONS: IOptions = {
  allowedTags: [
    // Headings
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    // Text structure
    'p', 'br', 'hr', 'blockquote', 'pre', 'code',
    // Inline
    'strong', 'b', 'em', 'i', 'u', 's', 'del', 'ins', 'mark', 'small', 'sup', 'sub',
    // Lists
    'ul', 'ol', 'li', 'dl', 'dt', 'dd',
    // Tables
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col',
    // Media & links
    'a', 'img', 'figure', 'figcaption',
    // Containers
    'div', 'span', 'section', 'article', 'aside', 'header', 'footer', 'main', 'nav',
    // Explicitly NOT allowed: script, style, iframe, frame, frameset, form, input,
    // button, select, textarea, object, embed, applet, base, link, meta
  ],
  allowedAttributes: {
    'a': ['href', 'title', 'target', 'rel'],
    'img': ['src', 'alt', 'title', 'width', 'height', 'loading'],
    'td': ['colspan', 'rowspan', 'align'],
    'th': ['colspan', 'rowspan', 'align', 'scope'],
    'col': ['span', 'width'],
    'colgroup': ['span'],
    '*': ['class'],
  },
  allowedSchemes: ['https', 'http', 'mailto'],
  allowedSchemesByTag: {
    img: ['https', 'http'],
    a: ['https', 'http', 'mailto'],
  },
  // Force rel="noopener noreferrer" on all target="_blank" links
  transformTags: {
    'a': (tagName: string, attribs: Record<string, string>) => ({
      tagName,
      attribs: {
        ...attribs,
        ...(attribs.target === '_blank' ? { rel: 'noopener noreferrer' } : {}),
      },
    }),
  },
};

export function sanitizeHtml(html: string | undefined | null): string {
  if (!html) return '';
  return _sanitize(html, SANITIZE_OPTIONS);
}
