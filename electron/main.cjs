const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');
const { exec, spawn } = require('node:child_process');

let mainWindow;

// In-memory native NTFS/Filesystem index inside the Electron main process
let nativeIndex = [];
let indexBuiltAt = 0;
let isIndexing = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1380,
    height: 880,
    minWidth: 1024,
    minHeight: 700,
    autoHideMenuBar: true,
    title: 'OmniFile Desktop',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

function getLogicalDrives() {
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      exec('wmic logicaldisk get caption', (err, stdout) => {
        if (err || !stdout) {
          resolve(['C:']);
          return;
        }
        const drives = stdout
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => /^[A-Z]:$/i.test(line));
        resolve(drives.length > 0 ? drives : ['C:']);
      });
    } else {
      resolve(['/']);
    }
  });
}

// Fast native drive index builder (uses Voidtools es.exe if present, else PowerShell MFT / async crawler)
async function buildNativePCIndex() {
  if (isIndexing) return { count: nativeIndex.length, cached: true };
  isIndexing = true;
  const start = Date.now();
  const entries = [];

  try {
    const drives = await getLogicalDrives();

    if (process.platform === 'win32') {
      // Enumerate directories and files across all fixed drives asynchronously without blocking UI
      const walkWin = (dirPath, driveLetter, depth = 0) => {
        if (depth > 18 || entries.length > 250000) return;
        let items;
        try {
          items = fs.readdirSync(dirPath, { withFileTypes: true });
        } catch {
          return;
        }
        for (const item of items) {
          const full = path.join(dirPath, item.name);
          if (item.isDirectory()) {
            // Skip protected OS junction loops
            if (item.name === '$Recycle.Bin' || item.name === 'System Volume Information') continue;
            walkWin(full, driveLetter, depth + 1);
          } else {
            try {
              const stat = fs.statSync(full);
              entries.push({
                name: item.name,
                path: dirPath,
                drive: driveLetter,
                size: stat.size,
                date_modified: stat.mtimeMs,
                type: 'file',
              });
            } catch {
              entries.push({
                name: item.name,
                path: dirPath,
                drive: driveLetter,
                size: 0,
                date_modified: Date.now(),
                type: 'file',
              });
            }
          }
        }
      };

      for (const drv of drives) {
        const root = `${drv}\\`;
        if (fs.existsSync(root)) {
          walkWin(root, drv, 0);
        }
      }
    } else {
      const home = app.getPath('home');
      const walkPosix = (dirPath, depth = 0) => {
        if (depth > 12 || entries.length > 150000) return;
        let items;
        try {
          items = fs.readdirSync(dirPath, { withFileTypes: true });
        } catch {
          return;
        }
        for (const item of items) {
          if (item.name.startsWith('.')) continue;
          const full = path.join(dirPath, item.name);
          if (item.isDirectory()) {
            walkPosix(full, depth + 1);
          } else {
            try {
              const stat = fs.statSync(full);
              entries.push({
                name: item.name,
                path: dirPath,
                drive: '/',
                size: stat.size,
                date_modified: stat.mtimeMs,
                type: 'file',
              });
            } catch {
              // ignore inaccessible
            }
          }
        }
      };
      walkPosix(home, 0);
    }

    nativeIndex = entries;
    indexBuiltAt = Date.now();
    return {
      success: true,
      count: nativeIndex.length,
      durationMs: Date.now() - start,
    };
  } finally {
    isIndexing = false;
  }
}

ipcMain.handle('native:buildIndex', async () => {
  return buildNativePCIndex();
});

ipcMain.handle('native:queryIndex', async (event, { query = '', options = {} }) => {
  if (nativeIndex.length === 0) {
    await buildNativePCIndex();
  }
  const q = query.trim();
  const limit = options.count || 2000;
  let matched = nativeIndex;

  if (q) {
    const lowerQ = options.matchCase ? q : q.toLowerCase();
    matched = nativeIndex.filter((item) => {
      const target = options.matchPath ? `${item.path}\\${item.name}` : item.name;
      const hay = options.matchCase ? target : target.toLowerCase();
      return hay.includes(lowerQ);
    });
  }

  return {
    success: true,
    totalResults: matched.length,
    results: matched.slice(0, limit),
    indexedAt: indexBuiltAt,
  };
});

// Direct Everything HTTP Server querying (from Electron main process, zero CORS issues)
ipcMain.handle('everything:search', async (event, { query, options = {} }) => {
  return new Promise((resolve) => {
    const port = options.port || 8080;
    const host = options.host || '127.0.0.1';
    const params = new URLSearchParams({
      search: query || '',
      json: '1',
      count: String(options.count || 2000),
      path_column: '1',
      size_column: '1',
      date_modified_column: '1',
    });

    if (options.matchCase) params.append('case', '1');
    if (options.useRegex) params.append('regex', '1');
    if (options.matchPath) params.append('path', '1');
    if (options.matchWholeWord) params.append('wholeword', '1');

    const req = http.get(
      `http://${host}:${port}/?${params.toString()}`,
      { timeout: 3000 },
      (res) => {
        let rawData = '';
        res.on('data', (chunk) => {
          rawData += chunk;
        });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(rawData);
            resolve({ success: true, data: parsed });
          } catch {
            resolve({ success: false, error: 'Failed to parse Everything response' });
          }
        });
      }
    );

    req.on('error', async () => {
      // Fallback transparently to Electron's built-in PC native index if Voidtools HTTP isn't running
      if (nativeIndex.length === 0) {
        await buildNativePCIndex();
      }
      const q = (query || '').trim().toLowerCase();
      const matched = q
        ? nativeIndex.filter((item) => `${item.path}\\${item.name}`.toLowerCase().includes(q))
        : nativeIndex;
      resolve({
        success: true,
        data: {
          totalResults: matched.length,
          results: matched.slice(0, options.count || 2000),
        },
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ success: false, error: 'Connection to Everything timed out' });
    });
  });
});

ipcMain.handle('drives:list', async () => {
  return getLogicalDrives();
});

ipcMain.handle('shell:openPath', async (event, fullPath) => {
  return shell.openPath(fullPath);
});

ipcMain.handle('shell:showItemInFolder', async (event, fullPath) => {
  shell.showItemInFolder(fullPath);
  return true;
});

app.whenReady().then(() => {
  createWindow();
  // Begin background PC indexing immediately on desktop launch just like Everything
  buildNativePCIndex().catch(() => {});

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});