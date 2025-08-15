// js/valve52.js — 50% skala, portar fasta, lådor/pilar glider sidledes, start i läge 1.
export function addValve52(
  x, y,
  compLayer, components, handlePortClick, makeDraggable, redrawConnections, uid
){
  const id = uid();

  // ======= Skalning =======
  const scale = .75;

  // Bas (oskalat) enligt din godkända mockup
  const CELLW0 = 120;
  const CELLH0 = 80;
  const GX0 = 115;
  const GY0 = 0;
  const FONT0 = 10;
  const STROKE0 = 2;
  const MARKERW0 = 6;
  const SVGW0 = (CELLW0 + 110);
  const SVGH0 = (CELLH0 + 0);

  // Skalade mått
  const cellW = CELLW0 * scale;
  const cellH = CELLH0 * scale;
  const gx    = GX0    * scale;
  const gy    = GY0    * scale;
  const font  = FONT0  * scale;
  const stroke= STROKE0* scale;
  const markerW = MARKERW0 * scale;
  const svgW  = SVGW0  * scale;
  const svgH  = SVGH0  * scale;

  const el = document.createElement('div');
  el.className = 'comp';
  el.style.left = x + 'px';
  el.style.top  = y + 'px';

  const label = document.createElement('div');
  label.className = 'label';
  label.textContent = '5/2-ventil';

  const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.classList.add('compSvg');
  svg.setAttribute('width', svgW);
  svg.setAttribute('height', svgH);

  // ======= Defs: dubbelspetsad pil =======
  const defs = document.createElementNS(svg.namespaceURI,'defs');
  const m = document.createElementNS(svg.namespaceURI,'marker');
  m.setAttribute('id','arr');
  m.setAttribute('viewBox','0 0 10 10');
  m.setAttribute('refX','5');
  m.setAttribute('refY','5');
  m.setAttribute('markerWidth', String(markerW));
  m.setAttribute('markerHeight', String(markerW));
  m.setAttribute('orient','auto');
  const mp = document.createElementNS(svg.namespaceURI,'path');
  mp.setAttribute('d','M 0 0 L 10 5 L 0 10 z');
  mp.setAttribute('fill','#000');
  m.appendChild(mp);
  defs.appendChild(m);
  svg.appendChild(defs);

  // ======= Rot-grupp =======
  const gRoot = document.createElementNS(svg.namespaceURI,'g');
  gRoot.setAttribute('transform', `translate(${gx},${gy})`);

  // ======= Porterna =======
  const ports = {
    "4":  { cx: 10*scale,              cy: -10*scale },
    "2":  { cx: (CELLW0-10)*scale,     cy: -10*scale },
    "5":  { cx: 10*scale,              cy: (CELLH0+10)*scale },
    "1":  { cx: (CELLW0/2)*scale,      cy: (CELLH0+10)*scale },
    "3":  { cx: (CELLW0-10)*scale,     cy: (CELLH0+10)*scale },
        "12": { cx: (CELLW0 + 18)*scale,   cy: (CELLH0/2)*scale }   ,      // vänster pilot
    "14": { cx: (-18)*scale,           cy: (CELLH0/2)*scale },        // höger pilot

  };

  const portEls = {};
  const gPorts = document.createElementNS(svg.namespaceURI,'g');
  for (const key of Object.keys(ports)){
    const c = document.createElementNS(svg.namespaceURI,'circle');
    c.setAttribute('class','port');
    c.setAttribute('r', String(6*scale));
    c.setAttribute('cx', String(ports[key].cx));
    c.setAttribute('cy', String(ports[key].cy));

    const t = document.createElementNS(svg.namespaceURI,'text');
    t.setAttribute('x', String(ports[key].cx));
    t.setAttribute('y', String(ports[key].cy - 10*scale));
    t.setAttribute('text-anchor','middle');
    t.setAttribute('font-size', String(font));
    t.textContent = key;

    c.addEventListener('click', e => { e.stopPropagation(); handlePortClick(comp, key, c); });

    gPorts.append(c, t);
    portEls[key] = c;
  }

  // ======= Lådor + pilar (glider i sidled) =======
  const slideInner = document.createElementNS(svg.namespaceURI,'g');

  const addDoubleArrow = (parent,x1,y1,x2,y2)=>{
    const line = document.createElementNS(svg.namespaceURI,'line');
    line.setAttribute('x1', String(x1));
    line.setAttribute('y1', String(y1));
    line.setAttribute('x2', String(x2));
    line.setAttribute('y2', String(y2));
    line.setAttribute('stroke','#000');
    line.setAttribute('stroke-width', String(stroke));
    line.setAttribute('marker-start','url(#arr)');
    line.setAttribute('marker-end','url(#arr)');
    parent.appendChild(line);
  };
  const addBlock = (parent,x,y,w,h)=>{
    const b = document.createElementNS(svg.namespaceURI,'rect');
    b.setAttribute('x', String(x));
    b.setAttribute('y', String(y));
    b.setAttribute('width', String(w));
    b.setAttribute('height', String(h));
    b.setAttribute('fill','#000');
    parent.appendChild(b);
  };

  // Cell 0 (vänster)
  const cell0 = document.createElementNS(svg.namespaceURI,'g');
  const r0 = document.createElementNS(svg.namespaceURI,'rect');
  r0.setAttribute('x','0'); r0.setAttribute('y','0');
  r0.setAttribute('width', String(cellW));
  r0.setAttribute('height', String(cellH));
  r0.setAttribute('fill','#fff');
  r0.setAttribute('stroke','#000');
  r0.setAttribute('stroke-width', String(stroke));
  cell0.appendChild(r0);

  addDoubleArrow(cell0, (CELLW0/2)*scale, CELLH0*scale, 10*scale, 10*scale);
  addDoubleArrow(cell0, (CELLW0-10)*scale, 10*scale, (CELLW0-10)*scale, CELLH0*scale);
  addBlock(cell0, 2*scale, (CELLH0/2 - 8)*scale, 8*scale, 16*scale);

  // Cell 1 (höger)
  const cell1 = document.createElementNS(svg.namespaceURI,'g');
  cell1.setAttribute('transform', `translate(${cellW},0)`);
  const r1 = document.createElementNS(svg.namespaceURI,'rect');
  r1.setAttribute('x','0'); r1.setAttribute('y','0');
  r1.setAttribute('width', String(cellW));
  r1.setAttribute('height', String(cellH));
  r1.setAttribute('fill','#fff');
  r1.setAttribute('stroke','#000');
  r1.setAttribute('stroke-width', String(stroke));
  cell1.appendChild(r1);

  addDoubleArrow(cell1, (CELLW0/2)*scale, CELLH0*scale, (CELLW0-10)*scale, 10*scale);
  addDoubleArrow(cell1, 10*scale, 10*scale, 10*scale, CELLH0*scale);
  addBlock(cell1, (CELLW0-12)*scale, (CELLH0/2 - 8)*scale, 8*scale, 16*scale);

  slideInner.append(cell0, cell1);

  // ======= Lägg i rätt ordning =======
  gRoot.appendChild(slideInner); // lådor under
  gRoot.appendChild(gPorts);     // portar över
  svg.appendChild(gRoot);

  el.append(label, svg);
  compLayer.appendChild(el);

  const comp = {
    id,
    type: 'valve52',
    el, x, y,
    svgW, svgH, gx, gy,
    state: 1,
    ports: {
      "4":  { cx: ports["4"].cx,  cy: ports["4"].cy,  el: portEls["4"]  },
      "2":  { cx: ports["2"].cx,  cy: ports["2"].cy,  el: portEls["2"]  },
      "5":  { cx: ports["5"].cx,  cy: ports["5"].cy,  el: portEls["5"]  },
      "1":  { cx: ports["1"].cx,  cy: ports["1"].cy,  el: portEls["1"]  },
      "3":  { cx: ports["3"].cx,  cy: ports["3"].cy,  el: portEls["3"]  },
      "12": { cx: ports["12"].cx, cy: ports["12"].cy, el: portEls["12"] },
      "14": { cx: ports["14"].cx, cy: ports["14"].cy, el: portEls["14"] }
    },
    setState(s){
      this.state = s ? 1 : 0;
      const shift = (this.state === 0) ? 0 : -cellW;
      slideInner.setAttribute('transform', `translate(${shift},0)`);
      redrawConnections();
    },
    toggle(){ this.setState(1 - this.state); }
  };

  // Startläge
  comp.setState(1);

  r0.addEventListener('click', ()=> comp.toggle());
  r1.addEventListener('click', ()=> comp.toggle());

  makeDraggable(comp);
  components.push(comp);
  return comp;
}
