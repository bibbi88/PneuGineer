

// js/main.js
// Pneumatics workspace with orthogonal multi-segment wires, junctions, selection,
// history, and a simple pressure simulation.
//
// This build adds a new component: air-piloted 3/2 valve (airValve32).
// - Its geometry matches the pushButton32 mover-style (ports static; body slides).
// - Pilot port 12 is horizontal (snap/routing), and pilot pressure drives its state.
// - Spring return when pilot pressure goes away.
// UI: Play/Pause (single toggle), Step, Stop & Reset, Toggle Grid.
// All UI text and comments are in English.

import { addValve52 }        from './valve52.js';
import { addCylinderDouble } from './cylinderDouble.js';
import { addCylinderSingle } from './cylinderSingle.js';
import { addSource }         from './source.js';
import { addAndValve }       from './andValve.js';
import { addOrValve }        from './orValve.js';
import { addLimitValve32 }   from './limitValve32.js';
import { addPushButton32 }   from './pushButton32.js';
import { addAirValve32 }     from './airValve32.js';

/* ---------- DOM layers ---------- */
const compLayer = document.getElementById('compLayer');
const connLayer = document.getElementById('connLayer');

connLayer.style.zIndex = '2';
compLayer.style.zIndex = '1';
connLayer.style.pointerEvents = 'none'; // custom hit-test in this module

/* ---------- App state ---------- */
let components = [];
// connection shape:
// {
//   from:{id,port}, to:{id,port}, pathEl, labelEl,
//   guides:[{type:'H'|'V',pos:number}], handleEls:[],
//   stubStartLen?:number|null, stubEndLen?:number|null
// }
let connections = [];
let nextId = 1;
let pendingPort = null;
let isDirty = false;
let currentProjectName = 'project';

let selectedConnection = null;
let selectedComponent  = null;
let selectedComponents = new Set();

const Modes = { STOP:'stop', PLAY:'play', PAUSE:'pause' };
let simMode = Modes.STOP;

const DEFAULT_VALVE_STATE = 1;
const DEFAULT_CYL_POS     = 0;

/* ---------- Undo/Redo ---------- */
const HISTORY_LIMIT = 50;
let history = [];
let future  = [];
let isRestoring = false;

/* ---------- Grid & Snap ---------- */
let GRID_ENABLED = true;
const GRID_SIZE = 10;
function snap(v, g=GRID_SIZE){ return GRID_ENABLED ? Math.round(v / g) * g : v; }

/* ---------- Utils ---------- */
function uid(){ return nextId++; }
function workspaceBBox(){ return compLayer.getBoundingClientRect(); }
function canEdit(){ return simMode === Modes.STOP; }
function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }

/* Fine nudge with arrow keys (Shift = x10) */
function nudgeSelectedComponents(dx, dy){
  if (!canEdit()) return;
  if (selectedComponents.size === 0) return;

  const rect = workspaceBBox();
  selectedComponents.forEach(c=>{
    const nx = snap(clamp(c.x + dx, 40, rect.width  - 40));
    const ny = snap(clamp(c.y + dy, 40, rect.height - 40));
    c.x = nx; c.y = ny;
    c.el.style.left = nx + 'px';
    c.el.style.top  = ny + 'px';
  });
  redrawConnections();
}

/* ---------- Signals & cylinder names ---------- */
const signals = {};
function setSignal(key, value) {
  const v = !!value;
  if (signals[key] === v) return;
  signals[key] = v;
  redrawConnections?.();
}
function getSignal(key) { return !!signals[key]; }
let cylinderCount = 0;
function getNextCylinderLetter() {
  const code = 'A'.charCodeAt(0) + cylinderCount;
  cylinderCount += 1;
  return String.fromCharCode(code);
}

/* ---------- Port → global coordinates ---------- */
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

/* ---------- Wires (orthogonal) ---------- */
const WIRE_STUB = 14;

// Port entry orientation: 12/14 on 5/2 must be horizontal; 12 on airValve32 is horizontal
function getPortEntryOrientation(comp, portKey){
  if (comp?.type === 'valve52'    && (portKey === '12' || portKey === '14')) return 'H';
  if (comp?.type === 'airValve32' && (portKey === '12' || portKey === '14')) return 'H';
  if (comp?.type === 'andValve') return (portKey === 'OUT') ? 'V' : 'H';
  if (comp?.type === 'orValve')  return (portKey === 'OUT') ? 'V' : 'H';
  return 'V';
}
function isValvePilotPort(comp, portKey){
  if (comp?.type === 'valve52'    && (portKey === '12' || portKey === '14')) return true;
  if (comp?.type === 'airValve32' && portKey === '12') return true;   // ⟵ add
  return false;
}

// Make a short endpoint stub from pHere towards pOther along desired axis
function makeEndpointStub(pHere, pOther, orient, len = WIRE_STUB){
  if (orient === 'H'){
    const dir = (pOther.x >= pHere.x) ? 1 : -1;
    return { x: pHere.x + dir*len, y: pHere.y };
  } else {
    const dir = (pOther.y >= pHere.y) ? 1 : -1;
    return { x: pHere.x, y: pHere.y + dir*len };
  }
}

// Simple orthogonal auto route without guides
function routeAuto(x1,y1,x2,y2){
  if (x1 === x2){
    return {
      points: [{x:x1,y:y1},{x:x2,y:y2}],
      label: { x: x1, y: (y1+y2)/2 - 6 }
    };
  }
  const dy = y2 - y1;
  const s  = Math.min(WIRE_STUB, Math.max(0, Math.abs(dy)/2) || WIRE_STUB);
  const yStart = y1 + (dy >= 0 ? s : -s);
  const yEnd   = y2 - (dy >= 0 ? s : -s);
  return {
    points: [
      {x:x1,y:y1},{x:x1,y:yStart},{x:x2,y:yStart},{x:x2,y:yEnd},{x:x2,y:y2}
    ],
    label: { x: (x1+x2)/2, y: yStart - 6 }
  };
}

// Find next guide of type 'H' or 'V' or fallback to target axis
function nextGuidePos(guides, i, type, fallback){
  for (let k=i+1;k<guides.length;k++){
    if (guides[k].type === type) return guides[k].pos;
  }
  return fallback;
}

// Route with user guides (H/V, in order)
function routeWithGuides(x1,y1,x2,y2, guides){
  const pts = [{x:x1,y:y1}];
  let cur = { x:x1, y:y1 };

  for (let i=0;i<guides.length;i++){
    const g = guides[i];
    if (g.type === 'H'){
      pts.push({ x:cur.x, y:g.pos });
      const nx = nextGuidePos(guides, i, 'V', x2);
      pts.push({ x:nx, y:g.pos });
      cur = { x:nx, y:g.pos };
    } else { // 'V'
      pts.push({ x:g.pos, y:cur.y });
      const ny = nextGuidePos(guides, i, 'H', y2);
      pts.push({ x:g.pos, y:ny });
      cur = { x:g.pos, y:ny };
    }
  }

  if (cur.x !== x2) pts.push({ x:x2, y:cur.y });
  if (cur.y !== y2) pts.push({ x:x2, y:y2 });

  const mid = polylineMidpoint(pts);
  return { points: pts, label: { x: mid.x, y: mid.y - 6 } };
}

function polylineMidpoint(pts){
  let tot=0;
  for (let i=0;i<pts.length-1;i++){
    tot += Math.abs(pts[i+1].x - pts[i].x) + Math.abs(pts[i+1].y - pts[i].y);
  }
  let acc=0;
  const half = tot/2;
  for (let i=0;i<pts.length-1;i++){
    const A = pts[i], B = pts[i+1];
    const seg = Math.abs(B.x-A.x) + Math.abs(B.y-A.y);
    if (acc + seg >= half){
      const need = half - acc;
      if (A.x===B.x){
        const y = A.y + Math.sign(B.y-A.y)*need;
        return { x:A.x, y };
      } else {
        const x = A.x + Math.sign(B.x-A.x)*need;
        return { x, y:A.y };
      }
    }
    acc += seg;
  }
  return pts[Math.floor(pts.length/2)] || pts[0];
}

function pathFromPoints(pts){
  let d = `M ${pts[0].x},${pts[0].y}`;
  for (let i=1;i<pts.length;i++){
    d += ` L ${pts[i].x},${pts[i].y}`;
  }
  return d;
}

/* ---------- Pilot stubs helpers ---------- */
function isPilotEndpoint(conn, which){ // 'start' | 'end'
  const end = (which==='start') ? conn.from : conn.to;
  const comp = components.find(c=> c.id === end.id);
  return isValvePilotPort(comp, end.port);
}
function pilotDir(conn, which){ // +1 for 12, -1 for 14
  const end = (which==='start') ? conn.from : conn.to;
  if (end.port === '12') return +1;
  if (end.port === '14') return -1;
  return +1;
}

