// js/andValve.js
// AND (Two-pressure) – ISO/Festo-stil. Ingångar A/B nere, OUT uppe.
// Justera storlek för ALLA AND-ventiler här:
const SCALE = 1;

export function addAndValve(x, y, compLayer, components, handlePortClick, makeDraggable, redrawConnections, uid){
  const id = uid();
  const s = (n)=> n * SCALE;

  const SVG_W=180, SVG_H=180, GX=10, GY=20;
  const HUS_X=30, HUS_Y=60, HUS_W=130, HUS_H=70;

  const el = document.createElement('div');
  el.className = 'comp';
  el.style.left = x + 'px';
  el.style.top  = y + 'px';

  const label = document.createElement('div');
  label.className = 'label';
  label.textContent = 'AND (Two-pressure)';

  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS,'svg');
  svg.classList.add('compSvg');
  svg.setAttribute('width',  s(SVG_W));
  svg.setAttribute('height', s(SVG_H));

  const g = document.createElementNS(NS,'g');
  g.setAttribute('transform', `translate(${s(GX)},${s(GY)})`);

  // Hus
  const hus = document.createElementNS(NS,'rect');
  hus.setAttribute('x', s(HUS_X)); hus.setAttribute('y', s(HUS_Y));
  hus.setAttribute('width', s(HUS_W)); hus.setAttribute('height', s(HUS_H));
  hus.setAttribute('fill','#fff'); hus.setAttribute('stroke','#000'); hus.setAttribute('stroke-width', s(2));

  const yMid   = HUS_Y + HUS_H/2;
  const leftX  = HUS_X + 35;
  const rightX = HUS_X + HUS_W - 35;

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
  const circle = (cx,cy,r)=>{
    const c = document.createElementNS(NS,'circle');
    c.setAttribute('cx', s(cx)); c.setAttribute('cy', s(cy)); c.setAttribute('r', s(r));
    c.setAttribute('fill','#fff'); c.setAttribute('stroke','#000'); c.setAttribute('stroke-width', s(2));
    return c;
  };

  // Backventiler mot centrum (kula + sned säte)
  const lRise = line(leftX,   HUS_Y+HUS_H, leftX,  yMid+10);
  const lBall = circle(leftX, yMid+6, 5.5);
  const lSeat = line(leftX+8, yMid-2, leftX+28, yMid-10);

  const rRise = line(rightX,  HUS_Y+HUS_H, rightX, yMid+10);
  const rBall = circle(rightX, yMid+6, 5.5);
  const rSeat = line(rightX-28, yMid-10, rightX-8, yMid-2);

  const topLink = line(leftX+28, yMid-10, rightX-28, yMid-10);
  const chamber = rect(HUS_X + HUS_W/2 - 4, HUS_Y + 12, 8, 18);

  // Portar
  const OUT = { cx: HUS_X + HUS_W/2, cy: HUS_Y - 20 };
  const A   = { cx: leftX,            cy: HUS_Y + HUS_H + 20 };
  const B   = { cx: rightX,           cy: HUS_Y + HUS_H + 20 };

  const outLine = line(OUT.cx, OUT.cy+6, OUT.cx, HUS_Y);
  const aLine   = line(A.cx,   HUS_Y+HUS_H, A.cx, A.cy-6);
  const bLine   = line(B.cx,   HUS_Y+HUS_H, B.cx, B.cy-6);

  g.append(hus,
           lRise, lBall, lSeat,
           rRise, rBall, rSeat,
           topLink, chamber,
           outLine, aLine, bLine);

  function makePort(key, p){
    const c = document.createElementNS(NS,'circle');
    c.setAttribute('class','port'); c.setAttribute('r', s(6));
    c.setAttribute('cx', s(p.cx)); c.setAttribute('cy', s(p.cy));
    c.addEventListener('click', (e)=>{ e.stopPropagation(); handlePortClick(comp, key, c); });

    const t = document.createElementNS(NS,'text');
    t.setAttribute('x', s(p.cx));
    t.setAttribute('y', s(key==='OUT' ? p.cy - 10 : p.cy + 20));
    t.setAttribute('text-anchor','middle');
    t.setAttribute('font-size', Math.max(9, 11*SCALE));
    t.textContent = key;
    return { c, t };
  }
  const out = makePort('OUT', OUT);
  const a   = makePort('A',   A);
  const b   = makePort('B',   B);
  g.append(out.c, out.t, a.c, a.t, b.c, b.t);

  svg.appendChild(g);
  el.append(label, svg);
  compLayer.appendChild(el);

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
