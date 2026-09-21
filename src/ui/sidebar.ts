import { renderComponentIcon } from '../components/iconPreview';

/** Drag payload MIME type carrying a component type from a library tile to the canvas - read by
 * the workspace's drop handler set up in main.ts. */
export const COMPONENT_DRAG_MIME = 'application/x-pneugineer-component';

// dataTransfer.getData() only actually returns its payload on the 'drop' event itself - browsers
// withhold it during 'dragover'/'dragenter' (so a page can't snoop a cross-origin drag's contents
// before the user commits to dropping there). main.ts's dragover handler needs to know which
// component type is being dragged well before that, to preview whether it'd splice onto a wire -
// so the type is tracked here instead, in a plain module variable set/cleared alongside the same
// dragstart/dragend that already exists on each tile.
let draggedType: string | null = null;

export function getDraggedComponentType(): string | null {
  return draggedType;
}

export interface SidebarItemSpec {
  type: string;
  label: string;
  onClick: () => void;
}

export interface SidebarGroupSpec {
  category: string;
  items: SidebarItemSpec[];
}

/** The two categories reached for most while wiring up a circuit - expanded by default so they
 * don't cost an extra click on every session; the rest start collapsed. */
const OPEN_BY_DEFAULT = new Set(['Directional valves', 'Logic']);

export function renderComponentLibrary(container: HTMLElement, groups: SidebarGroupSpec[]): void {
  const filterInput = document.createElement('input');
  filterInput.type = 'search';
  filterInput.className = 'libFilter';
  filterInput.placeholder = 'Filter components…';
  filterInput.setAttribute('aria-label', 'Filter components');
  container.appendChild(filterInput);

  const groupEntries: Array<{
    details: HTMLDetailsElement;
    openByDefault: boolean;
    tiles: Array<{ el: HTMLButtonElement; label: string }>;
  }> = [];

  for (const group of groups) {
    const details = document.createElement('details');
    details.className = 'libCategory';
    const openByDefault = OPEN_BY_DEFAULT.has(group.category);
    details.open = openByDefault;

    const summary = document.createElement('summary');
    const name = document.createElement('span');
    name.className = 'libCategoryName';
    name.textContent = group.category;
    const count = document.createElement('span');
    count.className = 'libCategoryCount';
    count.textContent = String(group.items.length);
    summary.append(name, count);
    details.appendChild(summary);

    const grid = document.createElement('div');
    grid.className = group.items.length === 1 ? 'libGrid libGrid--single' : 'libGrid';

    const tiles: Array<{ el: HTMLButtonElement; label: string }> = [];
    for (const item of group.items) {
      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'libTile';
      tile.id = `add-${item.type}`;
      tile.title = item.label;
      tile.appendChild(renderComponentIcon(item.type));

      const label = document.createElement('span');
      label.className = 'libTileLabel';
      label.textContent = item.label;
      tile.appendChild(label);

      // Click still places at the view center (fast, no aiming needed); dragging onto the
      // canvas places it exactly where dropped - both go through the same onClick/spawn path,
      // just with the drop's world position substituted for the view-center one.
      tile.addEventListener('click', item.onClick);
      tile.draggable = true;
      tile.addEventListener('dragstart', (e) => {
        e.dataTransfer?.setData(COMPONENT_DRAG_MIME, item.type);
        if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copy';
        tile.classList.add('dragging');
        draggedType = item.type;
      });
      tile.addEventListener('dragend', () => {
        tile.classList.remove('dragging');
        draggedType = null;
      });
      grid.appendChild(tile);
      tiles.push({ el: tile, label: item.label });
    }

    details.appendChild(grid);
    container.appendChild(details);
    groupEntries.push({ details, openByDefault, tiles });
  }

  filterInput.addEventListener('input', () => {
    const query = filterInput.value.trim().toLowerCase();
    for (const group of groupEntries) {
      let anyMatch = false;
      for (const tile of group.tiles) {
        const match = query === '' || tile.label.toLowerCase().includes(query);
        tile.el.hidden = !match;
        anyMatch = anyMatch || match;
      }
      group.details.hidden = !anyMatch;
      group.details.open = query === '' ? group.openByDefault : anyMatch;
    }
  });
}
