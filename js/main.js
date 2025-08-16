// js/main.js
// Tryck-overlay + Stega + pilotsignaler (12/14) för 5/2-ventil
// + Osynlig klick-yta för wires (lättare att välja)
// + 12/14 portar får horisontell "inflygning" på ledningar
// + Siffervisning av tryck (bar) på varje ledning i sim-läge
// + Marquee multi-select + Copy/Cut/Paste/Delete av markerade komponenter
// + Länkläge: port-prioritet, korsmarkör, ESC för att avbryta

import { addValve52 }        from './valve52.js';
import { addCylinderDouble } from './cylinderDouble.js';
import { addSource }         from './source.js';
import { addAndValve }       from './andValve.js';
import { addOrValve }        from './orValve.js';
import { addLimitValve32 }   from './limitValve32.js'; // 3/2 gränslägesventil
import { addPushButton32 }   from './pushButton32.js'; // 3/2 tryckknapp (momentan)

/* ---------- DOM-lager ---------- */
const compLayer = document.getElementById('compLayer');
const connLayer = document.getElementById('connLayer');

connLayer.style.zIndex = '2';
compLayer.style.zIndex = '1';
connLayer.style.pointerEvents = 'none';

/* ---------- App-state ---------- */
let components = [];
let connections = [];
let nextId = 1;
let pendingPort = null;     // {id, port} när länkning pågår
let isDirty = false;
let currentProjectName = 'projekt';

let selectedConnection = null;
// Flerkomponents-val:
const selectedComponents = new Set();
let lastClickPoint = { x: 200, y: 200 }; // fallback för klistra in-offset

const Modes = { STOP:'stop', PLAY:'play', PAUSE:'pause' };
let simMode = Modes.STOP;

const DEFAULT_VALVE_STATE = 1;
const DEFAULT_CYL_POS     = 0;

/* ---------- Tryck-konstanter ---------- */
const SUPPLY_BAR = 6.0;  // nominellt matningstryck
const EPS        = 1e-3;

/* ---------- Undo/Redo ---------- */
const HISTORY_LIMIT = 50;
let history = [];
let future  = [];
let isRestoring = false;

/* ---------- Utils ---------- */
function uid(){ return nextId++; }
function workspaceBBox(){ return compLayer.getBoundingClientRect(); }
function canEdit(){ return simMode === Modes.STOP; }
function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
function prettyBar(p){
  if (p == null) return '–';
  // hela eller en decimal
  const s = (Math.abs(p - Math.round(p)) < 0.05) ? String(Math.round(p)) : p.toFixed(1);
  return s;
}

/* ---------- Signals & Cylinder-namn ---------- */
const signals = {};
function setSignal(key, value) {
  const v = !!value;
  if (signals[key] === v) return;
  signals[key] = v;
  redrawConnections?.();
}
function getSignal(key) {
  return !!signals[key];
}
let cylinderCount = 0;
function getNextCylinderLetter() {
  const code = 'A'.charCodeAt(0) + cylinderCount;
  cylinderCount += 1;
  return String.fromCharCode(code); // 'A','B',...
}

/* ---------- Port → globala koordinater ---------- */
function portGlobalPosition(comp, portKey){
  const p = comp.ports?.[portKey];
  if (!p) return { x: comp.x, y: comp.y };
  if (comp.svgW && comp.svgH && (comp.gx !== undefined) && (comp.gy !== undefined)){
    const svg0x = comp.x - comp.svgW/2;
    const svg0y = comp.y - comp.svgH/2;
    return { x: svg0x + comp.gx + p.cx, y: svg0y + comp.gy + p.cy };
  }
  return { x: comp.x + p.cx, y: comp.y + p.cy };
}

/* ---------- Wires (ortogonalt, 12/14 med horisontell ”inflygning”) ---------- */
// Ortogonal ledning med valfri sista segmentriktning per ände.
// opts = { startHoriz: boolean, endHoriz: boolean }
function drawWirePath(x1, y1, x2, y2, opts = {}){
  const { startHoriz = false, endHoriz = false } = opts;

  const stub = 14;
  const dx = x2 - x1;
  const dy = y2 - y1;

  const sgn = (v)=> (v===0 ? 1 : (v>0 ? 1 : -1));
  const sx = sgn(dx);
  const sy = sgn(dy);

  // standardfall: sista segmentet vertikalt (tidigare beteende)
  if (!startHoriz && !endHoriz){
    if (x1 === x2) return `M ${x1},${y1} L ${x2},${y2}`;
    const s  = Math.min(stub, Math.max(0, Math.abs(dy)/2) || stub);
    const yStart = y1 + sy*s;
    const yEnd   = y2 - sy*s;
    return [
      `M ${x1},${y1}`,
      `L ${x1},${yStart}`,
      `L ${x2},${yStart}`,
      `L ${x2},${yEnd}`,
      `L ${x2},${y2}`
    ].join(' ');
  }

  // start vertikalt, slut horisontellt (… -> 12/14)
  if (!startHoriz && endHoriz){
    const s  = stub;
    const xNear = x2 - sx*s;   // närma dig i x-led
    const yKnee = y1 + sy*s;
    return [
      `M ${x1},${y1}`,
      `L ${x1},${yKnee}`,
      `L ${xNear},${yKnee}`,
      `L ${xNear},${y2}`,
      `L ${x2},${y2}`
    ].join(' ');
  }

  // start horisontellt, slut vertikalt (12/14 -> …)
  if (startHoriz && !endHoriz){
    const s  = stub;
    const xKnee = x1 + sx*s;
    const yNear = y2 - sy*s;
    return [
      `M ${x1},${y1}`,
      `L ${xKnee},${y1}`,
      `L ${xKnee},${yNear}`,
      `L ${x2},${yNear}`,
      `L ${x2},${y2}`
    ].join(' ');
  }

  // start horisontellt OCH slut horisontellt
  if (startHoriz && endHoriz){
    const s  = stub;
    const xL = x1 + sx*s;
    const xR = x2 - sx*s;
    return [
      `M ${x1},${y1}`,
      `L ${xL},${y1}`,
      `L ${xR},${y1}`,
      `L ${xR},${y2}`,
      `L ${x2},${y2}`
    ].join(' ');
  }
}

function wireCenterXY(a, b){
  return { cx:(a.x+b.x)/2, cy:(a.y+b.y)/2 };
}

