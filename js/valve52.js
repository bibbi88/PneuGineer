// js/valve52.js — portar 1/2/3/4/5 fasta, lådor/pilar glider, 12/14 flyttar exakt lika långt som ventilen, start i läge 1.
export function addValve52(
  x, y,
  compLayer, components, handlePortClick, makeDraggable, redrawConnections, uid
){
  const id = uid();

  // ======= Skalning =======
  const scale = 1;

  // Bas (oskalat) enligt din mockup
  const CELLW0   = 80;
  const CELLH0   = 60;
  const GX0      = 115;
  const GY0      = 0;
  const FONT0    = 10;
  const STROKE0  = 2;
  const MARKERW0 = 6;
  const SVGW0    = (CELLW0 + 110);
  const SVGH0    = (CELLH0 + 0);

  // Skalade mått
  const cellW   = CELLW0 * scale;
  const cellH   = CELLH0 * scale;
  const gx      = GX0    * scale;
  const gy      = GY0    * scale;
  const font    = FONT0  * scale;
  const stroke  = STROKE0* scale;
  const markerW = MARKERW0 * scale;
  const svgW    = SVGW0  * scale;
  const svgH    = SVGH0  * scale;

  // ======= Wrapper-element =======
  const el = document.createElement('div');
  el.className = 'comp';
  el.style.left = x + 'px';
  el.style.top  = y + 'px';

  const label = document.createElement('div');
  label.className = 'label';
  label.textContent = '5/2-ventil';

  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS,'svg');
  svg.classList.add('compSvg');
  svg.setAttribute('width', svgW);
  svg.setAttribute('height', svgH);
  svg.style.overflow = 'visible';

  // ======= Defs: dubbelspetsad pil =======
  const defs = document.createElementNS(NS,'defs');
  const m = document.createElementNS(NS,'marker');
  m.setAttribute('id','arr');
  m.setAttribute('viewBox','0 0 10 10');
  m.setAttribute('refX','10');
  m.setAttribute('refY','5');
  m.setAttribute('markerWidth', String(markerW));
  m.setAttribute('markerHeight', String(markerW));
  m.setAttribute('orient','auto-start-reverse');
  const mp = document.createElementNS(NS,'path');
  mp.setAttribute('d','M 0 0 L 10 5 L 0 10 z');
  mp.setAttribute('fill','#000');
  m.appendChild(mp);
  defs.appendChild(m);
  svg.appendChild(defs);

  // ======= Rot-grupp =======
  const gRoot = document.createElementNS(NS,'g');
  gRoot.setAttribute('transform', `translate(${gx},${gy})`);

  // ======= Porterna (fasta 1/2/3/4/5) =======
  const portsFixed = {
    "4":  { cx: 10*scale,             cy: -10*scale },
    "2":  { cx: (CELLW0-10)*scale,    cy: -10*scale },
    "5":  { cx: 10*scale,             cy: (CELLH0+10)*scale },
    "1":  { cx: (CELLW0/2)*scale,     cy: (CELLH0+10)*scale },
    "3":  { cx: (CELLW0-10)*scale,    cy: (CELLH0+10)*scale }
  };

  // Piloternas bas (utanför huset): 14 till vänster, 12 till höger
  const base14 = { cx: (  -15)*scale,      cy: (CELLH0/2)*scale }; // vänster pilot
  const base12 = { cx: (CELLW0*2 + 15)*scale,   cy: (CELLH0/2)*scale }; // höger pilot

  const portEls = {};
  const gPorts = document.createElementNS(NS,'g');

  // Rita fasta portar 1/2/3/4/5
  for (const key of Object.keys(portsFixed)){
    const p = portsFixed[key];
    const c = document.createElementNS(NS,'circle');
    c.setAttribute('class','port');
    c.setAttribute('r', String(6*scale));
    c.setAttribute('cx', String(p.cx));
    c.setAttribute('cy', String(p.cy));

    const t = document.createElementNS(NS,'text');
    t.setAttribute('x', String(p.cx));
    t.setAttribute('y', String(p.cy - 10*scale));
    t.setAttribute('text-anchor','middle');
    t.setAttribute('font-size', String(font));
    t.textContent = key;

    c.addEventListener('click', e => { e.stopPropagation(); handlePortClick(comp, key, c); });

    gPorts.append(c, t);
    portEls[key] = c;
  }

  // ======= Pilotportar i egna grupper (så de kan flyttas 1:1 med ventilen) =======
  const gP12 = document.createElementNS(NS,'g');
  const gP14 = document.createElementNS(NS,'g');
  gP12.style.transition = 'transform 160ms ease-in-out';
  gP14.style.transition = 'transform 160ms ease-in-out';

  function makePilot(g, base, key){
    const c = document.createElementNS(NS,'circle');
    c.setAttribute('class','port');
    c.setAttribute('r', String(6*scale));
    c.setAttribute('cx', String(base.cx)); // lokalt i gruppen
    c.setAttribute('cy', String(base.cy));
    c.addEventListener('click', e => { e.stopPropagation(); handlePortClick(comp, key, c); });

    const t = document.createElementNS(NS,'text');
    t.setAttribute('x', String(base.cx));
    t.setAttribute('y', String(base.cy - 10*scale));
    t.setAttribute('text-anchor','middle');
    t.setAttribute('font-size', String(font));
    t.textContent = key;

    g.append(c, t);
    return c;
  }

  const p12El = makePilot(gP12, base12, '12');
  const p14El = makePilot(gP14, base14, '14');

  // ======= Lådor + pilar (glider i sidled) =======
  const slideInner = document.createElementNS(NS,'g');
  slideInner.style.transition = 'transform 160ms ease-in-out';

  const addDoubleArrow = (parent,x1,y1,x2,y2)=>{
    const line = document.createElementNS(NS,'line');
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
    const b = document.createElementNS(NS,'rect');
    b.setAttribute('x', String(x));
    b.setAttribute('y', String(y));
    b.setAttribute('width', String(w));
    b.setAttribute('height', String(h));
    b.setAttribute('fill','#000');
    parent.appendChild(b);
  };

  // Cell 0 (vänster)
  const cell0 = document.createElementNS(NS,'g');
  const r0 = document.createElementNS(NS,'rect');
  r0.setAttribute('x','0'); r0.setAttribute('y','0');
  r0.setAttribute('width', String(cellW));
  r0.setAttribute('height', String(cellH));
  r0.setAttribute('fill','#fff');
  r0.setAttribute('stroke','#000');
  r0.setAttribute('stroke-width', String(stroke));
  cell0.appendChild(r0);

  // Pilor enligt din skiss
  addDoubleArrow(cell0, (CELLW0/2)*scale, CELLH0*scale, 10*scale, 0);
  addDoubleArrow(cell0, (CELLW0-10)*scale, 0*scale, (CELLW0-10)*scale, CELLH0*scale);
  // addBlock(cell0, 2*scale, (CELLH0/2 - 8)*scale, 8*scale, 16*scale); // ev. block T

  // Cell 1 (höger)
  const cell1 = document.createElementNS(NS,'g');
  cell1.setAttribute('transform', `translate(${cellW},0)`);
  const r1 = document.createElementNS(NS,'rect');
  r1.setAttribute('x','0'); r1.setAttribute('y','0');
  r1.setAttribute('width', String(cellW));
  r1.setAttribute('height', String(cellH));
  r1.setAttribute('fill','#fff');
  r1.setAttribute('stroke','#000');
  r1.setAttribute('stroke-width', String(stroke));
  cell1.appendChild(r1);

  addDoubleArrow(cell1, (CELLW0/2)*scale, CELLH0*scale, (CELLW0-10)*scale, 0);
  addDoubleArrow(cell1, 10*scale, 0, 10*scale, CELLH0*scale);
  // addBlock(cell1, (CELLW0-12)*scale, (CELLH0/2 - 8)*scale, 8*scale, 16*scale);

  slideInner.append(cell0, cell1);

  // ======= Lagerordning =======
  gRoot.appendChild(slideInner); // lådor under
  gRoot.appendChild(gPorts);     // fasta portar över
  gRoot.appendChild(gP12);       // 12 över
  gRoot.appendChild(gP14);       // 14 över
  svg.appendChild(gRoot);

  el.append(label, svg);
  compLayer.appendChild(el);

  // ======= Komponentobjekt =======
  const comp = {
    id,
    type: 'valve52',
    el, x, y,
    svgW, svgH, gx, gy,
    state: 1, // startläge
    ports: {
      "4":  { cx: portsFixed["4"].cx,  cy: portsFixed["4"].cy,  el: portEls["4"]  },
      "2":  { cx: portsFixed["2"].cx,  cy: portsFixed["2"].cy,  el: portEls["2"]  },
      "5":  { cx: portsFixed["5"].cx,  cy: portsFixed["5"].cy,  el: portEls["5"]  },
      "1":  { cx: portsFixed["1"].cx,  cy: portsFixed["1"].cy,  el: portEls["1"]  },
      "3":  { cx: portsFixed["3"].cx,  cy: portsFixed["3"].cy,  el: portEls["3"]  },
      "12": { cx: base12.cx,           cy: base12.cy,           el: p12El },
      "14": { cx: base14.cx,           cy: base14.cy,           el: p14El }
    },
    setState(s){
      this.state = s ? 1 : 0;
      const shift = (this.state === 0) ? 0 : -cellW;   // 0=vänster bild, 1=höger bild
      // flytta bilderna
      slideInner.setAttribute('transform', `translate(${shift},0)`);
      // flytta pilotportarna EXAKT lika långt
      gP12.setAttribute('transform', `translate(${shift},0)`);
      gP14.setAttribute('transform', `translate(${shift},0)`);
      // uppdatera kablage-koordinater (viktigt för wire-drag)
      comp.ports["12"].cx = base12.cx + shift;
      comp.ports["12"].cy = base12.cy;
      comp.ports["14"].cx = base14.cx + shift;
      comp.ports["14"].cy = base14.cy;
      // rita om ledningar
      redrawConnections();
    },
    toggle(){ this.setState(1 - this.state); }
  };

  // ======= Klick för manuell växling (main kan låsa i STOP med wrapValveToggleGuard) =======
  r0.addEventListener('click', ()=> comp.toggle());
  r1.addEventListener('click', ()=> comp.toggle());

  // ======= Init =======
  comp.setState(1); // start i läge 1

  makeDraggable(comp);
  components.push(comp);
  return comp;
}
