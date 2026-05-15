import DOMPurify from 'isomorphic-dompurify';

/**
 * Sanitizes an HTML string for safe rendering via dangerouslySetInnerHTML.
 *
 * Allowed: standard content tags (h1-h6, p, ul, ol, li, table, a, img, strong, em, etc.)
 * Removed: <script>, <style>, <iframe>, <form>, <input>, <button>, event handlers (onclick etc.),
 *          javascript: URLs, and all other potentially dangerous constructs.
 *
 * Use this everywhere HTML from external sources (agent callbacks, AI output) is rendered.
 */
export function sanitizeHtml(html: string | undefined | null): string {
  if (!html) return '';

  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    // Explicitly forbid tags that are unnecessary for editorial content
    FORBID_TAGS: ['script', 'style', 'iframe', 'frame', 'frameset', 'form', 'input', 'button', 'select', 'textarea', 'object', 'embed', 'applet', 'base', 'link', 'meta'],
    // Forbid all event handler attributes and dangerous attribute values
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'onchange', 'onsubmit', 'onkeydown', 'onkeyup', 'onkeypress'],
    // Block javascript: and data: URIs in href/src attributes
    ALLOW_DATA_ATTR: false,
    FORCE_BODY: true,
  });
}
