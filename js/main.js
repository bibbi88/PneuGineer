// js/main.js
// Tryck-overlay + Stega + pilotsignaler (12/14) för 5/2-ventil

import { addValve52 }        from './valve52.js';
import { addCylinderDouble } from './cylinderDouble.js';
import { addSource }         from './source.js';
import { addAndValve }       from './andValve.js';
import { addOrValve }        from './orValve.js';
import { addLimitValve32 }   from './limitValve32.js'; // 3/2 gränslägesventil
import { addPushButton32 }   from './pushButton32.js'; // ⬅️ NY: 3/2 tryckknapp (momentan)

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
let pendingPort = null;

let selectedConnection = null;
let selectedComponent  = null;

const Modes = { STOP:'stop', PLAY:'play', PAUSE:'pause' };
let simMode = Modes.STOP;

const DEFAULT_VALVE_STATE = 1;
const DEFAULT_CYL_POS     = 0;

/* ---------- Undo/Redo ---------- */
const HISTORY_LIMIT = 50;
let history = [];
let future  = [];
let isRestoring = false;

/* ---------- Utils ---------- */
function uid(){ return nextId++; }
function workspaceBBox(){ return compLayer.getBoundingClientRect(); }
function canEdit(){ return simMode === Modes.STOP; }

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

/* ---------- Wires (ortogonalt, sista segmentet vertikalt) ---------- */
function drawWirePath(x1, y1, x2, y2){
  const stub = 14;
  if (x1 === x2) return `M ${x1},${y1} L ${x2},${y2}`;
  const dy = y2 - y1;
  const s  = Math.min(stub, Math.max(0, Math.abs(dy)/2) || stub);
  const yStart = y1 + (dy >= 0 ? s : -s);
  const yEnd   = y2 - (dy >= 0 ? s : -s);
  return [
    `M ${x1},${y1}`,
    `L ${x1},${yStart}`,
    `L ${x2},${yStart}`,
    `L ${x2},${yEnd}`,
    `L ${x2},${y2}`
  ].join(' ');
}

function redrawConnections(){
  connLayer.setAttribute('width',  compLayer.clientWidth);
  connLayer.setAttribute('height', compLayer.clientHeight);
  connections.forEach(conn=>{
    const c1 = components.find(c=>c.id===conn.from.id);
    const c2 = components.find(c=>c.id===conn.to.id);
    if(!c1 || !c2) return;
    const a = portGlobalPosition(c1, conn.from.port);
    const b = portGlobalPosition(c2, conn.to.port);
    conn.pathEl.setAttribute('d', drawWirePath(a.x, a.y, b.x, b.y));
  });
}

/* ---------- Val / radering ---------- */
function selectConnection(conn){
  clearSelectedComponent();
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
function selectComponent(comp){
  clearSelectedConnection();
  if (selectedComponent && selectedComponent!==comp) selectedComponent.el.classList.remove('selected');
  selectedComponent = comp;
  if (selectedComponent) selectedComponent.el.classList.add('selected');
}
function clearSelectedComponent(){
  if (selectedComponent){
    selectedComponent.el.classList.remove('selected');
    selectedComponent = null;
  }
}

compLayer.addEventListener('click', ()=>{
  clearSelectedConnection();
  clearSelectedComponent();
  hideCtxMenu();
});

window.addEventListener('keydown', (e)=>{
  if (e.key!=='Delete' && e.key!=='Backspace') return;
  if (!canEdit()) return;

  if (selectedConnection){
    selectedConnection.pathEl.remove();
    connections = connections.filter(c=>c!==selectedConnection);
    selectedConnection = null;
    e.preventDefault();
    pushHistory('Delete wire');
    redrawConnections();
    return;
  }
  if (selectedComponent){
    deleteComponent(selectedComponent);
    selectedComponent = null;
    e.preventDefault();
    pushHistory('Delete component');
    return;
  }
});

/* ---------- Kontextmeny (högerklick) ---------- */
let ctxMenuEl = null;
function hideCtxMenu(){ if (ctxMenuEl){ ctxMenuEl.remove(); ctxMenuEl = null; } }
function showCtxMenu(x, y, { type, payload }){
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
      deleteComponent(payload.comp);
      clearSelectedComponent();
      pushHistory('Delete component');
    } else if (type==='wire' && payload?.conn){
      payload.conn.pathEl.remove();
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
  toRemove.forEach(c => c.pathEl.remove());
  connections = connections.filter(c => c.from.id!==comp.id && c.to.id!==comp.id);
  comp.el.remove();
  components = components.filter(c => c !== comp);
  hideCtxMenu();
  redrawConnections();
}

/* ---------- Drag ---------- */
function makeDraggable(comp){
  let dragging=false, dx=0, dy=0;

  function onDown(e){
    if (!canEdit()) return;
    if (e.target.closest('.port')) return;
    selectComponent(comp);

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
    comp.x = Math.max(40, Math.min(rect.width-40,  e.clientX - rect.left - dx));
    comp.y = Math.max(40, Math.min(rect.height-40, e.clientY - rect.top  - dy));
    comp.el.style.left = comp.x + 'px';
    comp.el.style.top  = comp.y + 'px';
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
    selectComponent(comp);
    showCtxMenu(e.clientX, e.clientY, { type:'component', payload:{ comp } });
  });
}

