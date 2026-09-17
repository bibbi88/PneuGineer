import { createSvgEl, createLabeledPort, createPort } from '../components/shared/svgHelpers';
import {
  ONE_WAY_FLOW_DEFAULT_GEOMETRY,
  drawOneWayFlowControlValveBody,
} from '../components/oneWayFlowControlValve';
import { JUNCTION_DEFAULT_GEOMETRY, drawJunctionBody } from '../components/junction';
import { SOURCE_DEFAULT_GEOMETRY, drawSourceBody } from '../components/source';
import { RESTRICTOR_DEFAULT_GEOMETRY, drawRestrictorBody } from '../components/restrictor';
import { CHECK_VALVE_DEFAULT_GEOMETRY, drawCheckValveBody } from '../components/checkValve';
import { AND_VALVE_DEFAULT_GEOMETRY, drawAndValveBody } from '../components/andValve';
import { OR_VALVE_DEFAULT_GEOMETRY, drawOrValveBody } from '../components/orValve';
import {
  QUICK_EXHAUST_VALVE_DEFAULT_GEOMETRY,
  drawQuickExhaustValveBody,
} from '../components/quickExhaustValve';
import {
  CYLINDER_DOUBLE_DEFAULT_GEOMETRY,
  drawCylinderDoubleBody,
} from '../components/cylinderDouble';
import {
  CYLINDER_SINGLE_DEFAULT_GEOMETRY,
  drawCylinderSingleBody,
} from '../components/cylinderSingle';
import {
  SLIDING_VALVE_32_DEFAULT_GEOMETRY,
  buildSlidingValve32Body,
} from '../components/shared/slidingValve32';
import {
  PUSH_BUTTON_32_DEFAULT_GEOMETRY,
  drawPushButton32Actuator,
} from '../components/pushButton32';
import { AIR_VALVE_32_DEFAULT_GEOMETRY, drawAirValve32Actuator } from '../components/airValve32';
import {
  LIMIT_VALVE_32_DEFAULT_GEOMETRY,
  drawLimitValve32Actuator,
} from '../components/limitValve32';
import {
  TIME_DELAY_VALVE_DEFAULT_GEOMETRY,
  drawTimeDelayValveActuator,
} from '../components/timeDelayValve';
import { VALVE_52_DEFAULT_GEOMETRY, drawValve52Body } from '../components/valve52';
import { VALVE_52_MONO_DEFAULT_GEOMETRY, drawValve52MonoBody } from '../components/valve52Mono';

export interface SymbolLabField {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
}

export interface SymbolLabEntry {
  id: string;
  label: string;
  group: string;
  sourceFile: string;
  exportName: string;
  fields: SymbolLabField[];
  createDefaultGeometry(): Record<string, number>;
  renderPreview(svg: SVGSVGElement, geo: Record<string, number>): { w: number; h: number };
}

function field(
  key: string,
  label: string,
  value: number,
  opts: { min?: number; max?: number; step?: number } = {},
): SymbolLabField {
  const spread = Math.max(Math.abs(value), 10);
  return {
    key,
    label,
    min: opts.min ?? Math.round((value - spread) * 100) / 100,
    max: opts.max ?? Math.round((value + spread) * 100) / 100,
    step: opts.step ?? (Number.isInteger(value) ? 1 : 0.05),
  };
}

let uidCounter = 0;
function labUid(): string {
  uidCounter += 1;
  return `symlab-${uidCounter}`;
}

const ONE_WAY_FLOW_CONTROL_VALVE_ENTRY: SymbolLabEntry = {
  id: 'oneWayFlowControlValve',
  label: 'One-way flow control valve',
  group: 'Flow',
  sourceFile: 'src/components/oneWayFlowControlValve.ts',
  exportName: 'ONE_WAY_FLOW_DEFAULT_GEOMETRY',
  fields: [
    field('localW', 'Body width', ONE_WAY_FLOW_DEFAULT_GEOMETRY.localW),
    field('localH', 'Body height', ONE_WAY_FLOW_DEFAULT_GEOMETRY.localH),
    field('portX', 'Check-valve line position', ONE_WAY_FLOW_DEFAULT_GEOMETRY.portX),
    field('branchX', 'Throttle line position', ONE_WAY_FLOW_DEFAULT_GEOMETRY.branchX),
    field('portMargin', 'Port margin', ONE_WAY_FLOW_DEFAULT_GEOMETRY.portMargin, {
      min: 0,
      max: 40,
    }),
    field('decorScale', 'Glyph scale', ONE_WAY_FLOW_DEFAULT_GEOMETRY.decorScale, {
      min: 0.5,
      max: 4,
      step: 0.05,
    }),
    field('decorOffsetX', 'Glyph offset X', ONE_WAY_FLOW_DEFAULT_GEOMETRY.decorOffsetX),
    field('decorOffsetY', 'Glyph offset Y', ONE_WAY_FLOW_DEFAULT_GEOMETRY.decorOffsetY),
  ],
  createDefaultGeometry: () => ({ ...ONE_WAY_FLOW_DEFAULT_GEOMETRY }),
  renderPreview(svg, geo) {
    const g = createSvgEl('g', { transform: 'translate(7,7)' });
    svg.appendChild(g);
    const typed = geo as unknown as typeof ONE_WAY_FLOW_DEFAULT_GEOMETRY;
    const { bottomY, topY, portX } = drawOneWayFlowControlValveBody(g, typed);
    createPort(g, 'IN', portX, bottomY, 'V');
    createPort(g, 'OUT', portX, topY, 'V');
    return { w: typed.localW + 14, h: typed.localH + 14 };
  },
};

const JUNCTION_ENTRY: SymbolLabEntry = {
  id: 'junction',
  label: 'Junction',
  group: 'Basics',
  sourceFile: 'src/components/junction.ts',
  exportName: 'JUNCTION_DEFAULT_GEOMETRY',
  fields: [
    field('svgW', 'Width', JUNCTION_DEFAULT_GEOMETRY.svgW, { min: 8, max: 40 }),
    field('svgH', 'Height', JUNCTION_DEFAULT_GEOMETRY.svgH, { min: 8, max: 40 }),
    field('dotRadius', 'Dot radius', JUNCTION_DEFAULT_GEOMETRY.dotRadius, { min: 1, max: 12 }),
  ],
  createDefaultGeometry: () => ({ ...JUNCTION_DEFAULT_GEOMETRY }),
  renderPreview(svg, geo) {
    const typed = geo as unknown as typeof JUNCTION_DEFAULT_GEOMETRY;
    drawJunctionBody(svg, typed);
    return { w: typed.svgW, h: typed.svgH };
  },
};