/* ---------- Rita om ledningar ---------- */
function redrawConnections(){
  connLayer.setAttribute('width',  compLayer.clientWidth);
  connLayer.setAttribute('height', compLayer.clientHeight);
  connections.forEach(conn=>{
    const c1 = components.find(c=>c.id===conn.from.id);
    const c2 = components.find(c=>c.id===conn.to.id);
    if(!c1 || !c2) return;
    const a = portGlobalPosition(c1, conn.from.port);
    const b = portGlobalPosition(c2, conn.to.port);

    // 12/14: horisontell sista/första biten
    const startHoriz = (conn.from.port === '12' || conn.from.port === '14');
    const endHoriz   = (conn.to.port   === '12' || conn.to.port   === '14');

    const d = drawWirePath(a.x, a.y, b.x, b.y, { startHoriz, endHoriz });

    // uppdatera path + hit
    conn.pathEl.setAttribute('d', d);
    conn.hitEl?.setAttribute('d', d);

    // placera trycketikett i mitten
    if (conn.pressLbl){
      const mid = wireCenterXY(a,b);
      conn.pressLbl.setAttribute('x', mid.cx);
      conn.pressLbl.setAttribute('y', mid.cy - 6); // liten upp-justering
      conn.pressBg?.setAttribute('x', mid.cx - 12);
      conn.pressBg?.setAttribute('y', mid.cy - 17);
    }
  });
}

/* ---------- Val / radering ---------- */
function setComponentSelected(comp, on){
  comp.el.classList.toggle('selected', !!on);
  if (on) selectedComponents.add(comp); else selectedComponents.delete(comp);
}
function clearSelectedComponents(){
  [...selectedComponents].forEach(c=> c.el.classList.remove('selected'));
  selectedComponents.clear();
}
function selectConnection(conn){
  clearSelectedComponents();
  if (selectedConnection && selectedConnection!==conn) selectedConnection.pathEl.classList.remove('selected');
  selectedConnection = conn;
  if (selectedConnection) selectedConnection.pathEl.classList.add('selected');
}
function clearSelectedConnection(){
  if (selectedConnection){
    selectedConnection.pathEl.classList.remove('selected');
    selectedConnection = null;
  }
}

compLayer.addEventListener('click', (e)=>{
  // spara sista klickpunkt (för paste-offset)
  const r = workspaceBBox();
  lastClickPoint = { x: clamp(e.clientX - r.left, 0, r.width), y: clamp(e.clientY - r.top, 0, r.height) };

  // Om vi är i länk-läge: ignorera rensning (portar har prioritet)
  if (pendingPort) return;

  clearSelectedConnection();
  if (!e.shiftKey) clearSelectedComponents();
  hideCtxMenu();
});

window.addEventListener('keydown', (e)=>{
  // Avbryt länkning med ESC
  if (e.key === 'Escape' && pendingPort){
    cancelLinking();
    return;
  }

  // Copy/Cut/Paste
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase()==='c'){
    if (!canEdit()) return;
    copySelectionToClipboard();
    e.preventDefault();
    return;
  }
  if (mod && e.key.toLowerCase()==='x'){
    if (!canEdit()) return;
    copySelectionToClipboard();
    deleteSelectedComponents();
    pushHistory('Cut components');
    e.preventDefault();
    return;
  }
  if (mod && e.key.toLowerCase()==='v'){
    if (!canEdit()) return;
    pasteClipboardAt(lastClickPoint.x, lastClickPoint.y);
    pushHistory('Paste components');
    e.preventDefault();
    return;
  }

  // Delete
  if ((e.key==='Delete' || e.key==='Backspace') && canEdit()){
    if (selectedConnection){
      (selectedConnection.groupEl ?? selectedConnection.pathEl).remove();
      connections = connections.filter(c=>c!==selectedConnection);
      selectedConnection = null;
      e.preventDefault();
      pushHistory('Delete wire');
      redrawConnections();
      return;
    }
    if (selectedComponents.size > 0){
      deleteSelectedComponents();
      e.preventDefault();
      pushHistory('Delete components');
      return;
    }
  }
});

/* ---------- Kontextmeny (högerklick) ---------- */
let ctxMenuEl = null;
function hideCtxMenu(){ if (ctxMenuEl){ ctxMenuEl.remove(); ctxMenuEl = null; } }
function showCtxMenu(x, y, { type, payload }){
  // blockera under länkning
  if (pendingPort) return;

  hideCtxMenu();
  const m = document.createElement('div');
  m.className = 'ctxmenu';
  m.style.left = x + 'px';
  m.style.top  = y + 'px';

  const delBtn = document.createElement('button');
  delBtn.textContent = canEdit() ? '🗑️ Ta bort' : '🔒 Redigering kräver STOP-läge';
  delBtn.disabled = !canEdit();
  delBtn.addEventListener('click', ()=>{
    if (!canEdit()) return;
    if (type==='component' && payload?.comp){
      setComponentSelected(payload.comp, true);
      deleteSelectedComponents();
      clearSelectedComponents();
      pushHistory('Delete component');
    } else if (type==='wire' && payload?.conn){
      (payload.conn.groupEl ?? payload.conn.pathEl).remove();
      connections = connections.filter(c=>c!==payload.conn);
      clearSelectedConnection();
      redrawConnections();
      pushHistory('Delete wire');
    }
    hideCtxMenu();
  });

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Avbryt';
  cancelBtn.addEventListener('click', hideCtxMenu);

  m.append(delBtn, cancelBtn);
  document.body.appendChild(m);

  setTimeout(()=>{
    const closer = (ev)=>{ if (!m.contains(ev.target)) hideCtxMenu(); };
    document.addEventListener('click', closer, { once:true });
    document.addEventListener('contextmenu', closer, { once:true });
    window.addEventListener('scroll', hideCtxMenu, { once:true });
    window.addEventListener('resize', hideCtxMenu, { once:true });
  }, 0);

  ctxMenuEl = m;
}

function deleteComponent(comp){
  const toRemove = connections.filter(c => c.from.id===comp.id || c.to.id===comp.id);
  toRemove.forEach(c => (c.groupEl ?? c.pathEl).remove());
  connections = connections.filter(c => c.from.id!==comp.id && c.to.id!==comp.id);
  comp.el.remove();
  components = components.filter(c => c !== comp);
  hideCtxMenu();
  redrawConnections();
}
function deleteSelectedComponents(){
  const list = [...selectedComponents];
  list.forEach(c=> deleteComponent(c));
  clearSelectedComponents();
}