/* ---------- Koppla portar ---------- */
function handlePortClick(comp, portKey, portEl){
  if (!canEdit()) return;
  hideCtxMenu();
  clearSelectedComponent();
  clearSelectedConnection();

  if (!pendingPort){
    pendingPort = { id: comp.id, port: portKey };
    portEl.setAttribute('fill', '#dff1ff');
    return;
  }
  if (pendingPort.id === comp.id && pendingPort.port === portKey){
    pendingPort = null;
    portEl.setAttribute('fill', '#fff');
    return;
  }

  const path = document.createElementNS('http://www.w3.org/2000/svg','path');
  path.setAttribute('class','wire');
  path.style.pointerEvents = 'stroke';
  path.addEventListener('click', (e)=>{
    e.stopPropagation();
    const conn = connections.find(c=>c.pathEl===path);
    if (conn) selectConnection(conn);
  });
  path.addEventListener('contextmenu', (e)=>{
    e.preventDefault();
    const conn = connections.find(c=>c.pathEl===path);
    if (conn){
      selectConnection(conn);
      showCtxMenu(e.clientX, e.clientY, { type:'wire', payload:{ conn } });
    }
  });

  connLayer.appendChild(path);

  connections.push({
    from: pendingPort,
    to:   { id: comp.id, port: portKey },
    pathEl: path
  });

  const prevComp = components.find(c=>c.id===pendingPort.id);
  if (prevComp) prevComp.ports[pendingPort.port]?.el?.setAttribute('fill','#fff');

  pendingPort = null;
  redrawConnections();
  pushHistory('Create wire');
}

