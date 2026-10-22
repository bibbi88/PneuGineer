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

2. **Lines as volumes – a flow network** (`src/sim/flowNetwork.ts`): nets of wired ports are
   volumes (tubing + fittings) with their own pressure; sources and open ports are fixed nodes;
   component paths are ISO 6358 restrictions (throttles scale them, check valves are one-way,
   reducing valves close at their setting); cylinders exchange air with their nets
   (`Component.flowDevice`). Valve switching still comes from the logic graph, but
   `ctx.pressureAt()` and the wire labels/colours read real pressures - so a pressure sequence
   valve on a **meter-in** line switches at the end of stroke (with meter-out, or no throttle, the
   driving line is near supply pressure the whole stroke, as in a real circuit).

3. **Single-acting cylinder**: one air chamber (cap end in push mode, rod end in pull mode)
   and a return spring (6 % of the air force at 6 bar at rest, 14 % fully compressed); the
   spring side is vented. Same stroke/mass/load settings.

## Next steps, in order

4. **Pilots switch on real pressure** (a minimum pilot pressure, e.g. 1.5 bar), and the time
   delay valve's reservoir fills through its throttle instead of using a timer.
5. **Per-component flow ratings** (C values, optionally editable) and **air consumption** /
   flow (l/min) readouts.
