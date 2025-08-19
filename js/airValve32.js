// js/airValve32.js
// Air-piloted 3/2 with spring return, built to MATCH the pushButton32 geometry.
// - Whole valve "mover" (frame, inner boxes, pilot wall/triangle, spring, AND pilot port 14) slides.
// - Ports 1/2/3 are static (as in pushButton32).
// - Horizontal pilot link goes FROM the left wall (x=0) TO port 14 (x<0), inside the mover.
//
// States (same semantics as pushbutton):
//   ACTIVE (left cell under the ports):   2 → 1,   3 is blocked (T)
//   INACTIVE (right cell under the ports): 2 → 3,   1 is blocked (T)
//
// Public API:
//   addAirValve32(x, y, compLayer, components, handlePortClick, makeDraggable, redrawConnections, uid)
// Component object:
//   comp.type === 'airValve32'
//   comp.state.active : boolean
//   comp.setActive(bool)  // also aliased as setState(0/1)

export function addAirValve32(
  x, y,
  compLayer, components,
  handlePortClick, makeDraggable, redrawConnections,
  uid
){
  const id = uid();

  // ==== Geometry (same basis as pushButton32) ====
  const W = 140, H = 60;
  const NS = 'http://www.w3.org/2000/svg';
  const midX = W / 2;

  // Static ports (1/2/3) — identical positions to pushButton32
  const insetRight = Math.round((W - midX) * 0.25); // ~¼ into right half
  const P2 = { cx: midX + insetRight, cy: -10  };   // 2 (top)
  const P1 = { cx: midX + insetRight, cy: H + 10 }; // 1 (bottom)
  const P3 = { cx: W - 12,            cy: H + 10 }; // 3 (bottom right)

  // Mirror positions for the left cell graphics
  const L2 = { cx: insetRight, cy: P2.cy };
  const L1 = { cx: insetRight, cy: P1.cy };
  const L3 = { cx: midX - 12,  cy: P3.cy };

  // Pilot port 14: local coords relative to the MOVER (so it moves with the valve)
  const P14_LOCAL = { cx: -40, cy: H/2 }; // to the left of the body wall (x=0 in mover)

  // ==== Root wrapper ====
  const el = document.createElement('div');
  el.className = 'comp';
  el.style.left = x + 'px';
  el.style.top  = y + 'px';

  const label = document.createElement('div');
  label.className = 'label';
  label.textContent = '';
  el.appendChild(label);

  const svg = document.createElementNS(NS,'svg');
  svg.classList.add('compSvg');
  svg.setAttribute('width',  W);
  svg.setAttribute('height', H);
  svg.style.overflow = 'visible';

  // ---- defs: arrow head (same as pushbutton) ----
  const defs = document.createElementNS(NS,'defs');
  const marker = document.createElementNS(NS,'marker');
  marker.setAttribute('id','arrow');
  marker.setAttribute('markerWidth','10');
  marker.setAttribute('markerHeight','10');
  marker.setAttribute('refX','9');
  marker.setAttribute('refY','5');
  marker.setAttribute('orient','auto');
  const mpath = document.createElementNS(NS,'path');
  mpath.setAttribute('d','M 0 0 L 10 5 L 0 10 z');
  mpath.setAttribute('fill','#000');
  marker.appendChild(mpath);
  defs.append(marker);
  svg.appendChild(defs);

  // ==== MOVER: everything that slides (frame, inner boxes, pilot wall/triangle, spring, pilot port 14 + link) ====
  const mover = document.createElementNS(NS,'g');

  // Body frame
  const body = document.createElementNS(NS,'rect');
  body.setAttribute('x',0); body.setAttribute('y',0);
  body.setAttribute('width',W); body.setAttribute('height',H);
  body.setAttribute('fill','#fff'); body.setAttribute('stroke','#000');
  body.setAttribute('stroke-width','2');

  // helpers
  const path = (d, opts={})=>{
    const p = document.createElementNS(NS,'path');
    p.setAttribute('d', d);
    p.setAttribute('fill', 'none');
    p.setAttribute('stroke', opts.stroke || '#000');
    p.setAttribute('stroke-width', opts.sw || 2);
    if (opts.arrow === 'end')   p.setAttribute('marker-end','url(#arrow)');
    if (opts.arrow === 'start') p.setAttribute('marker-start','url(#arrow)');
    return p;
  };
  const tBlock = (xCenter, yBar, yStemEnd)=>{
    const frag = document.createDocumentFragment();
    frag.appendChild(path(`M ${xCenter-10} ${yBar} L ${xCenter+10} ${yBar}`));
    frag.appendChild(path(`M ${xCenter} ${yBar} L ${xCenter} ${yStemEnd}`));
    return frag;
  };

  // Inner two boxes
  const boxLeft  = document.createElementNS(NS,'rect');
  boxLeft.setAttribute('x', 0); boxLeft.setAttribute('y', 0);
  boxLeft.setAttribute('width', midX); boxLeft.setAttribute('height', H);
  boxLeft.setAttribute('fill','#fff'); boxLeft.setAttribute('stroke','#000'); boxLeft.setAttribute('stroke-width','1.6');

  const boxRight = document.createElementNS(NS,'rect');
  boxRight.setAttribute('x', midX); boxRight.setAttribute('y', 0);
  boxRight.setAttribute('width', midX); boxRight.setAttribute('height', H);
  boxRight.setAttribute('fill','#fff'); boxRight.setAttribute('stroke','#000'); boxRight.setAttribute('stroke-width','1.6');

  // Left cell (ACTIVE): 2 → 1, block 3
  const gLeft = document.createElementNS(NS,'g');
  gLeft.appendChild(path(`M ${L1.cx} ${L1.cy - 10} L ${L2.cx} ${L2.cy + 10}`, { arrow:'end' }));
  gLeft.appendChild(tBlock(L3.cx, H-18, L3.cy - 8));

  // Right cell (INACTIVE): 2 → 3, block 1
  const gRight = document.createElementNS(NS,'g');
  gRight.appendChild(path(`M ${P2.cx} ${P2.cy + 10} L ${P3.cx} ${P3.cy - 10}`, { arrow:'end' }));
  gRight.appendChild(tBlock(P1.cx, H-18, P1.cy - 8));

  // Spring (right wall), follows the mover — same style as pushbutton
  const spring = document.createElementNS(NS,'g');
  spring.setAttribute('transform', `translate(${W}, ${H/2})`);
  spring.append(
    path(`M 0 0 L 20 0`),
    path(`M 20 0 l 10 -10 l 10 20 l 10 -20 l 10 20`)
  );

  // Pilot wall: vertical bar + inward-pointing triangle at the LEFT body wall (x=0) — lives on the mover
  const pilotWall = document.createElementNS(NS,'g');
  // pilotWall.appendChild(path(`M 0 14 L 0 ${H-14}`)); // vertical bar
  pilotWall.appendChild(path(
    `M -26 ${H/2+8} 
    L -6 ${H/2} 
    L -26 ${H/2 - 8} 
    L -26 ${H/2 + 8} Z`, 
    { stroke:'#000', sw:2 })); // inward triangle

  // Pilot port 14 (MOVES with mover)
  const port14El = document.createElementNS(NS,'circle');
  port14El.setAttribute('class','port');
  port14El.setAttribute('r', 6);
  port14El.setAttribute('cx', P14_LOCAL.cx);
  port14El.setAttribute('cy', P14_LOCAL.cy);
  port14El.addEventListener('click', (e)=>{ e.stopPropagation(); handlePortClick(comp, '14', port14El); });

  // Pilot link: FROM wall (x=0) TO port 14 (x<0) — inside mover
  const pilotLink = path(`M -26 ${P14_LOCAL.cy} L ${P14_LOCAL.cx}  ${P14_LOCAL.cy}`);
  const pilotLink2 = path(`M 0 ${P14_LOCAL.cy} L -6  ${P14_LOCAL.cy}`);

  // Assemble mover
  mover.append(
    body, boxLeft, boxRight, gLeft, gRight,
    pilotWall, pilotLink, pilotLink2, port14El, spring
  );
  svg.appendChild(mover);

  // ==== STATIC PORTS (1/2/3) ====
  const makePort = (pos, key)=>{
    const c = document.createElementNS(NS,'circle');
    c.setAttribute('class','port');
    c.setAttribute('r', 6);
    c.setAttribute('cx', pos.cx);
    c.setAttribute('cy', pos.cy);
    c.addEventListener('click', (e)=>{ e.stopPropagation(); handlePortClick(comp, key, c); });

    const t = document.createElementNS(NS,'text');
    t.setAttribute('x', pos.cx - 14);
    t.setAttribute('y', pos.cy + 4);
    t.setAttribute('text-anchor', 'end');
    t.setAttribute('font-size', '12');
    t.textContent = key;

    svg.appendChild(c);
    svg.appendChild(t);
    return c;
  };
  const port2El  = makePort(P2,  '2');
  const port1El  = makePort(P1,  '1');
  const port3El  = makePort(P3,  '3');

  // (No visible label for pilot port 14 on air-piloted 3/2 — pilot port number hidden)

  // ==== State / programmatic control (pilot-driven) ====
  let isActive = false; // ACTIVE => left cell under ports (2→1). INACTIVE => right cell (2→3)
  let moverDx  = 0;

  function applyTransforms(active){
    moverDx = active ? midX : 0;
    mover.setAttribute('transform', `translate(${moverDx}, 0)`);
    // update cached absolute cx for moving pilot port (used by wiring)
    comp.ports['14'].cx = P14_LOCAL.cx + moverDx;
    comp.ports['14'].cy = P14_LOCAL.cy;
  }

  function setActive(a){
    if (isActive === a) return;
    isActive = a;
    comp.state.active = a;
    applyTransforms(a);
    redrawConnections();
  }

  // ==== Component object ====
  const comp = {
    id, type: 'airValve32',
    el, x, y,
    svgW: W, svgH: H, gx: 0, gy: 0,
    ports: {
      '1':  { cx: P1.cx,          cy: P1.cy,          el: port1El  },
      '2':  { cx: P2.cx,          cy: P2.cy,          el: port2El  },
      '3':  { cx: P3.cx,          cy: P3.cy,          el: port3El  },
      '14': { cx: P14_LOCAL.cx,   cy: P14_LOCAL.cy,   el: port14El } // will be updated by applyTransforms()
    },
    state: { active: false },
    setActive,
    // Backward-compat alias if main.js calls setState(0/1)
    setState(s){ this.setActive(!!s); },
    recompute(){ applyTransforms(isActive); }
  };

  // Mount
  el.appendChild(svg);
  compLayer.appendChild(el);
  el.style.left = `${x}px`; el.style.top  = `${y}px`;

  makeDraggable(comp);
  components.push(comp);

  // Initial pose (INACTIVE)
  applyTransforms(false);

  return comp;
}
