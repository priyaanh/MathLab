const { app, BrowserWindow, Menu, shell, ipcMain, dialog } = require('electron');
const path = require('path');
const { isDev } = require('./utils');

let mainWindow;

// Performance optimizations
app.commandLine.appendSwitch('--enable-features', 'VaapiVideoDecoder');
app.commandLine.appendSwitch('--disable-features', 'VizDisplayCompositor');

function createWindow() {
    // Create the browser window with optimized settings
    mainWindow = new BrowserWindow({
        width: 480,
        height: 720,
        minWidth: 400,
        minHeight: 600,
        maxWidth: 600,
        maxHeight: 900,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            webSecurity: true,
            sandbox: false,
            preload: path.join(__dirname, 'preload.js'), // We'll create this for secure communication
        },
        icon: path.join(__dirname, '../assets/icon.png'),
        title: 'Scientific Calculator',
        titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
        resizable: true,
        show: false, // Don't show until ready
        backgroundColor: '#000000', // Match calculator's default theme
        webgl: false, // Disable WebGL for better performance
        experimentalFeatures: false,
    });

    // Load the app
if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    // Open DevTools in development
    // mainWindow.webContents.openDevTools();
} else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
}

// Show window when ready to prevent visual flash
mainWindow.once('ready-to-show', () => {
    mainWindow.show();
});

// Handle window closed
mainWindow.on('closed', () => {
    mainWindow = null;
});

// Handle external links
mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
});
}

// Create application menu
function createMenu() {
    const template = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'Quit',
                    accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
                    click: () => {
                        app.quit();
                    }
                }
            ]
        },
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                { role: 'selectall' }
            ]
        },
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'forceReload' },
                { role: 'toggleDevTools' },
                { type: 'separator' },
                { role: 'resetZoom' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { type: 'separator' },
                { role: 'togglefullscreen' }
            ]
        },
        {
            label: 'Window',
            submenu: [
                { role: 'minimize' },
                { role: 'close' }
            ]
        },
        {
            label: 'Help',
            submenu: [
                {
                    label: 'About Scientific Calculator',
                    click: () => {
                        shell.openExternal('https://github.com/yourusername/scientific-calculator');
                    }
                }
            ]
        }
    ];

    // macOS specific menu adjustments
    if (process.platform === 'darwin') {
        template.unshift({
            label: app.getName(),
            submenu: [
                { role: 'about' },
                { type: 'separator' },
                { role: 'services' },
                { type: 'separator' },
                { role: 'hide' },
                { role: 'hideOthers' },
                { role: 'unhide' },
                { type: 'separator' },
                { role: 'quit' }
            ]
        });

        // Edit menu
        template[2].submenu.push(
            { type: 'separator' },
            {
                label: 'Speech',
                submenu: [
                    { role: 'startSpeaking' },
                    { role: 'stopSpeaking' }
                ]
            }
        );

        // Window menu
        template[4].submenu = [
            { role: 'close' },
            { role: 'minimize' },
            { role: 'zoom' },
            { type: 'separator' },
            { role: 'front' }
        ];
    }

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

// App event handlers
app.whenReady().then(() => {
    createWindow();
    createMenu();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
    contents.on('new-window', (navigationEvent, url) => {
        navigationEvent.preventDefault();
        shell.openExternal(url);
    });
});

// Prevent navigation to external websites
app.on('web-contents-created', (event, contents) => {
    contents.on('will-navigate', (navigationEvent, url) => {
        const parsedUrl = new URL(url);
        if (parsedUrl.origin !== 'http://localhost:5173' && !isDev) {
            navigationEvent.preventDefault();
        }
    });
});
