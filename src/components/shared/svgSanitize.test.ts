import { describe, expect, it } from 'vitest';
import { sanitizeSvgMarkup } from './svgSanitize';

describe('sanitizeSvgMarkup', () => {
  it('returns null for markup that is not a parseable svg document', () => {
    expect(sanitizeSvgMarkup('<div>not svg</div>')).toBeNull();
    expect(sanitizeSvgMarkup('not even xml <<<')).toBeNull();
  });

  it('reads width/height from viewBox over explicit width/height attributes', () => {
    const result = sanitizeSvgMarkup(
      '<svg viewBox="0 0 120 80" width="999" height="999" xmlns="http://www.w3.org/2000/svg"></svg>',
    );
    expect(result?.width).toBe(120);
    expect(result?.height).toBe(80);
  });

  it('falls back to explicit width/height when there is no viewBox, and to a default when neither exists', () => {
    const withWH = sanitizeSvgMarkup(
      '<svg width="50" height="40" xmlns="http://www.w3.org/2000/svg"></svg>',
    );
    expect(withWH).toEqual({ root: expect.anything(), width: 50, height: 40 });

    const bare = sanitizeSvgMarkup('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    expect(bare?.width).toBeGreaterThan(0);
    expect(bare?.height).toBeGreaterThan(0);
  });

  it('strips <script> elements entirely', () => {
    const result = sanitizeSvgMarkup(
      '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10" /><script>alert(1)</script></svg>',
    );
    expect(result?.root.querySelector('script')).toBeNull();
    expect(result?.root.querySelector('rect')).not.toBeNull();
  });

  it('strips foreignObject/iframe/embed/object', () => {
    const result = sanitizeSvgMarkup(
      '<svg xmlns="http://www.w3.org/2000/svg">' +
        '<foreignObject><body xmlns="http://www.w3.org/1999/xhtml"><script>alert(1)</script></body></foreignObject>' +
        '<iframe src="https://evil.example"></iframe>' +
        '</svg>',
    );
    expect(result?.root.querySelector('foreignObject')).toBeNull();
    expect(result?.root.querySelector('iframe')).toBeNull();
  });

  it('strips every on* event handler attribute, on any element, at any depth', () => {
    const result = sanitizeSvgMarkup(
      '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)">' +
        '<g><circle cx="5" cy="5" r="5" onclick="alert(2)" /></g>' +
        '</svg>',
    );
    expect(result?.root.getAttribute('onload')).toBeNull();
    expect(result?.root.querySelector('circle')?.getAttribute('onclick')).toBeNull();
  });

  it('strips javascript: and external hrefs, but keeps a same-document #fragment href', () => {
    const result = sanitizeSvgMarkup(
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">' +
        '<a href="javascript:alert(1)"><rect width="5" height="5" /></a>' +
        '<use xlink:href="https://evil.example/x.svg#y" />' +
        '<use xlink:href="#local" />' +
        '</svg>',
    );
    expect(result?.root.querySelector('a')?.getAttribute('href')).toBeNull();
    const uses = result?.root.querySelectorAll('use') ?? [];
    expect(uses[0]?.getAttribute('xlink:href')).toBeNull();
    expect(uses[1]?.getAttribute('xlink:href')).toBe('#local');
  });

  it('leaves ordinary drawing markup untouched', () => {
    const result = sanitizeSvgMarkup(
      '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">' +
        '<rect x="10" y="10" width="80" height="80" fill="#fff" stroke="#111" /></svg>',
    );
    const rect = result?.root.querySelector('rect');
    expect(rect?.getAttribute('fill')).toBe('#fff');
    expect(rect?.getAttribute('width')).toBe('80');
  });
});