/* ---------- Geometry incl. stubs and 12/14/12 rules ---------- */
function computeConnectionGeometry(conn){
  const c1 = components.find(c=>c.id===conn.from.id);
  const c2 = components.find(c=>c.id===conn.to.id);
  if(!c1 || !c2) return null;

  const a = portGlobalPosition(c1, conn.from.port);
  const b = portGlobalPosition(c2, conn.to.port);

  const oStart = getPortEntryOrientation(c1, conn.from.port);
  const oEnd   = getPortEntryOrientation(c2, conn.to.port);

  let a0, b0;
  if (isValvePilotPort(c1, conn.from.port)){
    const dir = pilotDir(conn,'start');
    const L = Math.max(6, Number(conn.stubStartLen ?? WIRE_STUB));
    a0 = { x: a.x + dir*L, y: a.y };
  } else {
    a0 = makeEndpointStub(a, b, oStart);
  }
  if (isValvePilotPort(c2, conn.to.port)){
    const dir = pilotDir(conn,'end');
    const L = Math.max(6, Number(conn.stubEndLen ?? WIRE_STUB));
    b0 = { x: b.x + dir*L, y: b.y };
  } else {
    b0 = makeEndpointStub(b, a, oEnd);
  }

  const guides = Array.isArray(conn.guides) ? conn.guides : [];
  const inner = (guides.length>0)
    ? routeWithGuides(a0.x, a0.y, b0.x, b0.y, guides)
    : routeAuto(a0.x, a0.y, b0.x, b0.y);

  const pts = [];
  pts.push({ x:a.x, y:a.y });
  if (a0.x!==a.x || a0.y!==a.y) pts.push(a0);
  const innerPts = inner.points;
  for (let i=1; i<innerPts.length-1; i++) pts.push(innerPts[i]);
  if (b0.x!==b.x || b0.y!==b.y) pts.push(b0);
  pts.push({ x:b.x, y:b.y });

  const mid = polylineMidpoint(pts);
  return { a, b, points: pts, label: { x: mid.x, y: mid.y - 6 } };
}

function redrawConnections(){
  connLayer.setAttribute('width',  compLayer.clientWidth);
  connLayer.setAttribute('height', compLayer.clientHeight);
  connections.forEach(conn=>{
    const geom = computeConnectionGeometry(conn);
    if (!geom) return;
    const d = pathFromPoints(geom.points);
    conn.pathEl.setAttribute('d', d);
    if (conn.labelEl){
      conn.labelEl.setAttribute('x', geom.label.x);
      conn.labelEl.setAttribute('y', geom.label.y);
    }
    refreshHandlesForConnection(conn, /*repositionOnly=*/true);
  });
}

/* ---------- Selection / deletion ---------- */
function applySelectedClasses(){
  components.forEach(c=>{
    c.el.classList.toggle('selected', selectedComponents.has(c));
  });
}
function clearSelectedConnection(){
  if (selectedConnection){
    selectedConnection.pathEl.classList.remove('selected');
    destroyHandlesForConnection(selectedConnection);
    selectedConnection = null;
  }
}
function selectConnection(conn){
  clearSelectedComponent();
  if (selectedConnection && selectedConnection!==conn){
    selectedConnection.pathEl.classList.remove('selected');
    destroyHandlesForConnection(selectedConnection);
  }
  selectedConnection = conn;
  if (selectedConnection){
    selectedConnection.pathEl.classList.add('selected');
    maybeSeedFirstGuide(selectedConnection);
    refreshHandlesForConnection(selectedConnection);
  }
}
function selectComponent(comp, additive=false){
  clearSelectedConnection();
  if (!additive) selectedComponents.clear();
  if (selectedComponents.has(comp) && additive){
    selectedComponents.delete(comp);
  } else {
    selectedComponents.add(comp);
    selectedComponent = comp;
  }
  applySelectedClasses();
}
function clearSelectedComponent(){
  selectedComponents.clear();
  selectedComponent = null;
  applySelectedClasses();
}

/* --- Swallow background click after marquee --- */
let suppressNextBackgroundClick = false;
compLayer.addEventListener('click', (e)=>{
  if (suppressNextBackgroundClick){
    suppressNextBackgroundClick = false;
    return;
  }
  if (e.target === compLayer){
    clearSelectedConnection();
    clearSelectedComponent();
    hideCtxMenu();
  }
});

/* ---------- Delete + arrows (nudge) ---------- */
window.addEventListener('keydown', (e)=>{
  // ESC cancels linking
  if (e.key === 'Escape' && pendingPort){
    const prevComp = components.find(c=>c.id===pendingPort.id);
    if (prevComp) prevComp.ports[pendingPort.port]?.el?.setAttribute('fill','#fff');
    pendingPort = null;
    setHoverPort(null);
    removePreviewPath();
    document.body.style.cursor = '';
    return;
  }

  // Delete
  if ((e.key==='Delete' || e.key==='Backspace') && canEdit()){
    if (selectedConnection){
      removeConnection(selectedConnection);
      selectedConnection = null;
      e.preventDefault();
      pushHistory('Delete wire');
      redrawConnections();
      return;
    }
    if (selectedComponents.size > 0){
      const toDel = [...selectedComponents];
      toDel.forEach(c => deleteComponent(c));
      clearSelectedComponent();
      e.preventDefault();
      pushHistory('Delete components');
      return;
    }
  }
});

let _nudgeActive = false;
window.addEventListener('keydown', (e)=>{
  const tag = (e.target && e.target.tagName) ? e.target.tagName.toUpperCase() : '';
  if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target && e.target.isContentEditable)) return;
  if (!canEdit()) return;

  let dx = 0, dy = 0;
  const step = e.shiftKey ? 10 : 1;

  switch(e.key){
    case 'ArrowLeft':  dx = -step; break;
    case 'ArrowRight': dx =  step; break;
    case 'ArrowUp':    dy = -step; break;
    case 'ArrowDown':  dy =  step; break;
    default: return;
  }

  e.preventDefault();
  nudgeSelectedComponents(dx, dy);
  _nudgeActive = true;
});
window.addEventListener('keyup', (e)=>{
  if (!_nudgeActive) return;
  if (e.key==='ArrowLeft' || e.key==='ArrowRight' || e.key==='ArrowUp' || e.key==='Down'){
    pushHistory(selectedComponents.size>1 ? 'Nudge components' : 'Nudge component');
    _nudgeActive = false;
  }
});

/* ---------- Context menu ---------- */
let ctxMenuEl = null;
function hideCtxMenu(){ if (ctxMenuEl){ ctxMenuEl.remove(); ctxMenuEl = null; } }
function showCtxMenu(x, y, { type, payload }){
  hideCtxMenu();
  const m = document.createElement('div');
  m.className = 'ctxmenu';
  m.style.left = x + 'px';
  m.style.top  = y + 'px';

  const addBtn = (txt, fn)=>{
    const b = document.createElement('button');
    b.textContent = txt;
    b.addEventListener('click', ()=>{ fn(); hideCtxMenu(); });
    m.appendChild(b);
  };

  if (type==='wire' && payload?.conn){
    const conn = payload.conn;
    const hit = payload.hit || null;

    if (hit){
      const segIsH = (hit.seg && hit.seg.A && hit.seg.B) ? (hit.seg.A.y === hit.seg.B.y) : false;
      addBtn('➕ Insert segment here', ()=>{
        if (!conn.guides) conn.guides = [];
        if (segIsH) conn.guides.push({ type:'H', pos: hit.y });
        else        conn.guides.push({ type:'V', pos: hit.x });
        refreshHandlesForConnection(conn);
        redrawConnections();
        pushHistory('Add wire segment');
      });
    }

    if (Array.isArray(conn.guides) && conn.guides.length>0){
      addBtn('➖ Remove nearest segment', ()=>{
        const idx = nearestGuideIndex(conn, hit?.x ?? payload.x, hit?.y ?? payload.y);
        if (idx>=0){
          conn.guides.splice(idx,1);
          refreshHandlesForConnection(conn);
          redrawConnections();
          pushHistory('Remove nearest wire segment');
        }
      });
      addBtn('🧹 Clear all segments', ()=>{
        conn.guides = [];
        refreshHandlesForConnection(conn);
        redrawConnections();
        pushHistory('Clear wire segments');
      });
    }
  }

  const delBtn = document.createElement('button');
  delBtn.textContent = canEdit() ? '🗑️ Delete' : '🔒 Editing requires STOP';
  delBtn.disabled = !canEdit();
  delBtn.addEventListener('click', ()=>{
    if (!canEdit()) return;
    if (type==='component' && payload?.comp){
      deleteComponent(payload.comp);
      clearSelectedComponent();
      pushHistory('Delete component');
    } else if (type==='wire' && payload?.conn){
      removeConnection(payload.conn);
      clearSelectedConnection();
      redrawConnections();
      pushHistory('Delete wire');
    }
    hideCtxMenu();
  });

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
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

/* ---------- Component deletion ---------- */
function deleteComponent(comp){
  const toRemove = connections.filter(c => c.from.id===comp.id || c.to.id===comp.id);
  toRemove.forEach(c => removeConnection(c));
  components = components.filter(c => c !== comp);
  comp.el.remove();
  hideCtxMenu();
  redrawConnections();
}

/* ---------- Junction component ---------- */
function addJunction(
  x, y,
  compLayer, components,
  handlePortClick, makeDraggable, redrawConnections, uid
){
  const id = uid();
  const NS = 'http://www.w3.org/2000/svg';

  const el = document.createElement('div');
  el.className = 'comp';
  el.style.left = x + 'px';
  el.style.top  = y + 'px';

  const label = document.createElement('div');
  label.className = 'label';
  label.textContent = 'J';

  const svg = document.createElementNS(NS,'svg');
  svg.classList.add('compSvg');
  const SVG_W = 24, SVG_H = 24;
  svg.setAttribute('width',  SVG_W);
  svg.setAttribute('height', SVG_H);

  const g = document.createElementNS(NS,'g');
  const GX = 12, GY = 12;
  g.setAttribute('transform', `translate(${GX},${GY})`);

  const dot = document.createElementNS(NS,'circle');
  dot.setAttribute('cx', 0); dot.setAttribute('cy', 0);
  dot.setAttribute('r', 3);
  dot.setAttribute('fill', '#000');

  const port = document.createElementNS(NS,'circle');
  port.setAttribute('class','port');
  port.setAttribute('r', 6);
  port.setAttribute('cx', 0);
  port.setAttribute('cy', 0);
  port.addEventListener('click', (e)=>{
    e.stopPropagation();
    handlePortClick(comp, 'J', port);
  });

  g.append(dot, port);
  svg.appendChild(g);
  el.append(label, svg);
  compLayer.appendChild(el);

  const comp = {
    id, type:'junction', el, x, y,
    svgW: SVG_W, svgH: SVG_H, gx: GX, gy: GY,
    ports: { J: { cx:0, cy:0, el: port } }
  };

  makeDraggable(comp);
  components.push(comp);
  redrawConnections();
  return comp;
}

/* ---------- Drag (single + group) ---------- */
function makeDraggable(comp){
  let dragging=false, startMouseX=0, startMouseY=0;
  let offsets = null;

  function onDown(e){
    if (!canEdit()) return;
    if (e.target.closest('.port')) return;

    const additive = e.shiftKey || e.ctrlKey || e.metaKey;

    if (!selectedComponents.has(comp)) {
      if (!additive) selectedComponents.clear();
      selectedComponents.add(comp);
      applySelectedClasses();
    }

    dragging = true;
    const rect = workspaceBBox();
    startMouseX = e.clientX - rect.left;
    startMouseY = e.clientY - rect.top;

    const group = (selectedComponents.size > 1);
    if (group){
      offsets = [...selectedComponents].map(c=>({
        comp:c,
        dx:startMouseX - c.x,
        dy:startMouseY - c.y
      }));
    } else {
      offsets = [{ comp, dx:startMouseX - comp.x, dy:startMouseY - comp.y }];
    }

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp, { once:true });

    e.preventDefault();
    e.stopPropagation();
  }
  function onMove(e){
    if(!dragging) return;
    const rect = workspaceBBox();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    offsets.forEach(o=>{
      const nx = snap(clamp(mx - o.dx, 40, rect.width-40));
      const ny = snap(clamp(my - o.dy, 40, rect.height-40));
      o.comp.x = nx; o.comp.y = ny;
      o.comp.el.style.left = nx + 'px';
      o.comp.el.style.top  = ny + 'px';
    });
    redrawConnections();
  }
  function onUp(){
    dragging=false;
    offsets = null;
    pushHistory(selectedComponents.size>1 ? 'Move components' : 'Move component');
    window.removeEventListener('mousemove', onMove);
  }

  comp.el.addEventListener('mousedown', onDown);

  comp.el.addEventListener('contextmenu', (e)=>{
    e.preventDefault();
    showCtxMenu(e.clientX, e.clientY, { type:'component', payload:{ comp } });
  });
}

