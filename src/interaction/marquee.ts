import { appState } from '../app/AppState';
import { addToSelection, clearSelection } from './selection';

export function initMarquee(backgroundEl: SVGSVGElement): void {
  backgroundEl.addEventListener('mousedown', (e) => {
    if (e.target !== backgroundEl) return;
    if (e.button !== 0) return;

    const additive = e.shiftKey;
    if (!additive) clearSelection();

    const startX = e.clientX;
    const startY = e.clientY;

    const marqueeEl = document.createElement('div');
    marqueeEl.className = 'marquee';
    document.body.appendChild(marqueeEl);

    function updateRect(curX: number, curY: number): void {
      const x = Math.min(startX, curX);
      const y = Math.min(startY, curY);
      marqueeEl.style.left = `${x}px`;
      marqueeEl.style.top = `${y}px`;
      marqueeEl.style.width = `${Math.abs(curX - startX)}px`;
      marqueeEl.style.height = `${Math.abs(curY - startY)}px`;
    }
    updateRect(startX, startY);

    function onMove(ev: MouseEvent): void {
      updateRect(ev.clientX, ev.clientY);
    }

    function onUp(ev: MouseEvent): void {
      const x1 = Math.min(startX, ev.clientX);
      const x2 = Math.max(startX, ev.clientX);
      const y1 = Math.min(startY, ev.clientY);
      const y2 = Math.max(startY, ev.clientY);

      for (const c of appState.components) {
        const r = c.el.getBoundingClientRect();
        const intersects = r.left < x2 && r.right > x1 && r.top < y2 && r.bottom > y1;
        if (intersects) addToSelection(c.id);
      }

      marqueeEl.remove();
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  });
}
