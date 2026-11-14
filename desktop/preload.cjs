// The bridge between the app's page and the computer's files (see src/app/desktopBridge.ts):
// the system's Open and Save dialogs, writing back to a file, and project files handed to the
// app from outside. Nothing else of Node or Electron reaches the page.
const { contextBridge, ipcRenderer } = require('electron');

let handler = null;
const waiting = [];
ipcRenderer.on('open-file', (_event, file) => {
  if (handler) handler(file);
  else waiting.push(file);
});

contextBridge.exposeInMainWorld('pneugineerDesktop', {
  openFile: () => ipcRenderer.invoke('open-file'),
  openPath: (path) => ipcRenderer.invoke('open-path', path),
  saveFile: (path, text) => ipcRenderer.invoke('save-file', path, text),
  saveFileAs: (suggestedName, text) => ipcRenderer.invoke('save-file-as', suggestedName, text),
  onOpenFile: (cb) => {
    handler = cb;
    for (const file of waiting.splice(0)) cb(file);
    ipcRenderer.send('renderer-ready');
  },
});