/* ---------- Wires ---------- */
function createWirePath(){
  const path = document.createElementNS('http://www.w3.org/2000/svg','path');
  path.setAttribute('class','wire');
  path.style.pointerEvents = 'stroke';
  return path;
}
function createWireLabel(){
  const t = document.createElementNS('http://www.w3.org/2000/svg','text');
  t.setAttribute('class','wireLabel');
  t.setAttribute('text-anchor','middle');
  t.setAttribute('font-size','12');
  t.style.pointerEvents = 'none';
  return t;
}

function addConnection(from, to){
  const path = createWirePath();
  const label = createWireLabel(); // Create a label for the wire
  connLayer.appendChild(path);
  connLayer.appendChild(label);

  // Pilot endpoints get adjustable horizontal stubs
  const cFrom = components.find(c=> c.id === from.id);
  const cTo   = components.find(c=> c.id === to.id);
  const startPilot = isValvePilotPort(cFrom, from.port);
  const endPilot   = isValvePilotPort(cTo,   to.port);

  const conn = {
    from, to, pathEl: path, labelEl: label,
    guides: [], handleEls: [],
    stubStartLen: startPilot ? WIRE_STUB : null,
    stubEndLen:   endPilot   ? WIRE_STUB : null
  };
  connections.push(conn);
  return conn;
}
function removeConnection(conn){
  destroyHandlesForConnection(conn);
  conn.pathEl?.remove();
  conn.labelEl?.remove();
  connections = connections.filter(c=>c!==conn);
}
function finalizeWire(from, to){
  const conn = addConnection(from, to);
  redrawConnections();
  return conn;
}

/* ---------- Port hit-test (magnet) ---------- */
const PORT_SNAP_RADIUS = 16; // px
function findNearestPort(px, py, exclude={ id:null, port:null }){
  let best=null, bestD=Infinity;
  components.forEach(c=>{
    if (!c.ports) return;
    for (const key of Object.keys(c.ports)){
      if (exclude && exclude.id===c.id && exclude.port===key) continue;
      const gp = portGlobalPosition(c, key);
      const d = Math.hypot(gp.x - px, gp.y - py);
      if (d < bestD){ best = { comp:c, key, x:gp.x, y:gp.y, d }; bestD = d; }
    }
  });
  return (best && best.d <= PORT_SNAP_RADIUS) ? best : null;
}

let hoverPort = null;
let lastHoverPortEl = null;
function setHoverPort(newHover){
  if (lastHoverPortEl && (!newHover || newHover.comp.ports[newHover.key].el !== lastHoverPortEl)){
    lastHoverPortEl.setAttribute('fill', '#fff');
    lastHoverPortEl = null;
  }
  hoverPort = newHover;
  if (hoverPort){
    const el = hoverPort.comp.ports[hoverPort.key].el;
    el.setAttribute('fill', '#e9f6ff');
    lastHoverPortEl = el;
  }
}

/* ---------- Ghost-wire (preview) ---------- */
let tempPreviewPath = null;
function ensurePreviewPath(){
  if (tempPreviewPath) return tempPreviewPath;
  tempPreviewPath = document.createElementNS('http://www.w3.org/2000/svg','path');
  tempPreviewPath.setAttribute('class','wire preview');
  tempPreviewPath.style.pointerEvents = 'none';
  connLayer.appendChild(tempPreviewPath);
  return tempPreviewPath;
}
function removePreviewPath(){
  tempPreviewPath?.remove();
  tempPreviewPath = null;
}

/* ---------- Wire hit-test ---------- */
function distPointToSegment(px, py, ax, ay, bx, by){
  const abx = bx - ax, aby = by - ay;
  const apx = px - ax, apy = py - ay;
  const ab2 = abx*abx + aby*aby;
  let t = 0;
  if (ab2 > 0) t = Math.max(0, Math.min(1, (apx*abx + apy*aby)/ab2));
  const cx = ax + t*abx, cy = ay + t*aby;
  const dx = px - cx, dy = py - cy;
  const d = Math.hypot(dx, dy);
  return { d, cx, cy };
}
function hitTestWire(px, py, threshold=8){
  let best = null;
  connections.forEach(conn=>{
    const geom = computeConnectionGeometry(conn);
    if (!geom) return;
    const pts = geom.points;
    for (let i=0;i<pts.length-1;i++){
      const A = pts[i], B = pts[i+1];
      const { d, cx, cy } = distPointToSegment(px, py, A.x, A.y, B.x, B.y);
      if (d <= threshold && (!best || d < best.d)){
        best = { conn, d, x: cx, y: cy, seg: { A, B, i } };
      }
    }
  });
  return best;
}

/* ---------- Junction + select wire (capture) ---------- */
window.addEventListener('click', (e)=>{
  if (!canEdit()) return;

  const rect = workspaceBBox();
  const px = e.clientX - rect.left;
  const py = e.clientY - rect.top;

  // If we are linking and are over a port → finish to that port
  if (pendingPort && hoverPort){
    finalizeWire(pendingPort, { id:hoverPort.comp.id, port:hoverPort.key });

    const prevComp = components.find(c=>c.id===pendingPort.id);
    prevComp?.ports[pendingPort.port]?.el?.setAttribute('fill','#fff');

    setHoverPort(null);
    removePreviewPath();
    pendingPort = null;
    document.body.style.cursor = '';
    pushHistory('Create wire (snap-to-port)');
    redrawConnections();
    e.stopPropagation(); e.preventDefault();
    return;
  }

  // Linking to a wire ⇒ create junction
  if (pendingPort && !(e.target && e.target.classList?.contains('port'))){
    const hit = hitTestWire(px, py, 8);
    if (hit){
      const j = addJunction(hit.x, hit.y, compLayer, components, handlePortClick, makeDraggable, redrawConnections, uid);

      // split wire
      removeConnection(hit.conn);
      addConnection(hit.conn.from, { id:j.id, port:'J' });
      addConnection({ id:j.id, port:'J' }, hit.conn.to);

      // connect the pending endpoint to the junction
      addConnection(pendingPort, { id:j.id, port:'J' });

      const prevComp = components.find(c=>c.id===pendingPort.id);
      prevComp?.ports[pendingPort.port]?.el?.setAttribute('fill','#fff');

      setHoverPort(null);
      removePreviewPath();
      pendingPort = null;
      document.body.style.cursor = '';

      redrawConnections();
      pushHistory('Create junction');
      e.stopPropagation(); e.preventDefault();
      return;
    }
    return;
  }

  // Select a wire if not currently linking
  if (!pendingPort){
    const hit = hitTestWire(px, py, 6);
    if (hit){
      selectConnection(hit.conn);
      e.stopPropagation(); e.preventDefault();
    }
  }
}, true);

