/**
 * The desktop app treated like Chrome: a window.showSaveFilePicker stand-in that opens the
 * computer's own Save dialog (through the desktop bridge) and hands back a handle-like object
 * writing to the chosen path - so one save code path serves both (ui/fileActions.ts).
 */
import type { DesktopBridge } from './desktopBridge';
import type { FileHandleLike } from './fileHandles';

function baseNameOf(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

/** A handle for the file at `path` - one picked in a Save dialog, or opened from disk. */
export function desktopFileHandle(bridge: DesktopBridge, path: string): FileHandleLike {
  return {
    name: baseNameOf(path),
    path,
    async createWritable() {
      const parts: string[] = [];
      return {
        async write(data: Blob | string) {
          parts.push(typeof data === 'string' ? data : await data.text());
        },
        async close() {
          if (!(await bridge.saveFile(path, parts.join('')))) {
            throw new Error(`Couldn't write to ${path}`);
          }
        },
      };
    },
  };
}

/** Installs the stand-in (replacing the browser engine's own, which has no paths for recent
 * files or for writing back after a restart). */
export function installDesktopFilePicker(bridge: DesktopBridge): void {
  (window as unknown as { showSaveFilePicker: unknown }).showSaveFilePicker = async (opts?: {
    suggestedName?: string;
  }): Promise<FileHandleLike> => {
    const path = await bridge.chooseSavePath(opts?.suggestedName ?? 'project.pgcl');
    if (!path) throw new DOMException('The user aborted a request.', 'AbortError');
    return desktopFileHandle(bridge, path);
  };
}
