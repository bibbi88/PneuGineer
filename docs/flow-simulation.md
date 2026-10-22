# Flow simulation – plan and status

Work branch: `flow-calculations`. Goal: realistic behaviour **for teaching** (believable
speeds, pressures that build up and fall, throttles and loads that matter), not data-sheet
accuracy. The original **logic mode stays** and is the default; the toolbar's Logic | Flow
switch picks the model, and the choice is saved with the project (`simulation.mode`).

## Done

1. **Double-acting cylinder** (`src/sim/flowModel.ts`, `cylinderDouble.ts`): chamber pressures
   and volumes, ISO 6358 flow (sonic conductance C, critical ratio b), piston force balance with
   friction, damping, load and end stops. Stroke, moving mass and load force in the inspector.
   Live chamber pressures beside ports A/B.

## Next steps, in order

2. **Lines as volumes – a flow network** (`src/sim/flowNetwork.ts`):
   - _Nodes_ are nets: ports joined by wires/junctions. Each has a volume (wire length × 4 mm
     tube bore, plus a little per fitting) and a pressure that persists between frames.
   - _Fixed nodes_: a source's net (supply pressure) and atmosphere (any unwired port that a
     component path leads to - an open exhaust).
   - _Edges_ are the component paths the logic graph already knows (`conductivityRule`), each a
     restriction with C = a per-component default × `flowMultiplier` (throttles). Directed
     paths (check valves) only pass flow one way. A pressure reducing valve passes flow only
     while its outlet is below the set pressure.
   - _Devices_ (cylinders) exchange air with the net at their port through a fitting, stepping
     their own chamber/piston state each substep.
   - Valve switching still comes from the logic graph; `ctx.pressureAt()` returns the net's real
     pressure in flow mode, so the pressure sequence valve sees end-of-stroke pressure rise.
   - Wire labels/colours show the real net pressures.
3. **Single-acting cylinder** in flow mode (one chamber + spring).
4. **Pilots switch on real pressure** (a minimum pilot pressure, e.g. 1.5 bar), and the time
   delay valve's reservoir fills through its throttle instead of using a timer.
5. **Per-component flow ratings** (C values, optionally editable) and **air consumption** /
   flow (l/min) readouts.