const SOURCE_ENTRY: SymbolLabEntry = {
  id: 'source',
  label: 'Pressure source',
  group: 'Basics',
  sourceFile: 'src/components/source.ts',
  exportName: 'SOURCE_DEFAULT_GEOMETRY',
  fields: [
    field('svgW', 'Canvas width', SOURCE_DEFAULT_GEOMETRY.svgW),
    field('svgH', 'Canvas height', SOURCE_DEFAULT_GEOMETRY.svgH),
    field('gx', 'Group offset X', SOURCE_DEFAULT_GEOMETRY.gx),
    field('gy', 'Group offset Y', SOURCE_DEFAULT_GEOMETRY.gy),
    field('cx', 'Circle center X', SOURCE_DEFAULT_GEOMETRY.cx),
    field('cy', 'Circle center Y', SOURCE_DEFAULT_GEOMETRY.cy),
    field('r', 'Circle radius', SOURCE_DEFAULT_GEOMETRY.r, { min: 4, max: 40 }),
    field('portY', 'Port Y', SOURCE_DEFAULT_GEOMETRY.portY),
  ],
  createDefaultGeometry: () => ({ ...SOURCE_DEFAULT_GEOMETRY }),
  renderPreview(svg, geo) {
    const typed = geo as unknown as typeof SOURCE_DEFAULT_GEOMETRY;
    const g = createSvgEl('g', { transform: `translate(${typed.gx},${typed.gy})` });
    svg.appendChild(g);
    const { cx, portY } = drawSourceBody(g, typed);
    createPort(g, 'OUT', cx, portY, 'V');
    return { w: typed.svgW, h: typed.svgH };
  },
};

const RESTRICTOR_ENTRY: SymbolLabEntry = {
  id: 'restrictor',
  label: 'Restrictor',
  group: 'Flow',
  sourceFile: 'src/components/restrictor.ts',
  exportName: 'RESTRICTOR_DEFAULT_GEOMETRY',
  fields: [
    field('svgW', 'Canvas width', RESTRICTOR_DEFAULT_GEOMETRY.svgW),
    field('svgH', 'Canvas height', RESTRICTOR_DEFAULT_GEOMETRY.svgH),
    field('gx', 'Group offset X', RESTRICTOR_DEFAULT_GEOMETRY.gx),
    field('gy', 'Group offset Y', RESTRICTOR_DEFAULT_GEOMETRY.gy),
    field('husX', 'Housing X', RESTRICTOR_DEFAULT_GEOMETRY.husX),
    field('husY', 'Housing Y', RESTRICTOR_DEFAULT_GEOMETRY.husY),
    field('husW', 'Housing width', RESTRICTOR_DEFAULT_GEOMETRY.husW),
    field('husH', 'Housing height', RESTRICTOR_DEFAULT_GEOMETRY.husH),
    field('portLead', 'Port lead length', RESTRICTOR_DEFAULT_GEOMETRY.portLead, {
      min: 0,
      max: 40,
    }),
  ],
  createDefaultGeometry: () => ({ ...RESTRICTOR_DEFAULT_GEOMETRY }),
  renderPreview(svg, geo) {
    const typed = geo as unknown as typeof RESTRICTOR_DEFAULT_GEOMETRY;
    const g = createSvgEl('g', { transform: `translate(${typed.gx},${typed.gy})` });
    svg.appendChild(g);
    const { in: IN, out: OUT } = drawRestrictorBody(g, typed);
    createLabeledPort(g, 'IN', IN.cx, IN.cy, 'V', 'below');
    createLabeledPort(g, 'OUT', OUT.cx, OUT.cy, 'V', 'above');
    return { w: typed.svgW, h: typed.svgH };
  },
};

const CHECK_VALVE_ENTRY: SymbolLabEntry = {
  id: 'checkValve',
  label: 'Check valve',
  group: 'Flow',
  sourceFile: 'src/components/checkValve.ts',
  exportName: 'CHECK_VALVE_DEFAULT_GEOMETRY',
  fields: [
    field('svgW', 'Canvas width', CHECK_VALVE_DEFAULT_GEOMETRY.svgW),
    field('svgH', 'Canvas height', CHECK_VALVE_DEFAULT_GEOMETRY.svgH),
    field('gx', 'Group offset X', CHECK_VALVE_DEFAULT_GEOMETRY.gx),
    field('gy', 'Group offset Y', CHECK_VALVE_DEFAULT_GEOMETRY.gy),
    field('scale', 'Glyph scale', CHECK_VALVE_DEFAULT_GEOMETRY.scale, {
      min: 0.2,
      max: 2,
      step: 0.05,
    }),
    field('baseHusX', 'Base housing X', CHECK_VALVE_DEFAULT_GEOMETRY.baseHusX),
    field('baseHusY', 'Base housing Y', CHECK_VALVE_DEFAULT_GEOMETRY.baseHusY),
    field('baseHusW', 'Base housing width', CHECK_VALVE_DEFAULT_GEOMETRY.baseHusW),
    field('baseHusH', 'Base housing height', CHECK_VALVE_DEFAULT_GEOMETRY.baseHusH),
    field('basePortR', 'Base port radius', CHECK_VALVE_DEFAULT_GEOMETRY.basePortR, {
      min: 1,
      max: 20,
    }),
    field('basePortLead', 'Base port lead', CHECK_VALVE_DEFAULT_GEOMETRY.basePortLead, {
      min: 0,
      max: 30,
    }),
  ],
  createDefaultGeometry: () => ({ ...CHECK_VALVE_DEFAULT_GEOMETRY }),
  renderPreview(svg, geo) {
    const typed = geo as unknown as typeof CHECK_VALVE_DEFAULT_GEOMETRY;
    const g = createSvgEl('g', { transform: `translate(${typed.gx},${typed.gy})` });
    svg.appendChild(g);
    const { in: IN, out: OUT, portR } = drawCheckValveBody(g, typed);
    createPort(g, 'IN', IN.cx, IN.cy, 'V', { radius: portR });
    createPort(g, 'OUT', OUT.cx, OUT.cy, 'V', { radius: portR });
    return { w: typed.svgW, h: typed.svgH };
  },
};

