import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appState } from '../app/AppState';
import { Modes } from '../app/modes';
import { initDocuments, resetDocuments, unsavedDocuments } from '../app/documents';
import { fileHandles } from '../app/fileHandles';
import { resetHistory } from '../history/historyStore';
import { initWires } from '../wires/connection';
import { createSource } from '../components/source';
import { createFileActions, type FileActions } from './fileActions';
import { createSaveButton } from './saveButton';
import type { ViewportAdapter } from './viewport';

const viewport: ViewportAdapter = {
  clientToWorld: (x, y) => ({ x, y }),
  applyTransform: () => {},
  getTransform: () => ({ scale: 1, tx: 0, ty: 0 }),
  setTransform: () => {},
  setGridVisible: () => {},
};
const svg = (): SVGSVGElement =>
  document.createElementNS('http://www.w3.org/2000/svg', 'svg') as SVGSVGElement;

/** The browser's save picker, stubbed: counts picks, records what's written where. */
let picks = 0;
let nextName = 'beam.pgcl';
let writes: Array<{ file: string; text: string }> = [];
function stubPicker(): void {
  (window as unknown as { showSaveFilePicker: unknown }).showSaveFilePicker = async () => {
    picks++;
    const name = nextName;
    return {
      name,
      createWritable: async () => ({
        write: async (data: Blob | string) => {
          writes.push({ file: name, text: typeof data === 'string' ? data : await data.text() });
        },
        close: async () => {},
      }),
    };
  };
}

let name = 'project';
let files: FileActions;

beforeEach(() => {
  localStorage.clear();
  resetDocuments();
  resetHistory();
  fileHandles.clear();
  appState.components = [];
  appState.connections = [];
  appState.setMode(Modes.STOP);
  initWires(svg(), viewport, document.createElement('div'));
  name = 'project';
  picks = 0;
  nextName = 'beam.pgcl';
  writes = [];
  stubPicker();
  const ctx = { compLayer: document.createElement('div') };
  initDocuments({ ctx, viewport, getName: () => name, setName: (n) => (name = n) });
  files = createFileActions({
    ctx,
    viewport,
    connLayer: svg(),
    frameLayer: svg(),
    getName: () => name,
    setName: (n) => (name = n),
  });
  appState.addComponent(createSource(ctx.compLayer, 100, 100));
});

afterEach(() => {
  delete (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker;
  vi.restoreAllMocks();
  document.querySelector('.saveMenu')?.remove();
});

describe('Save and Save as', () => {
  it('asks for a file the first time, then writes back without asking', async () => {
    await files.save();
    expect(picks).toBe(1);
    await files.save();
    expect(picks).toBe(1);
    expect(writes.map((w) => w.file)).toEqual(['beam.pgcl', 'beam.pgcl']);
    expect(JSON.parse(writes[1]!.text).comps).toHaveLength(1);
    // The document takes the file's name, and has nothing unsaved.
    expect(name).toBe('beam');
    expect(unsavedDocuments()).toEqual([]);
  });

  it('Save as always asks, and later Saves go to the new file', async () => {
    await files.save();
    nextName = 'beam-v2.pgcl';
    await files.saveAs();
    expect(picks).toBe(2);
    await files.save();
    expect(picks).toBe(2);
    expect(writes.map((w) => w.file)).toEqual(['beam.pgcl', 'beam-v2.pgcl', 'beam-v2.pgcl']);
  });

  it('a cancelled pick saves nothing and keeps no file', async () => {
    (window as unknown as { showSaveFilePicker: unknown }).showSaveFilePicker = async () => {
      throw new DOMException('cancelled', 'AbortError');
    };
    await files.save();
    expect(writes).toEqual([]);
    expect(fileHandles.size).toBe(0);
  });

  it('a file that can no longer be written is forgotten, and a new one picked', async () => {
    await files.save();
    const handle = [...fileHandles.values()][0]!;
    handle.createWritable = async () => {
      throw new Error('moved');
    };
    nextName = 'elsewhere.pgcl';
    await files.save();
    expect(picks).toBe(2);
    expect(writes.at(-1)!.file).toBe('elsewhere.pgcl');
  });
});

describe('the Save button', () => {
  it('reads "Save as" until the document has a file, then "Save"', async () => {
    const button = createSaveButton(files).querySelector<HTMLButtonElement>('button')!;
    expect(button.getAttribute('aria-label')).toBe('Save as');
    await files.save();
    expect(button.getAttribute('aria-label')).toBe('Save');
    expect(button.title).toContain('beam.pgcl');
  });

  it("its menu's footer names the file", async () => {
    const wrap = createSaveButton(files);
    document.body.appendChild(wrap);
    const arrow = wrap.querySelectorAll<HTMLButtonElement>('button')[1]!;
    expect(arrow.getAttribute('aria-haspopup')).toBe('true');

    arrow.click();
    expect(document.querySelector('.saveMenuFooter')!.textContent).toBe('Not saved to a file yet');
    arrow.click(); // closes

    await files.save();
    arrow.click();
    const menu = document.querySelector('.saveMenu')!;
    expect(menu.getAttribute('role')).toBe('menu');
    expect(arrow.getAttribute('aria-expanded')).toBe('true');
    expect(menu.querySelectorAll('[role="menuitem"]')).toHaveLength(2);
    expect(menu.querySelector('.saveMenuFooter')!.textContent).toBe('Saved to beam.pgcl');
    expect(menu.textContent).toContain('Write the changes to beam.pgcl');
    wrap.remove();
  });
});

describe('where files cannot be written (Firefox, Safari)', () => {
  it('Save asks for a name and downloads; the button always reads "Save"', async () => {
    delete (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker;
    const prompt = vi.spyOn(window, 'prompt').mockReturnValue('my circuit');
    const downloads: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloads.push(this.download);
    });
    const button = createSaveButton(files).querySelector<HTMLButtonElement>('button')!;
    expect(button.getAttribute('aria-label')).toBe('Save');

    await files.save();
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(downloads).toEqual(['my circuit.pgcl']);
    expect(fileHandles.size).toBe(0);
    expect(button.getAttribute('aria-label')).toBe('Save');
  });
});
