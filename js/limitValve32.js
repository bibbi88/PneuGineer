// js/limitValve32.js
// 3/2 gränslägesventil, fasta portar i högra "lådan" (stämmer med din mockup)
// - vila: 2→3, 1 block (T)
// - aktiv: 2→1, 3 block (T)
// Styrs antingen manuellt (klick) eller via sensorKey (t.ex. "a0", "a1").

export function addLimitValve32(
  x, y,
  compLayer, components,
  handlePortClick, makeDraggable, redrawConnections,
  getSignal // <-- funktion från main.js
) {
  const width = 120, height = 70;
  const group = document.createElement('div');
  group.className = 'comp draggable';
  group.style.left = `${x}px`;
  group.style.top = `${y}px`;

  // Label överst
  const label = document.createElement('div');
  label.className = 'label';
  label.textContent = '3/2 gränsläge';
  group.appendChild(label);

  // SVG
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('class', 'compSvg');
  svg.setAttribute('width', width);
  svg.setAttribute('height', height);

  // Kapsling (två rutor)
  const body = document.createElementNS(svgNS, 'rect');
  body.setAttribute('x', 0); body.setAttribute('y', 0);
  body.setAttribute('width', width); body.setAttribute('height', height);
  body.setAttribute('fill', '#fff'); body.setAttribute('stroke', '#000');
  svg.appendChild(body);

  const mid = document.createElementNS(svgNS, 'line');
  mid.setAttribute('x1', width/2); mid.setAttribute('y1', 0);
  mid.setAttribute('x2', width/2); mid.setAttribute('y2', height);
  mid.setAttribute('stroke', '#000');
  svg.appendChild(mid);

  // PORTER (fasta i högra lådan): 2 uppe (~¼ in), 1 nere under 2, 3 nere höger
  const rightX = width/2;
  const insetX = rightX + Math.round((width/2) * 0.25); // ~¼ in i högra lådan
  const port2 = makePort(insetX, 6, '2');   // uppe
  const port1 = makePort(insetX, height-6, '1'); // nere
  const port3 = makePort(width-10, height-6, '3'); // nere höger

  svg.appendChild(port2.el);
  svg.appendChild(port1.el);
  svg.appendChild(port3.el);

  // Internt läges-flagga (om ingen sensorKey är bunden)
  let manualActive = false;
  let sensorKey = null; // t.ex. "a0", "a1", "b0", ...

  // Rita interna pilar/block
  const gRight = document.createElementNS(svgNS, 'g'); // viloläge i högra rutan
  const gLeft  = document.createElementNS(svgNS, 'g'); // aktiverat i vänstra rutan
  svg.appendChild(gRight);
  svg.appendChild(gLeft);

  function drawInternals(active) {
    // Töm grupper
    gRight.replaceChildren();
    gLeft.replaceChildren();

    // ----- Högra ruta (vila): 2→3, 1 block (T)
    // diagonal 2→3
    gRight.appendChild(path(`M ${insetX-rightX} 10 L ${width-10-rightX} ${height-10}`, '#000', 2, true));
    // T block vid 1 (horisontell över lodrät)
    gRight.appendChild(path(`M ${insetX-rightX-8} ${height-20} L ${insetX-rightX+8} ${height-20}`, '#000', 2));
    gRight.appendChild(path(`M ${insetX-rightX} ${height-20} L ${insetX-rightX} ${height-6}`, '#000', 2));

    // ----- Vänstra ruta (aktiv): 2→1, 3 block (T)
    if (active) {
      // diag 2→1 (speglad)
      gLeft.appendChild(path(`M ${insetX- (rightX)} 10 L ${insetX-(rightX)} ${height-10}`, '#000', 2, true));
      // T block vid 3 (speglad till vänster ruta, nere höger relativt vänster cell)
      const leftCellRight = rightX; // x=60 i vänster cell
      const bx = leftCellRight - 20; // lite in från högerkanten av vänster cell
      const by = height-20;
      gLeft.appendChild(path(`M ${bx-8} ${by} L ${bx+8} ${by}`, '#000', 2));
      gLeft.appendChild(path(`M ${bx} ${by} L ${bx} ${height-6}`, '#000', 2));
    }
  }

  function recompute() {
    const isActive = sensorKey ? !!getSignal(sensorKey) : manualActive;
    drawInternals(isActive);
    comp.state.active = isActive;
    redrawConnections();
  }

  // Klick i vänstra (aktiverade) rutan togglar manuellt om ingen sensorKey
  svg.addEventListener('click', (e) => {
    const clickX = e.offsetX;
    if (!sensorKey && clickX < width/2) {
      manualActive = !manualActive;
      recompute();
    }
  });

  // Enkel bindnings-UI: tryck 'S' → prompt för sensorKey (t.ex. a0/a1/b0/b1)
  svg.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 's') {
      const key = window.prompt('Ange sensorKey (t.ex. a0, a1, b0, b1):', sensorKey || '');
      if (key) {
        sensorKey = key.trim().toLowerCase();
        label.textContent = `3/2 gränsläge (${sensorKey})`;
        recompute();
      }
    }
  });
  svg.setAttribute('tabindex', '0'); // så keydown fungerar
  svg.style.outline = 'none';

  // Port-klick koppling
  [port1, port2, port3].forEach(p => {
    p.el.addEventListener('click', (ev) => {
      ev.stopPropagation();
      handlePortClick(comp, p);
    });
  });

  // Hjälpare
  function makePort(px, py, id) {
    const el = document.createElementNS(svgNS, 'circle');
    el.setAttribute('class', 'port');
    el.setAttribute('r', 5);
    el.setAttribute('cx', px);
    el.setAttribute('cy', py);
    return { id, el, x: px, y: py };
  }
  function path(d, stroke, sw=2, arrow=false) {
    const p = document.createElementNS(svgNS, 'path');
    p.setAttribute('d', d);
    p.setAttribute('fill', 'none');
    p.setAttribute('stroke', stroke);
    p.setAttribute('stroke-width', sw);
    if (arrow) p.setAttribute('marker-end', 'url(#arrow-head)'); // optional if you have markers
    return p;
  }

  // Lägg in valfri pil-marker om din app har en global <defs>. Om inte, funkar utan.
  // (Eller skapa egen <defs> här och append:a till svg.)

  // Registrera komponent
  const comp = {
    type: 'limit32',
    label,
    el: group,
    svg,
    ports: [
      { id: '1', x: x + port1.x - width/2, y: y + port1.y - height/2, el: port1.el },
      { id: '2', x: x + port2.x - width/2, y: y + port2.y - height/2, el: port2.el },
      { id: '3', x: x + port3.x - width/2, y: y + port3.y - height/2, el: port3.el },
    ],
    state: { active: false, sensorKey: null },
    getActivePaths() {
      // returnera vilka port-par som är ihopkopplade, för ditt connLayer
      // aktiv: 2-1, inaktiv: 2-3
      return this.state.active ? [['2','1']] : [['2','3']];
    },
    bindSensor(key) {
      sensorKey = key;
      label.textContent = `3/2 gränsläge (${sensorKey})`;
      recompute();
    },
    recompute,
  };

  group.appendChild(svg);
  compLayer.appendChild(group);
  makeDraggable(group, comp);
  components.push(comp);

  // första draw
  recompute();
  return comp;
}
