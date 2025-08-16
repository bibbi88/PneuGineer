// js/pushButton32.js
// Tryckknapp 3/2 (momentan): hela ventilen (ram, inre lådor, lodrätt aktiveringsstreck, fjäder)
// skuffas vid aktivering; porterna ligger kvar på plats.
//
// Vänster (AKTIV): 2→1, 3 block (T)
// Höger  (VILA):  2→3, 1 block (T)
//
// Signatur (matchar din main.js):
// addPushButton32(x,y, compLayer, components, handlePortClick, makeDraggable, redrawConnections, uid)

export function addPushButton32(
  x, y,
  compLayer, components,
  handlePortClick, makeDraggable, redrawConnections,
  uid
){
  const id = uid();

  // Geometri
  const W = 140, H = 60;
  const NS = 'http://www.w3.org/2000/svg';
  const midX = W / 2;

  // Portpositioner (bara i höger cell; utanför ramen för lättare koppling)
  const insetRight = Math.round((W - midX) * 0.25); // ~¼ in i högra halvan
  const P2 = { cx: midX + insetRight, cy: -10  };   // 2 (uppe)
  const P1 = { cx: midX + insetRight, cy: H + 10 }; // 1 (nere)
  const P3 = { cx: W - 12,            cy: H + 10 }; // 3 (nere höger)

  // Motsv. lägen i vänster cell (för inre grafik)
  const L2 = { cx: insetRight, cy: P2.cy };
  const L1 = { cx: insetRight, cy: P1.cy };
  const L3 = { cx: midX - 12,  cy: P3.cy };

  // Rot
  const el = document.createElement('div');
  el.className = 'comp';
  el.style.left = x + 'px';
  el.style.top  = y + 'px';

  const label = document.createElement('div');
  label.className = 'label';
  label.textContent = 'Tryckknapp 3/2';
  el.appendChild(label);

  const svg = document.createElementNS(NS,'svg');
  svg.classList.add('compSvg');
  svg.setAttribute('width',  W);
  svg.setAttribute('height', H);
  svg.style.overflow = 'visible';

  // defs: pilspets
  const defs = document.createElementNS(NS,'defs');
  const marker = document.createElementNS(NS,'marker');
  marker.setAttribute('id','arrow');
  marker.setAttribute('markerWidth','10');
  marker.setAttribute('markerHeight','10');
  marker.setAttribute('refX','9');
  marker.setAttribute('refY','5');
  marker.setAttribute('orient','auto');
  const mpath = document.createElementNS(NS,'path');
  mpath.setAttribute('d','M 0 0 L 10 5 L 0 10 z');
  mpath.setAttribute('fill','#000');
  marker.appendChild(mpath);
  defs.append(marker);
  svg.appendChild(defs);

  // === MOVER (ALLT som ska skuffas: ram, lådor, aktiveringsstreck, fjäder) ===
  const mover = document.createElementNS(NS,'g');

  // Ram/ytterbox
  const body = document.createElementNS(NS,'rect');
  body.setAttribute('x',0); body.setAttribute('y',0);
  body.setAttribute('width',W); body.setAttribute('height',H);
  body.setAttribute('fill','#fff'); body.setAttribute('stroke','#000');
  body.setAttribute('stroke-width','2');

  // Hjälpare för ritning
  const path = (d, opts={})=>{
    const p = document.createElementNS(NS,'path');
    p.setAttribute('d', d);
    p.setAttribute('fill', 'none');
    p.setAttribute('stroke', opts.stroke || '#000');
    p.setAttribute('stroke-width', opts.sw || 2);
    if (opts.arrow === 'end')   p.setAttribute('marker-end','url(#arrow)');
    if (opts.arrow === 'start') p.setAttribute('marker-start','url(#arrow)');
    return p;
  };
  const tBlock = (xCenter, yBar, yStemEnd)=>{
    const frag = document.createDocumentFragment();
    frag.appendChild(path(`M ${xCenter-10} ${yBar} L ${xCenter+10} ${yBar}`));
    frag.appendChild(path(`M ${xCenter} ${yBar} L ${xCenter} ${yStemEnd}`));
    return frag;
  };

  // Inre två "lådor"
  const boxLeft  = document.createElementNS(NS,'rect');
  boxLeft.setAttribute('x', 0); boxLeft.setAttribute('y', 0);
  boxLeft.setAttribute('width', midX); boxLeft.setAttribute('height', H);
  boxLeft.setAttribute('fill','#fff'); boxLeft.setAttribute('stroke','#000'); boxLeft.setAttribute('stroke-width','1.6');

  const boxRight = document.createElementNS(NS,'rect');
  boxRight.setAttribute('x', midX); boxRight.setAttribute('y', 0);
  boxRight.setAttribute('width', midX); boxRight.setAttribute('height', H);
  boxRight.setAttribute('fill','#fff'); boxRight.setAttribute('stroke','#000'); boxRight.setAttribute('stroke-width','1.6');

  // Vänster cell (AKTIV): 2→1, 3 block (T)  — pilspets vid 1
  const gLeft = document.createElementNS(NS,'g');
  gLeft.appendChild(path(`M ${L1.cx} ${L1.cy - 10} L ${L2.cx} ${L2.cy + 10}`, { arrow:'end' }));
  gLeft.appendChild(tBlock(L3.cx, H-18, L3.cy - 8));

  // Höger cell (VILA): 2→3, 1 block (T)    — pilspets vid 3
  const gRight = document.createElementNS(NS,'g');
  gRight.appendChild(path(`M ${P2.cx} ${P2.cy + 10} L ${P3.cx} ${P3.cy - 10}`, { arrow:'end' }));
  gRight.appendChild(tBlock(P1.cx, H-18, P1.cy - 8));

  // Aktiveringsstreck (ersätter rulle) – följer med ventilen
  const actuator = document.createElementNS(NS,'line');
  actuator.setAttribute('x1', -20); actuator.setAttribute('y1', 10);
  actuator.setAttribute('x2', -20); actuator.setAttribute('y2', H-10);
  actuator.setAttribute('stroke', '#000'); actuator.setAttribute('stroke-width', '2');

  // NYTT: två horisontella streck från aktiveringsstrecket in mot lådan
  const forkTop = path(`M -20 20 L 0 20`);
  const forkBot = path(`M -20 ${H-20} L 0 ${H-20}`);

  // Fjäder (höger) – följer med ventilen
  const spring = document.createElementNS(NS,'g');
  spring.setAttribute('transform', `translate(${W}, ${H/2})`);
  spring.append(
    path(`M 0 0 L 20 0`),
    path(`M 20 0 l 10 -10 l 10 20 l 10 -20 l 10 20`)
  );

  mover.append(body, boxLeft, boxRight, gLeft, gRight, forkTop, forkBot, actuator, spring);
  svg.appendChild(mover);

  // === PORTER (statiska; lämnas kvar) ======================================
  const makePort = (pos, key)=>{
    const c = document.createElementNS(NS,'circle');
    c.setAttribute('class','port');
    c.setAttribute('r', 6);
    c.setAttribute('cx', pos.cx);
    c.setAttribute('cy', pos.cy);
    c.addEventListener('click', (e)=>{ e.stopPropagation(); handlePortClick(comp, key, c); });
    return c;
  };
  const port2El = makePort(P2, '2');
  const port1El = makePort(P1, '1');
  const port3El = makePort(P3, '3');
  svg.append(port2El, port1El, port3El);

  // === Tillstånd / interaktion (momentan) ==================================
  let isActive = false;

  function applyTransforms(active){
    const dx = active ? midX : 0;  // aktiv ⇒ vänster ruta under porterna
    mover.setAttribute('transform', `translate(${dx}, 0)`);
  }

  function setActive(a){
    if (isActive === a) return;
    isActive = a;
    comp.state.active = a;
    applyTransforms(a);
    redrawConnections();
  }

  // Aktivera vid nedtryck i vänster halva, släpp återställer
  function isInLeftHalf(evt){
    const rect = svg.getBoundingClientRect();
    const x = (evt.touches?.[0]?.clientX ?? evt.clientX) - rect.left;
    return x < midX;
  }
  svg.addEventListener('mousedown', (e)=>{ if (isInLeftHalf(e)) setActive(true); });
  window.addEventListener('mouseup',   ()=> setActive(false));
  svg.addEventListener('mouseleave',   ()=> setActive(false));
  // Touch
  svg.addEventListener('touchstart', (e)=>{ if (isInLeftHalf(e)) setActive(true); }, {passive:true});
  window.addEventListener('touchend', ()=> setActive(false), {passive:true});
  window.addEventListener('touchcancel', ()=> setActive(false), {passive:true});

  // === Komponent-obj =======================================================
  const comp = {
    id, type: 'push32',
    el, x, y,
    svgW: W, svgH: H, gx: 0, gy: 0,
    ports: {
      '1': { cx: P1.cx, cy: P1.cy, el: port1El },
      '2': { cx: P2.cx, cy: P2.cy, el: port2El },
      '3': { cx: P3.cx, cy: P3.cy, el: port3El }
    },
    state: { active: false },
    recompute(){ applyTransforms(isActive); }
  };

  // Mount
  el.appendChild(svg);
  compLayer.appendChild(el);
  comp.x = x; comp.y = y;
  el.style.left = `${x}px`; el.style.top  = `${y}px`;

  makeDraggable(comp);
  components.push(comp);

  // Init
  applyTransforms(false);
  return comp;
}
