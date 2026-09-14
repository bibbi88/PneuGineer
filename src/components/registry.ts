import type { Component } from '../core/types';
import { createSource, SOURCE_TYPE } from './source';
import { createValve52, VALVE_52_TYPE } from './valve52';
import { createAndValve, AND_VALVE_TYPE } from './andValve';
import { createOrValve, OR_VALVE_TYPE } from './orValve';
import { createCheckValve, CHECK_VALVE_TYPE } from './checkValve';
import { createRestrictor, RESTRICTOR_TYPE } from './restrictor';
import { createLimitValve32, LIMIT_VALVE_32_TYPE } from './limitValve32';
import { createPushButton32, PUSH_BUTTON_32_TYPE } from './pushButton32';
import { createAirValve32, AIR_VALVE_32_TYPE } from './airValve32';
import { createCylinderDouble, CYLINDER_DOUBLE_TYPE } from './cylinderDouble';
import { createCylinderSingle, CYLINDER_SINGLE_TYPE } from './cylinderSingle';
import { createJunction, JUNCTION_TYPE } from './junction';
import { createTimeDelayValve, TIME_DELAY_VALVE_TYPE } from './timeDelayValve';
import { createQuickExhaustValve, QUICK_EXHAUST_VALVE_TYPE } from './quickExhaustValve';
import {
  createOneWayFlowControlValve,
  ONE_WAY_FLOW_CONTROL_VALVE_TYPE,
} from './oneWayFlowControlValve';

export interface ComponentFactoryContext {
  compLayer: HTMLElement;
}

export type ComponentFactory = (ctx: ComponentFactoryContext, x: number, y: number) => Component;

/** Sidebar grouping, matching how a pneumatics reference organizes symbols rather than an
 * alphabetical dump. */
export const ComponentCategory = {
  SOURCES: 'Sources',
  DIRECTIONAL: 'Directional valves',
  LOGIC: 'Logic',
  FLOW: 'Flow control',
  ACTUATORS: 'Actuators',
} as const;
export type ComponentCategoryName = (typeof ComponentCategory)[keyof typeof ComponentCategory];

export interface RegistryEntry {
  factory: ComponentFactory;
  /** Sidebar tile label. */
  label: string;
  /** False for types only ever created programmatically (e.g. junction, via wire-splitting). */
  placeable: boolean;
  /** Sidebar group; only meaningful when placeable. */
  category?: ComponentCategoryName;
}

