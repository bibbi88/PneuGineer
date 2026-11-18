/** A short message that shows for a moment at the bottom of the window ("Saved beam.pgcl"). */
const SHOW_MS = 2200;

let current: HTMLElement | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;

export function showToast(text: string): void {
  clearTimeout(timer);
  current?.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.textContent = text;
  document.body.appendChild(el);
  current = el;
  timer = setTimeout(() => {
    el.remove();
    if (current === el) current = null;
  }, SHOW_MS);
}