/* ---------- TRYCK-OVERLAY ---------- */
function computePressureSet(){
  const key = (id,port)=> `${id}:${port}`;

  // 1) graf av ledningar
  const adj = new Map();
  const addUndirected = (a,b)=>{
    if (!adj.has(a)) adj.set(a, new Set());
    if (!adj.has(b)) adj.set(b, new Set());
    adj.get(a).add(b); adj.get(b).add(a);
  };
  connections.forEach(conn=>{
    addUndirected(key(conn.from.id, conn.from.port), key(conn.to.id, conn.to.port));
  });

  // 2) start = tryckkällor
  const start = [];
  components.forEach(c=>{
    if (c.type==='source'){
      if (c.ports?.OUT) start.push(key(c.id,'OUT'));
      if (c.ports?.P)   start.push(key(c.id,'P'));
    }
  });

  // 3) flood via kablage
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

  // 4) komponentlogik + flood igen vid förändring
  let changed = true;
  while (changed){
    changed = false;

    // 5/2: 1 <-> (4 eller 2)
    components.forEach(v=>{
      if (v.type!=='valve52') return;
      const a = (v.state===0) ? '4' : '2';
      const n1 = `${v.id}:1`, na = `${v.id}:${a}`;
      const before = pressurized.size;
      if (pressurized.has(n1)) pressurized.add(na);
      if (pressurized.has(na)) pressurized.add(n1);
      if (pressurized.size !== before) changed = true;
    });

    // AND: A & B -> OUT
    components.forEach(av=>{
      if (av.type!=='andValve') return;
      const nA = `${av.id}:A`, nB = `${av.id}:B`, nO = `${av.id}:OUT`;
      const before = pressurized.size;
      if (pressurized.has(nA) && pressurized.has(nB)) pressurized.add(nO);
      if (pressurized.size !== before) changed = true;
    });

    // OR (shuttle): A || B -> OUT
    components.forEach(ov=>{
      if (ov.type!=='orValve') return;
      const nA = `${ov.id}:A`, nB = `${ov.id}:B`, nO = `${ov.id}:OUT`;
      const before = pressurized.size;
      if (pressurized.has(nA) || pressurized.has(nB)) pressurized.add(nO);
      if (pressurized.size !== before) changed = true;
    });

    // 3/2 gränslägesventil: aktiv → (2 <-> 1), inaktiv → (2 <-> 3)
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

    // 3/2 tryckknapp (momentan): aktiv → (2 <-> 1), annars (2 <-> 3)
    components.forEach(pv=>{
      if (pv.type!=='push32') return;
      const a = pv.state?.active ? '1' : '3';
      const n2 = `${pv.id}:2`, nx = `${pv.id}:${a}`;
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
let stepOnceFlag = false; // ⏭️ ett enstaka sim-tick

function simulate(dt){
  const playing = (simMode === Modes.PLAY) || stepOnceFlag;

  // 0) låt komponenter uppdatera internt läge (t.ex. limit32/push32 grafik)
  components.forEach(c=>{
    if (typeof c.recompute === 'function') c.recompute();
  });

  // 1) tryckbild
  if (playing){
    lastPressure = computePressureSet();
  } else if (simMode === Modes.STOP){
    lastPressure = new Set();
  }
  // (i PAUSE behåller vi lastPressure)

  // 2) pilotstyrning (rising-edge) för 5/2 – luftpuls på 12 eller 14 togglar läge
  if (playing){
    components.forEach(v=>{
      if (v.type!=='valve52') return;
      if (v._pilot12Prev === undefined) v._pilot12Prev = false;
      if (v._pilot14Prev === undefined) v._pilot14Prev = false;

      const p12 = lastPressure.has(`${v.id}:12`);
      const p14 = lastPressure.has(`${v.id}:14`);

      if (p12 && !v._pilot12Prev) v.toggle();
      if (p14 && !v._pilot14Prev) v.toggle();

      v._pilot12Prev = p12;
      v._pilot14Prev = p14;
    });
  }

  // 3) overlay på portar
  components.forEach(c=>{
    if (!c.ports) return;
    for (const k of Object.keys(c.ports)){
      const n = `${c.id}:${k}`;
      const pressed = lastPressure.has(n) && (playing || simMode===Modes.PAUSE);
      c.ports[k].el?.classList.toggle('pressurized', pressed);
    }
  });

  // 4) cylinder-rörelse
  if (playing){
    components.filter(c=>c.type==='cylDouble' || c.type==='cylinder').forEach(cyl=>{
      const isPress = (id,port)=> lastPressure.has(`${id}:${port}`);

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

      let target = cyl.pos;
      if (capPress && !rodPress) target = 1;
      else if (!capPress && rodPress) target = 0;

      const speed = 0.8;
      const dir = Math.sign(target - cyl.pos);
      if (dir!==0) cyl.setPos(cyl.pos + dir*speed*dt);
    });
  }

  // 5) wires: aktiva (blink) där båda ändar har tryck
  connections.forEach(conn=>{
    const a = `${conn.from.id}:${conn.from.port}`;
    const b = `${conn.to.id}:${conn.to.port}`;
    const active = (playing || simMode===Modes.PAUSE) && lastPressure.has(a) && lastPressure.has(b);
    conn.pathEl?.classList.toggle('active', active);
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
    if (c.type==='push32')  return { ...base, active: !!(c.state?.active) }; // ⬅️ NYTT
    // limit32 styrs via signaler, ingen extra state behövs
    return base;
  });
  const conns = connections.map(conn=>({
    from:{ id:conn.from.id, port:conn.from.port },
    to:  { id:conn.to.id,   port:conn.to.port }
  }));
  return { version: 4, comps, conns };
}
function clearProject(){
  connections.forEach(c=>c.pathEl.remove());
  connections = [];
  components.forEach(c=>c.el.remove());
  components = [];
  nextId = 1;
  pendingPort = null;
  clearSelectedConnection();
  clearSelectedComponent();
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
      // Om din cylinderDouble tar fler argument (namngivning/signaler), lägg till dem här.
      comp = addCylinderDouble(sc.x, sc.y, compLayer, components, handlePortClick, makeDraggable, redrawConnections, uid);
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

  for (const conn of data.conns){
    const newFromId = idMap.get(conn.from.id);
    const newToId   = idMap.get(conn.to.id);
    if (!newFromId || !newToId) continue;

    const path = document.createElementNS('http://www.w3.org/2000/svg','path');
    path.setAttribute('class','wire');
    path.style.pointerEvents = 'stroke';
    path.addEventListener('click', (e)=>{ e.stopPropagation(); const c = connections.find(k=>k.pathEl===path); if (c) selectConnection(c); });
    path.addEventListener('contextmenu', (e)=>{ e.preventDefault(); const c = connections.find(k=>k.pathEl===path); if (c){ selectConnection(c); showCtxMenu(e.clientX,e.clientY,{ type:'wire', payload:{ conn:c }}); }});
    connLayer.appendChild(path);

    connections.push({
      from: { id: newFromId, port: conn.from.port },
      to:   { id: newToId,   port: conn.to.port },
      pathEl: path
    });
  }

  redrawConnections();
  isRestoring = false;
}

/* ---------- Undo/Redo ---------- */
function pushHistory(_label=''){
  if (isRestoring) return;
  const snap = snapshotProject();
  history.push(JSON.stringify(snap));
  if (history.length > HISTORY_LIMIT) history.shift();
  future = [];
  updateUndoRedoButtons();
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
  lastPressure = new Set();
  components.forEach(c=>{
    if (!c.ports) return;
    for (const k of Object.keys(c.ports)){ c.ports[k].el?.classList.remove('pressurized'); }
  });
  clearSelectedConnection(); clearSelectedComponent(); hideCtxMenu();
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
    addCylinderDouble(r.width*0.70, r.height*0.50, compLayer, components, handlePortClick, makeDraggable, redrawConnections, uid);
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
    const a = document.createElement('a');
    a.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(snap, null, 2));
    a.download = 'projekt.json'; a.style.display='none'; document.body.appendChild(a); a.click(); document.body.removeChild(a);
  });
  ensureButton('loadProj', '📂 Ladda projekt', ()=>{
    if (!canEdit()) return;
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'application/json';
    inp.onchange = async (e)=>{
      const file = e.target.files?.[0]; if (!file) return;
      try { const data = JSON.parse(await file.text()); await loadProject(data); pushHistory('Load project'); }
      catch(err){ console.error('Fel vid laddning:', err); alert('Ogiltig projektfil.'); }
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
  addCylinderDouble(r.width*0.70, r.height*0.50, compLayer, components, handlePortClick, makeDraggable, redrawConnections, uid);
  pushHistory('Initial');
});

/* ---------- Nödvändig CSS om du inte redan har den ---------- */
(function injectOverlayCSS(){
  if (document.getElementById('overlayCSS')) return;
  const css = `
    .wire { stroke:#000; stroke-width:2; fill:none; }
    .wire.active { stroke:#d00; stroke-dasharray:6 6; animation: wireflow 1.2s linear infinite; }
    @keyframes wireflow { to { stroke-dashoffset: -12; } }
    .wire.selected { stroke:#0a74ff; stroke-width:3; }
    .comp.selected { outline: 2px dashed #0a74ff; outline-offset: 2px; }

    .port { fill:#fff; stroke:#0a74ff; stroke-width:1.5; }
    .port.pressurized { fill:#e6f3ff; stroke:#0073e6; stroke-width:2; }

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
  `;
  const style = document.createElement('style');
  style.id = 'overlayCSS';
  style.textContent = css;
  document.head.appendChild(style);
})();
