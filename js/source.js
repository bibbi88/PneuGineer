// js/source.js
// Pressure source — simple symbol with an OUT port on the top.
// Global skala:
const SCALE = 1;

export function addSource(x, y, compLayer, components, handlePortClick, makeDraggable, redrawConnections, uid){
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

  // Symbol: cirkel (källa) + utgång uppåt
  const Cx = 50, Cy = 50, R = 15;

  const circle = document.createElementNS(NS,'circle');
  circle.setAttribute('cx', s(Cx));
  circle.setAttribute('cy', s(Cy));
  circle.setAttribute('r',  s(R));
  circle.setAttribute('fill','#fff'); circle.setAttribute('stroke','#000'); circle.setAttribute('stroke-width', s(2));

  // NYTT: inre cirkel (tunn ring) inne i källans huvudcirkel
  const innerR = R * 0.55; // justerbar relativ storlek
  const innerCircle = document.createElementNS(NS,'circle');
  innerCircle.setAttribute('cx', s(Cx));
  innerCircle.setAttribute('cy', s(Cy));
  innerCircle.setAttribute('r',  s(innerR));
  innerCircle.setAttribute('fill','none');
  innerCircle.setAttribute('stroke','#000');
  innerCircle.setAttribute('stroke-width', s(2));

  const stem = document.createElementNS(NS,'line');
  stem.setAttribute('x1', s(Cx)); stem.setAttribute('y1', s(Cy - R));
  stem.setAttribute('x2', s(Cx)); stem.setAttribute('y2', s(20));
  stem.setAttribute('stroke','#000'); stem.setAttribute('stroke-width', s(2));

  // Port OUT (uppe)
  const OUT = { cx: Cx, cy: 14 };
  const p = document.createElementNS(NS,'circle');
  p.setAttribute('class','port'); p.setAttribute('r', s(6));
  p.setAttribute('cx', s(OUT.cx)); p.setAttribute('cy', s(OUT.cy));
  p.addEventListener('click', (e)=>{ e.stopPropagation(); handlePortClick(comp, 'OUT', p); });

  const t = document.createElementNS(NS,'text');
  t.setAttribute('x', s(OUT.cx)); t.setAttribute('y', s(OUT.cy - 10));
  t.setAttribute('text-anchor','middle'); t.setAttribute('font-size', Math.max(9, 11*SCALE));
  // hide OUT text on pressure source
  t.textContent = '';

  // Lägg till i ordning så innercirkeln hamnar ovanpå huvudcirkeln
  g.append(circle, innerCircle, stem, p, t);

  svg.appendChild(g);
  el.append(label, svg);
  compLayer.appendChild(el);

  const comp = {
    id, type:'source', el, x, y,
    svgW: s(SVG_W), svgH: s(SVG_H), gx: s(GX), gy: s(GY),
    ports: {
      OUT:{ cx: s(OUT.cx), cy: s(OUT.cy), el: p },
      // för bakåtkompabilitet (vissa projekt kan ha 'P'):
      P:  { cx: s(OUT.cx), cy: s(OUT.cy), el: p }
    }
  };

  makeDraggable(comp);
  components.push(comp);
  redrawConnections();
  return comp;
}