// Double-click: add a segment (H/V) at cursor
window.addEventListener('dblclick', (e)=>{
  if (!canEdit()) return;

  const rect = workspaceBBox();
  const px = e.clientX - rect.left;
  const py = e.clientY - rect.top;

  const hit = hitTestWire(px, py, 6);
  if (!hit) return;

  const isH = (hit.seg.A.y === hit.seg.B.y);
  const conn = hit.conn;
  if (!conn.guides) conn.guides = [];
  conn.guides.push(isH ? { type:'H', pos: hit.y } : { type:'V', pos: hit.x });

  selectConnection(conn);
  refreshHandlesForConnection(conn);
  redrawConnections();
  pushHistory('Add wire segment (dblclick)');

  e.stopPropagation(); e.preventDefault();
}, true);

// Context menu on wire
window.addEventListener('contextmenu', (e)=>{
  if (!canEdit()) return;

  const rect = workspaceBBox();
  const px = e.clientX - rect.left;
  const py = e.clientY - rect.top;

  const hit = hitTestWire(px, py, 6);
  if (hit){
    selectConnection(hit.conn);
    showCtxMenu(e.clientX, e.clientY, { type:'wire', payload:{ conn:hit.conn, hit, x:px, y:py } });
    e.stopPropagation(); e.preventDefault();
  }
}, true);

/* ---------- Magnetic port + ghost-wire while linking ---------- */
window.addEventListener('mousemove', (e)=>{
  if (!pendingPort) return;

  const rect = workspaceBBox();
  const px = e.clientX - rect.left;
  const py = e.clientY - rect.top;

  const near = findNearestPort(px, py, pendingPort);
  setHoverPort(near);

  const srcComp = components.find(c=>c.id===pendingPort.id);
  if (!srcComp) return;
  const a = portGlobalPosition(srcComp, pendingPort.port);
  const b = near ? { x:near.x, y:near.y } : { x:px, y:py };

  const orientA = getPortEntryOrientation(srcComp, pendingPort.port);
  const stubA = isValvePilotPort(srcComp, pendingPort.port)
    ? { x: a.x + ((pendingPort.port==='12')?+1:-1) * WIRE_STUB, y: a.y }
    : makeEndpointStub(a, b, orientA);

  const inner = routeAuto(stubA.x, stubA.y, b.x, b.y);
  const pts = [a];
  if (stubA.x!==a.x || stubA.y!==a.y) pts.push(stubA);
  pts.push(...inner.points.slice(1));

  ensurePreviewPath().setAttribute('d', pathFromPoints(pts));
}, true);

/* ---------- Marquee (lasso) ---------- */
let marqueeEl = null;
let marqueeActive = false;
let marqueeStart = { x:0, y:0 };
let marqueeAdditive = false;

function startMarquee(x, y, additive){
  if (!canEdit()) return;
  marqueeActive = true;
  marqueeStart = { x, y };
  marqueeAdditive = additive;

  marqueeEl = document.createElement('div');
  marqueeEl.className = 'marquee';
  marqueeEl.style.left = x + 'px';
  marqueeEl.style.top  = y + 'px';
  document.body.appendChild(marqueeEl);
}
function updateMarquee(x, y){
  if (!marqueeActive || !marqueeEl) return;
  const left   = Math.min(marqueeStart.x, x);
  const top    = Math.min(marqueeStart.y, y);
  const right  = Math.max(marqueeStart.x, x);
  const bottom = Math.max(marqueeStart.y, y);
  marqueeEl.style.left = left + 'px';
  marqueeEl.style.top  = top  + 'px';
  marqueeEl.style.width  = (right-left) + 'px';
  marqueeEl.style.height = (bottom-top) + 'px';
}
function endMarquee(x, y){
  if (!marqueeActive) return;
  const left   = Math.min(marqueeStart.x, x);
  const top    = Math.min(marqueeStart.y, y);
  const right  = Math.max(marqueeStart.x, x);
  const bottom = Math.max(marqueeStart.y, y);

  const rect = workspaceBBox();
  const sel = components.filter(c=>{
    const sx = rect.left + c.x;
    const sy = rect.top  + c.y;
    return sx>=left && sx<=right && sy>=top && sy<=bottom;
  });

  if (!marqueeAdditive) selectedComponents.clear();
  sel.forEach(c => selectedComponents.add(c));
  applySelectedClasses();

  marqueeActive = false;
  marqueeAdditive = false;

  suppressNextBackgroundClick = true;

  marqueeEl?.remove();
  marqueeEl = null;
}

compLayer.addEventListener('mousedown', (e)=>{
  if (!canEdit()) return;
  if (e.target.closest('.comp') || e.target.classList?.contains('port')) return;

  const additive = e.shiftKey || e.ctrlKey || e.metaKey;
  startMarquee(e.clientX, e.clientY, additive);
  e.preventDefault();

  const onMove = (ev)=> updateMarquee(ev.clientX, ev.clientY);
  const onUp = (ev)=>{
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp, { once:true });
    endMarquee(ev.clientX, ev.clientY);
    ev.stopPropagation();
  };
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp, { once:true });

  e.stopPropagation();
});

/* ---------- Port linking ---------- */
function handlePortClick(comp, portKey, portEl){
  if (!canEdit()) return;
  hideCtxMenu();
  clearSelectedConnection();

  if (!pendingPort){
    pendingPort = { id: comp.id, port: portKey };
    portEl.setAttribute('fill', '#dff1ff');
    document.body.style.cursor = 'crosshair';
    return;
  }
  if (pendingPort.id === comp.id && pendingPort.port === portKey){
    pendingPort = null;
    portEl.setAttribute('fill', '#fff');
    setHoverPort(null);
    removePreviewPath();
    document.body.style.cursor = '';
    return;
  }

  finalizeWire(pendingPort, { id: comp.id, port: portKey });

  const prevComp = components.find(c=>c.id===pendingPort.id);
  if (prevComp) prevComp.ports[pendingPort.port]?.el?.setAttribute('fill','#fff');

  pendingPort = null;
  setHoverPort(null);
  removePreviewPath();
  document.body.style.cursor = '';
  pushHistory('Create wire');
}

/* ---------- PRESSURE OVERLAY ---------- */
const SOURCE_PRESSURE = 6.0;

function computePressureSet(){
  const key = (id,port)=> `${id}:${port}`;

  // 1) graph of wires
  const adj = new Map(); // Adjacency list for the graph
  const addUndirected = (a,b)=>{
    if (!adj.has(a)) adj.set(a, new Set());
    if (!adj.has(b)) adj.set(b, new Set());
    adj.get(a).add(b); adj.get(b).add(a);
  };
  connections.forEach(conn=>{
    addUndirected(key(conn.from.id, conn.from.port), key(conn.to.id, conn.to.port));
  });

  // 2) start from sources
  const start = [];
  components.forEach(c=>{
    if (c.type==='source'){
      if (c.ports?.OUT) start.push(key(c.id,'OUT'));
      if (c.ports?.P)   start.push(key(c.id,'P'));
    }
  });

  // 3) flood through wiring
  const pressurized = new Set(start);
  const q = [...start];
  while(q.length){
    const cur = q.shift();
    const nbrs = adj.get(cur);
    if (!nbrs) continue;
    for (const n of nbrs){
      if (!pressurized.has(n)){ pressurized.add(n); q.push(n); }
    }
  }

  // 4) component logic + re-flood if changed
  let changed = true;
  while (changed){
    changed = false;

    // 5/2: 1 <-> (4 or 2) depending on state
    components.forEach(v=>{
      if (v.type!=='valve52') return;
      const a = (v.state===0) ? '4' : '2';
      const n1 = `${v.id}:1`, na = `${v.id}:${a}`;
      const before = pressurized.size;
      if (pressurized.has(n1)) pressurized.add(na);
      if (pressurized.has(na)) pressurized.add(n1);
      if (pressurized.size !== before) changed = true;
    });

    // AND valve
    components.forEach(av=>{
      if (av.type!=='andValve') return;
      const nA = `${av.id}:A`, nB = `${av.id}:B`, nO = `${av.id}:OUT`;
      const before = pressurized.size;
      if (pressurized.has(nA) && pressurized.has(nB)) pressurized.add(nO);
      if (pressurized.size !== before) changed = true;
    });

    // OR (shuttle)
    components.forEach(ov=>{
      if (ov.type!=='orValve') return;
      const nA = `${ov.id}:A`, nB = `${ov.id}:B`, nO = `${ov.id}:OUT`;
      const before = pressurized.size;
      if (pressurized.has(nA) || pressurized.has(nB)) pressurized.add(nO);
      if (pressurized.size !== before) changed = true;
    });

    // 3/2 limit valve
    components.forEach(lv=>{
      if (lv.type!=='limit32') return;
      const active = !!lv.state?.active;
      const n2 = `${lv.id}:2`;
      const nT = active ? `${lv.id}:1` : `${lv.id}:3`;
      const before = pressurized.size;
      if (pressurized.has(n2)) pressurized.add(nT);
      if (pressurized.has(nT)) pressurized.add(n2);
      if (pressurized.size !== before) changed = true;
    });

    // 3/2 pushbutton (momentary)
    components.forEach(pv=>{
      if (pv.type!=='push32') return;
      const a = pv.state?.active ? '1' : '3';
      const n2 = `${pv.id}:2`, nx = `${pv.id}:${a}`;
      const before = pressurized.size;
      if (pressurized.has(n2)) pressurized.add(nx);
      if (pressurized.has(nx)) pressurized.add(n2);
      if (pressurized.size !== before) changed = true;
    });

    // 3/2 air-piloted (NEW): same mapping as pushbutton, driven by state.active
    components.forEach(av=>{
      if (av.type!=='airValve32') return;
      const a = av.state?.active ? '1' : '3';
      const n2 = `${av.id}:2`, nx = `${av.id}:${a}`;
      const before = pressurized.size;
      if (pressurized.has(n2)) pressurized.add(nx);
      if (pressurized.has(nx)) pressurized.add(n2);
      if (pressurized.size !== before) changed = true;
    });

    if (changed){
      const queue = [...pressurized];
      while(queue.length){
        const cur = queue.shift();
        const nbrs = adj.get(cur);
        if (!nbrs) continue;
        for (const n of nbrs){
          if (!pressurized.has(n)){ pressurized.add(n); queue.push(n); }
        }
      }
    }
  }

  return pressurized;
}

