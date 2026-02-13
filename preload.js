const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('aerotop', {
    // Receive system snapshots from main process
    onSystemUpdate: (callback) => {
        ipcRenderer.on('system-update', (_event, snapshot) => callback(snapshot));
    },

    // Process management
    killProcess: (pid, signal = 'SIGTERM') => {
        return ipcRenderer.invoke('kill-process', pid, signal);
    },

    reniceProcess: (pid, priority) => {
        return ipcRenderer.invoke('renice-process', pid, priority);
    },

    getProcessTree: () => {
        return ipcRenderer.invoke('get-process-tree');
    },

    // Window controls (frameless window needs custom controls)
    windowMinimize: () => ipcRenderer.send('window-minimize'),
    windowMaximize: () => ipcRenderer.send('window-maximize'),
    windowClose: () => ipcRenderer.send('window-close'),
    windowShade: () => ipcRenderer.send('window-shade'),
});
