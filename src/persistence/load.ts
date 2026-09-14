import type { ComponentFactoryContext } from '../components/registry';
import type { ViewportAdapter } from '../ui/viewport';
import { migrate } from './migrations';
import { loadProject } from './project';

interface FileSystemFileHandleLike {
  getFile(): Promise<File>;
}
interface OpenFilePickerOptions {
  types?: { description: string; accept: Record<string, string[]> }[];
}
type ShowOpenFilePicker = (opts: OpenFilePickerOptions) => Promise<FileSystemFileHandleLike[]>;

function getShowOpenFilePicker(): ShowOpenFilePicker | undefined {
  return (window as unknown as { showOpenFilePicker?: ShowOpenFilePicker }).showOpenFilePicker;
}

/** Parses and applies a loaded project's JSON text, returning its saved name. */
function applyLoadedText(
  text: string,
  ctx: ComponentFactoryContext,
  viewport: ViewportAdapter,
  onBeforeApply?: () => void,
): string {
  const raw = JSON.parse(text);
  const file = migrate(raw);
  onBeforeApply?.();
  loadProject(file, ctx, viewport);
  return file.name;
}

function loadViaFileInput(
  ctx: ComponentFactoryContext,
  viewport: ViewportAdapter,
  onBeforeApply?: () => void,
): Promise<string | undefined> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pgcl,.json,application/json';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(undefined);
        return;
      }
      void file.text().then((text) => resolve(applyLoadedText(text, ctx, viewport, onBeforeApply)));
    });
    input.click();
  });
}

/**
 * Returns the loaded project's saved name, or undefined if the user cancelled.
 * `onBeforeApply` runs only once a file was actually selected, right before the current
 * project is cleared and replaced - so a cancelled picker leaves everything untouched.
 */
export async function loadProjectFromPicker(
  ctx: ComponentFactoryContext,
  viewport: ViewportAdapter,
  onBeforeApply?: () => void,
): Promise<string | undefined> {
  const showOpenFilePicker = getShowOpenFilePicker();
  if (showOpenFilePicker) {
    try {
      const [handle] = await showOpenFilePicker({
        types: [
          { description: 'PneuGineer project', accept: { 'application/json': ['.pgcl', '.json'] } },
        ],
      });
      if (!handle) return undefined;
      const file = await handle.getFile();
      return applyLoadedText(await file.text(), ctx, viewport, onBeforeApply);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return undefined;
      // fall through to the file-input fallback on any other error
    }
  }

  return loadViaFileInput(ctx, viewport, onBeforeApply);
}
