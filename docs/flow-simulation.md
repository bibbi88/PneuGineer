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

4. **Pilots on real pressure**: in flow mode a port flagged `isPilot` actuates only at 1.5 bar
   or more in its line (`PILOT_MIN_BAR`, engine.ts) - in the logic graph, the components' step()
   and the network's own paths alike. **Time delay valves** time with a 20 cm³ reservoir behind
   the one-way flow control instead of a timer, switching at 3 bar; the throttle is calibrated so
   the set delay holds at 6 bar supply (a lower supply takes longer).

5. **Air consumption**: each source shows the air drawn from it in l/min (ANR), smoothed over
   0.15 s. Near equilibrium the ISO 6358 curve is linearised over the last 2 % of pressure ratio
   and a path never moves more air in one step than would level its two sides - otherwise lines
   overshoot and sit oscillating above supply pressure.

## Next steps, in order

6. **Per-component flow ratings** (C values, optionally editable in the inspector) instead of
   one default for every valve path.
7. Flow-mode readouts on more components (flow through a throttle, l/min on a valve path).
