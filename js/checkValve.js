
// js/checkValve.js
// Backventil (check valve). Portar: IN nere, OUT uppe. Släpper IN→OUT, spärr OUT→IN.
// Skala för ALLA backventiler:
const SCALE = 0.5;

export function addCheckValve(
  x, y,
  compLayer, components, handlePortClick, makeDraggable, redrawConnections, uid
){
  const id = uid();
  const s = (n)=> n * SCALE;

  const SVG_W=120, SVG_H=140, GX=10, GY=20;

  const el = document.createElement('div');
  el.className = 'comp';
  el.style.left = x + 'px';
  el.style.top  = y + 'px';

  const label = document.createElement('div');
  label.className = 'label';
  label.textContent = 'Backventil';

  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS,'svg');
  svg.classList.add('compSvg');
  svg.setAttribute('width',  s(SVG_W));
  svg.setAttribute('height', s(SVG_H));

  const g = document.createElementNS(NS,'g');
  g.setAttribute('transform', `translate(${s(GX)},${s(GY)})`);

  // Hus
  const HUS_X=20, HUS_Y=40, HUS_W=80, HUS_H=60;
  const hus = document.createElementNS(NS,'rect');
  hus.setAttribute('x', s(HUS_X));
  hus.setAttribute('y', s(HUS_Y));
  hus.setAttribute('width',  s(HUS_W));
  hus.setAttribute('height', s(HUS_H));
  hus.setAttribute('fill','#fff');
  hus.setAttribute('stroke','#000');
  hus.setAttribute('stroke-width', s(2));

  // Kula + säte (ISO-stil) – flöde uppåt
  const cx = HUS_X + HUS_W/2;
  const yMid = HUS_Y + HUS_H/2;
  const ball = document.createElementNS(NS,'circle');
  ball.setAttribute('cx', s(cx));
  ball.setAttribute('cy', s(yMid+6));
  ball.setAttribute('r',  s(5.5));
  ball.setAttribute('fill','#fff');
  ball.setAttribute('stroke','#000');
  ball.setAttribute('stroke-width', s(2));

  const seat = document.createElementNS(NS,'line'); // sned sätesyta ↑
  seat.setAttribute('x1', s(cx-14)); seat.setAttribute('y1', s(yMid-8));
  seat.setAttribute('x2', s(cx+14)); seat.setAttribute('y2', s(yMid));
  seat.setAttribute('stroke','#000'); seat.setAttribute('stroke-width', s(2));

  // Portar: OUT uppe, IN nere
  const OUT = { cx: cx, cy: HUS_Y-18 };
  const IN  = { cx: cx, cy: HUS_Y+HUS_H+18 };

  const line = (x1,y1,x2,y2)=>{
    const l = document.createElementNS(NS,'line');
    l.setAttribute('x1', s(x1)); l.setAttribute('y1', s(y1));
    l.setAttribute('x2', s(x2)); l.setAttribute('y2', s(y2));
    l.setAttribute('stroke','#000'); l.setAttribute('stroke-width', s(2));
    return l;
  };

  const outLine = line(OUT.cx, OUT.cy+6, OUT.cx, HUS_Y);
  const inLine  = line(IN.cx,  HUS_Y+HUS_H, IN.cx,  IN.cy-6);

  function makePort(key, p, labelBelow=false){
    const c = document.createElementNS(NS,'circle');
    c.setAttribute('class','port'); c.setAttribute('r', s(6));
    c.setAttribute('cx', s(p.cx)); c.setAttribute('cy', s(p.cy));
    c.addEventListener('click', (e)=>{ e.stopPropagation(); handlePortClick(comp, key, c); });
    const t = document.createElementNS(NS,'text');
    t.setAttribute('x', s(p.cx));
    t.setAttribute('y', s(labelBelow ? p.cy+18 : p.cy-10));
    t.setAttribute('text-anchor','middle');
    t.setAttribute('font-size', Math.max(9, 11*SCALE));
    t.textContent = key;
    return { c, t };
  }
  const out = makePort('OUT', OUT, false);
  const inp = makePort('IN',  IN,  true);

  g.append(hus, ball, seat, outLine, inLine, out.c, out.t, inp.c, inp.t);
  svg.appendChild(g);
  el.append(label, svg);
  compLayer.appendChild(el);

  const comp = {
    id, type:'checkValve', el, x, y,
    svgW: s(SVG_W), svgH: s(SVG_H), gx: s(GX), gy: s(GY),
    ports: {
      IN:  { cx: s(IN.cx),  cy: s(IN.cy),  el: inp.c },
      OUT: { cx: s(OUT.cx), cy: s(OUT.cy), el: out.c }
    }
  };

  makeDraggable(comp);
  components.push(comp);
  redrawConnections();
  return comp;
}
