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

export interface RegistryEntry {
  factory: ComponentFactory;
  /** Sidebar button label. */
  label: string;
  /** False for types only ever created programmatically (e.g. junction, via wire-splitting). */
  placeable: boolean;
}

export const componentRegistry = new Map<string, RegistryEntry>([
  [
    SOURCE_TYPE,
    {
      factory: (ctx, x, y) => createSource(ctx.compLayer, x, y),
      label: '➕ Pressure source',
      placeable: true,
    },
  ],
  [
    VALVE_52_TYPE,
    {
      factory: (ctx, x, y) => createValve52(ctx.compLayer, x, y),
      label: '➕ 5/2 valve',
      placeable: true,
    },
  ],
  [
    AND_VALVE_TYPE,
    {
      factory: (ctx, x, y) => createAndValve(ctx.compLayer, x, y),
      label: '➕ AND valve',
      placeable: true,
    },
  ],
  [
    OR_VALVE_TYPE,
    {
      factory: (ctx, x, y) => createOrValve(ctx.compLayer, x, y),
      label: '➕ OR valve',
      placeable: true,
    },
  ],
  [
    CHECK_VALVE_TYPE,
    {
      factory: (ctx, x, y) => createCheckValve(ctx.compLayer, x, y),
      label: '➕ Check valve',
      placeable: true,
    },
  ],
  [
    RESTRICTOR_TYPE,
    {
      factory: (ctx, x, y) => createRestrictor(ctx.compLayer, x, y),
      label: '➕ Restrictor',
      placeable: true,
    },
  ],
  [
    LIMIT_VALVE_32_TYPE,
    {
      factory: (ctx, x, y) => createLimitValve32(ctx.compLayer, x, y),
      label: '➕ 3/2 limit valve',
      placeable: true,
    },
  ],
  [
    PUSH_BUTTON_32_TYPE,
    {
      factory: (ctx, x, y) => createPushButton32(ctx.compLayer, x, y),
      label: '➕ 3/2 push button',
      placeable: true,
    },
  ],
  [
    AIR_VALVE_32_TYPE,
    {
      factory: (ctx, x, y) => createAirValve32(ctx.compLayer, x, y),
      label: '➕ 3/2 air-piloted',
      placeable: true,
    },
  ],
  [
    CYLINDER_DOUBLE_TYPE,
    {
      factory: (ctx, x, y) => createCylinderDouble(ctx.compLayer, x, y),
      label: '➕ Cylinder, double-acting',
      placeable: true,
    },
  ],
  [
    CYLINDER_SINGLE_TYPE,
    {
      factory: (ctx, x, y) => createCylinderSingle(ctx.compLayer, x, y),
      label: '➕ Cylinder, single-acting',
      placeable: true,
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
  [
    TIME_DELAY_VALVE_TYPE,
    {
      factory: (ctx, x, y) => createTimeDelayValve(ctx.compLayer, x, y),
      label: '➕ Time delay valve',
      placeable: true,
    },
  ],
  [
    QUICK_EXHAUST_VALVE_TYPE,
    {
      factory: (ctx, x, y) => createQuickExhaustValve(ctx.compLayer, x, y),
      label: '➕ Quick-exhaust valve',
      placeable: true,
    },
  ],
  [
    ONE_WAY_FLOW_CONTROL_VALVE_TYPE,
    {
      factory: (ctx, x, y) => createOneWayFlowControlValve(ctx.compLayer, x, y),
      label: '➕ One-way flow control',
      placeable: true,
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

export function placeableComponentTypes(): Array<{ type: string; label: string }> {
  return [...componentRegistry.entries()]
    .filter(([, entry]) => entry.placeable)
    .map(([type, entry]) => ({ type, label: entry.label }));
}
