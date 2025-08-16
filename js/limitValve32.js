// js/limitValve32.js
// 3/2 gränslägesventil där hela ventilen (ram, inre lådor, rulle/skalen, fjäder)
// skuffas med transform vid aktivering; porterna lämnas på plats.
//
// Vänster cell (AKTIV): 2→1, 3 block (T)
// Höger  cell (VILA):  2→3, 1 block (T)
//
// Fixar:
//  - Vänster pilspets sitter vid 1 (ritas 2→1 med marker-end).
//  - Pilar försvinner inte vid rörelse (ingen clipPath; endast SVG transform).
//
// Signatur (matchar main.js):
// addLimitValve32(x,y, compLayer, components, handlePortClick, makeDraggable, redrawConnections, uid, getSignal)

export function addLimitValve32(
  x, y,
  compLayer, components,
  handlePortClick, makeDraggable, redrawConnections,
  uid,
  getSignal
){
  const id = uid();

  // Geometri
  const W = 140, H = 60;
  const NS = 'http://www.w3.org/2000/svg';
  const midX = W / 2;

  // Portpositioner (bara i höger cell)
  const insetRight = Math.round((W - midX) * 0.25); // ~¼ in i högra halvan
  const P2 = { cx: midX + insetRight, cy: -10  };    // 2 (uppe)
  const P1 = { cx: midX + insetRight, cy: H + 10 }; // 1 (nere, under 2)
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
  label.textContent = '3/2 gränsläge';
  el.appendChild(label);

  const svg = document.createElementNS(NS,'svg');
  svg.classList.add('compSvg');
  svg.setAttribute('width',  W);
  svg.setAttribute('height', H);
  svg.style.overflow = 'visible'; // rulle/fjäder kan sticka ut

  // --- defs: pilspets ---
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

  // === MOVER (ALLT som ska skuffas: ram/ytterbox, innerlådor, rulle/skalen, fjäder) ===
  const mover = document.createElementNS(NS,'g');
  // OBS: vi använder endast SVG-attributet 'transform' (inte CSS-transform),
  // för att markers/pilar ska renderas stabilt över alla motorer.

  // Ytterkapsling (ram) – följer med
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

  // Vänster cell (AKTIV): 2→1, 3 block (T)
  const gLeft = document.createElementNS(NS,'g');
  gLeft.appendChild(path(`M ${L1.cx } ${L1.cy -10} L ${L2.cx} ${L2.cy + 10}`, { arrow:'end' }));
  gLeft.appendChild(tBlock(L3.cx, H-24, L3.cy-10));

  // Höger cell (VILA): 2→3, 1 block (T), pilspets vid 3
  const gRight = document.createElementNS(NS,'g');
  gRight.appendChild(path(`M ${P2.cx} ${P2.cy + 10} L ${P3.cx} ${P3.cy - 10}`, { arrow:'end' }));
  gRight.appendChild(tBlock(P1.cx, H-24, P1.cy-10));

  // Rulle + skalen (följer med)
  const rollerGroup = document.createElementNS(NS,'g');
  rollerGroup.setAttribute('transform', `translate(-34, ${H/2})`);
  rollerGroup.append(
    path(`M -6 -7 L 35 -7`), path(`M -6 7 L 35 7`)
  );
  const rollerOuter = document.createElementNS(NS,'circle');
  rollerOuter.setAttribute('cx', 4); rollerOuter.setAttribute('cy', 0); rollerOuter.setAttribute('r', 13);
  rollerOuter.setAttribute('fill','#fff'); rollerOuter.setAttribute('stroke','#000'); rollerOuter.setAttribute('stroke-width','2');
  const rollerInner = document.createElementNS(NS,'circle');
  rollerInner.setAttribute('cx', 4); rollerInner.setAttribute('cy', 0); rollerInner.setAttribute('r', 6);
  rollerInner.setAttribute('fill','#fff'); rollerInner.setAttribute('stroke','#000'); rollerInner.setAttribute('stroke-width','2');
  rollerGroup.append(rollerOuter, rollerInner);

  // Fjäder (följer med)
  const spring = document.createElementNS(NS,'g');
  spring.setAttribute('transform', `translate(${W}, ${H/2})`);
  spring.append(
    path(`M 0 0 L 20 0`),
    path(`M 20 0 l 10 -10 l 10 20 l 10 -20 l 10 20 l 10 -20 l 10 20`)
  );

  // Bygg ihop allt som ska skuffas
  mover.append(body, boxLeft, boxRight, gLeft, gRight, rollerGroup, spring);
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

  // === Tillstånd / interaktion =============================================
  let sensorKey = null;  // 'a0', 'a1', ...
  let manualActive = false;

  function updateLabel(){
    label.textContent = '3/2 gränsläge' + (sensorKey ? ` — ${sensorKey}` : '');//  '3/2 gränsläge' + (sensorKey ? ` — ${sensorKey}` : '');
  }

  function applyTransforms(active){
    // Aktiv = vänster cell under porterna → flytta hela mover 'midX' åt höger
    const dx = active ? midX : 0;
    mover.setAttribute('transform', `translate(${dx}, 0)`);
  }

  function recompute(){
    const active = sensorKey ? !!getSignal(sensorKey) : manualActive;
    comp.state.active = active;
    applyTransforms(active);
  }

  function promptBind(){
    const k = window.prompt('Ange sensor (t.ex. a0, a1, b0, b1):', sensorKey || '');
    if (k){
      sensorKey = k.trim().toLowerCase();
      updateLabel();
      recompute();
      redrawConnections();
    }
  }

  // Manuell toggle (om ingen sensor): klick i vänstra halvan
  svg.addEventListener('click', (e)=>{
    const rect = svg.getBoundingClientRect();
    const localX = e.clientX - rect.left;
    if (sensorKey) return;
    if (localX < midX){
      manualActive = !manualActive;
      recompute();
      redrawConnections();
    }
  });

  // Bindning via S / dubbelklick / klick på etikett
  svg.addEventListener('keydown', (e)=>{ if (e.key.toLowerCase()==='s') promptBind(); });
  svg.setAttribute('tabindex', '0'); svg.style.outline = 'none';
  el.addEventListener('dblclick', (e)=>{ e.stopPropagation(); promptBind(); });
  label.addEventListener('click', (e)=>{ e.stopPropagation(); promptBind(); });

  // === Komponent-obj =======================================================
  const comp = {
    id, type: 'limit32',
    el, x, y,
    svgW: W, svgH: H, gx: 0, gy: 0,
    ports: {
      '1': { cx: P1.cx, cy: P1.cy, el: port1El },
      '2': { cx: P2.cx, cy: P2.cy, el: port2El },
      '3': { cx: P3.cx, cy: P3.cy, el: port3El }
    },
    state: { active: false },
    recompute
  };

  // Mount
  el.appendChild(svg);
  compLayer.appendChild(el);
  comp.x = x; comp.y = y;
  el.style.left = `${x}px`; el.style.top  = `${y}px`;

  makeDraggable(comp);
  components.push(comp);

  // Init
  updateLabel();
  recompute();
  return comp;
}
