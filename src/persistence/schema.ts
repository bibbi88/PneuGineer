import type { ComponentId, PortKey, WireGuide } from '../core/types';

export const CURRENT_SCHEMA_VERSION = 1;

export interface ComponentSnapshot {
  id: ComponentId;
  type: string;
  x: number;
  y: number;
  /** Rotation in degrees (0, 90, 180 or 270 - see interaction/componentContextMenu.ts), applied
   * as a CSS transform on the component's own element rather than through its `data` snapshot -
   * optional/omitted for the common unrotated case, and for anything saved before this field
   * existed (loadProject treats a missing value as 0). */
  rot?: number;
  data: Record<string, unknown>;
}

export interface ConnectionSnapshot {
  from: { id: ComponentId; port: PortKey };
  to: { id: ComponentId; port: PortKey };
  guides: WireGuide[];
  stubStartLen: number | null;
  stubEndLen: number | null;
  dashed?: boolean;
}

/** Title-block fields alongside the project name (see AppState's own projectAuthor/etc. doc) -
 * all optional so a file saved before this existed still loads (each just reads back as ''). */
export interface ProjectMeta {
  author?: string;
  checkedBy?: string;
  company?: string;
}

/** The optional print-sheet guide (see ui/pageFrame.ts) - `x`/`y` are the world-space center of
 * the frame, recomputed around the current diagram whenever `size` is set to an actual sheet
 * (see interaction/zoomToFit.ts's own content-bounds approach for the same idea), then left fixed
 * from then on rather than following the diagram around like a camera would. */
export interface PageFrame {
  size: 'none' | 'a4' | 'a3';
  x: number;
  y: number;
}

export interface ProjectFileV1 {
  schemaVersion: 1;
  name: string;
  meta?: ProjectMeta;
  pageFrame?: PageFrame;
  comps: ComponentSnapshot[];
  conns: ConnectionSnapshot[];
}
