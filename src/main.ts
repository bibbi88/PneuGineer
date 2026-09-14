import './ui/styles/app.css';
import { initViewport } from './ui/viewport';
import { renderComponentLibrary, COMPONENT_DRAG_MIME } from './ui/sidebar';
import { renderToolbar } from './ui/toolbar';
import { placeableComponentsByCategory, type ComponentFactoryContext } from './components/registry';
import { initLinking } from './interaction/linking';
import { initMarquee } from './interaction/marquee';
import { initKeyboard } from './interaction/keyboard';
import { initWireSplitting } from './interaction/wireSplitting';
import { spawnComponent } from './interaction/spawn';
import { initValveActuatorSwap } from './interaction/valveActuatorSwap';
import { initClipboard } from './interaction/clipboard';
import { initWires } from './wires/connection';
import { initWireHandles } from './wires/handles';
import { startSimLoop } from './sim/loop';
import { appState } from './app/AppState';
import { renderProjectBar } from './ui/projectBar';
import { showRestoreBanner } from './ui/restoreBanner';
import { scheduleAutosave, readAutosave, clearAutosave } from './persistence/autosave';
import { loadProject } from './persistence/project';
import { initHistory, pushHistory, resetHistory } from './history/historyStore';
import { renderInspector } from './ui/inspector';
import { resetCylinderLetters } from './components/shared/letters';

const workspaceQuery = document.querySelector<HTMLElement>('.workspace');
const viewportQuery = document.getElementById('viewport');
const compLayerQuery = document.getElementById('compLayer');
const connLayerQuery = document.getElementById('connLayer') as SVGSVGElement | null;
const handleLayerQuery = document.getElementById('handleLayer') as SVGSVGElement | null;
const sidebarButtonsQuery = document.getElementById('sidebarButtons');
const toolbarButtonsQuery = document.getElementById('toolbarButtons');
const projectBarQuery = document.getElementById('projectBar');
const inspectorQuery = document.getElementById('inspector');

if (
  !workspaceQuery ||
  !viewportQuery ||
  !compLayerQuery ||
  !connLayerQuery ||
  !handleLayerQuery ||
  !sidebarButtonsQuery ||
  !toolbarButtonsQuery ||
  !projectBarQuery ||
  !inspectorQuery
) {
  throw new Error('Missing required DOM scaffold elements');
}

const workspaceEl: HTMLElement = workspaceQuery;
const compLayer: HTMLElement = compLayerQuery;
const connLayer: SVGSVGElement = connLayerQuery;
const handleLayer: SVGSVGElement = handleLayerQuery;
const sidebarButtons: HTMLElement = sidebarButtonsQuery;
const toolbarButtons: HTMLElement = toolbarButtonsQuery;
const projectBarEl: HTMLElement = projectBarQuery;
const inspectorEl: HTMLElement = inspectorQuery;

const viewport = initViewport(viewportQuery, workspaceEl);
initWires(connLayer, viewport, workspaceEl);
initWireHandles(handleLayer, viewport, workspaceEl);
initLinking(connLayer, viewport, workspaceEl);
initMarquee(connLayer);
initKeyboard();
initWireSplitting(compLayer, viewport, workspaceEl);

const factoryCtx: ComponentFactoryContext = { compLayer };
initHistory(factoryCtx, viewport);
initValveActuatorSwap(factoryCtx, viewport);
initClipboard(factoryCtx, viewport, workspaceEl);

function addComponentAtViewCenter(type: string): void {
  const rect = workspaceEl.getBoundingClientRect();
  const world = viewport.clientToWorld(rect.left + rect.width / 2, rect.top + rect.height / 2);
  spawnComponent(type, factoryCtx, viewport, world.x, world.y);
}

// Dragging a library tile onto the canvas places it exactly where it's dropped, rather than
// always at the view center like a click does.
workspaceEl.addEventListener('dragover', (e) => {
  if (!e.dataTransfer?.types.includes(COMPONENT_DRAG_MIME)) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
});
workspaceEl.addEventListener('drop', (e) => {
  const type = e.dataTransfer?.getData(COMPONENT_DRAG_MIME);
  if (!type) return;
  e.preventDefault();
  const world = viewport.clientToWorld(e.clientX, e.clientY);
  spawnComponent(type, factoryCtx, viewport, world.x, world.y);
});

renderComponentLibrary(
  sidebarButtons,
  placeableComponentsByCategory().map((group) => ({
    category: group.category,
    items: group.items.map(({ type, label }) => ({
      type,
      label,
      onClick: () => addComponentAtViewCenter(type),
    })),
  })),
);
// Building each cylinder's sidebar icon just spawned a real (throwaway) instance of it, which
// consumed letters from the same counter real placement uses - reset it so the first cylinder
// the user actually places still starts at "A".
resetCylinderLetters();

renderToolbar(toolbarButtons);
const projectBar = renderProjectBar(projectBarEl, factoryCtx, viewport, connLayer);
renderInspector(inspectorEl);
startSimLoop();

appState.onChange(() => {
  const name = projectBar.getName();
  scheduleAutosave(name);
  pushHistory(name);
});

const autosaved = readAutosave();
if (autosaved) {
  showRestoreBanner(
    () => {
      resetHistory();
      loadProject(autosaved.file, factoryCtx, viewport);
      projectBar.setName(autosaved.file.name);
    },
    () => clearAutosave(),
  );
}
