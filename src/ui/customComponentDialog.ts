import { sanitizeSvgMarkup } from '../components/shared/svgSanitize';
import {
  saveCustomComponent,
  CUSTOM_TYPE_PREFIX,
  type CustomComponentDef,
  type CustomPortSpec,
} from '../components/customComponents';

const EXAMPLE_SVG =
  '<svg viewBox="0 0 120 80" xmlns="http://www.w3.org/2000/svg">\n' +
  '  <rect x="10" y="10" width="100" height="60" fill="#fff" stroke="#111" stroke-width="2" />\n' +
  '</svg>';

function nextPortKey(ports: CustomPortSpec[]): string {
  let n = ports.length + 1;
  const used = new Set(ports.map((p) => p.key));
  while (used.has(`P${n}`)) n++;
  return `P${n}`;
}

function screenToSvgPoint(svg: SVGSVGElement, clientX: number, clientY: number): { x: number; y: number } {
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
  return { x: Math.round(p.x), y: Math.round(p.y) };
}

/**
 * The "build your own component" editor: paste SVG markup, click the preview to place ports,
 * name it, save. `existing` (non-null when editing an already-saved custom component) pre-fills
 * the form and makes Save update it in place instead of creating a new one. Saving/deleting goes
 * through customComponents.ts's own onCustomComponentsChange notification, which is what
 * actually refreshes the sidebar - nothing here has to know about that directly.
 */