let lastPressure = new Set();
let stepOnceFlag = false;

/* ---------- Simulation ---------- */
function simulate(dt){
  const playing = (simMode === Modes.PLAY) || stepOnceFlag;

  components.forEach(c=>{
    if (typeof c.recompute === 'function') c.recompute();
  });

  if (playing){ // If the simulation is playing
    lastPressure = computePressureSet();
  } else if (simMode === Modes.STOP){
    lastPressure = new Set();
  }

  if (playing){
    // 5/2 pilot edges (12 ⇒ state=1, 14 ⇒ state=0)
    components.forEach(v=>{
      if (v.type!=='valve52') return;
      if (v._pilot12Prev === undefined) v._pilot12Prev = false;
      if (v._pilot14Prev === undefined) v._pilot14Prev = false;

      const p12 = lastPressure.has(`${v.id}:12`);
      const p14 = lastPressure.has(`${v.id}:14`);

      const rising12 = p12 && !v._pilot12Prev;
      const rising14 = p14 && !v._pilot14Prev;

      if (rising12 && v.state !== 1) v.setState(1);
      else if (rising14 && v.state !== 0) v.setState(0);

      v._pilot12Prev = p12;
      v._pilot14Prev = p14;
    });

    // 3/2 air-piloted: pilot 12 ⇒ active (2↔1), else inactive (2↔3)
    components.forEach(v=>{
      if (v.type!=='airValve32') return;
      const p12 = lastPressure.has(`${v.id}:12`);
      const desired = !!p12;
      if (v.state?.active !== desired){
        // Support both setActive and setState alias
        if (typeof v.setActive === 'function') v.setActive(desired);
        else if (typeof v.setState === 'function') v.setState(desired ? 1 : 0);
      }
    });
  }

  // port overlay + title with bar
  components.forEach(c=>{
    if (!c.ports) return;
    for (const k of Object.keys(c.ports)){
      const n = `${c.id}:${k}`;
      const pressed = lastPressure.has(n) && (playing || simMode===Modes.PAUSE);
      c.ports[k].el?.classList.toggle('pressurized', pressed);
      if (simMode!==Modes.STOP) c.ports[k].el?.setAttribute('title', `${k}: ${pressed ? SOURCE_PRESSURE.toFixed(1) : '0.0'} bar`);
      else c.ports[k].el?.removeAttribute('title');
      // determine if this port has any connection
      // Note: some components (e.g. source) may expose the same DOM element under multiple port keys
      // (e.g. OUT and P). To avoid false negatives we compare the actual port element used by
      // connections rather than only the port key.
      const portEl = c.ports[k]?.el;
      const hasConn = connections.some(conn => {
        if (conn.from.id === c.id){ const fromEl = c.ports?.[conn.from.port]?.el; if (fromEl && fromEl === portEl) return true; }
        if (conn.to.id === c.id){ const toEl = c.ports?.[conn.to.port]?.el; if (toEl && toEl === portEl) return true; }
        return false;
      });
      if (pressed && !hasConn){
        c.ports[k].el?.classList.add('unconnected');
      } else {
        c.ports[k].el?.classList.remove('unconnected');
      }
    }
  });

    // cylinder movement
  if (playing){
    components.filter(c=> c.type==='cylDouble' || c.type==='cylinder' || c.type==='cylSingle').forEach(cyl=>{
      const isPress = (id,port)=> lastPressure.has(`${id}:${port}`);

      let target = cyl.pos;

      if (cyl.type === 'cylSingle'){
        // single-acting: behavior depends on mode ('push' extends on A press, 'pull' retracts on A press)
        let aPress = false;
        const aConns = connections.filter(c=> (c.from.id===cyl.id && c.from.port==='A') || (c.to.id===cyl.id && c.to.port==='A'));
        aConns.forEach(conn=>{
          const other = (conn.from.id===cyl.id) ? conn.to : conn.from;
          if (isPress(other.id, other.port)) aPress = true;
        });
        if ((cyl.mode ?? 'push') === 'push') target = aPress ? 1 : 0;
        else target = aPress ? 0 : 1;
      } else {
        // double-acting behavior: Cap vs Rod
        let capPress=false, rodPress=false;
        const capConns = connections.filter(c=> (c.from.id===cyl.id && c.from.port==='Cap') || (c.to.id===cyl.id && c.to.port==='Cap'));
        const rodConns = connections.filter(c=> (c.from.id===cyl.id && c.from.port==='Rod') || (c.to.id===cyl.id && c.to.port==='Rod'));

        capConns.forEach(conn=>{
          const other = (conn.from.id===cyl.id) ? conn.to : conn.from;
          if (isPress(other.id, other.port)) capPress = true;
        });
        rodConns.forEach(conn=>{
          const other = (conn.from.id===cyl.id) ? conn.to : conn.from;
          if (isPress(other.id, other.port)) rodPress = true;
        });

        if (capPress && !rodPress) target = 1;
        else if (!capPress && rodPress) target = 0;
      }

      const speed = 0.8;
      const dir = Math.sign(target - cyl.pos);
      if (dir!==0) cyl.setPos(cyl.pos + dir*speed*dt);
    });
  }

  // wires: active & label
  connections.forEach(conn=>{
    const aKey = `${conn.from.id}:${conn.from.port}`;
    const bKey = `${conn.to.id}:${conn.to.port}`;
    const aPress = lastPressure.has(aKey);
    const bPress = lastPressure.has(bKey);
    const active = (playing || simMode===Modes.PAUSE) && aPress && bPress;
    conn.pathEl?.classList.toggle('active', active);

    if (simMode===Modes.PLAY || simMode===Modes.PAUSE){
      const bar = (aPress || bPress) ? SOURCE_PRESSURE : 0.0;
      if (conn.labelEl) conn.labelEl.textContent = bar.toFixed(1);
    } else {
      if (conn.labelEl) conn.labelEl.textContent = '';
    }
  });

  stepOnceFlag = false;
}

