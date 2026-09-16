import { createSvgEl } from '../components/shared/svgHelpers';
import { SYMBOL_LAB_ENTRIES, type SymbolLabEntry } from './symbolLabRegistry';

const symbolSelect = document.getElementById('symbolSelect') as HTMLSelectElement;
const fieldsEl = document.getElementById('fields') as HTMLDivElement;
const svgHost = document.getElementById('svgHost') as HTMLDivElement;
const codeOut = document.getElementById('codeOut') as HTMLTextAreaElement;
const resetBtn = document.getElementById('resetBtn') as HTMLButtonElement;
const copyBtn = document.getElementById('copyBtn') as HTMLButtonElement;
const saveBtn = document.getElementById('saveBtn') as HTMLButtonElement;
const statusEl = document.getElementById('status') as HTMLDivElement;
const targetFileEl = document.getElementById('targetFile') as HTMLElement;
const targetExportEl = document.getElementById('targetExport') as HTMLElement;

const firstEntry = SYMBOL_LAB_ENTRIES[0];
if (!firstEntry) throw new Error('No symbol lab entries registered');
let entry: SymbolLabEntry = firstEntry;
let geo: Record<string, number> = entry.createDefaultGeometry();

const inputs = new Map<string, HTMLInputElement>();
const valueLabels = new Map<string, HTMLSpanElement>();

function populateSymbolSelect(): void {
  const groups = new Map<string, SymbolLabEntry[]>();
  for (const e of SYMBOL_LAB_ENTRIES) {
    const list = groups.get(e.group) ?? [];
    list.push(e);
    groups.set(e.group, list);
  }
  for (const [group, list] of groups) {
    const optgroup = document.createElement('optgroup');
    optgroup.label = group;
    for (const e of list) {
      const opt = document.createElement('option');
      opt.value = e.id;
      opt.textContent = e.label;
      optgroup.appendChild(opt);
    }
    symbolSelect.appendChild(optgroup);
  }
  symbolSelect.value = entry.id;
}

function buildFieldControls(): void {
  fieldsEl.replaceChildren();
  inputs.clear();
  valueLabels.clear();

  const fieldset = document.createElement('fieldset');
  const legend = document.createElement('legend');
  legend.textContent = entry.label;
  fieldset.appendChild(legend);

  for (const f of entry.fields) {
    const wrap = document.createElement('div');
    wrap.className = 'field';

    const label = document.createElement('label');
    const name = document.createElement('span');
    name.textContent = f.label;
    const val = document.createElement('span');
    val.className = 'val';
    label.append(name, val);

    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(f.min);
    input.max = String(f.max);
    input.step = String(f.step);
    input.value = String(geo[f.key]);
    input.addEventListener('input', () => {
      geo = { ...geo, [f.key]: Number(input.value) };
      render();
    });

    wrap.append(label, input);
    fieldset.appendChild(wrap);

    inputs.set(f.key, input);
    valueLabels.set(f.key, val);
  }

  fieldsEl.appendChild(fieldset);
}

function syncControlValues(): void {
  for (const f of entry.fields) {
    const input = inputs.get(f.key);
    const val = valueLabels.get(f.key);
    if (!input || !val) continue;
    input.value = String(geo[f.key]);
    val.textContent = String(geo[f.key]);
  }
}

function renderCode(): void {
  const body = Object.entries(geo)
    .map(([k, v]) => `  ${k}: ${v},`)
    .join('\n');
  codeOut.value = `export const ${entry.exportName} = {\n${body}\n};`;
}

function setStatus(text: string, kind: 'ok' | 'error' | '' = ''): void {
  statusEl.textContent = text;
  statusEl.classList.remove('ok', 'error');
  if (kind) statusEl.classList.add(kind);
}

function render(): void {
  syncControlValues();
  renderCode();

  const svg = createSvgEl('svg');
  const { w, h } = entry.renderPreview(svg, geo);
  svg.setAttribute('width', String(w));
  svg.setAttribute('height', String(h));
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.setAttribute('overflow', 'visible');

  svgHost.replaceChildren(svg);
}

function selectSymbol(id: string): void {
  const found = SYMBOL_LAB_ENTRIES.find((e) => e.id === id);
  if (!found) return;
  entry = found;
  geo = entry.createDefaultGeometry();
  targetFileEl.textContent = entry.sourceFile;
  targetExportEl.textContent = entry.exportName;
  setStatus('');
  buildFieldControls();
  render();
}

symbolSelect.addEventListener('change', () => selectSymbol(symbolSelect.value));

resetBtn.addEventListener('click', () => {
  geo = entry.createDefaultGeometry();
  setStatus('');
  render();
});

copyBtn.addEventListener('click', () => {
  void navigator.clipboard.writeText(codeOut.value).catch(() => {
    codeOut.select();
  });
  const original = copyBtn.textContent;
  copyBtn.textContent = 'Copied!';
  setTimeout(() => {
    copyBtn.textContent = original;
  }, 1200);
});

saveBtn.addEventListener('click', () => {
  void (async () => {
    setStatus('Saving...');
    saveBtn.disabled = true;
    try {
      const res = await fetch('/__symbol_lab_save__', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceFile: entry.sourceFile,
          exportName: entry.exportName,
          geometry: geo,
        }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (data.ok) {
        setStatus(`Saved to ${entry.sourceFile}`, 'ok');
      } else {
        setStatus(`Save failed: ${data.error ?? 'unknown error'}`, 'error');
      }
    } catch (err) {
      setStatus(`Save failed: ${(err as Error).message}`, 'error');
    } finally {
      saveBtn.disabled = false;
    }
  })();
});

populateSymbolSelect();
selectSymbol(entry.id);
