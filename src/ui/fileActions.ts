import type { ComponentFactoryContext } from '../components/registry';
import type { ViewportAdapter } from './viewport';
import type { ProjectFileV1 } from '../persistence/schema';
import { appState } from '../app/AppState';
import { stopSimulation } from '../sim/stopSimulation';
import { getDeviceId } from '../app/deviceId';
import { desktopBridge, type DesktopFile } from '../app/desktopBridge';
import {
  activeDocumentId,
  listDocuments,
  markDocumentSaved,
  onDocumentsChange,
  prepareToOpen,
  renameDocument,
  snapshotDocuments,
  switchDocument,
  unsavedDocuments,
  updateDocumentFile,
} from '../app/documents';
import { canWriteBack, fileHandles, saveFilePicker, type FileHandleLike } from '../app/fileHandles';
import { desktopFileHandle, installDesktopFilePicker } from '../app/desktopFilePicker';
import { showToast } from './toast';
import { resetHistory } from '../history/historyStore';
import { loadProject, serializeProject, unixNow } from '../persistence/project';
import { migrate } from '../persistence/migrations';
import { forgetRecentFile, listRecentFiles, rememberRecentFile } from '../app/recentFiles';
import {
  forgetRecentHandle,
  listRecentHandles,
  rememberRecentHandle,
  type FileHandleRef,
} from '../app/recentHandles';
import { closeStartScreen } from './startScreen';

export interface FileActionDeps {
  ctx: ComponentFactoryContext;
  viewport: ViewportAdapter;
  connLayer: SVGSVGElement;
  frameLayer: SVGSVGElement;
  getName(): string;
  setName(name: string): void;
}

/** A recently opened or saved file: its name, where it is (if known), when, and how to open it. */
export interface RecentEntry {
  name: string;
  detail: string;
  at: number;
  open(): Promise<boolean>;
}

export interface FileActions {
  /** Ctrl+S: write back to the active document's file, or pick one (or download) first. */
  save(): Promise<void>;
  /** Ctrl+Shift+S: always a new file, which later Saves then go to. */
  saveAs(): Promise<void>;
  saveAll(): Promise<void>;
  open(): Promise<void>;
  /** Desktop only: a recent file by its path; whether it opened. */
  openRecent(path: string): Promise<boolean>;
  /** The most recently opened or saved files, for the Open button's menu. */
  recentFiles(max?: number): Promise<RecentEntry[]>;
  isDesktop: boolean;
}

/** The browser's save dialog remembers its last folder under this. */
const PICKER_ID = 'pneugineer-files';
const PICKER_TYPES = [
  { description: 'PneuGineer project', accept: { 'application/json': ['.pgcl'] } },
];