export const componentRegistry = new Map<string, RegistryEntry>([
  [
    SOURCE_TYPE,
    {
      factory: (ctx, x, y) => createSource(ctx.compLayer, x, y),
      label: 'Pressure source',
      placeable: true,
      category: ComponentCategory.SOURCES,
    },
  ],
  [
    VALVE_52_TYPE,
    {
      factory: (ctx, x, y) => createValve52(ctx.compLayer, x, y),
      label: '5/2 valve',
      placeable: true,
      category: ComponentCategory.DIRECTIONAL,
    },
  ],
  [
    LIMIT_VALVE_32_TYPE,
    {
      factory: (ctx, x, y) => createLimitValve32(ctx.compLayer, x, y),
      label: '3/2 limit valve',
      placeable: true,
      category: ComponentCategory.DIRECTIONAL,
    },
  ],
  [
    PUSH_BUTTON_32_TYPE,
    {
      factory: (ctx, x, y) => createPushButton32(ctx.compLayer, x, y),
      label: '3/2 push button',
      placeable: true,
      category: ComponentCategory.DIRECTIONAL,
    },
  ],
  [
    AIR_VALVE_32_TYPE,
    {
      factory: (ctx, x, y) => createAirValve32(ctx.compLayer, x, y),
      label: '3/2 air-piloted',
      placeable: true,
      category: ComponentCategory.DIRECTIONAL,
    },
  ],
  [
    AND_VALVE_TYPE,
    {
      factory: (ctx, x, y) => createAndValve(ctx.compLayer, x, y),
      label: 'AND valve',
      placeable: true,
      category: ComponentCategory.LOGIC,
    },
  ],
  [
    OR_VALVE_TYPE,
    {
      factory: (ctx, x, y) => createOrValve(ctx.compLayer, x, y),
      label: 'OR valve',
      placeable: true,
      category: ComponentCategory.LOGIC,
    },
  ],
  [
    CHECK_VALVE_TYPE,
    {
      factory: (ctx, x, y) => createCheckValve(ctx.compLayer, x, y),
      label: 'Check valve',
      placeable: true,
      category: ComponentCategory.FLOW,
    },
  ],
  [
    RESTRICTOR_TYPE,
    {
      factory: (ctx, x, y) => createRestrictor(ctx.compLayer, x, y),
      label: 'Restrictor',
      placeable: true,
      category: ComponentCategory.FLOW,
    },
  ],
  [
    ONE_WAY_FLOW_CONTROL_VALVE_TYPE,
    {
      factory: (ctx, x, y) => createOneWayFlowControlValve(ctx.compLayer, x, y),
      label: 'One-way flow control',
      placeable: true,
      category: ComponentCategory.FLOW,
    },
  ],
  [
    QUICK_EXHAUST_VALVE_TYPE,
    {
      factory: (ctx, x, y) => createQuickExhaustValve(ctx.compLayer, x, y),
      label: 'Quick-exhaust valve',
      placeable: true,
      category: ComponentCategory.FLOW,
    },
  ],
  [
    TIME_DELAY_VALVE_TYPE,
    {
      factory: (ctx, x, y) => createTimeDelayValve(ctx.compLayer, x, y),
      label: 'Time delay valve',
      placeable: true,
      category: ComponentCategory.FLOW,
    },
  ],
  [
    CYLINDER_DOUBLE_TYPE,
    {
      factory: (ctx, x, y) => createCylinderDouble(ctx.compLayer, x, y),
      label: 'Cylinder, double-acting',
      placeable: true,
      category: ComponentCategory.ACTUATORS,
    },
  ],
  [
    CYLINDER_SINGLE_TYPE,
    {
      factory: (ctx, x, y) => createCylinderSingle(ctx.compLayer, x, y),
      label: 'Cylinder, single-acting',
      placeable: true,
      category: ComponentCategory.ACTUATORS,
    },
  ],
  [
    JUNCTION_TYPE,
    {
      factory: (ctx, x, y) => createJunction(ctx.compLayer, x, y),
      label: 'Junction',
      placeable: false,
    },
  ],
]);

export function createComponent(
  type: string,
  ctx: ComponentFactoryContext,
  x: number,
  y: number,
): Component {
  const entry = componentRegistry.get(type);
  if (!entry) throw new Error(`Unknown component type: ${type}`);
  return entry.factory(ctx, x, y);
}

const CATEGORY_ORDER: ComponentCategoryName[] = [
  ComponentCategory.SOURCES,
  ComponentCategory.DIRECTIONAL,
  ComponentCategory.LOGIC,
  ComponentCategory.FLOW,
  ComponentCategory.ACTUATORS,
];

export interface ComponentGroup {
  category: ComponentCategoryName;
  items: Array<{ type: string; label: string }>;
}

/** Placeable component types grouped for the sidebar, in a fixed category order matching how a
 * pneumatics reference organizes symbols (sources -> valves -> logic -> flow control ->
 * actuators) rather than the registration order above. */
export function placeableComponentsByCategory(): ComponentGroup[] {
  const entries = [...componentRegistry.entries()].filter(([, entry]) => entry.placeable);
  return CATEGORY_ORDER.map((category) => ({
    category,
    items: entries
      .filter(([, entry]) => entry.category === category)
      .map(([type, entry]) => ({ type, label: entry.label })),
  })).filter((group) => group.items.length > 0);
}