const AND_VALVE_ENTRY: SymbolLabEntry = {
  id: 'andValve',
  label: 'AND valve',
  group: 'Logic',
  sourceFile: 'src/components/andValve.ts',
  exportName: 'AND_VALVE_DEFAULT_GEOMETRY',
  fields: [
    field('svgW', 'Canvas width', AND_VALVE_DEFAULT_GEOMETRY.svgW),
    field('svgH', 'Canvas height', AND_VALVE_DEFAULT_GEOMETRY.svgH),
    field('gx', 'Group offset X', AND_VALVE_DEFAULT_GEOMETRY.gx),
    field('gy', 'Group offset Y', AND_VALVE_DEFAULT_GEOMETRY.gy),
    field('husX', 'Housing X', AND_VALVE_DEFAULT_GEOMETRY.husX),
    field('husY', 'Housing Y', AND_VALVE_DEFAULT_GEOMETRY.husY),
    field('husW', 'Housing width', AND_VALVE_DEFAULT_GEOMETRY.husW),
    field('husH', 'Housing height', AND_VALVE_DEFAULT_GEOMETRY.husH),
    field('seatInset', 'Seat inset', AND_VALVE_DEFAULT_GEOMETRY.seatInset, { min: 5, max: 45 }),
    field('portLead', 'Port lead length', AND_VALVE_DEFAULT_GEOMETRY.portLead, {
      min: 0,
      max: 40,
    }),
  ],
  createDefaultGeometry: () => ({ ...AND_VALVE_DEFAULT_GEOMETRY }),
  renderPreview(svg, geo) {
    const typed = geo as unknown as typeof AND_VALVE_DEFAULT_GEOMETRY;
    const g = createSvgEl('g', { transform: `translate(${typed.gx},${typed.gy})` });
    svg.appendChild(g);
    const { a: A, b: B, out: OUT } = drawAndValveBody(g, typed);
    createLabeledPort(g, 'A', A.cx, A.cy, 'H', 'left');
    createLabeledPort(g, 'B', B.cx, B.cy, 'H', 'left');
    createLabeledPort(g, 'OUT', OUT.cx, OUT.cy, 'V', 'left');
    return { w: typed.svgW, h: typed.svgH };
  },
};

const OR_VALVE_ENTRY: SymbolLabEntry = {
  id: 'orValve',
  label: 'OR valve',
  group: 'Logic',
  sourceFile: 'src/components/orValve.ts',
  exportName: 'OR_VALVE_DEFAULT_GEOMETRY',
  fields: [
    field('svgW', 'Canvas width', OR_VALVE_DEFAULT_GEOMETRY.svgW),
    field('svgH', 'Canvas height', OR_VALVE_DEFAULT_GEOMETRY.svgH),
    field('gx', 'Group offset X', OR_VALVE_DEFAULT_GEOMETRY.gx),
    field('gy', 'Group offset Y', OR_VALVE_DEFAULT_GEOMETRY.gy),
    field('husX', 'Housing X', OR_VALVE_DEFAULT_GEOMETRY.husX),
    field('husY', 'Housing Y', OR_VALVE_DEFAULT_GEOMETRY.husY),
    field('husW', 'Housing width', OR_VALVE_DEFAULT_GEOMETRY.husW),
    field('husH', 'Housing height', OR_VALVE_DEFAULT_GEOMETRY.husH),
    field('seatInset', 'Seat inset', OR_VALVE_DEFAULT_GEOMETRY.seatInset, { min: 4, max: 30 }),
    field('portLead', 'Port lead length', OR_VALVE_DEFAULT_GEOMETRY.portLead, { min: 0, max: 40 }),
    field('ballR', 'Shuttle ball radius', OR_VALVE_DEFAULT_GEOMETRY.ballR, { min: 2, max: 20 }),
  ],
  createDefaultGeometry: () => ({ ...OR_VALVE_DEFAULT_GEOMETRY }),
  renderPreview(svg, geo) {
    const typed = geo as unknown as typeof OR_VALVE_DEFAULT_GEOMETRY;
    const g = createSvgEl('g', { transform: `translate(${typed.gx},${typed.gy})` });
    svg.appendChild(g);
    const { a: A, b: B, out: OUT } = drawOrValveBody(g, typed);
    createLabeledPort(g, 'A', A.cx, A.cy, 'H', 'left');
    createLabeledPort(g, 'B', B.cx, B.cy, 'H', 'left');
    createLabeledPort(g, 'OUT', OUT.cx, OUT.cy, 'V', 'left');
    return { w: typed.svgW, h: typed.svgH };
  },
};

const QUICK_EXHAUST_VALVE_ENTRY: SymbolLabEntry = {
  id: 'quickExhaustValve',
  label: 'Quick-exhaust valve',
  group: 'Flow',
  sourceFile: 'src/components/quickExhaustValve.ts',
  exportName: 'QUICK_EXHAUST_VALVE_DEFAULT_GEOMETRY',
  fields: [
    field('localW', 'Canvas width', QUICK_EXHAUST_VALVE_DEFAULT_GEOMETRY.localW),
    field('localH', 'Canvas height', QUICK_EXHAUST_VALVE_DEFAULT_GEOMETRY.localH),
    field('ox', 'Canvas offset X', QUICK_EXHAUST_VALVE_DEFAULT_GEOMETRY.ox),
    field('oy', 'Canvas offset Y', QUICK_EXHAUST_VALVE_DEFAULT_GEOMETRY.oy),
    field('scale', 'Overall scale', QUICK_EXHAUST_VALVE_DEFAULT_GEOMETRY.scale, {
      min: 0.2,
      max: 2,
      step: 0.05,
    }),
    field('housingX', 'Housing x', QUICK_EXHAUST_VALVE_DEFAULT_GEOMETRY.housingX),
    field('housingW', 'Housing width', QUICK_EXHAUST_VALVE_DEFAULT_GEOMETRY.housingW),
    field(
      'housingCenterY',
      'Housing center y',
      QUICK_EXHAUST_VALVE_DEFAULT_GEOMETRY.housingCenterY,
    ),
    field('housingHalfH', 'Housing half-height', QUICK_EXHAUST_VALVE_DEFAULT_GEOMETRY.housingHalfH),
    field('port1LeadX', 'Port 1 lead x', QUICK_EXHAUST_VALVE_DEFAULT_GEOMETRY.port1LeadX),
    field('ballLeftCx', 'Ball left x', QUICK_EXHAUST_VALVE_DEFAULT_GEOMETRY.ballLeftCx),
    field('ballRadius', 'Ball radius', QUICK_EXHAUST_VALVE_DEFAULT_GEOMETRY.ballRadius, {
      min: 1,
      max: 12,
    }),
    field('ballTravel', 'Ball travel', QUICK_EXHAUST_VALVE_DEFAULT_GEOMETRY.ballTravel),
    field('port2LeadTopY', 'Port 2 lead top y', QUICK_EXHAUST_VALVE_DEFAULT_GEOMETRY.port2LeadTopY),
    field('port3TipX', 'Exhaust arrow tip x', QUICK_EXHAUST_VALVE_DEFAULT_GEOMETRY.port3TipX),
    field('port3LeadX', 'Port 3 lead x', QUICK_EXHAUST_VALVE_DEFAULT_GEOMETRY.port3LeadX),
  ],
  createDefaultGeometry: () => ({ ...QUICK_EXHAUST_VALVE_DEFAULT_GEOMETRY }),
  renderPreview(svg, geo) {
    const typed = geo as unknown as typeof QUICK_EXHAUST_VALVE_DEFAULT_GEOMETRY;
    const g = createSvgEl('g', {
      transform: `translate(${typed.ox},${typed.oy}) scale(${typed.scale})`,
    });
    svg.appendChild(g);
    const p = drawQuickExhaustValveBody(g, typed);
    createPort(g, '1', p['1'].cx, p['1'].cy, 'H');
    createPort(g, '2', p['2'].cx, p['2'].cy, 'V');
    createPort(g, '3', p['3'].cx, p['3'].cy, 'H');
    return {
      w: typed.localW * typed.scale + typed.ox * 2,
      h: typed.localH * typed.scale + typed.oy * 2,
    };
  },
};

