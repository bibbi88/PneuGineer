export interface Transform {
  scale: number;
  tx: number;
  ty: number;
}

export interface ViewportAdapter {
  clientToWorld(cx: number, cy: number): { x: number; y: number };
  applyTransform(): void;
  getTransform(): Transform;
  setTransform(scale: number, tx: number, ty: number): void;
}

const MIN_SCALE = 0.2;
const MAX_SCALE = 4.0;

export function initViewport(viewportEl: HTMLElement, workspaceEl: HTMLElement): ViewportAdapter {
  let scale = 1.0;
  let tx = 0;
  let ty = 0;
  let panning = false;
  let panStart = { x: 0, y: 0 };
  let originStart = { x: 0, y: 0 };

  function applyTransform(): void {
    viewportEl.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
  }

  function clientToWorld(cx: number, cy: number): { x: number; y: number } {
    const rect = workspaceEl.getBoundingClientRect();
    return {
      x: (cx - rect.left - tx) / scale,
      y: (cy - rect.top - ty) / scale,
    };
  }

  function isOverWorkspace(clientX: number, clientY: number): boolean {
    const rect = workspaceEl.getBoundingClientRect();
    return (
      clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom
    );
  }

  window.addEventListener(
    'wheel',
    (e) => {
      if (!isOverWorkspace(e.clientX, e.clientY)) return;
      e.preventDefault();
      const rect = workspaceEl.getBoundingClientRect();
      const delta = -Math.sign(e.deltaY) * 0.12;
      const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale * (1 + delta)));
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const wx = (mx - tx) / scale;
      const wy = (my - ty) / scale;
      tx = mx - wx * newScale;
      ty = my - wy * newScale;
      scale = newScale;
      applyTransform();
    },
    { passive: false },
  );

  window.addEventListener('mousedown', (e) => {
    if (!isOverWorkspace(e.clientX, e.clientY)) return;
    if (e.button === 1 || (e.button === 2 && e.altKey)) {
      panning = true;
      panStart = { x: e.clientX, y: e.clientY };
      originStart = { x: tx, y: ty };
      document.body.style.cursor = 'grabbing';
      e.preventDefault();
    }
  });

  window.addEventListener('mousemove', (e) => {
    if (!panning) return;
    tx = originStart.x + (e.clientX - panStart.x);
    ty = originStart.y + (e.clientY - panStart.y);
    applyTransform();
  });

  window.addEventListener('mouseup', () => {
    if (panning) {
      panning = false;
      document.body.style.cursor = '';
    }
  });

  window.addEventListener('contextmenu', (e) => {
    if (isOverWorkspace(e.clientX, e.clientY)) e.preventDefault();
  });

  applyTransform();

  return {
    clientToWorld,
    applyTransform,
    getTransform: () => ({ scale, tx, ty }),
    setTransform: (s, x, y) => {
      scale = s;
      tx = x;
      ty = y;
      applyTransform();
    },
  };
}
