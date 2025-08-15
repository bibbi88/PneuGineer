// js/restrictor.js
// Stryp (restrictor): IN nere, OUT uppe. Släpper igenom men med fördröjning (tau).
// Skala för ALLA stryp:
const SCALE = 0.5;

export function addRestrictor(
  x, y,
  compLayer, components, handlePortClick, makeDraggable, redrawConnections, uid
){
  const id = uid();
  const s = (n)=> n * SCALE;

  // visuell symbol: liten rektangel med smalning
  const SVG_W=120, SVG_H=140, GX=10, GY=20;

  const el = document.createElement('div');
  el.className = 'comp';
  el.style.left = x + 'px';
  el.style.top  = y + 'px';

  const label = document.createElement('div');
  label.className = 'label';
  label.textContent = 'Stryp';

  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS,'svg');
  svg.classList.add('compSvg');
  svg.setAttribute('width',  s(SVG_W));
  svg.setAttribute('height', s(SVG_H));

  const g = document.createElementNS(NS,'g');
  g.setAttribute('transform', `translate(${s(GX)},${s(GY)})`);

  const HUS_X=30, HUS_Y=50, HUS_W=60, HUS_H=60;
  const hus = document.createElementNS(NS,'rect');
  hus.setAttribute('x', s(HUS_X));
  hus.setAttribute('y', s(HUS_Y));
  hus.setAttribute('width', s(HUS_W));
  hus.setAttribute('height', s(HUS_H));
  hus.setAttribute('fill','#fff'); hus.setAttribute('stroke','#000'); hus.setAttribute('stroke-width', s(2));

  // “Smalning” – två trianglar mot en liten hals
  const path = document.createElementNS(NS,'path');
  const x1 = HUS_X+6, x2 = HUS_X+HUS_W-6, yC = HUS_Y+HUS_H/2;
  path.setAttribute('d', `
    M ${s(x1)} ${s(yC+8)} L ${s(x1+16)} ${s(yC)} L ${s(x1)} ${s(yC-8)}
    M ${s(x2)} ${s(yC+8)} L ${s(x2-16)} ${s(yC)} L ${s(x2)} ${s(yC-8)}
  `);
  path.setAttribute('stroke', '#000'); path.setAttribute('fill','none'); path.setAttribute('stroke-width', s(2));

  // Portar IN nere, OUT uppe
  const IN  = { cx: HUS_X + HUS_W/2, cy: HUS_Y + HUS_H + 18 };
  const OUT = { cx: HUS_X + HUS_W/2, cy: HUS_Y - 18 };

  const line = (x1,y1,x2,y2)=>{
    const l = document.createElementNS(NS,'line');
    l.setAttribute('x1', s(x1)); l.setAttribute('y1', s(y1));
    l.setAttribute('x2', s(x2)); l.setAttribute('y2', s(y2));
    l.setAttribute('stroke','#000'); l.setAttribute('stroke-width', s(2));
    return l;
  };
  const inLine  = line(IN.cx,  HUS_Y+HUS_H, IN.cx,  IN.cy-6);
  const outLine = line(OUT.cx, OUT.cy+6,   OUT.cx, HUS_Y);

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
  const inp = makePort('IN',  IN,  true);
  const out = makePort('OUT', OUT, false);

  g.append(hus, path, inLine, outLine, inp.c, inp.t, out.c, out.t);
  svg.appendChild(g);
  el.append(label, svg);
  compLayer.appendChild(el);

  const comp = {
    id, type:'restrictor', el, x, y,
    svgW: s(SVG_W), svgH: s(SVG_H), gx: s(GX), gy: s(GY),
    ports: {
      IN:  { cx: s(IN.cx),  cy: s(IN.cy),  el: inp.c },
      OUT: { cx: s(OUT.cx), cy: s(OUT.cy), el: out.c }
    },
    // enkel tidskonstant (sekunder) – kan du senare göra inställningsbar
    tau: 0.25,
    // internt tillstånd: när IN blev trycksatt / släppt
    _inPress: false,
    _timer: 0
  };

  makeDraggable(comp);
  components.push(comp);
  redrawConnections();
  return comp;
}