/* ---------- Drag ---------- */
function makeDraggable(comp){
  let dragging=false, dx=0, dy=0;

  function onDown(e){
    if (!canEdit()) return;
    if (pendingPort) return; // länk-läge: dra inte
    if (e.target.closest('.port')) return;

    // Shift-klick togglar individ
    if (e.shiftKey){
      setComponentSelected(comp, !selectedComponents.has(comp));
    } else {
      // om inte redan i mängden: välj bara denna
      if (!selectedComponents.has(comp)){
        clearSelectedComponents();
        setComponentSelected(comp, true);
      }
    }

    // Starta drag om komponenten är vald
    dragging = true;
    const rect = workspaceBBox();
    dx = e.clientX - (rect.left + comp.x);
    dy = e.clientY - (rect.top  + comp.y);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp, { once:true });
  }
  function onMove(e){
    if(!dragging) return;
    const rect = workspaceBBox();
    const mx = clamp(e.clientX - rect.left - dx, 40, rect.width-40);
    const my = clamp(e.clientY - rect.top  - dy, 40, rect.height-40);

    // Om flera vald: flytta dem relativt samma delta som "comp"
    const ox = mx - comp.x;
    const oy = my - comp.y;
    [...selectedComponents].forEach(c=>{
      c.x = clamp(c.x + ox, 40, rect.width-40);
      c.y = clamp(c.y + oy, 40, rect.height-40);
      c.el.style.left = c.x + 'px';
      c.el.style.top  = c.y + 'px';
    });
    redrawConnections();
  }
  function onUp(){
    dragging=false;
    pushHistory('Move component');
    window.removeEventListener('mousemove', onMove);
  }
  comp.el.addEventListener('mousedown', onDown);

  comp.el.addEventListener('contextmenu', (e)=>{
    e.preventDefault();
    if (pendingPort) return; // länk-läge
    if (!selectedComponents.has(comp)){
      clearSelectedComponents();
      setComponentSelected(comp, true);
    }
    showCtxMenu(e.clientX, e.clientY, { type:'component', payload:{ comp } });
  });
}

/* ---------- Marquee (rektangelmarkering) ---------- */
let marqueeActive = false;
let marqueeStart  = null;
let marqueeEl     = null;
let marqueeAdd    = false;

compLayer.addEventListener('mousedown', (e)=>{
  if (!canEdit()) return;
  if (pendingPort) return; // länk-läge: ingen marquee
  if (e.target.closest('.comp') || e.target.closest('.port')) return; // låt komponenters egna mousedown hantera
  hideCtxMenu();

  marqueeActive = true;
  marqueeAdd = !!e.shiftKey;
  if (!marqueeAdd) clearSelectedComponents();

  marqueeStart = { x: e.clientX, y: e.clientY };

  marqueeEl = document.createElement('div');
  marqueeEl.className = 'marquee-box';
  marqueeEl.style.left = `${e.clientX}px`;
  marqueeEl.style.top  = `${e.clientY}px`;
  document.body.appendChild(marqueeEl);

  function onMove(ev){
    if (!marqueeActive) return;
    const x1 = Math.min(marqueeStart.x, ev.clientX);
    const y1 = Math.min(marqueeStart.y, ev.clientY);
    const x2 = Math.max(marqueeStart.x, ev.clientX);
    const y2 = Math.max(marqueeStart.y, ev.clientY);
    marqueeEl.style.left   = `${x1}px`;
    marqueeEl.style.top    = `${y1}px`;
    marqueeEl.style.width  = `${x2-x1}px`;
    marqueeEl.style.height = `${y2-y1}px`;

    // markera komponenter som skär rektangel
    const selRect = { left:x1, top:y1, right:x2, bottom:y2 };
    components.forEach(c=>{
      const b = c.el.getBoundingClientRect();
      const hit = !(b.right < selRect.left || b.left > selRect.right || b.bottom < selRect.top || b.top > selRect.bottom);
      if (hit) setComponentSelected(c, true);
      else if (!marqueeAdd) setComponentSelected(c, false);
    });
  }
  function onUp(){
    marqueeActive = false;
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp, { once:true });
    marqueeEl?.remove(); marqueeEl=null;
    pushHistory('Select components');
  }

  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp, { once:true });
});

/* ---------- Koppla portar (med osynlig hit-yta & trycketikett) ---------- */
function beginLinking(){
  document.body.classList.add('linking');
}
function endLinking(){
  document.body.classList.remove('linking');
}
function cancelLinking(){
  // hitta första port och återställ färg
  const prevComp = components.find(c=>c.id===pendingPort?.id);
  if (prevComp){ prevComp.ports[pendingPort.port]?.el?.setAttribute('fill','#fff'); }
  pendingPort = null;
  endLinking();
}

function handlePortClick(comp, portKey, portEl){
  if (!canEdit()) return;
  hideCtxMenu();
  clearSelectedConnection();

  if (!pendingPort){
    pendingPort = { id: comp.id, port: portKey };
    portEl.setAttribute('fill', '#dff1ff');
    // Endast denna komponent vald om inte Shift
    if (!selectedComponents.has(comp)){
      clearSelectedComponents();
      setComponentSelected(comp, true);
    }
    beginLinking();
    return;
  }
  // klick på samma port = avbryt
  if (pendingPort.id === comp.id && pendingPort.port === portKey){
    cancelLinking();
    return;
  }

  // Skapa wire-grupp
  const g = document.createElementNS('http://www.w3.org/2000/svg','g');

  const pathHit = document.createElementNS('http://www.w3.org/2000/svg','path');
  pathHit.setAttribute('class','wire-hit');

  const pathVis = document.createElementNS('http://www.w3.org/2000/svg','path');
  pathVis.setAttribute('class','wire');
  pathVis.style.pointerEvents = 'none'; // klick sker på hit-lagret

  // Trycketikett (text) + liten transparent bakgrund för läsbarhet
  const pressLbl = document.createElementNS('http://www.w3.org/2000/svg','text');
  pressLbl.setAttribute('class','wirePressure');
  pressLbl.setAttribute('text-anchor','middle');
  pressLbl.setAttribute('dominant-baseline','central');

  // (valfri) bakgrundsrektangel – kan lämnas av
  // const pressBg = document.createElementNS('http://www.w3.org/2000/svg','rect');
  // pressBg.setAttribute('class','wirePressureBg');
  // pressBg.setAttribute('width','24');
  // pressBg.setAttribute('height','14');
  // pressBg.setAttribute('rx','3');

  // g.append(pathHit, pathVis, pressBg, pressLbl);
  g.append(pathHit, pathVis, pressLbl);
  connLayer.appendChild(g);

  function onClick(e){
    if (pendingPort) return; // i länk-läge har portar prioritet
    e.stopPropagation();
    const conn = connections.find(c=>c.pathEl===pathVis);
    if (conn) selectConnection(conn);
  }
  function onCtx(e){
    if (pendingPort) return;
    e.preventDefault();
    const conn = connections.find(c=>c.pathEl===pathVis);
    if (conn){
      selectConnection(conn);
      showCtxMenu(e.clientX, e.clientY, { type:'wire', payload:{ conn } });
    }
  }
  function onEnter(){ if (!pendingPort) pathVis.classList.add('selected'); }
  function onLeave(){ if (!pendingPort && selectedConnection?.pathEl !== pathVis) pathVis.classList.remove('selected'); }

  pathHit.addEventListener('click', onClick);
  pathHit.addEventListener('contextmenu', onCtx);
  pathHit.addEventListener('mouseenter', onEnter);
  pathHit.addEventListener('mouseleave', onLeave);

  const conn = {
    from: pendingPort,
    to:   { id: comp.id, port: portKey },
    pathEl: pathVis,      // synlig path
    hitEl:  pathHit,      // klick-yta
    groupEl: g,           // hela gruppen
    pressLbl,             // trycktext
    // pressBg
  };
  connections.push(conn);

  const prevComp = components.find(c=>c.id===pendingPort.id);
  if (prevComp) prevComp.ports[pendingPort.port]?.el?.setAttribute('fill','#fff');

  pendingPort = null;
  endLinking();
  redrawConnections();
  pushHistory('Create wire');
}

