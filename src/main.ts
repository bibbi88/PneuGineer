import './ui/styles/app.css';
import { initViewport } from './ui/viewport';
import { renderSidebarButtons } from './ui/sidebar';
import { renderToolbar } from './ui/toolbar';
import { placeableComponentTypes, type ComponentFactoryContext } from './components/registry';
import { initLinking } from './interaction/linking';
import { initMarquee } from './interaction/marquee';
import { initKeyboard } from './interaction/keyboard';
import { initWireSplitting } from './interaction/wireSplitting';
import { spawnComponent } from './interaction/spawn';
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

const workspaceQuery = document.querySelector<HTMLElement>('.workspace');
const viewportQuery = document.getElementById('viewport');
const compLayerQuery = document.getElementById('compLayer');
const connLayerQuery = document.getElementById('connLayer') as SVGSVGElement | null;
const sidebarButtonsQuery = document.getElementById('sidebarButtons');
const toolbarButtonsQuery = document.getElementById('toolbarButtons');
const projectBarQuery = document.getElementById('projectBar');
const inspectorQuery = document.getElementById('inspector');

if (
  !workspaceQuery ||
  !viewportQuery ||
  !compLayerQuery ||
  !connLayerQuery ||
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
const sidebarButtons: HTMLElement = sidebarButtonsQuery;
const toolbarButtons: HTMLElement = toolbarButtonsQuery;
const projectBarEl: HTMLElement = projectBarQuery;
const inspectorEl: HTMLElement = inspectorQuery;

const viewport = initViewport(viewportQuery, workspaceEl);
initWires(connLayer, viewport, workspaceEl);
initWireHandles(connLayer, viewport, workspaceEl);
initLinking(connLayer, viewport, workspaceEl);
initMarquee(connLayer);
initKeyboard();
initWireSplitting(compLayer, viewport);

const factoryCtx: ComponentFactoryContext = { compLayer };
initHistory(factoryCtx, viewport);

function addComponentAtViewCenter(type: string): void {
  const rect = workspaceEl.getBoundingClientRect();
  const world = viewport.clientToWorld(rect.left + rect.width / 2, rect.top + rect.height / 2);
  spawnComponent(type, factoryCtx, viewport, world.x, world.y);
}

renderSidebarButtons(
  sidebarButtons,
  placeableComponentTypes().map(({ type, label }) => ({
    id: `add-${type}`,
    label,
    onClick: () => addComponentAtViewCenter(type),
  })),
);

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
