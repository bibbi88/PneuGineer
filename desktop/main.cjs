// PneuGineer as a desktop app: the web app's single built page (copied to app/index.html at
// build time, see .github/workflows/desktop.yml) in its own window. Everything the app does runs
// in the page itself; this opens the window and lends the page the computer's file dialogs
// (preload.cjs): Open, Save back to the same file, Save as, and project files double-clicked or
// given on the command line.
const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');

const FILTERS = [
  { name: 'PneuGineer project', extensions: ['pgcl'] },
  { name: 'All files', extensions: ['*'] },
];

/** Where the file dialogs open: the folder last opened from or saved to. */
let lastDir = null;
/** Project files to open once the page is ready to take them. */
let pending = [];
let rendererReady = false;

/** Project files among command-line arguments (a double-clicked .pgcl arrives this way). */
function projectFilesIn(argv) {
  return argv.slice(1).filter((a) => /\.(pgcl|json)$/i.test(a) && !a.startsWith('-'));
}

async function readProject(file) {
  const full = path.resolve(file);
  lastDir = path.dirname(full);
  return { path: full, text: await fs.readFile(full, 'utf8') };
}

async function sendFiles(files) {
  for (const f of files) {
    try {
      const project = await readProject(f);
      if (win) win.webContents.send('open-file', project);
    } catch (err) {
      dialog.showErrorBox('PneuGineer', `Couldn't open ${f}:\n${err.message}`);
    }
  }
}

ipcMain.handle('open-file', async () => {
  const result = await dialog.showOpenDialog(win, {
    title: 'Open project',
    defaultPath: lastDir ?? app.getPath('documents'),
    filters: FILTERS,
    properties: ['openFile'],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return readProject(result.filePaths[0]);
});

// A recent file from the start screen: null if it's gone (moved, deleted, renamed).
ipcMain.handle('open-path', async (_event, file) => {
  try {
    return await readProject(file);
  } catch {
    return null;
  }
});

ipcMain.handle('save-file', async (_event, file, text) => {
  try {
    await fs.writeFile(file, text, 'utf8');
    lastDir = path.dirname(file);
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle('save-file-as', async (_event, suggestedName, text) => {
  const result = await dialog.showSaveDialog(win, {
    title: 'Save project',
    defaultPath: path.join(lastDir ?? app.getPath('documents'), suggestedName),
    filters: FILTERS,
  });
  if (result.canceled || !result.filePath) return null;
  let file = result.filePath;
  if (!/\.[^\\/.]+$/.test(path.basename(file))) file += '.pgcl';
  try {
    await fs.writeFile(file, text, 'utf8');
  } catch (err) {
    dialog.showErrorBox('PneuGineer', `Couldn't save to ${file}:\n${err.message}`);
    return null;
  }
  lastDir = path.dirname(file);
  return file;
});

ipcMain.on('renderer-ready', () => {
  rendererReady = true;
  void sendFiles(pending.splice(0));
});

// One window: opening the app again (or a .pgcl file) brings the running one forward.
if (!app.requestSingleInstanceLock()) {
  app.quit();
}

let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'PneuGineer',
    icon: path.join(__dirname, 'build', 'icon.png'),
    backgroundColor: '#f7f7f9',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, 'app', 'index.html'));

  // Links to the web (help, GitHub) open in the normal browser, never inside the app window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file:')) {
      event.preventDefault();
      if (/^https?:/i.test(url)) shell.openExternal(url);
    }
  });
  win.on('closed', () => {
    win = null;
  });
}

// No menu bar: the app has its own toolbar, and the default menu's shortcuts (Ctrl+R reloads,
// for one) would take keys the app uses itself - Ctrl+R is redo.
Menu.setApplicationMenu(null);

// Opened again - a .pgcl double-clicked while it runs: that file opens in the running window.
app.on('second-instance', (_event, argv) => {
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
  const files = projectFilesIn(argv);
  if (rendererReady) void sendFiles(files);
  else pending.push(...files);
});

app.whenReady().then(() => {
  pending = projectFilesIn(process.argv);
  createWindow();
});
app.on('window-all-closed', () => app.quit());
