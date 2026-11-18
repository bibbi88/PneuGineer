import type { FileActions } from './fileActions';
import { createIcon, type IconName } from './icons';
import { iconButton } from './iconButton';
import { activeDocumentId, listDocuments, onDocumentsChange } from '../app/documents';
import { canWriteBack, fileHandles, onFileHandlesChange } from '../app/fileHandles';

interface Row {
  icon: IconName;
  title: string;
  hint: string;
  keys: string[];
  run: () => void;
}

/** The active document's file name, if it has a file. */
function activeFileName(): string | null {
  return fileHandles.get(activeDocumentId())?.name ?? null;
}

/**
 * The toolbar's Save: one button, and a small arrow beside it opening a menu with Save, Save as…
 * (and Save all, with several documents open) - see fileActions.ts for what each does.
 *
 * Where a save can write back to a file (Chrome, Edge, the desktop app) the button reads
 * "Save as" until the active document has a file, then "Save", its tooltip naming the file;
 * where it can't (Firefox, Safari, a sandboxed frame) it's always "Save".
 */
export function createSaveButton(files: FileActions): HTMLElement {
  const wrap = document.createElement('span');
  wrap.className = 'splitButton';

  const main = iconButton('save', 'Save', () => void files.save());
  const arrow = iconButton('chevronDown', 'More ways to save', () => {});
  arrow.classList.add('iconBtn--menuArrow');
  arrow.setAttribute('aria-haspopup', 'true');
  arrow.setAttribute('aria-expanded', 'false');
  wrap.append(main, arrow);

  function refreshLabel(): void {
    const name = activeFileName();
    let label: string;
    let tip: string;
    if (!canWriteBack()) {
      label = 'Save';
      tip = 'Save (Ctrl+S) - downloads the file';
    } else if (name) {
      label = 'Save';
      tip = `Save to ${name} (Ctrl+S)`;
    } else {
      label = 'Save as';
      tip = 'Save as… (Ctrl+S) - pick where, then later saves go there';
    }
    main.setAttribute('aria-label', label);
    main.title = tip;
    main.dataset.label = label;
  }
  refreshLabel();
  onFileHandlesChange(refreshLabel);
  onDocumentsChange(refreshLabel);

  // --- the menu ---------------------------------------------------------------------------
  let menu: HTMLElement | null = null;

  function rows(): Row[] {
    const name = activeFileName();
    const writable = canWriteBack();
    const list: Row[] = [
      {
        icon: 'save',
        title: 'Save',
        hint: !writable
          ? 'Download the file'
          : name
            ? `Write the changes to ${name}`
            : 'Pick where, then later saves go there',
        keys: ['Ctrl', 'S'],
        run: () => void files.save(),
      },
      {
        icon: 'saveAs',
        title: 'Save as…',
        hint: 'A new file, in a new place or under a new name',
        keys: ['Ctrl', 'Shift', 'S'],
        run: () => void files.saveAs(),
      },
    ];
    const count = listDocuments().length;
    if (count > 1) {
      list.push({
        icon: 'saveAll',
        title: `Save all (${count})`,
        hint: 'Every open circuit, each to its own file',
        keys: [],
        run: () => void files.saveAll(),
      });
    }
    return list;
  }

  function close(focusArrow = false): void {
    if (!menu) return;
    menu.remove();
    menu = null;
    arrow.setAttribute('aria-expanded', 'false');
    document.removeEventListener('mousedown', onOutside, true);
    window.removeEventListener('resize', onResize);
    if (focusArrow) arrow.focus();
  }

  function onOutside(e: MouseEvent): void {
    if (menu && !menu.contains(e.target as Node) && !arrow.contains(e.target as Node)) close();
  }
  function onResize(): void {
    close();
  }

  function items(): HTMLElement[] {
    return menu ? Array.from(menu.querySelectorAll<HTMLElement>('[role="menuitem"]')) : [];
  }

  function open(fromKeyboard: boolean): void {
    if (menu) {
      close();
      return;
    }
    const el = document.createElement('div');
    el.className = 'saveMenu';
    el.setAttribute('role', 'menu');
    el.setAttribute('aria-label', 'Save');
    // Keeps focus where it is (the canvas) on a mouse press inside the menu.
    el.addEventListener('mousedown', (e) => e.preventDefault());

    for (const row of rows()) {
      const item = document.createElement('div');
      item.className = 'saveMenuItem';
      item.setAttribute('role', 'menuitem');
      item.tabIndex = -1;
      const tile = document.createElement('span');
      tile.className = 'saveMenuIcon';
      tile.appendChild(createIcon(row.icon));
      const text = document.createElement('span');
      text.className = 'saveMenuText';
      const title = document.createElement('b');
      title.textContent = row.title;
      const hint = document.createElement('small');
      hint.textContent = row.hint;
      text.append(title, hint);
      const keys = document.createElement('span');
      keys.className = 'saveMenuKeys';
      for (const k of row.keys) {
        const kbd = document.createElement('kbd');
        kbd.textContent = k;
        keys.appendChild(kbd);
      }
      item.append(tile, text, keys);
      item.addEventListener('click', () => {
        close();
        row.run();
      });
      el.appendChild(item);
    }

    const footer = document.createElement('div');
    footer.className = 'saveMenuFooter';
    footer.appendChild(createIcon('document'));
    const where = document.createElement('span');
    const name = activeFileName();
    if (name) {
      const b = document.createElement('b');
      b.textContent = name;
      where.append('Saved to ', b);
    } else {
      where.textContent = 'Not saved to a file yet';
    }
    footer.appendChild(where);
    el.appendChild(footer);

    el.addEventListener('keydown', (e) => {
      const all = items();
      const at = all.indexOf(document.activeElement as HTMLElement);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const step = e.key === 'ArrowDown' ? 1 : -1;
        all[(at + step + all.length) % all.length]?.focus();
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        (document.activeElement as HTMLElement | null)?.click();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        close(true);
      } else if (e.key === 'Tab') {
        close();
      }
    });

    document.body.appendChild(el);
    const r = arrow.getBoundingClientRect();
    const left = Math.max(8, Math.min(r.left - 24, window.innerWidth - el.offsetWidth - 8));
    el.style.left = `${left}px`;
    el.style.top = `${r.bottom + 6}px`;
    menu = el;
    arrow.setAttribute('aria-expanded', 'true');
    document.addEventListener('mousedown', onOutside, true);
    window.addEventListener('resize', onResize);
    // Opened from the keyboard: straight into the first row.
    if (fromKeyboard) items()[0]?.focus();
  }

  // The arrow keeps focus where it is on a mouse press; a click (detail 0: from the keyboard)
  // opens the menu.
  arrow.addEventListener('mousedown', (e) => e.preventDefault());
  arrow.addEventListener('click', (e) => open(e.detail === 0));
  arrow.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' && !menu) {
      e.preventDefault();
      open(true);
    }
  });

  return wrap;
}
