import { saveProjectToFile } from '../persistence/save';
import { loadProjectFromPicker } from '../persistence/load';
import type { ComponentFactoryContext } from '../components/registry';
import type { ViewportAdapter } from './viewport';
import { resetHistory } from '../history/historyStore';
import { openExportDialog } from './exportDialog';

export interface ProjectBarRefs {
  getName(): string;
  setName(name: string): void;
}

export function renderProjectBar(
  container: HTMLElement,
  ctx: ComponentFactoryContext,
  viewport: ViewportAdapter,
  connLayer: SVGSVGElement,
  frameLayer: SVGSVGElement,
  workspaceEl: HTMLElement,
): ProjectBarRefs {
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.value = 'project';
  nameInput.className = 'projectName';
  nameInput.setAttribute('aria-label', 'Project name');

  const saveBtn = document.createElement('button');
  saveBtn.className = 'btn';
  saveBtn.title = 'Save';
  saveBtn.textContent = '💾 Save';
  saveBtn.addEventListener('click', () => void saveProjectToFile(nameInput.value || 'project'));

  const loadBtn = document.createElement('button');
  loadBtn.className = 'btn';
  loadBtn.title = 'Load';
  loadBtn.textContent = '📂 Load';
  loadBtn.addEventListener('click', () => {
    // Reset history only once a file was actually picked - loadProjectFromPicker itself
    // does the clear+rebuild, so this must run right before that, not before the picker
    // even opens (a cancelled picker shouldn't wipe undo history for nothing).
    void loadProjectFromPicker(ctx, viewport, resetHistory).then((loadedName) => {
      if (loadedName) nameInput.value = loadedName;
    });
  });

  const saveLoadRow = document.createElement('div');
  saveLoadRow.className = 'btnRow';
  saveLoadRow.append(saveBtn, loadBtn);

  const exportBtn = document.createElement('button');
  exportBtn.className = 'btn';
  exportBtn.textContent = '⬇ Export…';
  exportBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openExportDialog(nameInput.value || 'project', connLayer, frameLayer, viewport, workspaceEl);
  });

  container.append(nameInput, saveLoadRow, exportBtn);

  return {
    getName: () => nameInput.value || 'project',
    setName: (name: string) => {
      nameInput.value = name;
    },
  };
}