const CYLINDER_DOUBLE_ENTRY: SymbolLabEntry = {
  id: 'cylinderDouble',
  label: 'Double-acting cylinder',
  group: 'Actuators',
  sourceFile: 'src/components/cylinderDouble.ts',
  exportName: 'CYLINDER_DOUBLE_DEFAULT_GEOMETRY',
  fields: [
    field('svgW', 'Canvas width', CYLINDER_DOUBLE_DEFAULT_GEOMETRY.svgW),
    field('svgH', 'Canvas height', CYLINDER_DOUBLE_DEFAULT_GEOMETRY.svgH),
    field('gx', 'Group offset X', CYLINDER_DOUBLE_DEFAULT_GEOMETRY.gx),
    field('gy', 'Group offset Y', CYLINDER_DOUBLE_DEFAULT_GEOMETRY.gy),
    field('w', 'Body width', CYLINDER_DOUBLE_DEFAULT_GEOMETRY.w),
    field('h', 'Body height', CYLINDER_DOUBLE_DEFAULT_GEOMETRY.h),
    field('portMargin', 'Port margin', CYLINDER_DOUBLE_DEFAULT_GEOMETRY.portMargin, {
      min: 0,
      max: 20,
    }),
    field('portInsetA', 'Port A inset', CYLINDER_DOUBLE_DEFAULT_GEOMETRY.portInsetA, {
      min: 0,
      max: 30,
    }),
    field('portInsetB', 'Port B inset', CYLINDER_DOUBLE_DEFAULT_GEOMETRY.portInsetB, {
      min: 0,
      max: 30,
    }),
    field('pistonWidth', 'Piston width', CYLINDER_DOUBLE_DEFAULT_GEOMETRY.pistonWidth, {
      min: 1,
      max: 20,
    }),
    field(
      'pistonTravelInset',
      'Piston travel inset',
      CYLINDER_DOUBLE_DEFAULT_GEOMETRY.pistonTravelInset,
      { min: 0, max: 30 },
    ),
    field('pistonToRodGap', 'Piston-to-rod gap', CYLINDER_DOUBLE_DEFAULT_GEOMETRY.pistonToRodGap, {
      min: 0,
      max: 20,
    }),
    field('rodHeight', 'Rod height', CYLINDER_DOUBLE_DEFAULT_GEOMETRY.rodHeight, {
      min: 1,
      max: 20,
    }),
    field('rodTipInset', 'Rod tip inset', CYLINDER_DOUBLE_DEFAULT_GEOMETRY.rodTipInset, {
      min: 0,
      max: 30,
    }),
    field('rodTipWidth', 'Rod tip width', CYLINDER_DOUBLE_DEFAULT_GEOMETRY.rodTipWidth, {
      min: 1,
      max: 30,
    }),
    field('rodTipHeight', 'Rod tip height', CYLINDER_DOUBLE_DEFAULT_GEOMETRY.rodTipHeight, {
      min: 1,
      max: 30,
    }),
  ],
  createDefaultGeometry: () => ({ ...CYLINDER_DOUBLE_DEFAULT_GEOMETRY }),
  renderPreview(svg, geo) {
    const typed = geo as unknown as typeof CYLINDER_DOUBLE_DEFAULT_GEOMETRY;
    const g = createSvgEl('g', { transform: `translate(${typed.gx},${typed.gy})` });
    svg.appendChild(g);
    const { a: A, b: B } = drawCylinderDoubleBody(g, typed);
    createPort(g, 'A', A.cx, A.cy, 'V');
    createPort(g, 'B', B.cx, B.cy, 'V');
    return { w: typed.svgW, h: typed.svgH };
  },
};

