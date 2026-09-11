import { saveProjectToFile } from '../persistence/save';
import { loadProjectFromPicker } from '../persistence/load';
import { exportProjectAsSvg, exportProjectAsPng } from '../persistence/exportImage';
import type { ComponentFactoryContext } from '../components/registry';
import type { ViewportAdapter } from './viewport';
import { resetHistory } from '../history/historyStore';

export interface ProjectBarRefs {
  getName(): string;
  setName(name: string): void;
}

export function renderProjectBar(
  container: HTMLElement,
  ctx: ComponentFactoryContext,
  viewport: ViewportAdapter,
  connLayer: SVGSVGElement,
): ProjectBarRefs {
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.value = 'project';
  nameInput.className = 'projectName';
  nameInput.setAttribute('aria-label', 'Project name');

  const saveBtn = document.createElement('button');
  saveBtn.className = 'btn';
  saveBtn.textContent = '💾 Save';
  saveBtn.addEventListener('click', () => void saveProjectToFile(nameInput.value || 'project'));

  const loadBtn = document.createElement('button');
  loadBtn.className = 'btn';
  loadBtn.textContent = '📂 Load';
  loadBtn.addEventListener('click', () => {
    // Reset history only once a file was actually picked - loadProjectFromPicker itself
    // does the clear+rebuild, so this must run right before that, not before the picker
    // even opens (a cancelled picker shouldn't wipe undo history for nothing).
    void loadProjectFromPicker(ctx, viewport, resetHistory).then((loadedName) => {
      if (loadedName) nameInput.value = loadedName;
    });
  });

  const exportSvgBtn = document.createElement('button');
  exportSvgBtn.className = 'btn';
  exportSvgBtn.textContent = '⬇ Export SVG';
  exportSvgBtn.addEventListener('click', () =>
    exportProjectAsSvg(nameInput.value || 'project', connLayer),
  );

  const exportPngBtn = document.createElement('button');
  exportPngBtn.className = 'btn';
  exportPngBtn.textContent = '⬇ Export PNG';
  exportPngBtn.addEventListener(
    'click',
    () => void exportProjectAsPng(nameInput.value || 'project', connLayer),
  );

  container.append(nameInput, saveBtn, loadBtn, exportSvgBtn, exportPngBtn);

  return {
    getName: () => nameInput.value || 'project',
    setName: (name: string) => {
      nameInput.value = name;
    },
  };
}
