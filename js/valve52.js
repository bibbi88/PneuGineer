// js/valve52.js — lightweight, pushButton-like structure
// Fixed ports 1/2/3/4/5; boxes/arrows + pilot triangles AND pilot ports (12/14) slide together.
// Pilot 12 (right) and 14 (left) have inward-pointing triangles and:
//  - a short line from triangle tip to the housing wall, and
//  - a horizontal link line from the pilot PORT to the triangle's wall line (x=0 or x=BODY_W).
// Starts in state=1 (right image), i.e. inner content shifted by -W.

export function addValve52(
  x, y,
  compLayer, components, handlePortClick, makeDraggable, redrawConnections, uid
){
  const id = uid();

  // ======= Geometry (scalable) =======
  const scale   = 1;
  const W0      = 80;   // single cell width
  const H0      = 60;   // single cell height
  const CELLS   = 2;    // 2 cells for a 5/2 valve

  // SVG offset inside the component DOM (kept for wiring compatibility)
  const gx0     = 115;
  const gy0     = 0;

  const W       = W0 * scale;               // scaled cell width
  const H       = H0 * scale;               // scaled cell height
  const BODY_W  = W * CELLS;                // housing total width (2 cells)
  const BODY_H  = H;
  const SVG_W   = BODY_W + 110 * scale;     // extra for labels/triangles
  const SVG_H   = BODY_H;

  const STROKE  = 2 * scale;
  const FONT    = 10 * scale;
  const PORT_R  = 6 * scale;

  // Pilot triangle dimensions
  const TRI_H   = BODY_H / 4;               // ≈ 1/3 of housing height
  const TRI_W   = TRI_H * 1.2;
  const TRI_GAP = 7;                // gap from housing wall to triangle tip

  // How far pilot ports sit away from the housing (positive = farther from housing)
  const PILOT_PORT_OFFSET = 24 * scale;     // tweak to move ports 12/14 farther/closer

  // ======= Fixed port locations (relative to gRoot local coords; WITHOUT gx/gy) =======
  // 4,2 at top; 5,1,3 at bottom
  const portsFixed = {
    "4": { cx: 10*scale,          cy: -10*scale },
    "2": { cx: (W0-10)*scale,     cy: -10*scale },
    "5": { cx: 10*scale,          cy: (H0+10)*scale },
    "1": { cx: (W0/2)*scale,      cy: (H0+10)*scale },
    "3": { cx: (W0-10)*scale,     cy: (H0+10)*scale }
  };

  // Pilot triangle wall anchors (in gInner local coords; slide with state)
  // Left wall at x=0; right wall at x=BODY_W
  const pilotCY   = (H0/2)*scale;
  const triBase14 = { wallX: 0,       cy: pilotCY };       // left wall line x
  const triBase12 = { wallX: BODY_W,  cy: pilotCY };       // right wall line x

  // Pilot PORT centers (further from housing; in gInner local coords initially)
  const port14LocalX = (-15*scale - PILOT_PORT_OFFSET);             // left side (negative is left)
  const port12LocalX = (W0*2 + 15)*scale + PILOT_PORT_OFFSET;       // right side (positive is right)

  // ======= Wrapper =======
  const el = document.createElement('div');
  el.className = 'comp';
  el.dataset.compId = id;
  el.style.left = x + 'px';
  el.style.top  = y + 'px';

  const label = document.createElement('div');
  label.className = 'label';
  label.textContent = '5/2 valve';

  const NS  = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.classList.add('compSvg');
  svg.setAttribute('width',  String(SVG_W));
  svg.setAttribute('height', String(SVG_H));
  svg.style.overflow = 'visible';

  // ======= Defs: double-headed arrow marker =======
  const defs = document.createElementNS(NS,'defs');
  const m = document.createElementNS(NS,'marker');
  m.setAttribute('id','arr');
  m.setAttribute('viewBox','0 0 10 10');
  m.setAttribute('refX','10');
  m.setAttribute('refY','5');
  m.setAttribute('markerWidth',  String(6*scale));
  m.setAttribute('markerHeight', String(6*scale));
  m.setAttribute('orient','auto-start-reverse');
  const mp = document.createElementNS(NS,'path');
  mp.setAttribute('d','M 0 0 L 10 5 L 0 10 z');
  mp.setAttribute('fill','#000');
  m.appendChild(mp);
  defs.appendChild(m);
  svg.appendChild(defs);

  // ======= Layers: gRoot (fixed), gInner (slides) =======
  const gRoot  = document.createElementNS(NS,'g');
  gRoot.setAttribute('transform', `translate(${gx0*scale},${gy0*scale})`);

  // Single moving group (pushButton-like)
  const gInner = document.createElementNS(NS,'g');
  gInner.classList.add('inner'); // CSS tip: .comp .inner { transition: transform 160ms ease-in-out; }

  // ======= Slide content (boxes + arrows) — slides with state =======
  const gSlide = document.createElementNS(NS,'g');

  // helper: double-headed arrow
  function addDoubleArrow(parent, x1,y1, x2,y2){
    const line = document.createElementNS(NS,'line');
    line.setAttribute('x1', String(x1));
    line.setAttribute('y1', String(y1));
    line.setAttribute('x2', String(x2));
    line.setAttribute('y2', String(y2));
    line.setAttribute('stroke','#000');
    line.setAttribute('stroke-width', String(STROKE));
    line.setAttribute('marker-start','url(#arr)');
    line.setAttribute('marker-end','url(#arr)');
    parent.appendChild(line);
  }

  // Cell 0 (left image)
  const cell0 = document.createElementNS(NS,'g');
  const r0 = document.createElementNS(NS,'rect');
  r0.setAttribute('x','0'); r0.setAttribute('y','0');
  r0.setAttribute('width',  String(W));
  r0.setAttribute('height', String(H));
  r0.setAttribute('fill','#fff');
  r0.setAttribute('stroke','#000');
  r0.setAttribute('stroke-width', String(STROKE));
  cell0.appendChild(r0);
  addDoubleArrow(cell0, (W0/2)*scale, H, 10*scale, 0);
  addDoubleArrow(cell0, (W0-10)*scale, 0, (W0-10)*scale, H);

  // Cell 1 (right image)
  const cell1 = document.createElementNS(NS,'g');
  cell1.setAttribute('transform', `translate(${W},0)`);
  const r1 = document.createElementNS(NS,'rect');
  r1.setAttribute('x','0'); r1.setAttribute('y','0');
  r1.setAttribute('width',  String(W));
  r1.setAttribute('height', String(H));
  r1.setAttribute('fill','#fff');
  r1.setAttribute('stroke','#000');
  r1.setAttribute('stroke-width', String(STROKE));
  cell1.appendChild(r1);
  addDoubleArrow(cell1, (W0/2)*scale, H, (W0-10)*scale, 0);
  addDoubleArrow(cell1, 10*scale, 0, 10*scale, H);

  gSlide.append(cell0, cell1);

  // ======= Pilot geometry (triangles + wall lines + ports + horizontal link lines) in gInner =======
  function addTriangleAndWallLine(parent, side /* 'left'|'right' */, cy){
    const poly = document.createElementNS(NS,'polygon');
    poly.setAttribute('fill','none'); // change to '#000' for filled triangle
    poly.setAttribute('stroke','#000');
    poly.setAttribute('stroke-width', String(STROKE));

    const ln = document.createElementNS(NS,'line'); // triangle tip -> housing wall
    ln.setAttribute('stroke','#000');
    ln.setAttribute('stroke-width', String(STROKE));

    if (side === 'left') {
      // inward arrow →, housing left wall is x=0 in gInner
      const tipX = 0 - TRI_GAP;
      const pts = [
        [tipX,            cy],
        [tipX - TRI_W,    cy - TRI_H/2],
        [tipX - TRI_W,    cy + TRI_H/2]
      ];
      poly.setAttribute('points', pts.map(p=>p.join(',')).join(' '));
      ln.setAttribute('x1', String(tipX));
      ln.setAttribute('y1', String(cy));
      ln.setAttribute('x2', '0');
      ln.setAttribute('y2', String(cy));
      parent.append(poly, ln);
    } else {
      // inward arrow ←, housing right wall is x=BODY_W in gInner
      const tipX = BODY_W + TRI_GAP;
      const pts = [
        [tipX,            cy],
        [tipX + TRI_W,    cy - TRI_H/2],
        [tipX + TRI_W,    cy + TRI_H/2]
      ];
      poly.setAttribute('points', pts.map(p=>p.join(',')).join(' '));
      ln.setAttribute('x1', String(tipX));
      ln.setAttribute('y1', String(cy));
      ln.setAttribute('x2', String(BODY_W));
      ln.setAttribute('y2', String(cy));
      parent.append(poly, ln);
    }
  }

  function makePort(parent, key, cx, cy, clickableEl){
    const c = document.createElementNS(NS,'circle');
    c.setAttribute('class','port');
    c.setAttribute('r',  String(PORT_R));
    c.setAttribute('cx', String(cx));
    c.setAttribute('cy', String(cy));

    const t = document.createElementNS(NS,'text');
    t.setAttribute('x', String(cx));
    t.setAttribute('y', String(cy - 10*scale));
    t.setAttribute('text-anchor','middle');
    t.setAttribute('font-size', String(FONT));
    t.textContent = key;

    const clickable = clickableEl || c;
    clickable.addEventListener('click', e=>{
      e.stopPropagation();
      handlePortClick(comp, key, c);
    });

    parent.append(c, t);
    return c;
  }

  // Pilot groups (move with gInner)
  const gP14 = document.createElementNS(NS,'g'); // left pilot (14)
  const gP12 = document.createElementNS(NS,'g'); // right pilot (12)

  // Triangles + short wall lines
  addTriangleAndWallLine(gP14, 'left',  pilotCY);
  addTriangleAndWallLine(gP12, 'right', pilotCY);

  // Horizontal link lines from PORT -> triangle wall line (strictly horizontal)
  const link14 = document.createElementNS(NS,'line');
  link14.setAttribute('x1', String(port14LocalX + PORT_R)); // from port edge
  link14.setAttribute('y1', String(pilotCY));
  link14.setAttribute('x2', String(-TRI_GAP - TRI_W));                            // to left wall (x=0)
  link14.setAttribute('y2', String(pilotCY));
  link14.setAttribute('stroke','#000');
  link14.setAttribute('stroke-width', String(STROKE));
  gP14.appendChild(link14);

  const link12 = document.createElementNS(NS,'line');
  link12.setAttribute('x1', String(BODY_W+TRI_GAP+TRI_W));                 // from right wall (x=BODY_W)
  link12.setAttribute('y1', String(pilotCY));
  link12.setAttribute('x2', String(port12LocalX - PORT_R)); // to port edge
  link12.setAttribute('y2', String(pilotCY));
  link12.setAttribute('stroke','#000');
  link12.setAttribute('stroke-width', String(STROKE));
  gP12.appendChild(link12);

  // Pilot ports (placed farther away from housing) — still in gInner coords
  const p14El = makePort(gP14, '14', port14LocalX, pilotCY);
  const p12El = makePort(gP12, '12', port12LocalX, pilotCY);

  // ======= Fixed ports (do NOT move with state) =======
  const gFixedPorts = document.createElementNS(NS,'g');
  const fixedPortEls = {};
  for (const key of Object.keys(portsFixed)){
    const p = portsFixed[key];
    fixedPortEls[key] = makePort(gFixedPorts, key, p.cx, p.cy);
  }

  // ======= Assemble layers =======
  gRoot.append(gFixedPorts, gInner);
  gInner.append(gSlide, gP12, gP14);

  svg.appendChild(gRoot);
  el.append(label, svg);
  compLayer.appendChild(el);

  // ======= Component object (small API, pushButton-like) =======
  const comp = {
    id,
    type: 'valve52',
    el, x, y,

    // Expose offsets and SVG size for wiring/snap compatibility
    gx: gx0 * scale,
    gy: gy0 * scale,
    svgW: SVG_W,
    svgH: SVG_H,

    // 0 = left image, 1 = right image
    state: 1,
    // corresponds to state=1 -> shift gInner by -W
    shift: -W,

    // Port coordinates are in gRoot-local coords (WITHOUT gx/gy).
    ports: {
      "4":  { cx: portsFixed["4"].cx,  cy: portsFixed["4"].cy,  el: fixedPortEls["4"]  },
      "2":  { cx: portsFixed["2"].cx,  cy: portsFixed["2"].cy,  el: fixedPortEls["2"]  },
      "5":  { cx: portsFixed["5"].cx,  cy: portsFixed["5"].cy,  el: fixedPortEls["5"]  },
      "1":  { cx: portsFixed["1"].cx,  cy: portsFixed["1"].cy,  el: fixedPortEls["1"]  },
      "3":  { cx: portsFixed["3"].cx,  cy: portsFixed["3"].cy,  el: fixedPortEls["3"]  },

      // Pilot ports: convert from gInner-local to gRoot-local by adding current shift
      "12": { cx: port12LocalX + (-W),  cy: pilotCY,  el: p12El },
      "14": { cx: port14LocalX + (-W),  cy: pilotCY,  el: p14El }
    },

    // Move only the inner content horizontally (single place to manipulate)
    setShift(dx){
      this.shift = dx|0;
      gInner.setAttribute('transform', `translate(${this.shift},0)`);
      // keep 12/14 connection coordinates updated (still in gRoot-local coords)
      this.ports["12"].cx = port12LocalX + this.shift;
      this.ports["14"].cx = port14LocalX + this.shift;
      redrawConnections();
    },

    // Set logical state (0/1) -> map to shift 0 / -W
    setState(s){
      this.state = s ? 1 : 0;
      const dx = (this.state === 0) ? 0 : -W;
      this.setShift(dx);
    },

    toggle(){
      this.setState(1 - this.state);
    },

    // Move the whole component (DOM)
    setPos(nx, ny){
      this.x = nx|0; this.y = ny|0;
      el.style.left = this.x + 'px';
      el.style.top  = this.y + 'px';
      redrawConnections();
    },

    getBounds(){
      return { x: this.x, y: this.y, w: SVG_W, h: SVG_H };
    },

    setSelected(sel){
      if (sel) el.classList.add('selected'); else el.classList.remove('selected');
    }
  };

  // ======= Simple manual toggle (click either box) =======
  r0.addEventListener('click', ()=> comp.toggle());
  r1.addEventListener('click', ()=> comp.toggle());

  // ======= Init =======
  comp.setState(1);     // start at state 1 (right image)

  makeDraggable(comp);
  components.push(comp);
  return comp;
}