export function openCustomComponentDialog(existing: CustomComponentDef | null): void {
  let ports: CustomPortSpec[] = existing ? existing.ports.map((p) => ({ ...p })) : [];
  let lastGoodWidth = existing?.width ?? 120;
  let lastGoodHeight = existing?.height ?? 80;

  const backdrop = document.createElement('div');
  backdrop.className = 'modalBackdrop';
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });

  const dialog = document.createElement('div');
  dialog.className = 'exportDialog customCompDialog';
  backdrop.appendChild(dialog);

  const header = document.createElement('div');
  header.className = 'exportDialogHeader';
  const title = document.createElement('h2');
  title.textContent = existing ? 'Edit custom component' : 'New custom component';
  const closeBtn = document.createElement('button');
  closeBtn.className = 'exportDialogClose';
  closeBtn.textContent = '✕';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.addEventListener('click', () => close());
  header.append(title, closeBtn);
  dialog.appendChild(header);

  const nameRow = document.createElement('label');
  nameRow.className = 'inspectorRow';
  const nameSpan = document.createElement('span');
  nameSpan.textContent = 'Name';
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.value = existing?.label ?? '';
  nameInput.placeholder = 'e.g. Pressure gauge';
  nameRow.append(nameSpan, nameInput);
  dialog.appendChild(nameRow);

  const hint = document.createElement('p');
  hint.className = 'exportDialogHint';
  hint.textContent =
    'Paste the SVG markup below, then click anywhere on the preview to drop a port there ' +
    '(click an existing port dot to remove it). Every port conducts to every other one - ' +
    'there\'s no way yet to give a custom component its own flow logic.';
  dialog.appendChild(hint);

  const textarea = document.createElement('textarea');
  textarea.className = 'customCompSvgInput';
  textarea.value = existing?.svgMarkup ?? EXAMPLE_SVG;
  textarea.spellcheck = false;
  textarea.rows = 8;
  dialog.appendChild(textarea);

  const svgError = document.createElement('p');
  svgError.className = 'exportDialogHint customCompError';
  dialog.appendChild(svgError);

  const previewBox = document.createElement('div');
  previewBox.className = 'exportPreviewBox customCompPreview';
  dialog.appendChild(previewBox);

  const portListLabel = document.createElement('div');
  portListLabel.className = 'inspectorSectionHeading';
  portListLabel.textContent = 'Ports';
  dialog.appendChild(portListLabel);

  const portList = document.createElement('div');
  portList.className = 'customCompPortList';
  dialog.appendChild(portList);

  const buttonRow = document.createElement('div');
  buttonRow.className = 'exportDialogButtons';
  const saveBtn = document.createElement('button');
  saveBtn.className = 'btn';
  saveBtn.textContent = existing ? 'Save changes' : 'Save';
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => close());
  buttonRow.append(saveBtn, cancelBtn);
  dialog.appendChild(buttonRow);

  function close(): void {
    backdrop.remove();
    window.removeEventListener('keydown', onKeydown);
  }
  function onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') close();
  }
  window.addEventListener('keydown', onKeydown);

  function renderPreview(): void {
    previewBox.replaceChildren();
    const sanitized = sanitizeSvgMarkup(textarea.value);
    if (!sanitized) {
      svgError.textContent = "Couldn't parse that as SVG - check it's a complete <svg>...</svg> document.";
      return;
    }
    svgError.textContent = '';
    lastGoodWidth = sanitized.width;
    lastGoodHeight = sanitized.height;

    const svg = sanitized.root;
    svg.style.maxWidth = '100%';
    svg.style.maxHeight = '260px';
    svg.style.cursor = 'crosshair';
    svg.setAttribute('width', '360');
    svg.setAttribute('height', String(Math.round((360 * sanitized.height) / sanitized.width)));

    for (const port of ports) {
      const marker = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      marker.setAttribute('cx', String(port.cx));
      marker.setAttribute('cy', String(port.cy));
      marker.setAttribute('r', '5');
      marker.setAttribute('class', 'customCompPortMarker');
      marker.dataset.portKey = port.key;
      svg.appendChild(marker);
    }

    svg.addEventListener('click', (e) => {
      const target = e.target as Element;
      if (target.classList.contains('customCompPortMarker')) {
        const key = target.getAttribute('data-port-key');
        ports = ports.filter((p) => p.key !== key);
        renderPreview();
        renderPortList();
        return;
      }
      const { x, y } = screenToSvgPoint(svg, e.clientX, e.clientY);
      ports = [...ports, { key: nextPortKey(ports), cx: x, cy: y, orientation: 'V' }];
      renderPreview();
      renderPortList();
    });

    previewBox.appendChild(svg);
  }

  function renderPortList(): void {
    portList.replaceChildren();
    if (ports.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'inspectorHint';
      empty.textContent = 'No ports yet - click the preview above to add one.';
      portList.appendChild(empty);
      return;
    }
    for (const port of ports) {
      const row = document.createElement('div');
      row.className = 'customCompPortRow';

      const keyInput = document.createElement('input');
      keyInput.type = 'text';
      keyInput.value = port.key;
      keyInput.className = 'customCompPortKey';
      keyInput.addEventListener('change', () => {
        const next = keyInput.value.trim();
        if (!next || (next !== port.key && ports.some((p) => p.key === next))) {
          keyInput.value = port.key;
          return;
        }
        port.key = next;
        renderPreview();
      });

      const orientSelect = document.createElement('select');
      for (const o of ['V', 'H'] as const) {
        const opt = document.createElement('option');
        opt.value = o;
        opt.textContent = o === 'V' ? 'Vertical' : 'Horizontal';
        if (o === port.orientation) opt.selected = true;
        orientSelect.appendChild(opt);
      }
      orientSelect.addEventListener('change', () => {
        port.orientation = orientSelect.value as 'H' | 'V';
      });

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'customCompPortRemove';
      removeBtn.textContent = '✕';
      removeBtn.setAttribute('aria-label', `Remove port ${port.key}`);
      removeBtn.addEventListener('click', () => {
        ports = ports.filter((p) => p.key !== port.key);
        renderPreview();
        renderPortList();
      });

      row.append(keyInput, orientSelect, removeBtn);
      portList.appendChild(row);
    }
  }

  textarea.addEventListener('input', renderPreview);
  renderPreview();
  renderPortList();

  saveBtn.addEventListener('click', () => {
    const label = nameInput.value.trim();
    if (!label) {
      nameInput.focus();
      return;
    }
    const sanitized = sanitizeSvgMarkup(textarea.value);
    if (!sanitized) {
      textarea.focus();
      return;
    }
    const def: CustomComponentDef = {
      id: existing?.id ?? `${CUSTOM_TYPE_PREFIX}${crypto.randomUUID()}`,
      label,
      svgMarkup: textarea.value,
      width: lastGoodWidth,
      height: lastGoodHeight,
      ports,
    };
    saveCustomComponent(def);
    close();
  });

  document.body.appendChild(backdrop);
}