/* ---------- RAF loop ---------- */
let last = performance.now();
function tick(t){
  const dt = Math.min(0.05, (t-last)/1000);
  last = t;
  simulate(dt);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

/* ---------- History & persistence ---------- */
function readCylinderLetterFromComp(comp){
  try {
    const txt = comp.el?.querySelector('.label')?.textContent || '';
    const m = txt.match(/Cylinder\s+([A-Za-z])/);
    return m ? m[1].toUpperCase() : null;
  } catch { return null; }
}

function snapshotProject(){
  const comps = components.map(c=>{
    const base = { id:c.id, type:c.type, x:c.x, y:c.y };
  if (c.type==='valve52') return { ...base, state:c.state };
  if (c.type==='airValve32') return { ...base, active: !!(c.state?.active) };
    if (c.type==='cylDouble' || c.type==='cylinder' || c.type==='cylSingle'){
      const letter = readCylinderLetterFromComp(c);
      const out = { ...base, pos:c.pos??0, letter };
      if (c.type==='cylSingle'){
        out.mode = c.mode ?? 'push';
        out.normallyExtended = !!c.normallyExtended;
      }
      return out;
    }
    if (c.type==='push32')  return { ...base, active: !!(c.state?.active) };
    if (c.type==='limit32'){
      const sensor = typeof c.getSensorKey === 'function' ? c.getSensorKey() : null;
      return { ...base, sensor };
    }
    return base; // junction/and/or/source
  });
  const conns = connections.map(conn=>({
    from:{ id:conn.from.id, port:conn.from.port },
    to:  { id:conn.to.id,   port:conn.to.port },
    guides: (Array.isArray(conn.guides) && conn.guides.length>0)
              ? conn.guides.map(g=>({type:g.type,pos:g.pos}))
              : [],
    stubStartLen: (typeof conn.stubStartLen === 'number') ? conn.stubStartLen : null,
    stubEndLen:   (typeof conn.stubEndLen   === 'number') ? conn.stubEndLen   : null
  }));
  return { version: 18, comps, conns };
}
function clearProject(){
  connections.forEach(c=>removeConnection(c));
  connections = [];
  components.forEach(c=>c.el.remove());
  components = [];
  nextId = 1;
  pendingPort = null;

  cylinderCount = 0;                 // restart letter counter
  for (const k of Object.keys(signals)) delete signals[k]; // cleanup old sensors

  clearSelectedConnection();
  clearSelectedComponent();
  hideCtxMenu();
  redrawConnections();
}
async function loadProject(data){
  isRestoring = true;
  clearProject();

  const idMap = new Map();
  let _maxCylIndex = -1;

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
    } else if (sc.type === 'airValve32'){
      comp = addAirValve32(sc.x, sc.y, compLayer, components, handlePortClick, makeDraggable, redrawConnections, uid);
      if (typeof sc.active==='boolean'){
        if (typeof comp.setActive==='function') comp.setActive(sc.active);
        else if (typeof comp.setState==='function') comp.setState(sc.active ? 1 : 0);
      }
    } else if (sc.type === 'cylDouble' || sc.type==='cylinder'){
      const letterProvider = sc.letter ? (()=> sc.letter) : getNextCylinderLetter;
      comp = addCylinderDouble(sc.x, sc.y, compLayer, components, handlePortClick, makeDraggable, redrawConnections, uid, letterProvider, setSignal);
      if (typeof sc.pos==='number' && typeof comp.setPos==='function') comp.setPos(sc.pos);
      if (sc.letter){
        const idx = sc.letter.toUpperCase().charCodeAt(0) - 'A'.charCodeAt(0);
        if (!Number.isNaN(idx)) _maxCylIndex = Math.max(_maxCylIndex, idx);
      }
    } else if (sc.type === 'cylSingle' || sc.type === 'cylinderSingle'){
      const letterProvider = sc.letter ? (()=> sc.letter) : getNextCylinderLetter;
      // allow storing pos, letter, mode and normallyExtended
      const opts = { normallyExtended: !!sc.normallyExtended, mode: sc.mode };
      comp = addCylinderSingle(sc.x, sc.y, compLayer, components, handlePortClick, makeDraggable, redrawConnections, uid, letterProvider, setSignal, opts);
      if (typeof sc.pos==='number' && typeof comp.setPos==='function') comp.setPos(sc.pos);
      if (sc.letter){
        const idx = sc.letter.toUpperCase().charCodeAt(0) - 'A'.charCodeAt(0);
        if (!Number.isNaN(idx)) _maxCylIndex = Math.max(_maxCylIndex, idx);
      }
    } else if (sc.type === 'andValve'){
      comp = addAndValve(sc.x, sc.y, compLayer, components, handlePortClick, makeDraggable, redrawConnections, uid);
    } else if (sc.type === 'orValve'){
      comp = addOrValve(sc.x, sc.y, compLayer, components, handlePortClick, makeDraggable, redrawConnections, uid);
    } else if (sc.type === 'limit32'){
      const lv = addLimitValve32(sc.x, sc.y, compLayer, components, handlePortClick, makeDraggable, redrawConnections, uid, getSignal);
      if (typeof sc.sensor === 'string' && sc.sensor.trim()){
        lv.setSensorKey(sc.sensor);
      }
      comp = lv;
    } else if (sc.type === 'push32'){
      comp = addPushButton32(sc.x, sc.y, compLayer, components, handlePortClick, makeDraggable, redrawConnections, uid);
      if (typeof sc.active==='boolean'){ comp.state.active = sc.active; comp.recompute?.(); }
    } else if (sc.type === 'junction'){
      comp = addJunction(sc.x, sc.y, compLayer, components, handlePortClick, makeDraggable, redrawConnections, uid);
    } else {
      continue;
    }
    idMap.set(sc.id, comp.id);
  }

  // adjust next cylinder letter
  cylinderCount = (_maxCylIndex >= 0) ? (_maxCylIndex + 1) : 0;

  for (const conn of data.conns){
    const newFromId = idMap.get(conn.from.id);
    const newToId   = idMap.get(conn.to.id);
    if (!newFromId || !newToId) continue;
    const c = finalizeWire({ id:newFromId, port:conn.from.port }, { id:newToId, port:conn.to.port });
    if (Array.isArray(conn.guides)){
      c.guides = conn.guides.map(g=>({ type:(g.type==='V'?'V':'H'), pos: Number(g.pos) }));
    } else if (typeof conn.ctrlY === 'number'){ // backward compat
      c.guides = [{ type:'H', pos: conn.ctrlY }];
    }
    if (typeof conn.stubStartLen === 'number') c.stubStartLen = conn.stubStartLen;
    if (typeof conn.stubEndLen   === 'number') c.stubEndLen   = conn.stubEndLen;
  }

  redrawConnections();
  isRestoring = false;
}

