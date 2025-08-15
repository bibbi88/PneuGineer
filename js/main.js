// js/main.js
import { addValve52 }        from './valve52.js';
import { addCylinderDouble } from './cylinderDouble.js';
import { addSource }         from './source.js';
import { addAndValve }       from './andValve.js';
import { addOrValve }        from './orValve.js';

/* ---------- DOM-lager ---------- */
const compLayer = document.getElementById('compLayer');
const connLayer = document.getElementById('connLayer');

/* --- Ledningslagret överst, men släpp igenom klick utanför trådar --- */
connLayer.style.zIndex = '2';
compLayer.style.zIndex = '1';
connLayer.style.pointerEvents = 'none'; // pathar får egna pointer-events

/* ---------- App-state ---------- */
let components = [];    // { id,type,el,x,y, ports:{k:{cx,cy,el}}, state?, svgW,svgH,gx,gy, ... }
let connections = [];   // { from:{id,port}, to:{id,port}, pathEl }
let nextId = 1;
let pendingPort = null;

/* --- Val & radering --- */
let selectedConnection = null;
let selectedComponent  = null;

/* --- Simuleringsläge --- */
const Modes = { STOP:'stop', PLAY:'play', PAUSE:'pause' };
let simMode = Modes.STOP; // start i STOP (redigerbart)

/* --- Standardlägen för reset --- */
const DEFAULT_VALVE_STATE = 1; // "läge 1"
const DEFAULT_CYL_POS     = 0; // helt indragen

/* --- Undo / Redo --- */
const HISTORY_LIMIT = 50;
let history = [];  // stack av snapshots
let future  = [];  // stack för redo
let isRestoring = false; // blockera history push när vi återställer