const CYLINDER_SINGLE_ENTRY: SymbolLabEntry = {
  id: 'cylinderSingle',
  label: 'Single-acting cylinder',
  group: 'Actuators',
  sourceFile: 'src/components/cylinderSingle.ts',
  exportName: 'CYLINDER_SINGLE_DEFAULT_GEOMETRY',
  fields: [
    field('svgW', 'Canvas width', CYLINDER_SINGLE_DEFAULT_GEOMETRY.svgW),
    field('svgH', 'Canvas height', CYLINDER_SINGLE_DEFAULT_GEOMETRY.svgH),
    field('gx', 'Group offset X', CYLINDER_SINGLE_DEFAULT_GEOMETRY.gx),
    field('gy', 'Group offset Y', CYLINDER_SINGLE_DEFAULT_GEOMETRY.gy),
    field('w', 'Body width', CYLINDER_SINGLE_DEFAULT_GEOMETRY.w),
    field('h', 'Body height', CYLINDER_SINGLE_DEFAULT_GEOMETRY.h),
    field('portMargin', 'Port margin', CYLINDER_SINGLE_DEFAULT_GEOMETRY.portMargin, {
      min: 0,
      max: 20,
    }),
    field('capPortInset', 'Cap port inset', CYLINDER_SINGLE_DEFAULT_GEOMETRY.capPortInset, {
      min: 0,
      max: 30,
    }),
    field('rodPortInset', 'Rod port inset', CYLINDER_SINGLE_DEFAULT_GEOMETRY.rodPortInset, {
      min: 0,
      max: 30,
    }),
    field('pistonWidth', 'Piston width', CYLINDER_SINGLE_DEFAULT_GEOMETRY.pistonWidth, {
      min: 1,
      max: 20,
    }),
    field(
      'pistonTravelStartInset',
      'Piston travel start inset',
      CYLINDER_SINGLE_DEFAULT_GEOMETRY.pistonTravelStartInset,
      { min: 0, max: 30 },
    ),
    field(
      'pistonTravelEndInset',
      'Piston travel end inset',
      CYLINDER_SINGLE_DEFAULT_GEOMETRY.pistonTravelEndInset,
      { min: 0, max: 40 },
    ),
    field('pistonToRodGap', 'Piston-to-rod gap', CYLINDER_SINGLE_DEFAULT_GEOMETRY.pistonToRodGap, {
      min: 0,
      max: 20,
    }),
    field('rodHeight', 'Rod height', CYLINDER_SINGLE_DEFAULT_GEOMETRY.rodHeight, {
      min: 1,
      max: 20,
    }),
    field('rodTipInset', 'Rod tip inset', CYLINDER_SINGLE_DEFAULT_GEOMETRY.rodTipInset, {
      min: 0,
      max: 30,
    }),
    field('rodTipWidth', 'Rod tip width', CYLINDER_SINGLE_DEFAULT_GEOMETRY.rodTipWidth, {
      min: 1,
      max: 30,
    }),
    field('rodTipHeight', 'Rod tip height', CYLINDER_SINGLE_DEFAULT_GEOMETRY.rodTipHeight, {
      min: 1,
      max: 30,
    }),
    field('springInset', 'Spring inset', CYLINDER_SINGLE_DEFAULT_GEOMETRY.springInset, {
      min: 5,
      max: 60,
    }),
    field('springSegment', 'Spring segment', CYLINDER_SINGLE_DEFAULT_GEOMETRY.springSegment, {
      min: 2,
      max: 20,
    }),
  ],
  createDefaultGeometry: () => ({ ...CYLINDER_SINGLE_DEFAULT_GEOMETRY }),
  renderPreview(svg, geo) {
    const typed = geo as unknown as typeof CYLINDER_SINGLE_DEFAULT_GEOMETRY;
    const g = createSvgEl('g', { transform: `translate(${typed.gx},${typed.gy})` });
    svg.appendChild(g);
    const { capPortX } = drawCylinderSingleBody(g, typed);
    createPort(g, 'A', capPortX, typed.h + typed.portMargin, 'V');
    return { w: typed.svgW, h: typed.svgH };
  },
};

const SLIDING_VALVE_32_EXTRA_W = 48;
const SLIDING_VALVE_32_EXTRA_H = 30;

const SLIDING_VALVE_32_ENTRY: SymbolLabEntry = {
  id: 'slidingValve32',
  label: 'Sliding 3/2 valve body (shared)',
  group: 'Directional valves',
  sourceFile: 'src/components/shared/slidingValve32.ts',
  exportName: 'SLIDING_VALVE_32_DEFAULT_GEOMETRY',
  fields: [
    field('bodyW', 'Body width', SLIDING_VALVE_32_DEFAULT_GEOMETRY.bodyW),
    field('bodyH', 'Body height', SLIDING_VALVE_32_DEFAULT_GEOMETRY.bodyH),
    field('offsetX', 'Canvas offset X', SLIDING_VALVE_32_DEFAULT_GEOMETRY.offsetX),
    field('offsetY', 'Canvas offset Y', SLIDING_VALVE_32_DEFAULT_GEOMETRY.offsetY),
    field(
      'insetRightRatio',
      'Right-column inset ratio',
      SLIDING_VALVE_32_DEFAULT_GEOMETRY.insetRightRatio,
      {
        min: 0,
        max: 1,
        step: 0.01,
      },
    ),
    field('portEdgeGap', 'Port edge gap', SLIDING_VALVE_32_DEFAULT_GEOMETRY.portEdgeGap, {
      min: 0,
      max: 30,
    }),
    field('arrowEdgeGap', 'Arrow edge gap', SLIDING_VALVE_32_DEFAULT_GEOMETRY.arrowEdgeGap, {
      min: 0,
      max: 30,
    }),
    field(
      'tBlockBarHalfWidth',
      'T-block bar half-width',
      SLIDING_VALVE_32_DEFAULT_GEOMETRY.tBlockBarHalfWidth,
      { min: 2, max: 25 },
    ),
    field(
      'tBlockBottomGap',
      'T-block bottom gap',
      SLIDING_VALVE_32_DEFAULT_GEOMETRY.tBlockBottomGap,
      { min: 0, max: 40 },
    ),
    field('tBlockStemGap', 'T-block stem gap', SLIDING_VALVE_32_DEFAULT_GEOMETRY.tBlockStemGap, {
      min: 0,
      max: 20,
    }),
    field('silencerDir', 'Silencer direction', SLIDING_VALVE_32_DEFAULT_GEOMETRY.silencerDir, {
      min: -1,
      max: 1,
      step: 2,
    }),
  ],
  createDefaultGeometry: () => ({ ...SLIDING_VALVE_32_DEFAULT_GEOMETRY }),
  renderPreview(svg, geo) {
    const typed = geo as unknown as typeof SLIDING_VALVE_32_DEFAULT_GEOMETRY;
    buildSlidingValve32Body(svg, labUid(), typed);
    return {
      w: typed.offsetX + typed.bodyW + SLIDING_VALVE_32_EXTRA_W,
      h: typed.offsetY + typed.bodyH + SLIDING_VALVE_32_EXTRA_H,
    };
  },
};

function slidingValveCanvasSize(): { w: number; h: number } {
  return {
    w:
      SLIDING_VALVE_32_DEFAULT_GEOMETRY.offsetX +
      SLIDING_VALVE_32_DEFAULT_GEOMETRY.bodyW +
      SLIDING_VALVE_32_EXTRA_W,
    h:
      SLIDING_VALVE_32_DEFAULT_GEOMETRY.offsetY +
      SLIDING_VALVE_32_DEFAULT_GEOMETRY.bodyH +
      SLIDING_VALVE_32_EXTRA_H,
  };
}