/* ---------- History ---------- */
function pushHistory(_label=''){
  if (isRestoring) return;
  const snap = snapshotProject();
  history.push(JSON.stringify(snap));
  if (history.length > HISTORY_LIMIT) history.shift();
  future = [];
  updateUndoRedoButtons();

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

/* ---------- UI helpers ---------- */
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

function updateUndoRedoButtons(){
  const undoBtn = document.getElementById('undoBtn');
  const redoBtn = document.getElementById('redoBtn');
  if (undoBtn) undoBtn.disabled = !canEdit() || history.length < 2;
  if (redoBtn) redoBtn.disabled = !canEdit() || future.length === 0;
}

/* ---------- Reset system ---------- */
function resetSystem(){
  setMode(Modes.STOP);
  components.forEach(c=>{
    if (c.type==='valve52' && typeof c.setState==='function') c.setState(DEFAULT_VALVE_STATE);
    else if (c.type==='airValve32'){
      if (typeof c.setActive==='function') c.setActive(false);
      else if (typeof c.setState==='function') c.setState(0);
    }
  else if (c.type==='cylSingle' && typeof c.setPos==='function') c.setPos(c.normallyExtended ? 1 : 0);
  else if ((c.type==='cylDouble'||c.type==='cylinder') && typeof c.setPos==='function') c.setPos(DEFAULT_CYL_POS);
    else if (c.type==='push32'){ c.state.active=false; c.recompute?.(); }
    if (c.type==='valve52'){ c._pilot12Prev=false; c._pilot14Prev=false; }
  });
  connections.forEach(conn => conn.pathEl.classList.remove('active'));
  lastPressure = new Set();
  components.forEach(c=>{
    if (!c.ports) return;
    for (const k of Object.keys(c.ports)){
      c.ports[k].el?.classList.remove('pressurized');
      c.ports[k].el?.removeAttribute('title');
    }
  });
  connections.forEach(conn => { if (conn.labelEl) conn.labelEl.textContent=''; });

  clearSelectedConnection(); clearSelectedComponent(); hideCtxMenu();
  pushHistory('Reset');
}

/* ---- Lock manual toggle of 5/2 to PLAY ---- */
function wrapValveToggleGuard(valveComp){
  if (!valveComp || typeof valveComp.toggle!=='function') return;
  const original = valveComp.toggle.bind(valveComp);
  valveComp.toggle = function(){ if (simMode!==Modes.PLAY) return; original(); };
}

/* ---------- Inject CSS overlay ---------- */
(function injectOverlayCSS(){
  if (document.getElementById('overlayCSS')) return;
  const css = `
    /* Workspace grid */
    #compLayer {
      ${GRID_ENABLED ? `background-image:
        linear-gradient(to right, rgba(0,0,0,.06) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(0,0,0,.06) 1px, transparent 1px);
      background-size: ${GRID_SIZE}px ${GRID_SIZE}px;` : ''}
    }

    .wire { stroke:#000; stroke-width:2; fill:none; vector-effect: non-scaling-stroke; }
    .wire.preview { stroke:#888; stroke-dasharray:4 4; }
  /* Active wires (pressurized) use the port color (blue) */
  .wire.active { stroke: var(--port); stroke-dasharray:6 6; animation: wireflow 1.2s linear infinite; }
    @keyframes wireflow { to { stroke-dashoffset: -12; } }
    .wire.selected { stroke:#0a74ff; stroke-width:3; }
    .comp.selected { outline: 2px dashed #0a74ff; outline-offset: 2px; }

  .port { fill:#fff; stroke:#0a74ff; stroke-width:1.5; cursor: crosshair; }
  /* Ports that are pressurized during simulation are highlighted in the port color (blue) */
  .port.pressurized { fill: var(--port); stroke: var(--port); stroke-width:2; }
  /* If a pressurized port is not connected to any other component, blink it red to draw attention */
  .port.pressurized.unconnected { fill: var(--accent); stroke: var(--accent); animation: portBlink 1.8s linear infinite; }
  @keyframes portBlink { 0%,100% { opacity: 1; } 50% { opacity: 0.25; } }

    .wireLabel {
      font-family: system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
      fill:#222;
      paint-order: stroke;
      stroke: #fff;
      stroke-width: 3px;
      pointer-events: none;
    }

    .ctxmenu {
      position: fixed; z-index: 9999;
      background:#fff; border:1px solid #ccc; border-radius:8px;
      box-shadow: 0 8px 22px rgba(0,0,0,.12);
      padding:6px; font-size:14px; min-width:200px;
    }
    .ctxmenu button {
      display:block; width:100%; text-align:left;
      background:none; border:0; padding:8px 10px; cursor:pointer;
    }
    .ctxmenu button:hover { background:#f5f7ff; }
    .btn[disabled] { opacity: .5; cursor: not-allowed; }

    .marquee {
      position: fixed;
      border: 1px dashed #0a74ff;
      background: rgba(10,116,255,0.08);
      pointer-events: none;
      z-index: 9998;
    }

    .ctrlHandle {
      position: absolute;
      width: 12px; height: 12px;
      background: #fff;
      border: 2px solid #0a74ff;
      border-radius: 3px;
      box-shadow: 0 1px 3px rgba(0,0,0,.2);
      z-index: 3;
    }
    .ctrlHandle.h { cursor: ns-resize; }
    .ctrlHandle.v { cursor: ew-resize; }
  `;
  const style = document.createElement('style');
  style.id = 'overlayCSS';
  style.textContent = css;
  document.head.appendChild(style);
})();

/* ---------- Buttons ---------- */
function ensureGridStyle(){
  const style = document.getElementById('overlayCSS');
  if (!style) return;
  const enabled = GRID_ENABLED;
  const repl = style.textContent.replace(
    /#compLayer\s*\{[\s\S]*?\}/,
    `#compLayer { ${enabled ? `
      background-image:
        linear-gradient(to right, rgba(0,0,0,.06) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(0,0,0,.06) 1px, transparent 1px);
      background-size: ${GRID_SIZE}px ${GRID_SIZE}px;` : ''} }`
  );
  style.textContent = repl;
}

function updateModeButtons(){
  ensureButton('btnPlayPause',
    simMode===Modes.PLAY ? '⏸️ Pause' : '▶️ Play',
    ()=>{
      if (simMode===Modes.PLAY){ setMode(Modes.PAUSE); }
      else { setMode(Modes.PLAY); }
    }
  );
  ensureButton('btnStep',  '⏭️ Step', ()=>{
    stepOnceFlag = true;
    simulate(0.02);
  });
  ensureButton('btnStop',  '⏹️ Stop & Reset', ()=> resetSystem());
  ensureButton('btnToggleGrid', GRID_ENABLED ? '🔳 Hide Grid' : '🔲 Show Grid', ()=>{
    GRID_ENABLED = !GRID_ENABLED;
    ensureGridStyle();
  });

  const editableButtons = ['addSource','addValve52','addAir32','addCylDouble','addCylSingle','addAnd','addOr','addLimit32','addPush32','saveProj','loadProj','undoBtn','redoBtn'];
  editableButtons.forEach(id=>{
    const b = document.getElementById(id);
    if (b) b.disabled = !canEdit();
  });

  // Hide per-component single-acting mode buttons while simulation is running
  const shouldShowModeBtns = canEdit(); // only show when STOP/edit mode
  components.forEach(c=>{
    if (c && c.modeBtn && c.modeBtn.style){
      c.modeBtn.style.display = shouldShowModeBtns ? '' : 'none';
    }
  });
}
function addButtons(){
  ensureButton('addSource',  '➕ Pressure source', ()=>{
    if (!canEdit()) return;
    const r = workspaceBBox();
    addSource(r.width*0.15, r.height*0.50, compLayer, components, handlePortClick, makeDraggable, redrawConnections, uid);
    pushHistory('Add source');
  });
  ensureButton('addValve52', '➕ 5/2 valve', ()=>{
    if (!canEdit()) return;
    const r = workspaceBBox();
    const v = addValve52(r.width*0.40, r.height*0.50, compLayer, components, handlePortClick, makeDraggable, redrawConnections, uid);
    v._pilot12Prev = false; v._pilot14Prev = false;
    wrapValveToggleGuard(v);
    pushHistory('Add valve52');
  });
  ensureButton('addAir32',   '➕ 3/2 air-piloted', ()=>{
    if (!canEdit()) return;
    const r = workspaceBBox();
    addAirValve32(r.width*0.33, r.height*0.35, compLayer, components, handlePortClick, makeDraggable, redrawConnections, uid);
    pushHistory('Add airValve32');
  });




  ensureButton('addCylDouble','➕ Cylinder (double-acting)', ()=>{
    if (!canEdit()) return;
    const r = workspaceBBox();
    addCylinderDouble(r.width*0.70, r.height*0.50, compLayer, components, handlePortClick, makeDraggable, redrawConnections, uid, getNextCylinderLetter, setSignal);
    pushHistory('Add cylinder');
  });
  ensureButton('addCylSingle','➕ Cylinder (single-acting)', ()=>{
    if (!canEdit()) return;
    const r = workspaceBBox();
    addCylinderSingle(r.width*0.70, r.height*0.60, compLayer, components, handlePortClick, makeDraggable, redrawConnections, uid, getNextCylinderLetter, setSignal);
    pushHistory('Add single cylinder');
  });
  ensureButton('addAnd',     '➕ AND valve', ()=>{
    if (!canEdit()) return;
    const r = workspaceBBox();
    addAndValve(r.width*0.25, r.height*0.35, compLayer, components, handlePortClick, makeDraggable, redrawConnections, uid);
    pushHistory('Add AND');
  });
  ensureButton('addOr',      '➕ OR valve', ()=>{
    if (!canEdit()) return;
    const r = workspaceBBox();
    addOrValve(r.width*0.25, r.height*0.65, compLayer, components, handlePortClick, makeDraggable, redrawConnections, uid);
    pushHistory('Add OR');
  });
  ensureButton('addLimit32', '➕ 3/2 limit valve', ()=>{
    if (!canEdit()) return;
    const r = workspaceBBox();
    addLimitValve32(r.width*0.52, r.height*0.28, compLayer, components, handlePortClick, makeDraggable, redrawConnections, uid, getSignal);
    pushHistory('Add limit32');
  });
  ensureButton('addPush32',  '➕ 3/2 pushbutton', ()=>{
    if (!canEdit()) return;
    const r = workspaceBBox();
    addPushButton32(r.width*0.25, r.height*0.50, compLayer, components, handlePortClick, makeDraggable, redrawConnections, uid);
    pushHistory('Add push32');
  });

  ensureButton('saveProj', '💾 Save project', ()=>{
    if (!canEdit()) return;
    const snap = snapshotProject();
    const defaultName = currentProjectName || 'project';
    const answer = window.prompt('Enter a name for the project (without extension):', defaultName);
    if (answer === null) return;
    let name = (answer.trim() || defaultName).replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '_');
    if (!name) name = 'project';
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

  ensureButton('loadProj', '📂 Load project', ()=>{
    if (!canEdit()) return;
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'application/json';
    inp.onchange = async (e)=>{
      const file = e.target.files?.[0]; if (!file) return;
      currentProjectName = file.name.replace(/\.json$/i, '');
      try { const data = JSON.parse(await file.text()); await loadProject(data); pushHistory('Load project'); }
      catch(err){ console.error('Load error:', err); alert('Invalid project file.'); }
    };
    inp.click();
  });

  ensureButton('undoBtn', '↩️ Undo', ()=> { if (canEdit()) undo(); });
  ensureButton('redoBtn', '↪️ Redo', ()=> { if (canEdit()) redo(); });

  updateModeButtons();
  updateUndoRedoButtons();
}
addButtons();

/* ---------- Initial layout ---------- */
window.addEventListener('load', ()=>{
  const r = workspaceBBox();
  addSource(r.width*0.15, r.height*0.50, compLayer, components, handlePortClick, makeDraggable, redrawConnections, uid);

  // ensure wire arrow markers if you want to enable them
  (function ensureWireMarkers(){
    if (connLayer.__markersReady) return;
    const defs = document.createElementNS('http://www.w3.org/2000/svg','defs');
    const marker = document.createElementNS('http://www.w3.org/2000/svg','marker');
    marker.setAttribute('id','arrow');
    marker.setAttribute('markerWidth','8');
    marker.setAttribute('markerHeight','8');
    marker.setAttribute('refX','8');
    marker.setAttribute('refY','4');
    marker.setAttribute('orient','auto-start-reverse');
    const path = document.createElementNS('http://www.w3.org/2000/svg','path');
    path.setAttribute('d','M0,0 L8,4 L0,8 Z');
    path.setAttribute('fill','#000');
    marker.appendChild(path);
    defs.appendChild(marker);
    connLayer.appendChild(defs);
    connLayer.__markersReady = true;
  })();

  const v = addValve52(r.width*0.40, r.height*0.50, compLayer, components, handlePortClick, makeDraggable, redrawConnections, uid);
  v._pilot12Prev = false; v._pilot14Prev = false;
  wrapValveToggleGuard(v);
  addCylinderDouble(r.width*0.70, r.height*0.50, compLayer, components, handlePortClick, makeDraggable, redrawConnections, uid, getNextCylinderLetter, setSignal);
  pushHistory('Initial');
});

// Warn if closing with unsaved changes
window.addEventListener('beforeunload', (e)=>{
  if (!isDirty) return;
  e.preventDefault();
  e.returnValue = '';
});

/* ---------- Segment helpers ---------- */
// function maybeSeedFirstGuide(conn){
//   if (Array.isArray(conn.guides) && conn.guides.length>0) return;
//   const geom = computeConnectionGeometry({ ...conn, guides: [] });
//   if (!geom) return;
//   const { a, b } = geom;
//   if (a.x !== b.x){
//     const y = (a.y + b.y)/2;
//     conn.guides = [{ type:'H', pos:y }];
//   } else {
//     const x = (a.x + b.x)/2;
//     conn.guides = [{ type:'V', pos:x }];
//   }
// }
function nearestGuideIndex(conn, px, py){
  if (!Array.isArray(conn.guides) || conn.guides.length===0) return -1;
  let bestIdx = -1, bestD = Infinity;
  conn.guides.forEach((g, i)=>{
    const d = (g.type==='H') ? Math.abs(py - g.pos) : Math.abs(px - g.pos);
    if (d < bestD){ bestD = d; bestIdx = i; }
  });
  return bestIdx;
}

/* ---------- Handles for segments (incl. pilot stubs) ---------- */
function destroyHandlesForConnection(conn){
  if (Array.isArray(conn.handleEls)){
    conn.handleEls.forEach(el=> el?.remove());
  }
  conn.handleEls = [];
}

function refreshHandlesForConnection(conn, repositionOnly=false){
  // Only when selected
  if (selectedConnection !== conn){
    destroyHandlesForConnection(conn);
    return;
  }

  const geom = computeConnectionGeometry(conn);
  if (!geom) return;
  const { a, b } = geom;

  if (!Array.isArray(conn.guides)) conn.guides = [];

  // Create handles
  if (!repositionOnly){
    destroyHandlesForConnection(conn);

    // --- Guide handles (H/V) ---
    conn.handleEls = conn.guides.map((g, idx)=>{
      const el = document.createElement('div');
      el.className = 'ctrlHandle ' + (g.type==='H' ? 'h' : 'v');
      el.title = g.type==='H' ? 'Drag up/down to move a horizontal segment'
                              : 'Drag left/right to move a vertical segment';
      compLayer.appendChild(el);

      let dragging=false, startOff=0;
      const onDown = (e)=>{
        if (!canEdit()) return;
        dragging = true;
        const rect = workspaceBBox();
        if (g.type==='H'){
          startOff = (e.clientY - rect.top) - g.pos;
          el.style.cursor = 'ns-resize';
        } else {
          startOff = (e.clientX - rect.left) - g.pos;
          el.style.cursor = 'ew-resize';
        }
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp, { once:true });
        e.stopPropagation(); e.preventDefault();
      };
      const onMove = (e)=>{
        if (!dragging) return;
        const rect = workspaceBBox();
        if (g.type==='H'){
          let y = e.clientY - rect.top - startOff;
          y = clamp(y, 20, rect.height-20);
          g.pos = y;
        } else {
          let x = e.clientX - rect.left - startOff;
          x = clamp(x, 20, rect.width-20);
          g.pos = x;
        }
        redrawConnections();
      };
      const onUp = ()=>{
        dragging=false;
        el.style.cursor = '';
        pushHistory('Move wire segment');
        window.removeEventListener('mousemove', onMove);
      };

      el.addEventListener('mousedown', onDown);
      el.addEventListener('contextmenu', (e)=>{
        e.preventDefault();
        const idxNow = conn.guides.indexOf(g);
        if (idxNow>=0){
          conn.guides.splice(idxNow,1);
          refreshHandlesForConnection(conn);
          redrawConnections();
          pushHistory('Remove wire segment');
        }
      });

      return el;
    });

    // --- Pilot stub handle (start) ---
    if (isPilotEndpoint(conn,'start')){
      const el = document.createElement('div');
      el.className = 'ctrlHandle v';
      el.title = 'Drag to change pilot stub length';
      compLayer.appendChild(el);
      conn.handleEls.push(el);

      let dragging=false, baseX=0, baseLen=Number(conn.stubStartLen ?? WIRE_STUB);
      const onDown = (e)=>{
        if (!canEdit()) return;
        dragging = true;
        const c1 = components.find(c=>c.id===conn.from.id);
        const aPort = portGlobalPosition(c1, conn.from.port);
        baseX = aPort.x;
        baseLen = Number(conn.stubStartLen ?? WIRE_STUB);
        const dir0 = pilotDir(conn,'start');
        const move = (ev)=>{
          if (!dragging) return;
          const rect = workspaceBBox();
          const mx = ev.clientX - rect.left;
          const dir = dir0;
          let L = Math.max(6, Math.abs(mx - baseX));
          // enforce outward direction
          if (dir>0 && mx < baseX) L = Math.max(6, baseLen);
          if (dir<0 && mx > baseX) L = Math.max(6, baseLen);
          conn.stubStartLen = L;
          redrawConnections();
        };
        const up = ()=>{
          dragging=false;
          pushHistory('Resize pilot stub (start)');
          window.removeEventListener('mousemove', move);
        };
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', up, { once:true });
        e.stopPropagation(); e.preventDefault();
      };
      el.addEventListener('mousedown', onDown);
    }

    // --- Pilot stub handle (end) ---
    if (isPilotEndpoint(conn,'end')){
      const el = document.createElement('div');
      el.className = 'ctrlHandle v';
      el.title = 'Drag to change pilot stub length';
      compLayer.appendChild(el);
      conn.handleEls.push(el);

      let dragging=false, baseX=0, baseLen=Number(conn.stubEndLen ?? WIRE_STUB);
      const onDown = (e)=>{
        if (!canEdit()) return;
        dragging = true;
        const c2 = components.find(c=>c.id===conn.to.id);
        const bPort = portGlobalPosition(c2, conn.to.port);
        baseX = bPort.x;
        baseLen = Number(conn.stubEndLen ?? WIRE_STUB);
        const dir0 = pilotDir(conn,'end');
        const move = (ev)=>{
          if (!dragging) return;
          const rect = workspaceBBox();
          const mx = ev.clientX - rect.left;
          const dir = dir0;
          let L = Math.max(6, Math.abs(mx - baseX));
          if (dir>0 && mx < baseX) L = Math.max(6, baseLen);
          if (dir<0 && mx > baseX) L = Math.max(6, baseLen);
          conn.stubEndLen = L;
          redrawConnections();
        };
        const up = ()=>{
          dragging=false;
          pushHistory('Resize pilot stub (end)');
          window.removeEventListener('mousemove', move);
        };
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', up, { once:true });
        e.stopPropagation(); e.preventDefault();
      };
      el.addEventListener('mousedown', onDown);
    }
  }

  // Position handles (guides)
  conn.guides.forEach((g, i)=>{
    const el = conn.handleEls[i];
    if (!el) return;
    if (g.type==='H'){
      const xMid = (a.x + b.x)/2;
      el.style.left = (xMid - 6) + 'px';
      el.style.top  = (g.pos - 6) + 'px';
    } else {
      const yMid = (a.y + b.y)/2;
      el.style.left = (g.pos - 6) + 'px';
      el.style.top  = (yMid - 6) + 'px';
    }
  });

  // Position pilot stub handles (after guide handles)
  let idxOffset = conn.guides.length;
  const c1 = components.find(c=>c.id===conn.from.id);
  const c2 = components.find(c=>c.id===conn.to.id);
  const aPort = portGlobalPosition(c1, conn.from.port);
  const bPort = portGlobalPosition(c2, conn.to.port);

  if (isPilotEndpoint(conn,'start')){
    const el = conn.handleEls[idxOffset++];
    if (el){
      const dir = pilotDir(conn,'start');
      const L = Number(conn.stubStartLen ?? WIRE_STUB);
      const hx = aPort.x + dir * L;
      el.style.left = (hx - 6) + 'px';
      el.style.top  = (aPort.y - 6) + 'px';
    }
  }
  if (isPilotEndpoint(conn,'end')){
    const el = conn.handleEls[idxOffset++];
    if (el){
      const dir = pilotDir(conn,'end');
      const L = Number(conn.stubEndLen ?? WIRE_STUB);
      const hx = bPort.x + dir * L;
      el.style.left = (hx - 6) + 'px';
      el.style.top  = (bPort.y - 6) + 'px';
    }
  }
}

/* ---------- Help: seed first guide if none ---------- */
function maybeSeedFirstGuide(conn){
  if (Array.isArray(conn.guides) && conn.guides.length>0) return;
  const geom = computeConnectionGeometry({ ...conn, guides: [] });
  if (!geom) return;
  const { a, b } = geom;
  if (a.x !== b.x){
    const y = (a.y + b.y)/2;
    conn.guides = [{ type:'H', pos:y }];
  } else {
    const x = (a.x + b.x)/2;
    conn.guides = [{ type:'V', pos:x }];
  }
}

/* ---------- Buttons state ---------- */
// function updateUndoRedoButtons(){
//   const undoBtn = document.getElementById('undoBtn');
//   const redoBtn = document.getElementById('redoBtn');
//   if (undoBtn) undoBtn.disabled = !canEdit() || history.length < 2;
//   if (redoBtn) redoBtn.disabled = !canEdit() || future.length === 0;
// }