/* ---------- CSS för trådar, markering & meny ---------- */
(function injectWireCSS(){
  const css = `
    .wire { stroke:#000; stroke-width:2; fill:none; }
    .wire.active { stroke:#d00; stroke-dasharray:6 6; animation: wireflow 1.2s linear infinite; }
    .wire.selected { stroke:#0a74ff; stroke-width:3; }
    .comp.selected { outline: 2px dashed #0a74ff; outline-offset: 2px; }
    @keyframes wireflow { to { stroke-dashoffset: -12; } }

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
  style.textContent = css;
  document.head.appendChild(style);
})();

/* ---------- Utils ---------- */
function uid(){ return nextId++; }
function workspaceBBox(){ return compLayer.getBoundingClientRect(); }
function canEdit(){ return simMode === Modes.STOP; }

/* ----- Port → globala koordinater ----- */
function portGlobalPosition(comp, portKey){
  const p = comp.ports?.[portKey];
  if (!p) return { x: comp.x, y: comp.y };

  if (comp.svgW && comp.svgH && (comp.gx !== undefined) && (comp.gy !== undefined)) {
    const svg0x = comp.x - comp.svgW/2;
    const svg0y = comp.y - comp.svgH/2;
    return { x: svg0x + comp.gx + p.cx, y: svg0y + comp.gy + p.cy };
  }
  return { x: comp.x + p.cx, y: comp.y + p.cy };
}

/* ---------- Wire-dragning (ortogonal; sista biten vertikal) ---------- */
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

/* ---------- Rita om kopplingar ---------- */
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

/* ---------- Val: tråd ---------- */
function selectConnection(conn){
  clearSelectedComponent();
  if (selectedConnection && selectedConnection !== conn){
    selectedConnection.pathEl.classList.remove('selected');
  }
  selectedConnection = conn;
  if (selectedConnection) selectedConnection.pathEl.classList.add('selected');
}
function clearSelectedConnection(){
  if (selectedConnection){
    selectedConnection.pathEl.classList.remove('selected');
    selectedConnection = null;
  }
}

/* ---------- Val: komponent ---------- */
function selectComponent(comp){
  clearSelectedConnection();
  if (selectedComponent && selectedComponent !== comp){
    selectedComponent.el.classList.remove('selected');
  }
  selectedComponent = comp;
  if (selectedComponent) selectedComponent.el.classList.add('selected');
}
function clearSelectedComponent(){
  if (selectedComponent){
    selectedComponent.el.classList.remove('selected');
    selectedComponent = null;
  }
}

/* ---------- Delete med tangentbord ---------- */
window.addEventListener('keydown', (e)=>{
  if (e.key !== 'Delete' && e.key !== 'Backspace') return;
  if (!canEdit()) return; // bara i STOP

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
function hideCtxMenu(){
  if (ctxMenuEl){ ctxMenuEl.remove(); ctxMenuEl = null; }
}
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
    if (type === 'component' && payload?.comp){
      deleteComponent(payload.comp);
      clearSelectedComponent();
      pushHistory('Delete component');
    } else if (type === 'wire' && payload?.conn){
      payload.conn.pathEl.remove();
      connections = connections.filter(c => c!==payload.conn);
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

/* ---------- Radera komponent + dess trådar ---------- */
function deleteComponent(comp){
  const toRemove = connections.filter(c => c.from.id===comp.id || c.to.id===comp.id);
  toRemove.forEach(c => c.pathEl.remove());
  connections = connections.filter(c => c.from.id!==comp.id && c.to.id!==comp.id);

  comp.el.remove();
  components = components.filter(c => c !== comp);

  hideCtxMenu();
  redrawConnections();
}

/* ---------- Markering rensas i tom yta ---------- */
compLayer.addEventListener('click', ()=>{
  clearSelectedConnection();
  clearSelectedComponent();
  hideCtxMenu();
});

/* ---------- Drag move för komponent ---------- */
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
    comp.el.classList.add('draggable');
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
    if (dragging) pushHistory('Move component');
    dragging=false;
    comp.el.classList.remove('draggable');
    window.removeEventListener('mousemove', onMove);
  }
  comp.el.addEventListener('mousedown', onDown);

  comp.el.addEventListener('contextmenu', (e)=>{
    e.preventDefault();
    selectComponent(comp);
    showCtxMenu(e.clientX, e.clientY, { type:'component', payload:{ comp } });
  });
}

/* ---------- Portkoppling ---------- */
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

/* ---------- Tryckpropagering ---------- */
function computePressureSet(){
  if (simMode !== Modes.PLAY) return new Set();

  const key = (id,port)=> `${id}:${port}`;
  const adj = new Map();
  const addUndirected = (a,b)=>{
    if (!adj.has(a)) adj.set(a, new Set());
    if (!adj.has(b)) adj.set(b, new Set());
    adj.get(a).add(b); adj.get(b).add(a);
  };

  connections.forEach(conn=>{
    addUndirected(key(conn.from.id, conn.from.port), key(conn.to.id, conn.to.port));
  });

  const start = [];
  components.forEach(c=>{
    if (c.type === 'source'){
      if (c.ports.OUT) start.push(key(c.id,'OUT'));
      if (c.ports.P)   start.push(key(c.id,'P'));
    }
  });

  const pressurized = new Set();
  const q = [];
  start.forEach(s=>{ pressurized.add(s); q.push(s); });
  while(q.length){
    const cur = q.shift();
    const nbrs = adj.get(cur);
    if (!nbrs) continue;
    for (const n of nbrs){
      if (!pressurized.has(n)){
        pressurized.add(n);
        q.push(n);
      }
    }
  }

  let changed = true;
  while (changed){
    changed = false;

    components.forEach(v=>{
      if (v.type !== 'valve52') return;
      const a = (v.state===0) ? '4' : '2';
      const n1 = key(v.id,'1');
      const na = key(v.id, a);
      const sizeBefore = pressurized.size;
      if (pressurized.has(n1)) pressurized.add(na);
      if (pressurized.has(na)) pressurized.add(n1);
      if (pressurized.size !== sizeBefore) changed = true;
    });

    components.forEach(av=>{
      if (av.type !== 'andValve') return;
      const nA = key(av.id,'A'), nB = key(av.id,'B'), nO = key(av.id,'OUT');
      const sizeBefore = pressurized.size;
      if (pressurized.has(nA) && pressurized.has(nB)) pressurized.add(nO);
      if (pressurized.size !== sizeBefore) changed = true;
    });

    components.forEach(ov=>{
      if (ov.type !== 'orValve') return;
      const nA = key(ov.id,'A'), nB = key(ov.id,'B'), nO = key(ov.id,'OUT');
      const sizeBefore = pressurized.size;
      if (pressurized.has(nA) || pressurized.has(nB)) pressurized.add(nO);
      if (pressurized.size !== sizeBefore) changed = true;
    });

    if (changed){
      const q2 = [...pressurized];
      while(q2.length){
        const cur = q2.shift();
        const nbrs = adj.get(cur);
        if (!nbrs) continue;
        for (const n of nbrs){
          if (!pressurized.has(n)){
            pressurized.add(n);
            q2.push(n);
          }
        }
      }
    }
  }

  return pressurized;
}

/* ---------- Simulering ---------- */
function findConnections(fromId, fromPort){
  return connections.filter(c =>
    (c.from.id===fromId && c.from.port===fromPort) ||
    (c.to.id===fromId   && c.to.port===fromPort)
  );
}
function counterpart(conn, id){ return (conn.from.id===id) ? conn.to : conn.from; }

let lastPressure = new Set();

function simulate(dt){
  lastPressure = computePressureSet();

  if (simMode === Modes.PLAY){
    components.filter(c=>c.type==='cylDouble' || c.type==='cylinder').forEach(cyl=>{
      let capPress = false, rodPress = false;

      const capConns = findConnections(cyl.id, 'Cap');
      const rodConns = findConnections(cyl.id, 'Rod');
      const isPress = (id,port)=> lastPressure.has(`${id}:${port}`);

      capConns.forEach(conn=>{
        const o = counterpart(conn, cyl.id);
        if (isPress(o.id, o.port)) capPress = true;
      });
      rodConns.forEach(conn=>{
        const o = counterpart(conn, cyl.id);
        if (isPress(o.id, o.port)) rodPress = true;
      });

      let target = cyl.pos;
      if (capPress && !rodPress) target = 1;
      else if (!capPress && rodPress) target = 0;

      const speed = 0.8;
      const dir = Math.sign(target - cyl.pos);
      if (dir !== 0) cyl.setPos(cyl.pos + dir*speed*dt);
    });
  }

  connections.forEach(conn=>{
    const a = `${conn.from.id}:${conn.from.port}`;
    const b = `${conn.to.id}:${conn.to.port}`;
    const active = (simMode === Modes.PLAY) && lastPressure.has(a) && lastPressure.has(b);
    conn.pathEl.classList.toggle('active', active);
  });
}

/* ---------- Tidsloop ---------- */
let last = performance.now();
function tick(t){
  const dt = Math.min(0.05, (t-last)/1000);
  last = t;
  simulate(dt);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

/* ---------- Spara/Ladda ---------- */
function snapshotProject(){
  const comps = components.map(c => {
    const base = { id: c.id, type: c.type, x: c.x, y: c.y };
    if (c.type === 'valve52') return { ...base, state: c.state };
    if (c.type === 'cylDouble' || c.type === 'cylinder') return { ...base, pos: c.pos ?? 0 };
    if (c.type === 'source') return { ...base, on: c.on ?? true };
    return base;
  });

  const conns = connections.map(conn => ({
    from: { id: conn.from.id, port: conn.from.port },
    to:   { id: conn.to.id,   port: conn.to.port }
  }));

  return { version: 1, comps, conns };
}

function clearProject(){
  connections.forEach(c => c.pathEl.remove());
  connections = [];
  components.forEach(c => c.el.remove());
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
      if (typeof sc.on === 'boolean') comp.on = sc.on;
    } else if (sc.type === 'valve52'){
      comp = addValve52(sc.x, sc.y, compLayer, components, handlePortClick, makeDraggable, redrawConnections, uid);
      if (typeof sc.state === 'number') comp.setState(sc.state);
      wrapValveToggleGuard(comp);
    } else if (sc.type === 'cylDouble' || sc.type === 'cylinder'){
      comp = addCylinderDouble(sc.x, sc.y, compLayer, components, handlePortClick, makeDraggable, redrawConnections, uid);
      if (typeof sc.pos === 'number') comp.setPos(sc.pos);
    } else if (sc.type === 'andValve'){
      comp = addAndValve(sc.x, sc.y, compLayer, components, handlePortClick, makeDraggable, redrawConnections, uid);
    } else if (sc.type === 'orValve'){
      comp = addOrValve(sc.x, sc.y, compLayer, components, handlePortClick, makeDraggable, redrawConnections, uid);
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
    path.addEventListener('click', (e)=>{
      e.stopPropagation();
      const c = connections.find(k=>k.pathEl===path);
      if (c) selectConnection(c);
    });
    path.addEventListener('contextmenu', (e)=>{
      e.preventDefault();
      const c = connections.find(k=>k.pathEl===path);
      if (c){
        selectConnection(c);
        showCtxMenu(e.clientX, e.clientY, { type:'wire', payload:{ conn:c } });
      }
    });
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

/* ---------- Nedladdning ---------- */
function download(filename, text){
  const a = document.createElement('a');
  a.setAttribute('href', 'data:application/json;charset=utf-8,' + encodeURIComponent(text));
  a.setAttribute('download', filename);
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
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
  loadProject(prev).then(()=>{
    isRestoring = false;
    updateUndoRedoButtons();
  });
}
function redo(){
  if (future.length === 0) return;
  const next = JSON.parse(future.pop());
  const current = snapshotProject();
  history.push(JSON.stringify(current));
  isRestoring = true;
  loadProject(next).then(()=>{
    isRestoring = false;
    updateUndoRedoButtons();
  });
}

/* ---------- Knappar ---------- */
function ensureButton(id, label, onClick){
  let btn = document.getElementById(id);
  if (!btn){
    const side = document.querySelector('.sidebar') || document.body;
    btn = document.createElement('button');
    btn.id = id;
    btn.className = 'btn';
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
  ensureButton('btnPause', simMode===Modes.PAUSE ? '⏸️ Paus'   : '⏸️ Pausa', ()=> setMode(Modes.PAUSE));
  ensureButton('btnStop',  '⏹️ Stoppa & återställ', ()=> resetSystem());

  const editableButtons = ['addSource','addValve52','addCylDouble','addAnd','addOr','saveProj','loadProj','undoBtn','redoBtn'];
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
    if (c.type === 'valve52' && typeof c.setState === 'function'){
      c.setState(DEFAULT_VALVE_STATE);
    } else if ((c.type === 'cylDouble' || c.type === 'cylinder') && typeof c.setPos === 'function'){
      c.setPos(DEFAULT_CYL_POS);
    }
  });

  connections.forEach(conn => conn.pathEl.classList.remove('active'));

  clearSelectedConnection();
  clearSelectedComponent();
  hideCtxMenu();

  pushHistory('Reset');
}

/* ---- Guard: lås ventilväxling utanför PLAY ---- */
function wrapValveToggleGuard(valveComp){
  if (!valveComp || typeof valveComp.toggle !== 'function') return;
  const original = valveComp.toggle.bind(valveComp);
  valveComp.toggle = function(){
    if (simMode !== Modes.PLAY) return;
    original();
  };
}

/* ---- Skapa knappar ---- */
ensureButton('addSource',  '➕ Tryckkälla', ()=>{
  if (!canEdit()) return;
  const r = workspaceBBox();
  addSource(r.width*0.15, r.height*0.50,
            compLayer, components, handlePortClick, makeDraggable, redrawConnections, uid);
  pushHistory('Add source');
});
ensureButton('addValve52', '➕ 5/2-ventil', ()=>{
  if (!canEdit()) return;
  const r = workspaceBBox();
  const v = addValve52(r.width*0.40, r.height*0.50,
             compLayer, components, handlePortClick, makeDraggable, redrawConnections, uid);
  wrapValveToggleGuard(v);
  pushHistory('Add valve52');
});
ensureButton('addCylDouble','➕ Cylinder, dubbelverkande', ()=>{
  if (!canEdit()) return;
  const r = workspaceBBox();
  addCylinderDouble(r.width*0.70, r.height*0.50,
                    compLayer, components, handlePortClick, makeDraggable, redrawConnections, uid);
  pushHistory('Add cylinder');
});
ensureButton('addAnd',     '➕ AND-ventil', ()=>{
  if (!canEdit()) return;
  const r = workspaceBBox();
  addAndValve(r.width*0.25, r.height*0.35,
              compLayer, components, handlePortClick, makeDraggable, redrawConnections, uid);
  pushHistory('Add AND');
});
ensureButton('addOr',      '➕ OR-ventil', ()=>{
  if (!canEdit()) return;
  const r = workspaceBBox();
  addOrValve(r.width*0.25, r.height*0.65,
             compLayer, components, handlePortClick, makeDraggable, redrawConnections, uid);
  pushHistory('Add OR');
});

/* ---- Save/Load/Undo/Redo ---- */
ensureButton('saveProj', '💾 Spara projekt', ()=>{
  if (!canEdit()) return;
  const snap = snapshotProject();
  download('projekt.json', JSON.stringify(snap, null, 2));
});
ensureButton('loadProj', '📂 Ladda projekt', ()=>{
  if (!canEdit()) return;
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = 'application/json';
  inp.onchange = async (e)=>{
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      const data = JSON.parse(text);
      await loadProject(data);
      pushHistory('Load project');
    } catch (err){
      console.error('Fel vid laddning:', err);
      alert('Ogiltig projektfil.');
    }
  };
  inp.click();
});
ensureButton('undoBtn', '↩️ Ångra', ()=> { if (canEdit()) undo(); });
ensureButton('redoBtn', '↪️ Gör om', ()=> { if (canEdit()) redo(); });

/* ---- Play/Pause/Stop UI ---- */
updateModeButtons();

/* ---------- Startlayout ---------- */
window.addEventListener('load', ()=>{
  const r = workspaceBBox();
  addSource(r.width*0.15, r.height*0.50,
            compLayer, components, handlePortClick, makeDraggable, redrawConnections, uid);
  const v = addValve52(r.width*0.40, r.height*0.50,
             compLayer, components, handlePortClick, makeDraggable, redrawConnections, uid);
  wrapValveToggleGuard(v);
  addCylinderDouble(r.width*0.70, r.height*0.50,
                    compLayer, components, handlePortClick, makeDraggable, redrawConnections, uid);

  pushHistory('Initial');
  updateUndoRedoButtons();
});
