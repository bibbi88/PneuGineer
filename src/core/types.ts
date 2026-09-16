export type ComponentId = number;
export type PortKey = string;

export interface PortDef {
  key: PortKey;
  cx: number;
  cy: number;
  el: SVGCircleElement;
  entryOrientation: 'H' | 'V';
  isPilot?: boolean;
  pilotDir?: 1 | -1;
}

export interface PortConnection {
  a: PortKey;
  b: PortKey;
  directed?: boolean;
}

export interface ConductivityContext {
  isPressurized(port: PortKey): boolean;
}

export interface SimStepContext {
  dt: number;
  isPressurized(port: PortKey): boolean;
  flowMultiplierToNearestSource(port: PortKey): number;
  emitSignal(key: string, value: boolean): void;
  readSignal(key: string): boolean;
}

export interface ComponentBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ContextMenuAction {
  label: string;
  onClick: () => void;
}

export interface Component<TSnapshot = Record<string, unknown>> {
  readonly id: ComponentId;
  readonly type: string;
  el: HTMLElement;
  x: number;
  y: number;
  svgW: number;
  svgH: number;
  gx: number;
  gy: number;
  ports: Record<PortKey, PortDef>;

  conductivityRule(ctx: ConductivityContext): PortConnection[];
  flowMultiplier?(fromPort: PortKey, toPort: PortKey): number;
  /** Ports that inject pressure into the system (e.g. a pressure source's outlet). */
  sourcePorts?(): PortKey[];

  snapshot(): TSnapshot;
  restore(data: TSnapshot): void;
  reset(): void;

  setPos(x: number, y: number): void;
  getBounds(): ComponentBounds;
  setSelected(sel: boolean): void;
  destroy?(): void;
  /** Reassigns a fresh distinguishing label (e.g. a cylinder's letter) - called after pasting a
   * copy so it doesn't keep the exact identity (and signal names) of the component it was
   * copied from. Components without a meaningful identity to reassign can omit this. */
  relabel?(): void;
  /** Renames this component's user-facing identifying label (e.g. a cylinder's letter) to
   * `newValue`, cascading to anything derived from the old one (sensor labels, other
   * components bound to them). Returns whether `newValue` was valid and applied - an invalid
   * value leaves everything unchanged. Drives the inspector's rename field. */
  renameLabel?(newValue: string): boolean;
  /** Switches a single-acting cylinder between push/pull, immediately snapping its piston to
   * that mode's own default rest position (rather than animating there on the next simulation
   * step) since this is a configuration change, not a live simulation event. Drives the
   * inspector's mode field - not part of the generic snapshot()/restore() round trip because a
   * loaded project's saved position must NOT be overridden by this same "reset to default"
   * logic. */
  setCylinderMode?(mode: 'push' | 'pull'): void;
  /** Extra type-specific entries spliced into this component's right-click menu, alongside the
   * generic rotate/delete every component gets. */
  contextMenuItems?(): ContextMenuAction[];

  recompute?(): void;
  onPressureChange?(ctx: ConductivityContext): void;
  step?(dt: number, ctx: SimStepContext): void;
}

export interface ConnectionEndpoint {
  id: ComponentId;
  port: PortKey;
}

export interface WireGuide {
  type: 'H' | 'V';
  pos: number;
}

export interface Connection {
  id: ComponentId;
  from: ConnectionEndpoint;
  to: ConnectionEndpoint;
  guides: WireGuide[];
  stubStartLen: number | null;
  stubEndLen: number | null;
  dashed?: boolean;
  pathEl: SVGPathElement;
  /** Wider, invisible path stacked on top of pathEl so clicking/right-clicking the wire is easier. */
  hitEl: SVGPathElement;
  labelEl: SVGTextElement;
}
