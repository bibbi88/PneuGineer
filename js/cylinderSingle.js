// js/cylinderSingle.js
// Single-acting cylinder (spring return).
// Ports: A (pressure). Internal spring returns the piston when no pressure.
// Shares the same letter + signals scheme as your double-acting cylinder:
//   - Signals published: a0 (fully retracted), a1 (fully extended) for current letter.
//   - Double-click label to rename cylinder letter (A–Z).
//
// Public API:
// addCylinderSingle(
//   x, y,
//   compLayer, components,
//   handlePortClick, makeDraggable, redrawConnections, uid,
//   getNextCylinderLetter, setSignal,
//   opts?    // { normallyExtended?: boolean } default false (normally retracted)
// )

const SCALE = 1;

export function addCylinderSingle(
  x, y,
  compLayer, components,
  handlePortClick, makeDraggable, redrawConnections, uid,
  getNextCylinderLetter, setSignal,
  opts = {}
){
  const id = uid();
  const s = (n)=> n * SCALE;

  // Mode: 'push' (default) = extend when A pressurized; 'pull' = retract when A pressurized
  const initialMode = (opts && opts.mode === 'pull') ? 'pull' : 'push';
  // Defaults: normally retracted unless explicitly set; but pull-mode defaults to extended
  const normallyExtended = (opts && typeof opts.normallyExtended !== 'undefined')
    ? !!opts.normallyExtended
    : (initialMode === 'pull');

  // ===== Letter init =====
  const initialLetter = (typeof getNextCylinderLetter === 'function')
    ? getNextCylinderLetter()
    : 'A';

  // Compact overall SVG like your double-acting style
  const SVG_W = 300;
  const SVG_H = 60;
  const GX = 10, GY = 10;

  // Cylinder housing geometry
  const W = 200, H = 70;
  const PORT_MARGIN = 6;

  // --- DOM container ---
  const el = document.createElement('div');
  el.className = 'comp';
  el.style.left = x + 'px';
  el.style.top  = y + 'px';

  const label = document.createElement('div');
  label.className = 'label';
  label.style.pointerEvents = 'auto'; // allow dblclick edit
  // label contains text and a small mode toggle button
  const labelText = document.createElement('span');
  const modeBtn = document.createElement('button');
  modeBtn.className = 'cylModeBtn';
  modeBtn.style.marginLeft = '6px';
  modeBtn.style.fontSize = '10px';
  modeBtn.style.padding = '2px 6px';
  modeBtn.style.borderRadius = '6px';
  modeBtn.style.cursor = 'pointer';
  modeBtn.title = 'Toggle single-acting mode (push/pull)';
  label.appendChild(labelText);
  label.appendChild(modeBtn);
  el.appendChild(label);

  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS,'svg');
  svg.classList.add('compSvg');
  svg.setAttribute('width',  s(SVG_W));
  svg.setAttribute('height', s(SVG_H));
  svg.style.overflow = 'visible';

  const g = document.createElementNS(NS,'g');
  g.setAttribute('transform', `translate(${s(GX)},${s(GY)})`);

  // --- Body ---
  const body = document.createElementNS(NS,'rect');
  body.setAttribute('x', s(0)); body.setAttribute('y', s(0));
  body.setAttribute('width', s(W)); body.setAttribute('height', s(H));
  body.setAttribute('fill','#fff'); body.setAttribute('stroke','#000');
  body.setAttribute('stroke-width', s(2));

  // --- Piston (vertical bar) ---
  const piston = document.createElementNS(NS,'rect');
  piston.setAttribute('x', s(56)); piston.setAttribute('y', s(0));
  piston.setAttribute('width', s(6)); piston.setAttribute('height', s(H));
  piston.setAttribute('fill','#888');

  // --- Rod (horizontal) ---
  const rod = document.createElementNS(NS,'rect');
  rod.setAttribute('x', s(62)); rod.setAttribute('y', s(H/2 - 3));
  rod.setAttribute('width', s(W-62)); rod.setAttribute('height', s(6));
  rod.setAttribute('fill','#888');

  // --- Rod tip (end block) ---
  const rodTip = document.createElementNS(NS,'rect');
  rodTip.setAttribute('x', s(W));
  rodTip.setAttribute('y', s(H/2 - 6));
  rodTip.setAttribute('width', s(10));
  rodTip.setAttribute('height', s(12));
  rodTip.setAttribute('fill','#666');

  // --- Spring (drawn on the right pushing left) ---
  // Fixed anchor at right inner wall; purely cosmetic symbol
  const spring = document.createElementNS(NS,'path');
  const springY = H/2;
  const springX0 = W - 28; // start near right wall
  const seg = 10;
  const springPath = [
    `M ${s(springX0)} ${s(springY)}`,
    `l ${s(-seg)} ${s(-8)}`,
    `l ${s(-seg)} ${s(16)}`,
    `l ${s(-seg)} ${s(-16)}`,
    `l ${s(-seg)} ${s(16)}`
  ].join(' ');
  spring.setAttribute('d', springPath);
  spring.setAttribute('fill','none');
  spring.setAttribute('stroke','#000');
  spring.setAttribute('stroke-width', s(2));

  // --- Ports (only A) ---
  // Position A on left for 'push', on right for 'pull'
  const A_cx = (initialMode === 'pull') ? (W - 12) : 12;
  const ports = { A: { cx: A_cx, cy: H + PORT_MARGIN } };
  const portEls = {};
  const portTextEls = {};
  Object.keys(ports).forEach(key=>{
    const p = ports[key];
    const c = document.createElementNS(NS,'circle');
    c.setAttribute('class','port'); c.setAttribute('r', s(6));
    c.setAttribute('cx', s(p.cx)); c.setAttribute('cy', s(p.cy));
    c.addEventListener('click', (e)=>{ e.stopPropagation(); handlePortClick(comp, key, c); });

    const t = document.createElementNS(NS,'text');
    t.setAttribute('x', s(p.cx)); t.setAttribute('y', s(p.cy - 8));
    t.setAttribute('text-anchor','middle');
    t.setAttribute('font-size', Math.max(9, 10*SCALE));
    t.textContent = key;

    g.append(c, t);
    portEls[key] = c;
    portTextEls[key] = t;
  });

  // Mount graphics
  g.append(body, piston, rod, rodTip, spring);
  svg.appendChild(g);
  el.appendChild(svg);
  compLayer.appendChild(el);

  // ===== Component object =====
  const comp = {
    id, type:'cylSingle', el, x, y,
    svgW: s(SVG_W), svgH: s(SVG_H), gx: s(GX), gy: s(GY),
    ports: {
      A: { cx: s(ports.A.cx), cy: s(ports.A.cy), el: portEls.A }
    },

    // Position (0=retracted, 1=extended)
    pos: normallyExtended ? 1 : 0,

  // persistable properties
  mode: initialMode,
  normallyExtended: normallyExtended,

    // Letter / signals
    letter: initialLetter,
    lower: initialLetter.toLowerCase(),

    setPos(alpha){
      this.pos = Math.max(0, Math.min(1, alpha));

      // Piston x: travel range inside body (approx like your double)
      const travelStart = 10;           // where piston is when retracted
      const travelEnd   = W - 20;       // near right
      const px = travelStart + this.pos * (travelEnd - travelStart);

      piston.setAttribute('x', s(px));

      const rodX = px + 6;
      const tipX = px + (W - 10);
      const rodW = Math.max(0, tipX - rodX);

      rod.setAttribute('x', s(rodX));
      rod.setAttribute('width', s(rodW));
      rodTip.setAttribute('x', s(tipX));

      // --- Signals ---
      if (this.pos <= 0) {          // fully retracted
        setSignal(`${this.lower}0`, true);
        setSignal(`${this.lower}1`, false);
      } else if (this.pos >= 1) {   // fully extended
        setSignal(`${this.lower}0`, false);
        setSignal(`${this.lower}1`, true);
      } else {                      // mid
        setSignal(`${this.lower}0`, false);
        setSignal(`${this.lower}1`, false);
      }
    },

    setLetter(newLetterRaw){
      if (!newLetterRaw) return;
      const L = String(newLetterRaw).trim().toUpperCase();
      if (!/^[A-Z]$/.test(L)) return;

      const prevLower = this.lower;
      const nextLower = L.toLowerCase();

      // Clear previous signal keys
      setSignal(`${prevLower}0`, false);
      setSignal(`${prevLower}1`, false);

      this.letter = L;
      this.lower  = nextLower;

  labelText.textContent = `Cylinder ${this.letter} (single-acting)`;
  modeBtn.textContent = this.mode === 'push' ? 'push' : 'pull';

      // Re-publish current state under new keys
      this.setPos(this.pos);
      redrawConnections?.();
    },

    getLetter(){ return this.letter; }
  };

    // Init label & position/signals
  comp.setLetter(initialLetter);
  comp.setPos(comp.pos);

    // expose the mode button so the outer UI can hide/show it during simulation
    comp.modeBtn = modeBtn;

  // mode toggle handler — move port and set default position
  modeBtn.addEventListener('click', (e)=>{
    e.stopPropagation();
    comp.mode = (comp.mode === 'push') ? 'pull' : 'push';
    modeBtn.textContent = comp.mode === 'push' ? 'push' : 'pull';

    // move port to other end
    const newCx = (comp.mode === 'pull') ? (W - 12) : 12;
    const pEl = portEls.A; const tEl = portTextEls.A;
    pEl.setAttribute('cx', s(newCx));
    tEl.setAttribute('x', s(newCx));
    comp.ports.A.cx = s(newCx);

    // when switching to pull, default to extended; when switching to push, default to retracted
    comp.normallyExtended = (comp.mode === 'pull');
    comp.setPos(comp.normallyExtended ? 1 : 0);

    redrawConnections?.();
  });

  // Letter edit on dblclick
  label.addEventListener('dblclick', (e)=>{
    e.stopPropagation();
    const answer = window.prompt('Enter cylinder letter (A–Z):', comp.letter);
    if (answer === null) return;
    comp.setLetter(answer);
  });

  makeDraggable(comp);
  components.push(comp);
  redrawConnections();
  return comp;
}
