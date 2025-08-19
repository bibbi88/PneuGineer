
// js/checkValve.js
// Check valve. Ports: IN bottom, OUT top. Allows IN→OUT, blocks OUT→IN.
// Scale for ALL check valves:
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
  // label intentionally blank per UI preference
  label.textContent = '';

  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS,'svg');
  svg.classList.add('compSvg');
  svg.setAttribute('width',  s(SVG_W));
  svg.setAttribute('height', s(SVG_H));

  const g = document.createElementNS(NS,'g');
  g.setAttribute('transform', `translate(${s(GX)},${s(GY)})`);

  // Hus
  const HUS_X=20, HUS_Y=40, HUS_W=50, HUS_H=50;
  const hus = document.createElementNS(NS,'rect');
  hus.setAttribute('x', s(HUS_X));
  hus.setAttribute('y', s(HUS_Y));
  hus.setAttribute('width',  s(HUS_W));
  hus.setAttribute('height', s(HUS_H));
  hus.setAttribute('fill','#fff');
  hus.setAttribute('stroke','#000');
  hus.setAttribute('stroke-width', s(3));

  // Ball + seat (ISO style) – flow upwards
  const cx = HUS_X + HUS_W/2;
  const yMid = HUS_Y + HUS_H/2;
  const ball = document.createElementNS(NS,'circle');
  ball.setAttribute('cx', s(cx));
  ball.setAttribute('cy', s(yMid-5));
  ball.setAttribute('r',  s(9));
  ball.setAttribute('fill','#fff');
  ball.setAttribute('stroke','#000');
  ball.setAttribute('stroke-width', s(3));

  const seat = document.createElementNS(NS,'line'); // slanted seat surface ↑
  seat.setAttribute('x1', s(cx-16)); seat.setAttribute('y1', s(yMid-8));
  seat.setAttribute('x2', s(cx)); seat.setAttribute('y2', s(yMid+12));
  seat.setAttribute('stroke','#000'); seat.setAttribute('stroke-width', s(3));

  const seat2 = document.createElementNS(NS,'line'); // slanted seat surface ↑
  seat2.setAttribute('x1', s(cx+16)); seat2.setAttribute('y1', s(yMid-8));
  seat2.setAttribute('x2', s(cx)); seat2.setAttribute('y2', s(yMid+12));
  seat2.setAttribute('stroke','#000'); seat2.setAttribute('stroke-width', s(3));
  // Ports: OUT top, IN bottom
  const OUT = { cx: cx, cy: HUS_Y-10 };
  const IN  = { cx: cx, cy: HUS_Y+HUS_H+10 };

  const line = (x1,y1,x2,y2)=>{
    const l = document.createElementNS(NS,'line');
    l.setAttribute('x1', s(x1)); l.setAttribute('y1', s(y1));
    l.setAttribute('x2', s(x2)); l.setAttribute('y2', s(y2));
    l.setAttribute('stroke','#000'); l.setAttribute('stroke-width', s(3));
    return l;
  };

  const outLine = line(OUT.cx, OUT.cy+22, OUT.cx, HUS_Y);
  const inLine  = line(IN.cx,  HUS_Y+HUS_H, IN.cx,  IN.cy-23);
  outLine.setAttribute('stroke','#000'); outLine.setAttribute('stroke-width', s(3));
  inLine.setAttribute('stroke','#000'); inLine.setAttribute('stroke-width', s(3));

  function makePort(key, p, labelBelow=false){
    const c = document.createElementNS(NS,'circle');
    c.setAttribute('class','port'); c.setAttribute('r', s(7));
    c.setAttribute('cx', s(p.cx)); c.setAttribute('cy', s(p.cy));
    c.addEventListener('click', (e)=>{ e.stopPropagation(); handlePortClick(comp, key, c); });
    const t = document.createElementNS(NS,'text');
    t.setAttribute('x', s(p.cx));
    t.setAttribute('y', s(labelBelow ? p.cy+18 : p.cy-10));
    t.setAttribute('text-anchor','middle');
    t.setAttribute('font-size', Math.max(9, 11*SCALE));
  // hide port text for check valve (IN/OUT labels not shown)
  t.textContent = '';
    return { c, t };
  }
  const out = makePort('OUT', OUT, false);
  const inp = makePort('IN',  IN,  true);

  g.append( ball, seat, seat2, outLine, inLine, out.c, out.t, inp.c, inp.t);
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
