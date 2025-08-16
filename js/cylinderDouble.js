// js/cylinderDouble.js
// Dubbelverkande cylinder. Portar: Cap (vänster botten), Rod (höger botten).
// Justera storlek för ALLA cylindrar här:
const SCALE = 1;

export function addCylinderDouble(
  x, y,
  compLayer, components,
  handlePortClick, makeDraggable, redrawConnections, uid,
  getNextCylinderLetter, setSignal   // <-- NYA argument
){
  const id = uid();
  const s = (n)=> n * SCALE;

  // Cylinder-namn
  const letter = getNextCylinderLetter(); // 'A','B',...
  const lower  = letter.toLowerCase();    // 'a','b',...

  // Kompaktare box
  const SVG_W = 340;
  const SVG_H = 50;
  const GX = 10, GY = 10;

  const W = 220, H = 70;
  const PORT_MARGIN = 6;

  const el = document.createElement('div');
  el.className = 'comp';
  el.style.left = x + 'px';
  el.style.top  = y + 'px';

  const label = document.createElement('div');
  label.className = 'label';
  label.textContent = `Cylinder ${letter}`;

  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS,'svg');
  svg.classList.add('compSvg');
  svg.setAttribute('width',  s(SVG_W));
  svg.setAttribute('height', s(SVG_H));
  svg.style.overflow = 'visible';

  const g = document.createElementNS(NS,'g');
  g.setAttribute('transform', `translate(${s(GX)},${s(GY)})`);

  // Hus
  const body = document.createElementNS(NS,'rect');
  body.setAttribute('x', s(0)); body.setAttribute('y', s(0));
  body.setAttribute('width', s(W)); body.setAttribute('height', s(H));
  body.setAttribute('fill','#fff'); body.setAttribute('stroke','#000');
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

  // Spets
  const rodTip = document.createElementNS(NS,'rect');
  rodTip.setAttribute('x', s(W));
  rodTip.setAttribute('y', s(H/2 - 6));
  rodTip.setAttribute('width', s(10));
  rodTip.setAttribute('height', s(12));
  rodTip.setAttribute('fill','#666');

  // Portar
  const ports = {
    Cap: { cx: 10,     cy: H + PORT_MARGIN },
    Rod: { cx: W - 10, cy: H + PORT_MARGIN }
  };
  const portEls = {};
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
      // Kolvens x
      const px = 10 + this.pos*(W-20);

      piston.setAttribute('x', s(px));

      const rodX = px + 6;
      const tipX = px + (W - 10);
      const rodW = Math.max(0, tipX - rodX);

      rod.setAttribute('x', s(rodX));
      rod.setAttribute('width', s(rodW));
      rodTip.setAttribute('x', s(tipX));

      // === Signaler ===
      if (this.pos <= 0) {          // helt inne
        setSignal(`${lower}0`, true);
        setSignal(`${lower}1`, false);
      } else if (this.pos >= 1) {   // helt ute
        setSignal(`${lower}0`, false);
        setSignal(`${lower}1`, true);
      } else {                      // mellanläge
        setSignal(`${lower}0`, false);
        setSignal(`${lower}1`, false);
      }
    }
  };

  // init
  comp.setPos(comp.pos);
  // första signalerna
  setSignal(`${lower}0`, true);
  setSignal(`${lower}1`, false);

  makeDraggable(comp);
  components.push(comp);
  redrawConnections();
  return comp;
}
