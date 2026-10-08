# PneuGineer

A browser-based pneumatic circuit editor and simulator. Drag components — valves, cylinders,
pressure sources, sensors — onto a canvas, wire their ports together, and run a play/pause/step
simulation with a live pressure overlay.

**▶ Try it in your browser: [bibbi88.github.io/PneuGineer](https://bibbi88.github.io/PneuGineer/)**

This is an educational project focused on flow _logic_, not flow _calculations_ — pressure is
modeled as a simple pressurized/not-pressurized graph, not real fluid dynamics.

## Components

- Pressure source, 5/2 valve, AND / OR valve, check valve, throttle valve
- 3/2 limit valve, 3/2 push button, 3/2 air-piloted valve
- Double-acting and single-acting (push/pull) cylinders
- Time delay valve, quick-exhaust valve, one-way flow control valve

## Usage

- Drag a component from the sidebar onto the canvas.
- Click a port, then click another port to wire them together. Click a wire while linking to
  split it into a junction. Double-click a wire to drag its bend.
- Use Play / Pause / Step / Stop to run the simulation, and Undo / Redo to step through edits.
- Save / Load a project as JSON, or export the circuit as an SVG or PNG. Work is autosaved
  locally and offered back if you return to an unsaved session.

## Development

```bash
npm install
npm run dev      # start the dev server
npm run test     # run the unit test suite
npm run build    # type-check and produce a production build
npm run lint     # eslint + prettier check
```
