import type { Component } from '../core/types';
import { createSource, SOURCE_TYPE } from './source';
import { createValve52, VALVE_52_TYPE } from './valve52';
import { createValve52Mono, VALVE_52_MONO_TYPE } from './valve52Mono';
import { createValve53Mono, VALVE_53_MONO_TYPE } from './valve53Mono';
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
import { createThrottleValve, THROTTLE_VALVE_TYPE } from './throttleValve';
import {
  createElecRailPlus,
  createElecRailZero,
  createElecContact,
  createElecPushButton,
  createElecCoil,
  createElecLamp,
  ELEC_RAIL_PLUS_TYPE,
  ELEC_RAIL_ZERO_TYPE,
  ELEC_CONTACT_TYPE,
  ELEC_PUSH_BUTTON_TYPE,
  ELEC_COIL_TYPE,
  ELEC_LAMP_TYPE,
} from './electrical';
import {
  createValve52Solenoid,
  createValve52SolenoidDouble,
  createValve53Solenoid,
  VALVE_52_SOLENOID_TYPE,
  VALVE_52_SOLENOID_DOUBLE_TYPE,
  VALVE_53_SOLENOID_TYPE,
} from './solenoidValves';
import { createPlc, PLC_TYPE } from './plc';
import { createTextAnnotation, TEXT_ANNOTATION_TYPE } from './textAnnotation';

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
  ELECTRICAL: 'Electrical',
  ANNOTATIONS: 'Annotations',
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
    VALVE_52_MONO_TYPE,
    {
      factory: (ctx, x, y) => createValve52Mono(ctx.compLayer, x, y),
      label: '5/2 valve, monostable',
      placeable: true,
      category: ComponentCategory.DIRECTIONAL,
    },
  ],
  [
    VALVE_53_MONO_TYPE,
    {
      factory: (ctx, x, y) => createValve53Mono(ctx.compLayer, x, y),
      label: '5/3 valve, monostable',
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
    THROTTLE_VALVE_TYPE,
    {
      factory: (ctx, x, y) => createThrottleValve(ctx.compLayer, x, y),
      label: 'Throttle valve',
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
    ELEC_RAIL_PLUS_TYPE,
    {
      factory: (ctx, x, y) => createElecRailPlus(ctx.compLayer, x, y),
      label: '+24 V supply',
      placeable: true,
      category: ComponentCategory.ELECTRICAL,
    },
  ],
  [
    ELEC_RAIL_ZERO_TYPE,
    {
      factory: (ctx, x, y) => createElecRailZero(ctx.compLayer, x, y),
      label: '0 V supply',
      placeable: true,
      category: ComponentCategory.ELECTRICAL,
    },
  ],
  [
    ELEC_PUSH_BUTTON_TYPE,
    {
      factory: (ctx, x, y) => createElecPushButton(ctx.compLayer, x, y),
      label: 'Push button NO',
      placeable: true,
      category: ComponentCategory.ELECTRICAL,
    },
  ],
  [
    ELEC_CONTACT_TYPE,
    {
      factory: (ctx, x, y) => createElecContact(ctx.compLayer, x, y),
      label: 'Contact NO',
      placeable: true,
      category: ComponentCategory.ELECTRICAL,
    },
  ],
  // Sidebar shortcuts for the normally-closed variants: same component types as the plain ones
  // (saved projects, the inspector and swapping all key off comp.type, which stays
  // 'elecContact' / 'elecPushButton'), just pre-set to NC - the registry key only has to be
  // unique for the sidebar tile.
  [
    'elecContactNc',
    {
      factory: (ctx, x, y) => {
        const c = createElecContact(ctx.compLayer, x, y);
        c.restore({ ...c.snapshot(), normallyClosed: true });
        return c;
      },
      label: 'Contact NC',
      placeable: true,
      category: ComponentCategory.ELECTRICAL,
    },
  ],
  [
    'elecPushButtonNc',
    {
      factory: (ctx, x, y) => {
        const c = createElecPushButton(ctx.compLayer, x, y);
        c.restore({ ...c.snapshot(), normallyClosed: true });
        return c;
      },
      label: 'Push button NC',
      placeable: true,
      category: ComponentCategory.ELECTRICAL,
    },
  ],
  [
    ELEC_COIL_TYPE,
    {
      factory: (ctx, x, y) => createElecCoil(ctx.compLayer, x, y),
      label: 'Coil (relay / solenoid)',
      placeable: true,
      category: ComponentCategory.ELECTRICAL,
    },
  ],
  [
    ELEC_LAMP_TYPE,
    {
      factory: (ctx, x, y) => createElecLamp(ctx.compLayer, x, y),
      label: 'Lamp',
      placeable: true,
      category: ComponentCategory.ELECTRICAL,
    },
  ],
  [
    VALVE_52_SOLENOID_TYPE,
    {
      factory: (ctx, x, y) => createValve52Solenoid(ctx.compLayer, x, y),
      label: '5/2 solenoid valve',
      placeable: true,
      category: ComponentCategory.DIRECTIONAL,
    },
  ],
  [
    VALVE_52_SOLENOID_DOUBLE_TYPE,
    {
      factory: (ctx, x, y) => createValve52SolenoidDouble(ctx.compLayer, x, y),
      label: '5/2 double solenoid valve',
      placeable: true,
      category: ComponentCategory.DIRECTIONAL,
    },
  ],
  [
    VALVE_53_SOLENOID_TYPE,
    {
      factory: (ctx, x, y) => createValve53Solenoid(ctx.compLayer, x, y),
      label: '5/3 solenoid valve',
      placeable: true,
      category: ComponentCategory.DIRECTIONAL,
    },
  ],
  [
    PLC_TYPE,
    {
      factory: (ctx, x, y) => createPlc(ctx.compLayer, x, y),
      label: 'PLC',
      placeable: true,
      category: ComponentCategory.ELECTRICAL,
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
    TEXT_ANNOTATION_TYPE,
    {
      factory: (ctx, x, y) => createTextAnnotation(ctx.compLayer, x, y),
      label: 'Text note',
      placeable: true,
      category: ComponentCategory.ANNOTATIONS,
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
  ComponentCategory.ELECTRICAL,
  ComponentCategory.ANNOTATIONS,
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
