interface TipSection {
  heading: string;
  tips: string[];
}

// Everything a hint or comment elsewhere in the UI already says, gathered into one place - plus
// the keyboard/mouse interactions (viewport.ts's pan/zoom, interaction/keyboard.ts's shortcuts,
// componentContextMenu.ts's right-click menu) that aren't shown anywhere in the app itself.
const TIP_SECTIONS: TipSection[] = [
  {
    heading: 'Canvas navigation',
    tips: [
      'Scroll to zoom in/out.',
      'Middle-click drag (or Alt + right-click drag) to pan.',
      'Right-click empty canvas → Zoom to fit, to frame every component on screen.',
      'Right-click empty canvas → Paste, to drop a copy exactly where you clicked.',
    ],
  },
  {
    heading: 'Placing & editing',
    tips: [
      'Drag a component from the sidebar onto the canvas, or click it to add at the view center.',
      'Drag a check valve, throttle valve, one-way flow control valve, or quick exhaust valve onto an existing wire ' +
        '(it highlights green when close enough) to splice it in, instead of dropping it ' +
        'unconnected on top.',
      'Right-click a component for Rotate, Copy, and Delete.',
      'Arrow keys nudge the selected component; hold Shift to move a full grid step further.',
      'Delete or Backspace removes the current selection.',
      'Ctrl+C / Ctrl+V copies and pastes the selection.',
      'Ctrl+Z undoes, Ctrl+R redoes.',
      'Escape cancels a wire you’re in the middle of drawing, or clears the current selection ' +
        'if nothing is being drawn.',
    ],
  },
  {
    heading: 'Electro-pneumatics',
    tips: [
      'The Electrical group holds a +24 V and a 0 V supply, contacts, a push button, coils and ' +
        'a lamp. Electrical terminals (dark blue) only connect to other electrical terminals.',
      'A coil publishes its name (e.g. Y1, K1) while energized. A solenoid valve with the same ' +
        'name shifts, and a contact whose "Signal" is that name (a relay contact) closes.',
      'Set a contact’s Signal to a cylinder sensor label (e.g. A1) to use it as a position sensor.',
      'The PLC has inputs I0.0-I0.3 (true while wired to +24 V), outputs Q0.0-Q0.3 (drive their ' +
        'terminal to +24 V when true) and L+/M supply terminals. Write its logic in the ' +
        'inspector as equations, e.g. "Q0.0 = (I0.0 | Q0.0) & !I0.1" (start/stop with ' +
        'self-hold). Use AND/OR/NOT/XOR or & | ! ^, and separate lines with ";".',
      'Wires that are connected to +24 V during a run turn amber. Hold the mouse on an ' +
        'electric push button to press it (Ctrl+click latches).',
    ],
  },
  {
    heading: 'Project info & the page frame',
    tips: [
      'Project name, date, author, checked by, and company live in the inspector’s "Project ' +
        'info" section (visible with nothing selected) and appear on the sheet’s title block.',
      'The page frame (None/A4/A3) draws a sheet outline with that title block, centered on the ' +
        'current diagram when picked - a visual guide only, not a hard boundary.',
    ],
  },
  {
    heading: 'Exporting',
    tips: [
      'Export… opens a dialog with a live preview and a choice of what to crop to: ' +
        'Everything, the page frame, or whatever’s currently in view.',
      'To export just part of a diagram, pan/zoom to that region first, then pick "Current view".',
    ],
  },
];

export function openTipsDialog(): void {
  const backdrop = document.createElement('div');
  backdrop.className = 'modalBackdrop';
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });

  const dialog = document.createElement('div');
  dialog.className = 'exportDialog tipsDialog';
  backdrop.appendChild(dialog);

  const header = document.createElement('div');
  header.className = 'exportDialogHeader';
  const title = document.createElement('h2');
  title.textContent = 'Tips';
  const closeBtn = document.createElement('button');
  closeBtn.className = 'exportDialogClose';
  closeBtn.textContent = '✕';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.addEventListener('click', () => close());
  header.append(title, closeBtn);
  dialog.appendChild(header);

  for (const section of TIP_SECTIONS) {
    const heading = document.createElement('div');
    heading.className = 'inspectorSectionHeading';
    heading.textContent = section.heading;
    dialog.appendChild(heading);

    const list = document.createElement('ul');
    list.className = 'tipsList';
    for (const tip of section.tips) {
      const item = document.createElement('li');
      item.textContent = tip;
      list.appendChild(item);
    }
    dialog.appendChild(list);
  }

  function close(): void {
    backdrop.remove();
    window.removeEventListener('keydown', onKeydown);
  }
  function onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') close();
  }
  window.addEventListener('keydown', onKeydown);

  document.body.appendChild(backdrop);
}
