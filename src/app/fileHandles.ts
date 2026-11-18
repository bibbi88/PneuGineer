/**
 * Which file each open document belongs to: a file handle per document id, set when a document is
 * saved to a file or opened from one, so Save writes back there without asking. In memory only -
 * after a reload, the first Save asks again.
 *
 * A handle is the browser's own (File System Access API: Chrome, Edge) or, in the desktop app,
 * the stand-in from app/desktopFilePicker.ts, which carries its path on disk too.
 */

export interface WritableLike {
  write(data: Blob | string): Promise<void>;
  close(): Promise<void>;
}

export interface FileHandleLike {
  /** The file's name, e.g. "beam.pgcl". */
  name: string;
  /** Desktop app: where it is on disk. */
  path?: string;
  createWritable(): Promise<WritableLike>;
  requestPermission?(opts: { mode: 'readwrite' }): Promise<string>;
}

const listeners: Array<() => void> = [];

function notify(): void {
  for (const cb of listeners) cb();
}

/** Notified whenever a document gets, changes or loses its file (the Save button's label). */
export function onFileHandlesChange(cb: () => void): void {
  listeners.push(cb);
}

/** Document id -> its file. Setting or deleting notifies (onFileHandlesChange). */
class FileHandleMap extends Map<string, FileHandleLike> {
  override set(id: string, handle: FileHandleLike): this {
    super.set(id, handle);
    notify();
    return this;
  }
  override delete(id: string): boolean {
    const had = super.delete(id);
    if (had) notify();
    return had;
  }
  override clear(): void {
    super.clear();
    notify();
  }
}

export const fileHandles = new FileHandleMap();

type ShowSaveFilePicker = (opts?: unknown) => Promise<FileHandleLike>;

export function saveFilePicker(): ShowSaveFilePicker | null {
  const fn = (window as unknown as { showSaveFilePicker?: ShowSaveFilePicker }).showSaveFilePicker;
  return typeof fn === 'function' ? fn : null;
}

/**
 * Whether a save can write back to a file (and so remember it): Chrome, Edge, the desktop app -
 * not Firefox or Safari, which only download, nor a page in a sandboxed or cross-origin frame,
 * where the save picker throws.
 */
export function canWriteBack(): boolean {
  if (!saveFilePicker()) return false;
  if (window.self !== window.top) {
    try {
      // A cross-origin parent: reading its address throws.
      void window.top?.location.href;
    } catch {
      return false;
    }
    // A sandboxed frame has an opaque origin.
    if (window.origin === 'null') return false;
  }
  return true;
}
