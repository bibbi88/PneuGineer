import type { FileActions } from './fileActions';
import { iconButton, setIconButtonLabel } from './iconButton';
import { attachDropdown, menuArrowButton } from './dropdownMenu';
import { activeDocumentId, listDocuments, onDocumentsChange } from '../app/documents';
import { canWriteBack, fileHandles, onFileHandlesChange } from '../app/fileHandles';

/** The active document's file name, if it has a file. */
function activeFileName(): string | null {
  return fileHandles.get(activeDocumentId())?.name ?? null;
}

/**
 * The toolbar's Save: one button, and a small arrow beside it opening a menu with Save, Save as…
 * (and Save all, with several documents open) - see fileActions.ts for what each does. The menu
 * itself is ui/dropdownMenu.ts, shared with Open's.
 *
 * Where a save can write back to a file (Chrome, Edge, the desktop app) the button reads
 * "Save as" until the active document has a file, then "Save", its tooltip naming the file;
 * where it can't (Firefox, Safari, a sandboxed frame) it's always "Save".
 */
export function createSaveButton(files: FileActions): HTMLElement {
  const wrap = document.createElement('span');
  wrap.className = 'splitButton saveControl';

  const main = iconButton('save', 'Save', () => void files.save());
  const arrow = menuArrowButton('More ways to save');
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
    setIconButtonLabel(main, tip, label);
    main.setAttribute('aria-label', label);
    main.dataset.label = label;
  }
  refreshLabel();
  onFileHandlesChange(refreshLabel);
  onDocumentsChange(refreshLabel);

  attachDropdown(wrap, arrow, 'Save', (b) => {
    const name = activeFileName();
    const nodes: Node[] = [
      b.row({
        icon: 'save',
        title: 'Save',
        hint: !canWriteBack()
          ? 'Download the file'
          : name
            ? `Write the changes to ${name}`
            : 'Pick where, then later saves go there',
        keys: ['Ctrl', 'S'],
        run: () => void files.save(),
      }),
      b.row({
        icon: 'saveAs',
        title: 'Save as…',
        hint: 'A new file, in a new place or under a new name',
        keys: ['Ctrl', 'Shift', 'S'],
        run: () => void files.saveAs(),
      }),
    ];
    const count = listDocuments().length;
    if (count > 1) {
      nodes.push(
        b.row({
          icon: 'saveAll',
          title: `Save all (${count})`,
          hint: 'Every open circuit, each to its own file',
          run: () => void files.saveAll(),
        }),
      );
    }
    if (name) {
      const bold = document.createElement('b');
      bold.textContent = name;
      nodes.push(b.footer(['Saved to ', bold]));
    } else nodes.push(b.footer(['Not saved to a file yet']));
    return nodes;
  });

  return wrap;
}