const PUSH_BUTTON_32_ENTRY: SymbolLabEntry = {
  id: 'pushButton32',
  label: '3/2 push button (actuator)',
  group: 'Directional valves',
  sourceFile: 'src/components/pushButton32.ts',
  exportName: 'PUSH_BUTTON_32_DEFAULT_GEOMETRY',
  fields: [
    field('actuatorX', 'Actuator X', PUSH_BUTTON_32_DEFAULT_GEOMETRY.actuatorX),
    field(
      'actuatorTopInset',
      'Actuator top inset',
      PUSH_BUTTON_32_DEFAULT_GEOMETRY.actuatorTopInset,
      {
        min: 0,
        max: 30,
      },
    ),
    field(
      'actuatorBottomInset',
      'Actuator bottom inset',
      PUSH_BUTTON_32_DEFAULT_GEOMETRY.actuatorBottomInset,
      { min: 0, max: 30 },
    ),
    field('forkYInset', 'Fork Y inset', PUSH_BUTTON_32_DEFAULT_GEOMETRY.forkYInset, {
      min: 0,
      max: 30,
    }),
    field('springSegLen', 'Spring segment length', PUSH_BUTTON_32_DEFAULT_GEOMETRY.springSegLen, {
      min: 5,
      max: 40,
    }),
    field('springZigW', 'Spring zigzag width', PUSH_BUTTON_32_DEFAULT_GEOMETRY.springZigW, {
      min: 2,
      max: 20,
    }),
    field('springZigH', 'Spring zigzag height', PUSH_BUTTON_32_DEFAULT_GEOMETRY.springZigH, {
      min: 2,
      max: 20,
    }),
  ],
  createDefaultGeometry: () => ({ ...PUSH_BUTTON_32_DEFAULT_GEOMETRY }),
  renderPreview(svg, geo) {
    const typed = geo as unknown as typeof PUSH_BUTTON_32_DEFAULT_GEOMETRY;
    const valve = buildSlidingValve32Body(svg, labUid());
    drawPushButton32Actuator(valve.mover, typed);
    return slidingValveCanvasSize();
  },
};

const AIR_VALVE_32_ENTRY: SymbolLabEntry = {
  id: 'airValve32',
  label: '3/2 air-piloted valve (pilot)',
  group: 'Directional valves',
  sourceFile: 'src/components/airValve32.ts',
  exportName: 'AIR_VALVE_32_DEFAULT_GEOMETRY',
  fields: [
    field('pilotPortX', 'Pilot port X', AIR_VALVE_32_DEFAULT_GEOMETRY.pilotPortX),
    field('pilotBaseX', 'Pilot triangle base X', AIR_VALVE_32_DEFAULT_GEOMETRY.pilotBaseX),
    field('pilotTipX', 'Pilot triangle tip X', AIR_VALVE_32_DEFAULT_GEOMETRY.pilotTipX),
    field(
      'pilotHalfHeight',
      'Pilot triangle half-height',
      AIR_VALVE_32_DEFAULT_GEOMETRY.pilotHalfHeight,
      {
        min: 2,
        max: 25,
      },
    ),
    field('springSegLen', 'Spring segment length', AIR_VALVE_32_DEFAULT_GEOMETRY.springSegLen, {
      min: 5,
      max: 40,
    }),
    field('springZigW', 'Spring zigzag width', AIR_VALVE_32_DEFAULT_GEOMETRY.springZigW, {
      min: 2,
      max: 20,
    }),
    field('springZigH', 'Spring zigzag height', AIR_VALVE_32_DEFAULT_GEOMETRY.springZigH, {
      min: 2,
      max: 20,
    }),
  ],
  createDefaultGeometry: () => ({ ...AIR_VALVE_32_DEFAULT_GEOMETRY }),
  renderPreview(svg, geo) {
    const typed = geo as unknown as typeof AIR_VALVE_32_DEFAULT_GEOMETRY;
    const valve = buildSlidingValve32Body(svg, labUid());
    drawAirValve32Actuator(valve.mover, svg, typed);
    return slidingValveCanvasSize();
  },
};

const LIMIT_VALVE_32_ENTRY: SymbolLabEntry = {
  id: 'limitValve32',
  label: '3/2 limit valve (roller)',
  group: 'Directional valves',
  sourceFile: 'src/components/limitValve32.ts',
  exportName: 'LIMIT_VALVE_32_DEFAULT_GEOMETRY',
  fields: [
    field('rollerX', 'Roller group X', LIMIT_VALVE_32_DEFAULT_GEOMETRY.rollerX),
    field('rollerArmStartX', 'Roller arm start X', LIMIT_VALVE_32_DEFAULT_GEOMETRY.rollerArmStartX),
    field('rollerArmReach', 'Roller arm reach', LIMIT_VALVE_32_DEFAULT_GEOMETRY.rollerArmReach, {
      min: 5,
      max: 60,
    }),
    field('rollerArmHalfY', 'Roller arm half-Y', LIMIT_VALVE_32_DEFAULT_GEOMETRY.rollerArmHalfY, {
      min: 2,
      max: 20,
    }),
    field('rollerOuterR', 'Roller outer radius', LIMIT_VALVE_32_DEFAULT_GEOMETRY.rollerOuterR, {
      min: 4,
      max: 30,
    }),
    field('rollerInnerR', 'Roller inner radius', LIMIT_VALVE_32_DEFAULT_GEOMETRY.rollerInnerR, {
      min: 1,
      max: 20,
    }),
    field('rollerCenterX', 'Roller center X', LIMIT_VALVE_32_DEFAULT_GEOMETRY.rollerCenterX, {
      min: -10,
      max: 20,
    }),
    field('labelYOffset', 'Sensor label Y offset', LIMIT_VALVE_32_DEFAULT_GEOMETRY.labelYOffset, {
      min: -40,
      max: 0,
    }),
    field('springSegLen', 'Spring segment length', LIMIT_VALVE_32_DEFAULT_GEOMETRY.springSegLen, {
      min: 5,
      max: 40,
    }),
    field('springZigW', 'Spring zigzag width', LIMIT_VALVE_32_DEFAULT_GEOMETRY.springZigW, {
      min: 2,
      max: 20,
    }),
    field('springZigH', 'Spring zigzag height', LIMIT_VALVE_32_DEFAULT_GEOMETRY.springZigH, {
      min: 2,
      max: 20,
    }),
  ],
  createDefaultGeometry: () => ({ ...LIMIT_VALVE_32_DEFAULT_GEOMETRY }),
  renderPreview(svg, geo) {
    const typed = geo as unknown as typeof LIMIT_VALVE_32_DEFAULT_GEOMETRY;
    const valve = buildSlidingValve32Body(svg, labUid());
    drawLimitValve32Actuator(valve.mover, typed);
    return slidingValveCanvasSize();
  },
};

