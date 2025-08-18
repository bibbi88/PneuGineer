# PneuGineer

PneuGineer is a light pneumatic simulation program aimed solely for educational purposes. The program has basic fundtionalities. Future development might add more components, but the aim is only to focus on flow logic, not flow calculations.

## What's new

- Single-acting cylinder (new): instances now support a per-component "mode" (push / pull).
	- Push: the A port acts to push the piston (A port at the cap end by default). Normally retracted unless configured otherwise.
	- Pull: the A port is moved to the rod end and the cylinder defaults to *normally extended* (unless the component was explicitly created with a different default).
	- Toggle mode: click the small mode button on the cylinder's label to switch between push and pull for that instance.
	- Persistence: `mode` and `normallyExtended` are saved with the project snapshot and restored on load.

## Quick usage

- Start the app (serve the project folder and open `index.html` in your browser) or use the combined "PneuGineer.html" that contains all code.
- Use the sidebar button "Cylinder, single-acting" (appears after the double-acting cylinder) to add a single-acting cylinder.
- After placing a cylinder, use the small mode toggle in the component label to switch between push/pull.
- Connect the A port to a pressure source or valve. In PLAY mode:
	- push mode: pressurising A extends the piston.
	- pull mode: pressurising A retracts the piston (because the port is on the rod end and the cylinder defaults extended).


<img width="1507" height="1002" alt="image" src="https://github.com/user-attachments/assets/e59247aa-6774-47e9-a5eb-f89f790a704f" />


AI has been used largely during development.
