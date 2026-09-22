/**
 * Best-effort sanitizer for user-pasted SVG markup before it's ever inserted into the live DOM
 * (a custom component's artwork, see components/customComponents.ts) - this is the one place in
 * the app that takes arbitrary external markup and renders it, so it's the one place an XSS
 * payload could otherwise ride along inside what looks like a harmless drawing. Denylist-based
 * (strip known-dangerous elements/attributes) rather than an allowlist, since SVG has a large,
 * genuinely-needed vocabulary of drawing elements - not a substitute for treating this as fully
 * trusted content, but applied on every render (not just when a component is first saved), so a
 * hand-edited or otherwise untrusted project file gets the same treatment as a fresh paste.
 */

const DANGEROUS_TAGS = ['script', 'foreignobject', 'iframe', 'embed', 'object', 'link'];

function isExternalUrl(value: string): boolean {
  const v = value.trim();
  return !v.startsWith('#') && /^[a-z][a-z0-9+.-]*:/i.test(v) && !/^data:image\//i.test(v);
}

function sanitizeElement(el: Element): void {
  for (const attr of Array.from(el.attributes)) {
    const name = attr.name.toLowerCase();
    if (name.startsWith('on')) {
      el.removeAttribute(attr.name);
      continue;
    }
    if (
      (name === 'href' || name === 'xlink:href' || name === 'src') &&
      (attr.value.trim().toLowerCase().startsWith('javascript:') || isExternalUrl(attr.value))
    ) {
      el.removeAttribute(attr.name);
    }
  }
  for (const child of Array.from(el.children)) {
    if (DANGEROUS_TAGS.includes(child.tagName.toLowerCase())) {
      child.remove();
      continue;
    }
    sanitizeElement(child);
  }
}

export interface SanitizedSvg {
  root: SVGSVGElement;
  width: number;
  height: number;
}

/** Parses and sanitizes `markup`, returning the cleaned root `<svg>` element plus its intrinsic
 * width/height (from `viewBox`, falling back to `width`/`height`, falling back to 200x150) - or
 * `null` if `markup` isn't a parseable SVG document at all. */
export function sanitizeSvgMarkup(markup: string): SanitizedSvg | null {
  const doc = new DOMParser().parseFromString(markup, 'image/svg+xml');
  const root = doc.documentElement;
  if (!root || root.tagName.toLowerCase() !== 'svg' || doc.querySelector('parsererror')) {
    return null;
  }
  sanitizeElement(root);

  let width = Number(root.getAttribute('width'));
  let height = Number(root.getAttribute('height'));
  const viewBox = root.getAttribute('viewBox');
  if (viewBox) {
    const parts = viewBox.trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
      width = parts[2] as number;
      height = parts[3] as number;
    }
  }
  if (!Number.isFinite(width) || width <= 0) width = 200;
  if (!Number.isFinite(height) || height <= 0) height = 150;

  return { root: root as unknown as SVGSVGElement, width, height };
}
