import type { ComponentId, PortKey, WireGuide } from '../core/types';

export const CURRENT_SCHEMA_VERSION = 1;

export interface ComponentSnapshot {
  id: ComponentId;
  type: string;
  x: number;
  y: number;
  data: Record<string, unknown>;
}

export interface ConnectionSnapshot {
  from: { id: ComponentId; port: PortKey };
  to: { id: ComponentId; port: PortKey };
  guides: WireGuide[];
  stubStartLen: number | null;
  stubEndLen: number | null;
}

export interface ProjectFileV1 {
  schemaVersion: 1;
  name: string;
  comps: ComponentSnapshot[];
  conns: ConnectionSnapshot[];
}
