// js/orValve.js
// OR (Shuttle) – ISO/Festo-lik symbol. Ingångar A/B nere, OUT uppe.
// Global skala: ändra SCALE = 1 för 100%, 0.5 för 50% osv.
const SCALE = 1;

export function addOrValve(x, y, compLayer, components, handlePortClick, makeDraggable, redrawConnections, uid){
  const id = uid();
  const s = (n)=> n * SCALE;

  // Basgeometri (oskalanterad)
  const SVG_W=180, SVG_H=180, GX=10, GY=20;
  const HUS_X=30, HUS_Y=60, HUS_W=130, HUS_H=70;

  // Wrapper
  const el = document.createElement('div');
  el.className = 'comp';
  el.style.left = x + 'px';
  el.style.top  = y + 'px';

  const label = document.createElement('div');
  label.className = 'label';
  label.textContent = 'OR (Shuttle)';

  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.classList.add('compSvg');
  svg.setAttribute('width',  s(SVG_W));
  svg.setAttribute('height', s(SVG_H));

  const g = document.createElementNS(NS, 'g');
  g.setAttribute('transform', `translate(${s(GX)},${s(GY)})`);

  // Hus
  const hus = document.createElementNS(NS,'rect');
  hus.setAttribute('x', s(HUS_X));
  hus.setAttribute('y', s(HUS_Y));
  hus.setAttribute('width',  s(HUS_W));
  hus.setAttribute('height', s(HUS_H));
  hus.setAttribute('fill','#fff'); hus.setAttribute('stroke','#000'); hus.setAttribute('stroke-width', s(2));

  // Kanal
  const kanal = document.createElementNS(NS,'line');
  kanal.setAttribute('x1', s(HUS_X+10));
  kanal.setAttribute('y1', s(HUS_Y+HUS_H/2));
  kanal.setAttribute('x2', s(HUS_X+HUS_W-10));
  kanal.setAttribute('y2', s(HUS_Y+HUS_H/2));
  kanal.setAttribute('stroke','#000'); kanal.setAttribute('stroke-width', s(2));

  // Shuttle (tjock lodrät linje)
  const cx = HUS_X + HUS_W/2;
  const plug = document.createElementNS(NS,'line');
  plug.setAttribute('x1', s(cx)); plug.setAttribute('y1', s(HUS_Y));
  plug.setAttribute('x2', s(cx)); plug.setAttribute('y2', s(HUS_Y+HUS_H));
  plug.setAttribute('stroke','#000'); plug.setAttribute('stroke-width', s(4));

  // Små sätesstaplar uppe/nere (ISO-estetik)
  const seat = (x1,y1,x2,y2)=>{
    const ln = document.createElementNS(NS,'line');
    ln.setAttribute('x1',s(x1)); ln.setAttribute('y1',s(y1));
    ln.setAttribute('x2',s(x2)); ln.setAttribute('y2',s(y2));
    ln.setAttribute('stroke','#000'); ln.setAttribute('stroke-width', s(2));
    g.appendChild(ln);
  };
  seat(HUS_X+30, HUS_Y,         HUS_X+30, HUS_Y+12);
  seat(HUS_X+HUS_W-30, HUS_Y,   HUS_X+HUS_W-30, HUS_Y+12);
  seat(HUS_X+30, HUS_Y+HUS_H-12, HUS_X+30, HUS_Y+HUS_H);
  seat(HUS_X+HUS_W-30, HUS_Y+HUS_H-12, HUS_X+HUS_W-30, HUS_Y+HUS_H);

  // Portar (OUT uppe mitt, A/B nere vänster/höger)
  const OUT = { cx: cx,                 cy: HUS_Y - 20 };
  const A   = { cx: HUS_X + 30,         cy: HUS_Y + HUS_H + 20 };
  const B   = { cx: HUS_X + HUS_W - 30, cy: HUS_Y + HUS_H + 20 };

  const vline = (x1,y1,y2)=>{
    const l = document.createElementNS(NS,'line');
    l.setAttribute('x1', s(x1)); l.setAttribute('y1', s(y1));
    l.setAttribute('x2', s(x1)); l.setAttribute('y2', s(y2));
    l.setAttribute('stroke','#000'); l.setAttribute('stroke-width', s(2));
    return l;
  };
  g.append(
    hus, kanal, plug,
    vline(OUT.cx, OUT.cy+6, HUS_Y),
    vline(A.cx,   HUS_Y+HUS_H, A.cy-6),
    vline(B.cx,   HUS_Y+HUS_H, B.cy-6)
  );

  function makePort(key, p){
    const c = document.createElementNS(NS,'circle');
    c.setAttribute('class','port'); c.setAttribute('r', s(6));
    c.setAttribute('cx', s(p.cx)); c.setAttribute('cy', s(p.cy));
    c.addEventListener('click', (e)=>{ e.stopPropagation(); handlePortClick(comp, key, c); });

    const t = document.createElementNS(NS,'text');
    t.setAttribute('x', s(p.cx));
    t.setAttribute('y', s(key==='OUT' ? p.cy - 10 : p.cy + 20));
    t.setAttribute('text-anchor','middle');
    t.setAttribute('font-size', Math.max(9, 11*SCALE));
    t.textContent = key;
    return { c, t };
  }
  const out = makePort('OUT', OUT);
  const a   = makePort('A',   A);
  const b   = makePort('B',   B);
  g.append(out.c, out.t, a.c, a.t, b.c, b.t);

  svg.appendChild(g);
  el.append(label, svg);
  compLayer.appendChild(el);

  const comp = {
    id, type:'orValve', el, x, y,
    svgW: s(SVG_W), svgH: s(SVG_H),
    gx: s(GX), gy: s(GY),
    ports: {
      OUT:{ cx: s(OUT.cx), cy: s(OUT.cy), el: out.c },
      A:  { cx: s(A.cx),   cy: s(A.cy),   el: a.c },
      B:  { cx: s(B.cx),   cy: s(B.cy),   el: b.c }
    }
  };

  makeDraggable(comp);
  components.push(comp);
  redrawConnections();
  return comp;
}