/* ---------- TRYCK-OVERLAY (numeriskt) ---------- */
// Bygg fullständig "ledningsgraf": wires + öppna inre förbindelser i ventiler
function computePressureMap(){
  const key = (id,port)=> `${id}:${port}`;

  // 1) grafkanter
  const adj = new Map();
  const add = (a,b)=>{
    if (!adj.has(a)) adj.set(a, new Set());
    if (!adj.has(b)) adj.set(b, new Set());
    adj.get(a).add(b); adj.get(b).add(a);
  };

  // a) kablage-ledningar
  connections.forEach(conn=>{
    add(key(conn.from.id, conn.from.port), key(conn.to.id, conn.to.port));
  });

  // b) komponent-inre förbindelser (beroende på läge)
  components.forEach(c=>{
    if (c.type==='valve52'){
      if (c.state === 0){
        // 1 <-> 4,  2 <-> 3
        add(key(c.id,'1'), key(c.id,'4'));
        add(key(c.id,'2'), key(c.id,'3'));
      } else {
        // 1 <-> 2,  4 <-> 5
        add(key(c.id,'1'), key(c.id,'2'));
        add(key(c.id,'4'), key(c.id,'5'));
      }
    } else if (c.type==='limit32'){
      const active = !!c.state?.active;
      if (active) add(key(c.id,'2'), key(c.id,'1'));
      else        add(key(c.id,'2'), key(c.id,'3'));
    } else if (c.type==='push32'){
      const active = !!c.state?.active;
      if (active) add(key(c.id,'2'), key(c.id,'1'));
      else        add(key(c.id,'2'), key(c.id,'3'));
    }
  });

  // 2) källor (noder med fasta tryck)
  const sources = [];
  components.forEach(c=>{
    if (c.type==='source'){
      if (c.ports?.OUT) sources.push([key(c.id,'OUT'), SUPPLY_BAR]);
      if (c.ports?.P)   sources.push([key(c.id,'P'),   SUPPLY_BAR]);
    }
    if (c.type==='valve52'){
      sources.push([key(c.id,'3'), 0.0]); // avluft
      sources.push([key(c.id,'5'), 0.0]);
    }
    if (c.type==='limit32' || c.type==='push32'){
      sources.push([key(c.id,'3'), 0.0]);
    }
  });

  // 3) multi-source BFS → högsta tryck vinner per komponent
  const pressure = new Map();
  const q = [];
  for (const [n, p] of sources){
    const prev = pressure.get(n);
    if (prev == null || p > prev){
      pressure.set(n, p);
      q.push([n, p]);
    }
  }
  while(q.length){
    const [n, p] = q.shift();
    const nbrs = adj.get(n);
    if (!nbrs) continue;
    for (const m of nbrs){
      const prev = pressure.get(m);
      if (prev == null || p > prev){
        pressure.set(m, p);
        q.push([m, p]);
      }
    }
  }

  return pressure;
}

let lastPressure = new Map(); // key -> bar
let stepOnceFlag = false; // ⏭️ ett enstaka sim-tick

function pressureAt(id, port){
  return lastPressure.get(`${id}:${port}`);
}

function simulate(dt){
  const playing = (simMode === Modes.PLAY) || stepOnceFlag;

  // 0) låt komponenter uppdatera internt läge (t.ex. limit32/push32 grafik)
  components.forEach(c=>{
    if (typeof c.recompute === 'function') c.recompute();
  });

  // 1) tryckbild (numerisk)
  if (playing){
    lastPressure = computePressureMap();
  } else if (simMode === Modes.STOP){
    lastPressure = new Map();
  }
  // (i PAUSE behåller vi lastPressure)

  // 2) pilotstyrning (rising-edge) för 5/2 – luftpuls på 12 eller 14 togglar läge
  if (playing){
    components.forEach(v=>{
      if (v.type!=='valve52') return;
      if (v._pilot12Prev === undefined) v._pilot12Prev = false;
      if (v._pilot14Prev === undefined) v._pilot14Prev = false;

      const p12 = (pressureAt(v.id,'12') ?? 0) > EPS;
      const p14 = (pressureAt(v.id,'14') ?? 0) > EPS;

      if (p12 && !v._pilot12Prev) v.toggle();
      if (p14 && !v._pilot14Prev) v.toggle();

      v._pilot12Prev = p12;
      v._pilot14Prev = p14;
    });
  }

  // 3) overlay på portar (pressurized om >0)
  const simVisible = (simMode === Modes.PLAY) || (simMode === Modes.PAUSE) || stepOnceFlag;
  components.forEach(c=>{
    if (!c.ports) return;
    for (const k of Object.keys(c.ports)){
      const p = pressureAt(c.id, k) ?? 0;
      const on = simVisible && (p > EPS);
      c.ports[k].el?.classList.toggle('pressurized', on);
      // title tooltip med tryck
      if (simVisible) c.ports[k].el?.setAttribute('title', `${k}: ${prettyBar(p)} bar`);
      else            c.ports[k].el?.removeAttribute('title');
    }
  });

  // 4) cylinder-rörelse (binär logik: finns tryck vid Cap/Rod)
  if (playing){
    components.filter(c=>c.type==='cylDouble' || c.type==='cylinder').forEach(cyl=>{
      const capPress = (pressureAt(cyl.id,'Cap') ?? 0) > EPS;
      const rodPress = (pressureAt(cyl.id,'Rod') ?? 0) > EPS;

      let target = cyl.pos;
      if (capPress && !rodPress) target = 1;
      else if (!capPress && rodPress) target = 0;

      const speed = 0.8;
      const dir = Math.sign(target - cyl.pos);
      if (dir!==0) cyl.setPos(cyl.pos + dir*speed*dt);
    });
  }

  // 5) wires: aktiva (blink) + trycketikett
  connections.forEach(conn=>{
    const pa = pressureAt(conn.from.id, conn.from.port);
    const pb = pressureAt(conn.to.id,   conn.to.port);
    const p  = (pa!=null && pb!=null) ? Math.min(pa, pb) : (pa ?? pb);
    const active = simVisible && (p ?? 0) > EPS;

    conn.pathEl?.classList.toggle('active', active);

    if (conn.pressLbl){
      conn.pressLbl.textContent = simVisible ? `${prettyBar(p)} bar` : '';
      conn.pressLbl.classList.toggle('on', active);
      conn.pressLbl.style.display = simVisible ? 'block' : 'none';
      // om rektangel-bakgrund används:
      // if (conn.pressBg){ conn.pressBg.style.display = simVisible ? 'block' : 'none'; }
    }
  });

  stepOnceFlag = false; // rensa stegflagga efter ett tick
}

