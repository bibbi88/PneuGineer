// js/cylinderDouble.js
// Dubbelverkande cylinder. Portar: Cap (vänster botten), Rod (höger botten).
// Justera storlek för ALLA cylindrar här:
const SCALE = 1.5;

export function addCylinderDouble(
  x, y,
  compLayer, components,
  handlePortClick, makeDraggable, redrawConnections, uid
){
  const id = uid();
  const s = (n)=> n * SCALE;

  // Vi ger extra bredd åt höger så att full stångutgång syns
  const SVG_W = 360;   // större för att rymma tippens fulla slag (W-20)
  const SVG_H = 170;
  const GX = 10, GY = 25;

  // Oskalerade husmått
  const W = 160, H = 40;

  const el = document.createElement('div');
  el.className = 'comp';
  el.style.left = x + 'px';
  el.style.top  = y + 'px';

  const label = document.createElement('div');
  label.className = 'label';
  label.textContent = 'Cylinder (DV)';

  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS,'svg');
  svg.classList.add('compSvg');
  svg.setAttribute('width',  s(SVG_W));
  svg.setAttribute('height', s(SVG_H));

  const g = document.createElementNS(NS,'g');
  g.setAttribute('transform', `translate(${s(GX)},${s(GY)})`);

  // Hus
  const body = document.createElementNS(NS,'rect');
  body.setAttribute('x', s(0)); body.setAttribute('y', s(0));
  body.setAttribute('width', s(W)); body.setAttribute('height', s(H));
  body.setAttribute('fill','#fff');
  body.setAttribute('stroke','#000');
  body.setAttribute('stroke-width', s(2));

  // Kolv
  const piston = document.createElementNS(NS,'rect');
  piston.setAttribute('x', s(60)); piston.setAttribute('y', s(0));
  piston.setAttribute('width', s(6)); piston.setAttribute('height', s(H));
  piston.setAttribute('fill','#888');

  // Stång
  const rod = document.createElementNS(NS,'rect');
  rod.setAttribute('x', s(66)); rod.setAttribute('y', s(H/2 - 3));
  rod.setAttribute('width', s(W-66)); rod.setAttribute('height', s(6));
  rod.setAttribute('fill','#888');

  // Stångspets (visuellt tydlig ända)
  const rodTip = document.createElementNS(NS,'rect');
  rodTip.setAttribute('x', s(W));                 // start: precis vid husets högerkant
  rodTip.setAttribute('y', s(H/2 - 6));
  rodTip.setAttribute('width', s(10));
  rodTip.setAttribute('height', s(12));
  rodTip.setAttribute('fill','#666');

  // Portar (Cap vänster botten, Rod höger botten)
  const ports = {
    Cap: { cx: 10,   cy: H+12 },
    Rod: { cx: W-10, cy: H+12 }
  };
  const portEls = {};
  Object.keys(ports).forEach(key=>{
    const p = ports[key];
    const c = document.createElementNS(NS,'circle');
    c.setAttribute('class','port'); c.setAttribute('r', s(6));
    c.setAttribute('cx', s(p.cx)); c.setAttribute('cy', s(p.cy));
    c.addEventListener('click', (e)=>{ e.stopPropagation(); handlePortClick(comp, key, c); });

    const t = document.createElementNS(NS,'text');
    t.setAttribute('x', s(p.cx)); t.setAttribute('y', s(p.cy - 10));
    t.setAttribute('text-anchor','middle');
    t.setAttribute('font-size', Math.max(9, 10*SCALE));
    t.textContent = key;

    g.append(c, t);
    portEls[key] = c;
  });

  g.append(body, piston, rod, rodTip);
  svg.appendChild(g);
  el.append(label, svg);
  compLayer.appendChild(el);

  const comp = {
    id, type:'cylDouble', el, x, y,
    svgW: s(SVG_W), svgH: s(SVG_H), gx: s(GX), gy: s(GY),
    ports: {
      Cap: { cx: s(ports.Cap.cx), cy: s(ports.Cap.cy), el: portEls.Cap },
      Rod: { cx: s(ports.Rod.cx), cy: s(ports.Rod.cy), el: portEls.Rod }
    },
    pos: 0, // 0=indragen, 1=utdragen
    setPos(alpha){
      this.pos = Math.max(0, Math.min(1, alpha));
      // Kolvens x (0..W): 10 → W-10
      const px = 10 + this.pos*(W-20);

      // Kolv
      piston.setAttribute('x', s(px));

      // Stångens vänsterkant vid kolvens högerkant
      const rodX = px + 6;

      // Tippens x ska följa kolven 1:1:
      // vid pos=0: tipX = W
      // vid pos=1: tipX = W + (W-20)
      const tipX = px + (W - 10);    // = W + (px - 10)

      // Stångens bredd = avstånd från rodX till tipX
      const rodW = Math.max(0, tipX - rodX);

      rod.setAttribute('x', s(rodX));
      rod.setAttribute('width', s(rodW));
      rodTip.setAttribute('x', s(tipX));
    }
  };
  comp.setPos(comp.pos);

  makeDraggable(comp);
  components.push(comp);
  redrawConnections();
  return comp;
}
