// js/andValve.js
// AND (Two-pressure) – ISO/Festo style.
// Port layout: A (left side), B (right side), OUT (top).
// Links: A/B enter horizontally from the sides, OUT exits vertically from the top.

const SCALE = 1;

export function addAndValve(
  x, y,
  compLayer, components,
  handlePortClick, makeDraggable, redrawConnections, uid
){
  const id = uid();
  const s = (n)=> n * SCALE;

  // Geometri
  const SVG_W=200, SVG_H=180, GX=10, GY=20;
  const HUS_X=40, HUS_Y=60, HUS_W=100, HUS_H=60;

  const NS = 'http://www.w3.org/2000/svg';

  // Rot
  const el = document.createElement('div');
  el.className = 'comp';
  el.style.left = x + 'px';
  el.style.top  = y + 'px';

  const svg = document.createElementNS(NS,'svg');
  svg.classList.add('compSvg');
  svg.setAttribute('width',  s(SVG_W));
  svg.setAttribute('height', s(SVG_H));

  const g = document.createElementNS(NS,'g');
  g.setAttribute('transform', `translate(${s(GX)},${s(GY)})`);

  // Hjälpare
  const line = (x1,y1,x2,y2)=>{
    const l = document.createElementNS(NS,'line');
    l.setAttribute('x1', s(x1)); l.setAttribute('y1', s(y1));
    l.setAttribute('x2', s(x2)); l.setAttribute('y2', s(y2));
    l.setAttribute('stroke','#000'); l.setAttribute('stroke-width', s(2));
    return l;
  };
  const rect = (x,y,w,h)=>{
    const r = document.createElementNS(NS,'rect');
    r.setAttribute('x', s(x)); r.setAttribute('y', s(y));
    r.setAttribute('width', s(w)); r.setAttribute('height', s(h));
    r.setAttribute('fill','#fff'); r.setAttribute('stroke','#000'); r.setAttribute('stroke-width', s(2));
    return r;
  };

  // Hus
  const hus = rect(HUS_X, HUS_Y, HUS_W, HUS_H);

  const yMid   = HUS_Y + HUS_H/2;
  const leftX  = HUS_X + 35;
  const rightX = HUS_X + HUS_W - 35;

  // Check valves toward the center (simple drawing)
  const lBlock1 = line(leftX-20,   HUS_Y, leftX-20,   HUS_Y+23);
  const lShuttle = line(leftX-27,   HUS_Y+15, leftX-27,   HUS_Y+HUS_H-15);
  const lBlock2 = line(leftX-20,   HUS_Y+HUS_H, leftX-20,   HUS_Y+HUS_H-23);

  const rBlock1 = line(rightX+20,  HUS_Y, rightX+20, HUS_Y+23);
  const rShuttle = line(rightX+27,   HUS_Y+15, rightX+27,   HUS_Y+HUS_H-15);
  const rBlock2 = line(rightX+20, HUS_Y+HUS_H, rightX+20, HUS_Y+HUS_H-23);

  const hShuttle = line(leftX-27,  yMid, rightX+27,   yMid);

  // === Port points: A (left), B (right), OUT (top) ===
  const LEFT_PORT_X  = HUS_X - 20;           // port center left
  const RIGHT_PORT_X = HUS_X + HUS_W + 20;   // port center right
  const TOP_PORT_Y   = HUS_Y - 20;           // portcentrum ovanför hus

  const A   = { cx: LEFT_PORT_X,  cy: yMid };
  const B   = { cx: RIGHT_PORT_X, cy: yMid };
  const OUT = { cx: HUS_X + HUS_W/2, cy: TOP_PORT_Y };

  // Inre anslutningslinjer
  const aLine = line(HUS_X,        A.cy,   A.cx+6, A.cy);
  const bLine = line(HUS_X+HUS_W,  B.cy,   B.cx-6, B.cy);
  const outLn = line(OUT.cx,       OUT.cy+6, OUT.cx, HUS_Y);

  g.append(hus,
           lBlock1, lShuttle, lBlock2,
           rBlock1, rShuttle, rBlock2,
           hShuttle,
           aLine, bLine, outLn);

  // Ports (clickable) with smart text placement
  function makePort(key, p, side){ // side: 'L' | 'R' | 'T'
    const c = document.createElementNS(NS,'circle');
    c.setAttribute('class','port'); c.setAttribute('r', s(6));
    c.setAttribute('cx', s(p.cx)); c.setAttribute('cy', s(p.cy));
    c.addEventListener('click', (e)=>{ e.stopPropagation(); handlePortClick(comp, key, c); });

    const t = document.createElementNS(NS,'text');
  // Place all port labels to the left of the port
  t.setAttribute('x', s(p.cx - 14));
  t.setAttribute('y', s(p.cy + 4));
  t.setAttribute('text-anchor','end');
    t.setAttribute('font-size', Math.max(9, 11*SCALE));
    t.textContent = key;

    return { c, t };
  }

  const a   = makePort('A',   A,   'L');
  const b   = makePort('B',   B,   'R');
  const out = makePort('OUT', OUT, 'T');
  g.append(a.c, a.t, b.c, b.t, out.c, out.t);

  // Montera
  svg.appendChild(g);
  el.append(svg);
  compLayer.appendChild(el);

  // Komponent-API
  const comp = {
    id, type:'andValve', el, x, y,
    svgW: s(SVG_W), svgH: s(SVG_H),
    gx: s(GX), gy: s(GY),
    ports: {
      OUT:{ cx: s(OUT.cx), cy: s(OUT.cy), el: out.c },
      A:  { cx: s(A.cx),   cy: s(A.cy),   el: a.c },
      B:  { cx: s(B.cx),   cy: s(B.cy),   el: b.c }
    }
  };

  makeDraggable(comp);
  components.push(comp);
  redrawConnections();
  return comp;
}