/* ---------- RAF-loop ---------- */
let last = performance.now();
function tick(t){
  const dt = Math.min(0.05, (t-last)/1000);
  last = t;
  simulate(dt);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

/* ---------- Historik ---------- */
function snapshotProject(){
  const comps = components.map(c=>{
    const base = { id:c.id, type:c.type, x:c.x, y:c.y };
    if (c.type==='valve52') return { ...base, state:c.state };
    if (c.type==='cylDouble' || c.type==='cylinder') return { ...base, pos:c.pos??0 };
    if (c.type==='push32')  return { ...base, active: !!(c.state?.active) };
    // limit32 styrs via signaler, ingen extra state behövs
    return base;
  });
  const conns = connections.map(conn=>({
    from:{ id:conn.from.id, port:conn.from.port },
    to:  { id:conn.to.id,   port:conn.to.port }
  }));
  return { version: 8, comps, conns };
}
function clearProject(){
  connections.forEach(c=> (c.groupEl ?? c.pathEl).remove());
  connections = [];
  components.forEach(c=>c.el.remove());
  components = [];
  nextId = 1;
  pendingPort = null;
  endLinking();
  clearSelectedConnection();
  clearSelectedComponents();
  hideCtxMenu();
  redrawConnections();
}
async function loadProject(data){
  isRestoring = true;
  clearProject();

  const idMap = new Map();
  for (const sc of data.comps){
    let comp = null;
    if (sc.type === 'source'){
      comp = addSource(sc.x, sc.y, compLayer, components, handlePortClick, makeDraggable, redrawConnections, uid);
    } else if (sc.type === 'valve52'){
      const v = addValve52(sc.x, sc.y, compLayer, components, handlePortClick, makeDraggable, redrawConnections, uid);
      if (typeof sc.state==='number' && typeof v.setState==='function') v.setState(sc.state);
      v._pilot12Prev = false; v._pilot14Prev = false;
      wrapValveToggleGuard(v);
      comp = v;
    } else if (sc.type === 'cylDouble' || sc.type === 'cylinder'){
      comp = addCylinderDouble(
        sc.x, sc.y,
        compLayer, components,
        handlePortClick, makeDraggable, redrawConnections,
        uid,
        getNextCylinderLetter,
        setSignal
      );
      if (typeof sc.pos==='number' && typeof comp.setPos==='function') comp.setPos(sc.pos);
    } else if (sc.type === 'andValve'){
      comp = addAndValve(sc.x, sc.y, compLayer, components, handlePortClick, makeDraggable, redrawConnections, uid);
    } else if (sc.type === 'orValve'){
      comp = addOrValve(sc.x, sc.y, compLayer, components, handlePortClick, makeDraggable, redrawConnections, uid);
    } else if (sc.type === 'limit32'){
      comp = addLimitValve32(sc.x, sc.y, compLayer, components, handlePortClick, makeDraggable, redrawConnections, uid, getSignal);
    } else if (sc.type === 'push32'){
      comp = addPushButton32(sc.x, sc.y, compLayer, components, handlePortClick, makeDraggable, redrawConnections, uid);
      if (typeof sc.active==='boolean'){ comp.state.active = sc.active; comp.recompute?.(); }
    } else {
      continue;
    }
    idMap.set(sc.id, comp.id);
  }

  // återskapa wires med hit-yta + trycktext
  for (const conn of data.conns){
    const newFromId = idMap.get(conn.from.id);
    const newToId   = idMap.get(conn.to.id);
    if (!newFromId || !newToId) continue;

    const g = document.createElementNS('http://www.w3.org/2000/svg','g');

    const pathHit = document.createElementNS('http://www.w3.org/2000/svg','path');
    pathHit.setAttribute('class','wire-hit');

    const pathVis = document.createElementNS('http://www.w3.org/2000/svg','path');
    pathVis.setAttribute('class','wire');
    pathVis.style.pointerEvents = 'none';

    const pressLbl = document.createElementNS('http://www.w3.org/2000/svg','text');
    pressLbl.setAttribute('class','wirePressure');
    pressLbl.setAttribute('text-anchor','middle');
    pressLbl.setAttribute('dominant-baseline','central');

    g.append(pathHit, pathVis, pressLbl);
    connLayer.appendChild(g);

    pathHit.addEventListener('click', (e)=>{ if (pendingPort) return; e.stopPropagation(); const c = connections.find(k=>k.pathEl===pathVis); if (c) selectConnection(c); });
    pathHit.addEventListener('contextmenu', (e)=>{ if (pendingPort) return; e.preventDefault(); const c = connections.find(k=>k.pathEl===pathVis); if (c){ selectConnection(c); showCtxMenu(e.clientX,e.clientY,{ type:'wire', payload:{ conn:c }}); }});
    pathHit.addEventListener('mouseenter', ()=> { if (!pendingPort) pathVis.classList.add('selected'); });
    pathHit.addEventListener('mouseleave', ()=>{ if (!pendingPort && selectedConnection?.pathEl !== pathVis) pathVis.classList.remove('selected'); });

    connections.push({
      from: { id: newFromId, port: conn.from.port },
      to:   { id: newToId,   port: conn.to.port },
      pathEl: pathVis,
      hitEl:  pathHit,
      groupEl: g,
      pressLbl
    });
  }

  redrawConnections();
  isRestoring = false;
}

/* ---------- Urval → Urklipp ---------- */
let clipboard = null; // { comps:[...], conns:[...], offset:{x,y}, w,h }
function copySelectionToClipboard(){
  if (selectedComponents.size === 0) return;
  // bbox över val
  const rects = [...selectedComponents].map(c=> c.el.getBoundingClientRect());
  const x1 = Math.min(...rects.map(r=>r.left));
  const y1 = Math.min(...rects.map(r=>r.top));
  const x2 = Math.max(...rects.map(r=>r.right));
  const y2 = Math.max(...rects.map(r=>r.bottom));

  const r = workspaceBBox();
  const box = { x: x1 - r.left, y: y1 - r.top, w: (x2-x1), h: (y2-y1) };

  const ids = new Set([...selectedComponents].map(c=>c.id));

  // komponenter
  const comps = [...selectedComponents].map(c=>{
    const base = { type:c.type, x: c.x - box.x, y: c.y - box.y };
    if (c.type==='valve52') return { ...base, state:c.state };
    if (c.type==='cylDouble' || c.type==='cylinder') return { ...base, pos:c.pos??0 };
    if (c.type==='push32') return { ...base, active: !!(c.state?.active) };
    return base;
  });

  // anslutningar där båda ändar är inom urvalet
  const conns = connections
    .filter(k=> ids.has(k.from.id) && ids.has(k.to.id))
    .map(k=>({
      from:{ ref:k.from.id, port:k.from.port },
      to:  { ref:k.to.id,   port:k.to.port }
    }));

  clipboard = { comps, conns, box };
}

function pasteClipboardAt(targetX, targetY){
  if (!clipboard) return;
  const { comps, conns, box } = clipboard;

  // placera med boxens övre vänstra hörn på target-(x,y)
  const baseX = targetX + 20; // liten offset
  const baseY = targetY + 20;

  const createdStartIndex = components.length;

  // Skapa komponenter
  comps.forEach(sc=>{
    let comp = null;
    const x = baseX + sc.x;
    const y = baseY + sc.y;

    if (sc.type === 'source'){
      comp = addSource(x, y, compLayer, components, handlePortClick, makeDraggable, redrawConnections, uid);
    } else if (sc.type === 'valve52'){
      const v = addValve52(x, y, compLayer, components, handlePortClick, makeDraggable, redrawConnections, uid);
      if (typeof sc.state==='number' && typeof v.setState==='function') v.setState(sc.state);
      v._pilot12Prev = false; v._pilot14Prev = false;
      wrapValveToggleGuard(v);
      comp = v;
    } else if (sc.type === 'cylDouble' || sc.type === 'cylinder'){
      comp = addCylinderDouble(
        x, y,
        compLayer, components,
        handlePortClick, makeDraggable, redrawConnections,
        uid,
        getNextCylinderLetter,
        setSignal
      );
      if (typeof sc.pos==='number' && typeof comp.setPos==='function') comp.setPos(sc.pos);
    } else if (sc.type === 'andValve'){
      comp = addAndValve(x, y, compLayer, components, handlePortClick, makeDraggable, redrawConnections, uid);
    } else if (sc.type === 'orValve'){
      comp = addOrValve(x, y, compLayer, components, handlePortClick, makeDraggable, redrawConnections, uid);
    } else if (sc.type === 'limit32'){
      comp = addLimitValve32(x, y, compLayer, components, handlePortClick, makeDraggable, redrawConnections, uid, getSignal);
    } else if (sc.type === 'push32'){
      comp = addPushButton32(x, y, compLayer, components, handlePortClick, makeDraggable, redrawConnections, uid);
      if (typeof sc.active==='boolean'){ comp.state.active = sc.active; comp.recompute?.(); }
    } else {
      return;
    }
  });

  // index-map: clipboard-ordning -> nya component-id
  const created = components.slice(createdStartIndex);
  const indexMap = new Map();
  comps.forEach((c, idx)=> indexMap.set(idx, created[idx]?.id));

  // Om clipboard.connsIndex saknas: skapa den baserat på ref-id matchning mot comps-ordning (bäst effort)
  if (!clipboard.connsIndex){
    clipboard.connsIndex = clipboard.conns.map(c=>({
      fromIdx: comps.findIndex(cc=> cc.refId ? cc.refId===c.from.ref : false),
      fromPort: c.from.port,
      toIdx:   comps.findIndex(cc=> cc.refId ? cc.refId===c.to.ref : false),
      toPort:  c.to.port
    })).map((ci,i)=>{
      // fallback – om refId saknas (vanligt), mappa i ordning
      if (ci.fromIdx<0 || ci.toIdx<0){
        const f = connections.length; // dummy
      }
      return {
        fromIdx: comps.findIndex(cc=> cc===clipboard.conns[i].from.ref),
        fromPort: clipboard.conns[i].from.port,
        toIdx:   comps.findIndex(cc=> cc===clipboard.conns[i].to.ref),
        toPort:  clipboard.conns[i].to.port
      };
    });
  }

  // Skapa ledningar
  clipboard.connsIndex.forEach(c=>{
    const fromId = indexMap.get(c.fromIdx);
    const toId   = indexMap.get(c.toIdx);
    if (!fromId || !toId) return;

    const g = document.createElementNS('http://www.w3.org/2000/svg','g');

    const pathHit = document.createElementNS('http://www.w3.org/2000/svg','path');
    pathHit.setAttribute('class','wire-hit');

    const pathVis = document.createElementNS('http://www.w3.org/2000/svg','path');
    pathVis.setAttribute('class','wire');
    pathVis.style.pointerEvents = 'none';

    const pressLbl = document.createElementNS('http://www.w3.org/2000/svg','text');
    pressLbl.setAttribute('class','wirePressure');
    pressLbl.setAttribute('text-anchor','middle');
    pressLbl.setAttribute('dominant-baseline','central');

    g.append(pathHit, pathVis, pressLbl);
    connLayer.appendChild(g);

    pathHit.addEventListener('click', (e)=>{ if (pendingPort) return; e.stopPropagation(); const c0 = connections.find(k=>k.pathEl===pathVis); if (c0) selectConnection(c0); });
    pathHit.addEventListener('contextmenu', (e)=>{ if (pendingPort) return; e.preventDefault(); const c0 = connections.find(k=>k.pathEl===pathVis); if (c0){ selectConnection(c0); showCtxMenu(e.clientX,e.clientY,{ type:'wire', payload:{ conn:c0 }}); }});
    pathHit.addEventListener('mouseenter', ()=> { if (!pendingPort) pathVis.classList.add('selected'); });
    pathHit.addEventListener('mouseleave', ()=>{ if (!pendingPort && selectedConnection?.pathEl !== pathVis) pathVis.classList.remove('selected'); });

    connections.push({
      from: { id: fromId, port: c.fromPort },
      to:   { id: toId,   port: c.toPort },
      pathEl: pathVis,
      hitEl:  pathHit,
      groupEl: g,
      pressLbl
    });
  });

  redrawConnections();
}

/* ---------- Undo/Redo ---------- */
function pushHistory(_label=''){
  if (isRestoring) return;
  const snap = snapshotProject();
  history.push(JSON.stringify(snap));
  if (history.length > HISTORY_LIMIT) history.shift();
  future = [];
  updateUndoRedoButtons();

  // Dessa åtgärder betraktas som ”rena”: Initial, Load project, Reset.
  // Allt annat sätter isDirty = true.
  const cleanLabels = ['Initial','Load project','Reset'];
  isDirty = !cleanLabels.includes(_label);
}
function undo(){
  if (history.length < 2) return;
  const current = snapshotProject();
  future.push(JSON.stringify(current));
  const prev = JSON.parse(history[history.length-2]);
  history.pop();
  isRestoring = true;
  loadProject(prev).then(()=>{ isRestoring = false; updateUndoRedoButtons(); });
}
function redo(){
  if (future.length === 0) return;
  const next = JSON.parse(future.pop());
  const current = snapshotProject();
  history.push(JSON.stringify(current));
  isRestoring = true;
  loadProject(next).then(()=>{ isRestoring = false; updateUndoRedoButtons(); });
}

/* ---------- UI ---------- */
function ensureButton(id, label, onClick){
  let btn = document.getElementById(id);
  if (!btn){
    const side = document.querySelector('.sidebar') || document.body;
    btn = document.createElement('button');
    btn.id = id; btn.className = 'btn';
    side.appendChild(btn);
  }
  btn.textContent = label;
  const fresh = btn.cloneNode(true);
  btn.replaceWith(fresh);
  fresh.addEventListener('click', onClick);
}

function setMode(m){
  if (m === simMode) return;
  simMode = m;
  updateModeButtons();
  if (simMode !== Modes.PLAY){
    connections.forEach(conn => conn.pathEl.classList.remove('active'));
  }
}
function updateModeButtons(){
  ensureButton('btnPlay',  simMode===Modes.PLAY  ? '▶️ Spelar…' : '▶️ Spela', ()=> setMode(Modes.PLAY));
  ensureButton('btnStep',  '⏭️ Stega', ()=>{
    stepOnceFlag = true;
    simulate(0.02); // ett kort tick
  });
  ensureButton('btnPause', simMode===Modes.PAUSE ? '⏸️ Paus'   : '⏸️ Pausa', ()=> setMode(Modes.PAUSE));
  ensureButton('btnStop',  '⏹️ Stoppa & återställ', ()=> resetSystem());

  const editableButtons = ['addSource','addValve52','addCylDouble','addAnd','addOr','addLimit32','addPush32','saveProj','loadProj','undoBtn','redoBtn'];
  editableButtons.forEach(id=>{
    const b = document.getElementById(id);
    if (b) b.disabled = !canEdit();
  });
}
function updateUndoRedoButtons(){
  const undoBtn = document.getElementById('undoBtn');
  const redoBtn = document.getElementById('redoBtn');
  if (undoBtn) undoBtn.disabled = !canEdit() || history.length < 2;
  if (redoBtn) redoBtn.disabled = !canEdit() || future.length === 0;
}

function resetSystem(){
  setMode(Modes.STOP);
  components.forEach(c=>{
    if (c.type==='valve52' && typeof c.setState==='function') c.setState(DEFAULT_VALVE_STATE);
    else if ((c.type==='cylDouble'||c.type==='cylinder') && typeof c.setPos==='function') c.setPos(DEFAULT_CYL_POS);
    else if (c.type==='push32'){ c.state.active=false; c.recompute?.(); }
    if (c.type==='valve52'){ c._pilot12Prev=false; c._pilot14Prev=false; } // nollställ pilotminne
  });
  connections.forEach(conn => conn.pathEl.classList.remove('active'));
  lastPressure = new Map();
  components.forEach(c=>{
    if (!c.ports) return;
    for (const k of Object.keys(c.ports)){ c.ports[k].el?.classList.remove('pressurized'); c.ports[k].el?.removeAttribute('title'); }
  });
  clearSelectedConnection(); clearSelectedComponents(); hideCtxMenu();
  pushHistory('Reset');
}

/* ---- Lås manuell växling av 5/2 till PLAY ---- */
function wrapValveToggleGuard(valveComp){
  if (!valveComp || typeof valveComp.toggle!=='function') return;
  const original = valveComp.toggle.bind(valveComp);
  valveComp.toggle = function(){ if (simMode!==Modes.PLAY) return; original(); };
}

/* ---- Skapa knappar ---- */
function addButtons(){
  ensureButton('addSource',  '➕ Tryckkälla', ()=>{
    if (!canEdit()) return;
    const r = workspaceBBox();
    addSource(r.width*0.15, r.height*0.50, compLayer, components, handlePortClick, makeDraggable, redrawConnections, uid);
    pushHistory('Add source');
  });
  ensureButton('addValve52', '➕ 5/2-ventil', ()=>{
    if (!canEdit()) return;
    const r = workspaceBBox();
    const v = addValve52(r.width*0.40, r.height*0.50, compLayer, components, handlePortClick, makeDraggable, redrawConnections, uid);
    v._pilot12Prev = false; v._pilot14Prev = false;
    wrapValveToggleGuard(v);
    pushHistory('Add valve52');
  });
  ensureButton('addCylDouble','➕ Cylinder, dubbelverkande', ()=>{
    if (!canEdit()) return;
    const r = workspaceBBox();
    addCylinderDouble(
      r.width*0.70, r.height*0.50,
      compLayer, components,
      handlePortClick, makeDraggable, redrawConnections,
      uid,
      getNextCylinderLetter,
      setSignal
    );
    pushHistory('Add cylinder');
  });
  ensureButton('addAnd',     '➕ AND-ventil', ()=>{
    if (!canEdit()) return;
    const r = workspaceBBox();
    addAndValve(r.width*0.25, r.height*0.35, compLayer, components, handlePortClick, makeDraggable, redrawConnections, uid);
    pushHistory('Add AND');
  });
  ensureButton('addOr',      '➕ OR-ventil', ()=>{
    if (!canEdit()) return;
    const r = workspaceBBox();
    addOrValve(r.width*0.25, r.height*0.65, compLayer, components, handlePortClick, makeDraggable, redrawConnections, uid);
    pushHistory('Add OR');
  });
  ensureButton('addLimit32', '➕ 3/2 gränslägesventil', ()=>{
    if (!canEdit()) return;
    const r = workspaceBBox();
    addLimitValve32(
      r.width*0.52, r.height*0.28,
      compLayer, components,
      handlePortClick, makeDraggable, redrawConnections,
      uid,
      getSignal // ventilen läser t.ex. a0/a1
    );
    pushHistory('Add limit32');
  });
  ensureButton('addPush32',  '➕ Tryckknapp 3/2', ()=>{
    if (!canEdit()) return;
    const r = workspaceBBox();
    addPushButton32(r.width*0.25, r.height*0.50, compLayer, components, handlePortClick, makeDraggable, redrawConnections, uid);
    pushHistory('Add push32');
  });

  ensureButton('saveProj', '💾 Spara projekt', ()=>{
    if (!canEdit()) return;

    const snap = snapshotProject();

    const defaultName = currentProjectName || 'projekt';
    const answer = window.prompt('Ange ett namn för projektet (utan filändelse):', defaultName);
    if (answer === null) return; // användaren avbröt

    // Sanera och kom fram till filnamn
    let name = answer.trim();
    if (!name) name = defaultName;
    name = name.replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '_');
    if (!name) name = 'projekt';

    currentProjectName = name;
    const filename = /\.json$/i.test(name) ? name : `${name}.json`;

    const a = document.createElement('a');
    a.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(snap, null, 2));
    a.download = filename;
    a.style.display='none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    isDirty = false;
  });

  ensureButton('loadProj', '📂 Ladda projekt', ()=>{
    if (!canEdit()) return;
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'application/json';
    inp.onchange = async (e)=>{
      const file = e.target.files?.[0]; if (!file) return;

      currentProjectName = file.name.replace(/\.json$/i, '');

      try {
        const data = JSON.parse(await file.text());
        await loadProject(data);
        pushHistory('Load project');
      } catch(err){
        console.error('Fel vid laddning:', err);
        alert('Ogiltig projektfil.');
      }
    };
    inp.click();
  });

  ensureButton('undoBtn', '↩️ Ångra', ()=> { if (canEdit()) undo(); });
  ensureButton('redoBtn', '↪️ Gör om', ()=> { if (canEdit()) redo(); });

  updateModeButtons();
  updateUndoRedoButtons();
}
addButtons();

