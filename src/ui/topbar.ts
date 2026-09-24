import type { ComponentFactoryContext } from '../components/registry';
import type { ViewportAdapter } from './viewport';
import { renderProjectBar, type ProjectBarRefs } from './projectBar';
import { renderToolbar } from './toolbar';
import { renderViewControls } from './viewControls';
import { renderArrangeControls } from './arrangeControls';

/** Builds the application toolbar across the top of the window, grouped so related controls sit
 * together with a divider between groups: the project (name, save, load, export), the
 * simulation and its history (play/stop, pause, step, undo, redo), the view (zoom, fit to
 * window, zoom to selection) and arranging the selection (rotate, flip).
 *
 * Returns the project refs, since the project name field lives in the first section and both
 * the inspector and the page frame's title block read it from there.
 */
export function renderTopbar(
  container: HTMLElement,
  ctx: ComponentFactoryContext,
  viewport: ViewportAdapter,
  connLayer: SVGSVGElement,
  frameLayer: SVGSVGElement,
  workspaceEl: HTMLElement,
): ProjectBarRefs {
  container.replaceChildren();

  function section(label: string): HTMLElement {
    const el = document.createElement('div');
    el.className = 'topbarSection';
    // Grouping alone is only visible, so the group is also named for screen readers.
    el.setAttribute('role', 'group');
    el.setAttribute('aria-label', label);
    container.appendChild(el);
    return el;
  }

  const projectRefs = renderProjectBar(
    section('Project'),
    ctx,
    viewport,
    connLayer,
    frameLayer,
    workspaceEl,
  );
  renderToolbar(section('Simulation'));
  renderViewControls(section('View'), viewport, workspaceEl);
  renderArrangeControls(section('Arrange'));

  return projectRefs;
}