function safeFileName(name: string): string {
  return (
    name
      .replace(/[\\/:*?"<>|]/g, '_')
      .replace(/\p{Cc}/gu, '')
      .trim() || 'project'
  );
}

/** "beam.pgcl" -> "beam": what a document is called once it has a file. */
function nameOfFile(fileName: string): string {
  return fileName.replace(/\.(pgcl|json)$/i, '') || fileName;
}

/** `file` as saved by this browser, now. */
function stamped(file: ProjectFileV1): ProjectFileV1 {
  return { ...file, LS: getDeviceId(), lst: unixNow() };
}

function json(file: ProjectFileV1): string {
  return JSON.stringify(file, null, 2);
}

function downloadText(text: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** The active document has just been saved as `file`: what's on the canvas carries the stamps. */
function commitActiveSaved(file: ProjectFileV1): void {
  appState.projectLastSavedDeviceId = file.LS ?? null;
  appState.projectLastSavedAt = file.lst ?? null;
}

async function writeToHandle(handle: FileHandleLike, text: string): Promise<void> {
  const writable = await handle.createWritable();
  await writable.write(new Blob([text], { type: 'application/json' }));
  await writable.close();
}

const isAbort = (err: unknown): boolean => err instanceof DOMException && err.name === 'AbortError';

interface DocToSave {
  id: string;
  name: string;
  file: ProjectFileV1;
}

/** What a save came to: written (to a file, or downloaded), cancelled, or failed. */
type SaveOutcome = 'saved' | 'cancelled' | 'failed';

/** The live actions, for parts of the UI that save a given document (the tab menu). */
let current: FileActions | null = null;
let saveById: ((id: string) => Promise<boolean>) | null = null;

export function getFileActions(): FileActions | null {
  return current;
}

/** Saves document `id` - as Save does for the active one. Whether it got saved. */
export function saveDocumentById(id: string): Promise<boolean> {
  return saveById ? saveById(id) : Promise.resolve(false);
}

/**
 * Save, Save as, Save all and Open - for the toolbar and its menus, the tab
 * menu, and Ctrl+S / Ctrl+Shift+S / Ctrl+O.
 *
 * Save writes back to the document's file without asking, once it has one (fileHandles); the
 * first time - or with Save as, always - a file is picked, and later Saves go there. That needs a
 * browser that can write files (Chrome, Edge: showSaveFilePicker) or the desktop app, which gets
 * a stand-in for it (app/desktopFilePicker.ts) - one code path for both. Firefox and Safari
 * can't: every save there asks for a name and downloads.
 */
export function createFileActions(deps: FileActionDeps): FileActions {
  const bridge = desktopBridge();
  if (bridge) installDesktopFilePicker(bridge);

  /** The document a save of the active one writes: fresh from the canvas, at rest. */
  function activeDoc(): DocToSave {
    return {
      id: activeDocumentId(),
      name: deps.getName(),
      file: serializeProject(deps.getName()),
    };
  }

  /** `doc` has just been written as `file` (to `handle`, or downloaded). */
  function afterSaved(doc: DocToSave, file: ProjectFileV1, handle: FileHandleLike | null): void {
    if (doc.id === activeDocumentId()) commitActiveSaved(file);
    else updateDocumentFile(doc.id, file);
    markDocumentSaved(doc.id, file);
    if (handle?.path) rememberRecentFile(handle.path);
    else if (handle) void rememberRecentHandle(handle as unknown as FileHandleRef);
  }

  /** A document saved to a new file takes that file's name. */
  function takeFileName(doc: DocToSave, handle: FileHandleLike): void {
    const name = nameOfFile(handle.name);
    if (doc.id === activeDocumentId()) deps.setName(name);
    else renameDocument(doc.id, name);
  }

  /**
   * Saves `doc`: (1) back to its file, if it has one and asNew isn't set; else (2) to a file
   * picked now, which it then keeps; else - where files can't be written (Firefox, Safari) - (3)
   * as a download, under a name asked for (unless `quiet`).
   */
  async function saveDoc(
    doc: DocToSave,
    opts: { asNew?: boolean; quiet?: boolean } = {},
  ): Promise<SaveOutcome> {
    const file = stamped(doc.file);
    const text = json(file);

    // 1. Write back to the file it has.
    const known = opts.asNew ? undefined : fileHandles.get(doc.id);
    if (known) {
      try {
        if (known.requestPermission) {
          const permission = await known.requestPermission({ mode: 'readwrite' });
          if (permission !== 'granted') throw new Error('No permission to write the file');
        }
        await writeToHandle(known, text);
        afterSaved(doc, file, known);
        showToast(`Saved ${known.name}`);
        return 'saved';
      } catch {
        // Moved, deleted, or permission withdrawn: forget it and pick a file as if new.
        fileHandles.delete(doc.id);
      }
    }

    // 2. Pick a file, write it, and keep it for later Saves.
    const pick = canWriteBack() ? saveFilePicker() : null;
    if (pick) {
      let handle: FileHandleLike;
      try {
        handle = await pick({
          suggestedName: `${safeFileName(doc.name)}.pgcl`,
          types: PICKER_TYPES,
          id: PICKER_ID,
        });
      } catch (err) {
        if (isAbort(err)) return 'cancelled';
        handle = null as unknown as FileHandleLike;
      }
      if (handle) {
        try {
          await writeToHandle(handle, text);
        } catch (err) {
          window.alert(
            `Couldn't save to ${handle.name}: ${err instanceof Error ? err.message : err}`,
          );
          return 'failed';
        }
        fileHandles.set(doc.id, handle);
        takeFileName(doc, handle);
        afterSaved(doc, file, handle);
        showToast(`Saved ${handle.name}`);
        return 'saved';
      }
    }

    // 3. Download, under a name asked for.
    let fileName = `${safeFileName(doc.name)}.pgcl`;
    if (!opts.quiet) {
      const answer = window.prompt('Save as', fileName);
      if (answer === null || !answer.trim()) return 'cancelled';
      fileName = safeFileName(answer.trim());
      if (!/\.pgcl$/i.test(fileName)) fileName += '.pgcl';
    }
    downloadText(text, fileName);
    afterSaved(doc, file, null);
    return 'saved';
  }

  async function save(): Promise<void> {
    // A file holds the circuit at rest, never mid-run.
    stopSimulation();
    await saveDoc(activeDoc());
  }

  async function saveAs(): Promise<void> {
    stopSimulation();
    await saveDoc(activeDoc(), { asNew: true });
  }

  /** Saves the open documents - only those in `only`, if given - each back to its own file,
   * picking one (with its tab shown, so it's clear which) for those that have none. Whether
   * every one of them got saved. */
  async function saveDocuments(only?: Set<string>): Promise<boolean> {
    stopSimulation();
    const startId = activeDocumentId();
    const quiet = !canWriteBack(); // downloads: under their own names, without a question each
    let all = true;
    for (const doc of snapshotDocuments().filter((d) => !only || only.has(d.id))) {
      if (!fileHandles.has(doc.id) && canWriteBack()) switchDocument(doc.id);
      const target = doc.id === activeDocumentId() ? activeDoc() : doc;
      if ((await saveDoc(target, { quiet })) !== 'saved') all = false;
    }
    switchDocument(startId);
    return all;
  }

  async function saveAll(): Promise<void> {
    await saveDocuments();
  }

  saveById = async (id) => {
    if (id !== activeDocumentId()) switchDocument(id);
    stopSimulation();
    return (await saveDoc(activeDoc())) === 'saved';
  };

  /** Puts a project on the canvas - in a new tab, or the empty/current one (see prepareToOpen) -
   * belonging to `handle`, if it came from a file Save can write back to. */
  function openText(text: string, handle?: FileHandleLike): void {
    // Already open: just show it.
    if (handle?.path) {
      const openId = [...fileHandles.entries()].find(([, h]) => h.path === handle.path)?.[0];
      if (openId && listDocuments().some((d) => d.id === openId)) {
        switchDocument(openId);
        return;
      }
    }
    const file = migrate(JSON.parse(text));
    if (prepareToOpen() === 'current') resetHistory();
    loadProject(file, deps.ctx, deps.viewport);
    deps.setName(handle ? nameOfFile(handle.name) : file.name || 'project');
    if (handle) fileHandles.set(activeDocumentId(), handle);
    else fileHandles.delete(activeDocumentId());
    // Just as in its file: nothing to save yet.
    markDocumentSaved(activeDocumentId(), serializeProject(deps.getName()));
  }

  function openFromOutside(f: DesktopFile): void {
    closeStartScreen();
    try {
      openText(f.text, bridge ? desktopFileHandle(bridge, f.path) : undefined);
      rememberRecentFile(f.path);
    } catch (err) {
      window.alert(`Couldn't open ${f.path}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  function openFailed(name: string, err: unknown): void {
    window.alert(`Couldn't open ${name} (${err instanceof Error ? err.message : String(err)}).`);
  }

  /** Firefox and Safari: the plain file chooser - the file opens, without a handle to write
   * back to (its first Save asks for a name). */
  function openViaInput(): Promise<void> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.pgcl,.json,application/json';
      input.addEventListener('change', () => {
        const picked = input.files?.[0];
        if (!picked) return resolve();
        picked
          .text()
          .then((text) => openText(text))
          .catch((err: unknown) => openFailed(picked.name, err))
          .finally(() => resolve());
      });
      input.click();
    });
  }

  async function open(): Promise<void> {
    if (bridge) {
      const f = await bridge.openFile();
      if (f) openFromOutside(f);
      return;
    }
    type OpenPicker = (
      opts: unknown,
    ) => Promise<Array<FileHandleLike & { getFile(): Promise<File> }>>;
    const pick = (window as unknown as { showOpenFilePicker?: OpenPicker }).showOpenFilePicker;
    if (!pick || !canWriteBack()) return openViaInput();
    let handle: (FileHandleLike & { getFile(): Promise<File> }) | undefined;
    try {
      [handle] = await pick({ types: PICKER_TYPES, id: PICKER_ID });
    } catch (err) {
      if (isAbort(err)) return;
      return openViaInput();
    }
    if (!handle) return;
    try {
      openText(await (await handle.getFile()).text(), handle);
      void rememberRecentHandle(handle as unknown as FileHandleRef);
    } catch (err) {
      openFailed(handle.name, err);
    }
  }

  /** A file from the browser's recent list (Chrome, Edge): read through its kept handle, after
   * the browser's permission prompt; Save then writes back to it. One that can't be read any
   * more is taken off the list. */
  async function openRecentHandle(handle: FileHandleRef): Promise<boolean> {
    try {
      if (handle.queryPermission && handle.requestPermission) {
        const opts = { mode: 'readwrite' } as const;
        if ((await handle.queryPermission(opts)) !== 'granted') {
          await handle.requestPermission(opts);
        }
      }
      const file = await handle.getFile!();
      closeStartScreen();
      openText(await file.text(), handle as unknown as FileHandleLike);
      void rememberRecentHandle(handle);
      return true;
    } catch (err) {
      void forgetRecentHandle(handle);
      const detail = err instanceof Error ? err.message : String(err);
      window.alert(`Couldn't open ${handle.name} (${detail}) - it may have been moved or deleted.`);
      return false;
    }
  }

  /** Up to `max` recently opened or saved files, newest first, each with how to open it: paths
   * in the desktop app, kept file handles in Chrome and Edge, none elsewhere. */
  async function recentFiles(max = 5): Promise<RecentEntry[]> {
    if (bridge) {
      return listRecentFiles()
        .slice(0, max)
        .map((f) => ({
          name: f.path.split(/[\\/]/).pop() ?? f.path,
          detail: f.path.replace(/[\\/][^\\/]*$/, ''),
          at: f.at,
          open: () => openRecent(f.path),
        }));
    }
    if (!canWriteBack()) return [];
    return (await listRecentHandles()).slice(0, max).map((e) => ({
      name: e.name,
      detail: '',
      at: e.at,
      open: () => openRecentHandle(e.handle),
    }));
  }

  /** A file from the start screen's recent list. One that's gone is taken off the list. */
  async function openRecent(path: string): Promise<boolean> {
    if (!bridge) return false;
    const f = await bridge.openPath(path);
    if (!f) {
      forgetRecentFile(path);
      window.alert(`${path} isn't there any more - it may have been moved or deleted.`);
      return false;
    }
    openFromOutside(f);
    return true;
  }

  if (bridge) {
    bridge.onOpenFile(openFromOutside);
    // Closing the window: the desktop app asks which circuits have unsaved changes, and - if the
    // user chooses Save - has them saved before it closes (desktop/main.cjs).
    bridge.onCloseRequest(async (step) => {
      if (step === 'list') return unsavedDocuments().map((d) => d.name);
      return saveDocuments(new Set(unsavedDocuments().map((d) => d.id)));
    });
    // The window's title names the circuit, as a desktop program's does.
    const title = (): void => {
      document.title = `${deps.getName()} - PneuGineer`;
    };
    onDocumentsChange(title);
    title();
  }

  // A file dropped on the window never replaces the app (in the desktop app it would navigate
  // away from it): a project file opens, as with Open; pictures dropped on the canvas are
  // handled there (interaction/pictures.ts); anything else is ignored.
  window.addEventListener('dragover', (e) => {
    if (e.dataTransfer?.types.includes('Files')) e.preventDefault();
  });
  window.addEventListener('drop', (e) => {
    if (!e.dataTransfer?.types.includes('Files')) return;
    if (e.defaultPrevented) return;
    e.preventDefault();
    const file = Array.from(e.dataTransfer.files).find((f) => /\.(pgcl|json)$/i.test(f.name));
    if (!file || document.querySelector('.modalBackdrop')) return;
    if (bridge) {
      void bridge.openPath(bridge.pathForFile(file)).then((f) => {
        if (f) openFromOutside(f);
      });
      return;
    }
    void file
      .text()
      .then((text) => {
        closeStartScreen();
        openText(text);
      })
      .catch((err: unknown) => {
        window.alert(`Couldn't open ${file.name}: ${err instanceof Error ? err.message : err}`);
      });
  });

  // The usual file shortcuts. Not while typing in a field or with a dialog open.
  window.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    const target = document.activeElement as HTMLElement | null;
    const typing =
      target && (/^(input|textarea|select)$/i.test(target.tagName) || target.isContentEditable);
    if (typing || document.querySelector('.modalBackdrop')) return;
    const key = e.key.toLowerCase();
    if (key === 's') {
      e.preventDefault();
      void (e.shiftKey ? saveAs() : save());
    } else if (key === 'o' && !e.shiftKey) {
      e.preventDefault();
      void open();
    }
  });

  current = {
    save,
    saveAs,
    saveAll,
    open,
    openRecent,
    recentFiles,
    isDesktop: bridge !== null,
  };
  return current;
}