const TIME_DELAY_VALVE_ENTRY: SymbolLabEntry = {
  id: 'timeDelayValve',
  label: 'Time delay valve (clock)',
  group: 'Directional valves',
  sourceFile: 'src/components/timeDelayValve.ts',
  exportName: 'TIME_DELAY_VALVE_DEFAULT_GEOMETRY',
  fields: [
    field('pilotPortX', 'Pilot port X', TIME_DELAY_VALVE_DEFAULT_GEOMETRY.pilotPortX),
    field(
      'pilotLinkInnerX',
      'Pilot link inner X',
      TIME_DELAY_VALVE_DEFAULT_GEOMETRY.pilotLinkInnerX,
    ),
    field('clockX', 'Clock X', TIME_DELAY_VALVE_DEFAULT_GEOMETRY.clockX),
    field('clockR', 'Clock radius', TIME_DELAY_VALVE_DEFAULT_GEOMETRY.clockR, { min: 4, max: 25 }),
    field(
      'clockHourLen',
      'Clock hour hand length',
      TIME_DELAY_VALVE_DEFAULT_GEOMETRY.clockHourLen,
      {
        min: 2,
        max: 20,
      },
    ),
    field(
      'clockMinuteDx',
      'Clock minute hand dX',
      TIME_DELAY_VALVE_DEFAULT_GEOMETRY.clockMinuteDx,
      {
        min: -20,
        max: 20,
      },
    ),
    field(
      'clockMinuteDy',
      'Clock minute hand dY',
      TIME_DELAY_VALVE_DEFAULT_GEOMETRY.clockMinuteDy,
      {
        min: -20,
        max: 20,
      },
    ),
    field(
      'delayLabelYOffset',
      'Delay label Y offset',
      TIME_DELAY_VALVE_DEFAULT_GEOMETRY.delayLabelYOffset,
      { min: -40, max: 0 },
    ),
    field('springSegLen', 'Spring segment length', TIME_DELAY_VALVE_DEFAULT_GEOMETRY.springSegLen, {
      min: 5,
      max: 40,
    }),
    field('springZigW', 'Spring zigzag width', TIME_DELAY_VALVE_DEFAULT_GEOMETRY.springZigW, {
      min: 2,
      max: 20,
    }),
    field('springZigH', 'Spring zigzag height', TIME_DELAY_VALVE_DEFAULT_GEOMETRY.springZigH, {
      min: 2,
      max: 20,
    }),
  ],
  createDefaultGeometry: () => ({ ...TIME_DELAY_VALVE_DEFAULT_GEOMETRY }),
  renderPreview(svg, geo) {
    const typed = geo as unknown as typeof TIME_DELAY_VALVE_DEFAULT_GEOMETRY;
    const valve = buildSlidingValve32Body(svg, labUid());
    drawTimeDelayValveActuator(valve.mover, svg, typed);
    const size = slidingValveCanvasSize();
    const label = createSvgEl('text', {
      x: SLIDING_VALVE_32_DEFAULT_GEOMETRY.offsetX + SLIDING_VALVE_32_DEFAULT_GEOMETRY.bodyW / 2,
      y: SLIDING_VALVE_32_DEFAULT_GEOMETRY.offsetY + typed.delayLabelYOffset,
      'text-anchor': 'middle',
      'font-size': 11,
    });
    label.textContent = '1.0s';
    svg.appendChild(label);
    return size;
  },
};

const VALVE_52_ENTRY: SymbolLabEntry = {
  id: 'valve52',
  label: '5/2 valve, bistable',
  group: 'Directional valves',
  sourceFile: 'src/components/valve52.ts',
  exportName: 'VALVE_52_DEFAULT_GEOMETRY',
  fields: [
    field('w0', 'Cell width', VALVE_52_DEFAULT_GEOMETRY.w0),
    field('h0', 'Cell height', VALVE_52_DEFAULT_GEOMETRY.h0),
    field('gx0', 'Housing offset X', VALVE_52_DEFAULT_GEOMETRY.gx0),
    field('gy0', 'Housing offset Y', VALVE_52_DEFAULT_GEOMETRY.gy0),
    field('extraW', 'Extra canvas width', VALVE_52_DEFAULT_GEOMETRY.extraW),
    field('extraH', 'Extra canvas height', VALVE_52_DEFAULT_GEOMETRY.extraH),
    field('stroke', 'Stroke width', VALVE_52_DEFAULT_GEOMETRY.stroke, { min: 0.5, max: 6 }),
    field('font', 'Pilot label font size', VALVE_52_DEFAULT_GEOMETRY.font, { min: 6, max: 18 }),
    field('triHRatio', 'Pilot triangle height ratio', VALVE_52_DEFAULT_GEOMETRY.triHRatio, {
      min: 0.05,
      max: 0.6,
      step: 0.01,
    }),
    field('triWRatio', 'Pilot triangle width ratio', VALVE_52_DEFAULT_GEOMETRY.triWRatio, {
      min: 0.5,
      max: 3,
      step: 0.05,
    }),
    field('triGap', 'Pilot triangle gap', VALVE_52_DEFAULT_GEOMETRY.triGap, { min: 0, max: 25 }),
    field('pilotPortOffset', 'Pilot port offset', VALVE_52_DEFAULT_GEOMETRY.pilotPortOffset, {
      min: 0,
      max: 50,
    }),
    field('pilotLinkGap', 'Pilot link gap', VALVE_52_DEFAULT_GEOMETRY.pilotLinkGap, {
      min: 0,
      max: 40,
    }),
    field('cellArrowInset', 'Cell arrow inset', VALVE_52_DEFAULT_GEOMETRY.cellArrowInset, {
      min: 2,
      max: 30,
    }),
    field('fixedPortInset', 'Fixed port inset', VALVE_52_DEFAULT_GEOMETRY.fixedPortInset, {
      min: 2,
      max: 30,
    }),
    field('fixedPortLead', 'Fixed port lead', VALVE_52_DEFAULT_GEOMETRY.fixedPortLead, {
      min: 0,
      max: 30,
    }),
    field('tightLabelDx', 'Bottom-row label dX', VALVE_52_DEFAULT_GEOMETRY.tightLabelDx, {
      min: -25,
      max: 0,
    }),
    field('tightLabelDy', 'Bottom-row label dY', VALVE_52_DEFAULT_GEOMETRY.tightLabelDy, {
      min: -10,
      max: 15,
    }),
  ],
  createDefaultGeometry: () => ({ ...VALVE_52_DEFAULT_GEOMETRY }),
  renderPreview(svg, geo) {
    const typed = geo as unknown as typeof VALVE_52_DEFAULT_GEOMETRY;
    svg.style.overflow = 'visible';
    const { gInner } = drawValve52Body(svg, typed, labUid());
    // Default/resting state (state 1) is shifted one cell to the left of the housing offset -
    // matches createValve52's own applyState() so the lab preview shows the same picture the
    // real component defaults to.
    gInner.setAttribute('transform', `translate(${typed.gx0 - typed.w0},${typed.gy0})`);
    return { w: typed.w0 * 2 + typed.extraW, h: typed.h0 + typed.extraH };
  },
};