/* ---------- Startlayout ---------- */
window.addEventListener('load', ()=>{
  const r = workspaceBBox();
  addSource(r.width*0.15, r.height*0.50, compLayer, components, handlePortClick, makeDraggable, redrawConnections, uid);
  const v = addValve52(r.width*0.40, r.height*0.50, compLayer, components, handlePortClick, makeDraggable, redrawConnections, uid);
  v._pilot12Prev = false; v._pilot14Prev = false;
  wrapValveToggleGuard(v);
  addCylinderDouble(
    r.width*0.70, r.height*0.50,
    compLayer, components,
    handlePortClick, makeDraggable, redrawConnections,
    uid,
    getNextCylinderLetter,
    setSignal
  );
  pushHistory('Initial');
});

// Varnar vid sidstängning/uppdatering om osparade ändringar finns
window.addEventListener('beforeunload', (e)=>{
  if (!isDirty) return;
  e.preventDefault();
  e.returnValue = '';
});

/* ---------- Nödvändig CSS (inkl. wire-hit, trycketikett, marquee, länkläge) ---------- */
(function injectOverlayCSS(){
  if (document.getElementById('overlayCSS')) return;
  const css = `
    .wire { stroke:#000; stroke-width:2; fill:none; }
    .wire.active { stroke:#d00; stroke-dasharray:6 6; animation: wireflow 1.2s linear infinite; }
    @keyframes wireflow { to { stroke-dashoffset: -12; } }
    .wire.selected { stroke:#0a74ff; stroke-width:3; }

    /* osynlig klick-yta ovanpå varje wire */
    .wire-hit {
      stroke:#000;
      stroke-opacity:0.001; /* 0 kan ignorera pointer-events i vissa webbläsare */
      stroke-width:14;       /* klickyta */
      fill:none;
      pointer-events:stroke; /* träffa "strecket" */
      stroke-linecap:round;
    }

    /* Trycketikett */
    .wirePressure {
      font: 11px/1 monospace;
      fill:#444;
      stroke:#fff; stroke-width:3px; paint-order: stroke;
      user-select: none;
      pointer-events: none;
    }
    .wirePressure.on { fill:#b00; }

    .comp.selected { outline: 2px dashed #0a74ff; outline-offset: 2px; }

    .port { fill:#fff; stroke:#0a74ff; stroke-width:1.5; cursor: pointer; }
    .port.pressurized { fill:#e6f3ff; stroke:#0073e6; stroke-width:2; }

    /* Länkläge: prioritera portar, byt markör, highlight */
    body.linking { cursor: crosshair; }
    body.linking .wire-hit { pointer-events: none; } /* wires tappas så portar får prioritet */
    body.linking .port { cursor: crosshair; }
    body.linking .port:hover { fill:#fffbe6; stroke-width:2; }

    .ctxmenu {
      position: fixed; z-index: 9999;
      background:#fff; border:1px solid #ccc; border-radius:8px;
      box-shadow: 0 8px 22px rgba(0,0,0,.12);
      padding:6px; font-size:14px; min-width:160px;
    }
    .ctxmenu button {
      display:block; width:100%; text-align:left;
      background:none; border:0; padding:8px 10px; cursor:pointer;
    }
    .ctxmenu button:hover { background:#f5f7ff; }
    .btn[disabled] { opacity: .5; cursor: not-allowed; }

    /* Marquee */
    .marquee-box {
      position: fixed;
      border: 1.5px dashed #0a74ff;
      background: rgba(10,116,255,0.08);
      pointer-events: none;
      z-index: 9998;
    }
  `;
  const style = document.createElement('style');
  style.id = 'overlayCSS';
  style.textContent = css;
  document.head.appendChild(style);
})();
