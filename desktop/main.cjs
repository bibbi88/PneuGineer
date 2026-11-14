// PneuGineer as a desktop app: the web app's single built page (copied to app/index.html at
// build time, see .github/workflows/desktop.yml) in its own window. Everything the app does runs
// in the page itself; this only opens the window.
const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('node:path');

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

app.on('second-instance', () => {
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