const VALVE_52_MONO_ENTRY: SymbolLabEntry = {
  id: 'valve52Mono',
  label: '5/2 valve, monostable',
  group: 'Directional valves',
  sourceFile: 'src/components/valve52Mono.ts',
  exportName: 'VALVE_52_MONO_DEFAULT_GEOMETRY',
  fields: [
    field('w0', 'Cell width', VALVE_52_MONO_DEFAULT_GEOMETRY.w0),
    field('h0', 'Cell height', VALVE_52_MONO_DEFAULT_GEOMETRY.h0),
    field('gx0', 'Housing offset X', VALVE_52_MONO_DEFAULT_GEOMETRY.gx0),
    field('gy0', 'Housing offset Y', VALVE_52_MONO_DEFAULT_GEOMETRY.gy0),
    field('extraW', 'Extra canvas width', VALVE_52_MONO_DEFAULT_GEOMETRY.extraW),
    field('extraH', 'Extra canvas height', VALVE_52_MONO_DEFAULT_GEOMETRY.extraH),
    field('stroke', 'Stroke width', VALVE_52_MONO_DEFAULT_GEOMETRY.stroke, { min: 0.5, max: 6 }),
    field('font', 'Pilot label font size', VALVE_52_MONO_DEFAULT_GEOMETRY.font, {
      min: 6,
      max: 18,
    }),
    field('triHRatio', 'Pilot triangle height ratio', VALVE_52_MONO_DEFAULT_GEOMETRY.triHRatio, {
      min: 0.05,
      max: 0.6,
      step: 0.01,
    }),
    field('triWRatio', 'Pilot triangle width ratio', VALVE_52_MONO_DEFAULT_GEOMETRY.triWRatio, {
      min: 0.5,
      max: 3,
      step: 0.05,
    }),
    field('triGap', 'Pilot triangle gap', VALVE_52_MONO_DEFAULT_GEOMETRY.triGap, {
      min: 0,
      max: 25,
    }),
    field('pilotPortOffset', 'Pilot port offset', VALVE_52_MONO_DEFAULT_GEOMETRY.pilotPortOffset, {
      min: 0,
      max: 50,
    }),
    field('pilotLinkGap', 'Pilot link gap', VALVE_52_MONO_DEFAULT_GEOMETRY.pilotLinkGap, {
      min: 0,
      max: 40,
    }),
    field('cellArrowInset', 'Cell arrow inset', VALVE_52_MONO_DEFAULT_GEOMETRY.cellArrowInset, {
      min: 2,
      max: 30,
    }),
    field('fixedPortInset', 'Fixed port inset', VALVE_52_MONO_DEFAULT_GEOMETRY.fixedPortInset, {
      min: 2,
      max: 30,
    }),
    field('fixedPortLead', 'Fixed port lead', VALVE_52_MONO_DEFAULT_GEOMETRY.fixedPortLead, {
      min: 0,
      max: 30,
    }),
    field('tightLabelDx', 'Bottom-row label dX', VALVE_52_MONO_DEFAULT_GEOMETRY.tightLabelDx, {
      min: -25,
      max: 0,
    }),
    field('tightLabelDy', 'Bottom-row label dY', VALVE_52_MONO_DEFAULT_GEOMETRY.tightLabelDy, {
      min: -10,
      max: 15,
    }),
    field('springSegLen', 'Spring segment length', VALVE_52_MONO_DEFAULT_GEOMETRY.springSegLen, {
      min: 5,
      max: 40,
    }),
    field('springZigW', 'Spring zigzag width', VALVE_52_MONO_DEFAULT_GEOMETRY.springZigW, {
      min: 2,
      max: 20,
    }),
    field('springZigH', 'Spring zigzag height', VALVE_52_MONO_DEFAULT_GEOMETRY.springZigH, {
      min: 2,
      max: 20,
    }),
  ],
  createDefaultGeometry: () => ({ ...VALVE_52_MONO_DEFAULT_GEOMETRY }),
  renderPreview(svg, geo) {
    const typed = geo as unknown as typeof VALVE_52_MONO_DEFAULT_GEOMETRY;
    svg.style.overflow = 'visible';
    const { gInner } = drawValve52MonoBody(svg, typed, labUid());
    gInner.setAttribute('transform', `translate(${typed.gx0 - typed.w0},${typed.gy0})`);
    return { w: typed.w0 * 2 + typed.extraW, h: typed.h0 + typed.extraH };
  },
};

export const SYMBOL_LAB_ENTRIES: SymbolLabEntry[] = [
  JUNCTION_ENTRY,
  SOURCE_ENTRY,
  RESTRICTOR_ENTRY,
  CHECK_VALVE_ENTRY,
  ONE_WAY_FLOW_CONTROL_VALVE_ENTRY,
  QUICK_EXHAUST_VALVE_ENTRY,
  AND_VALVE_ENTRY,
  OR_VALVE_ENTRY,
  CYLINDER_DOUBLE_ENTRY,
  CYLINDER_SINGLE_ENTRY,
  SLIDING_VALVE_32_ENTRY,
  PUSH_BUTTON_32_ENTRY,
  AIR_VALVE_32_ENTRY,
  LIMIT_VALVE_32_ENTRY,
  TIME_DELAY_VALVE_ENTRY,
  VALVE_52_ENTRY,
  VALVE_52_MONO_ENTRY,
];
