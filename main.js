const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const SystemCollector = require('./src/system-collector');
const ProcessManager = require('./src/process-manager');

let mainWindow;
let collector;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 900,
        height: 700,
        minWidth: 600,
        minHeight: 400,
        transparent: true,
        frame: false,
        hasShadow: false,
        backgroundColor: '#00000000',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
        // Allow the window to be resizable despite being frameless
        resizable: true,
    });

    mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

    // Open DevTools in development
    if (process.env.NODE_ENV === 'development') {
        mainWindow.webContents.openDevTools({ mode: 'detach' });
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

function startCollector() {
    collector = new SystemCollector();

    collector.on('snapshot', (snapshot) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('system-update', snapshot);
        }
    });

    collector.start(1000); // 1 second interval
}

// ── IPC Handlers ──────────────────────────────────────────────

ipcMain.handle('kill-process', async (_event, pid, signal) => {
    return ProcessManager.killProcess(pid, signal);
});

ipcMain.handle('renice-process', async (_event, pid, priority) => {
    return ProcessManager.reniceProcess(pid, priority);
});

ipcMain.handle('get-process-tree', async () => {
    return collector ? collector.getProcessTree() : [];
});

// Window control IPC
ipcMain.on('window-minimize', () => {
    if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
    if (mainWindow) {
        if (mainWindow.isMaximized()) {
            mainWindow.unmaximize();
        } else {
            mainWindow.maximize();
        }
    }
});

ipcMain.on('window-close', () => {
    if (mainWindow) mainWindow.close();
});

ipcMain.on('window-shade', () => {
    if (mainWindow) {
        const bounds = mainWindow.getBounds();
        if (bounds.height > 60) {
            mainWindow._unshadedHeight = bounds.height;
            mainWindow.setBounds({ ...bounds, height: 50 });
        } else {
            mainWindow.setBounds({ ...bounds, height: mainWindow._unshadedHeight || 700 });
        }
    }
});

// ── App Lifecycle ─────────────────────────────────────────────

app.whenReady().then(() => {
    createWindow();
    startCollector();
});

app.on('window-all-closed', () => {
    if (collector) collector.stop();
    app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
        startCollector();
    }
});
