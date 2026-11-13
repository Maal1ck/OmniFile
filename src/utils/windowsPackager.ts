import JSZip from 'jszip';
import { triggerFileDownload } from './fileHelpers';

// Windows Batch Launcher (.bat)
export function generateWindowsBatchLauncher(appUrl: string): string {
  return `@echo off
title OmniFile Desktop by Maodo - Launcher
echo ========================================================
echo   OmniFile Desktop by Maodo - Windows Native Launcher
echo ========================================================
echo.
echo Launching OmniFile Desktop by Maodo in dedicated window...
echo.

:: Check for Microsoft Edge (Standard on all modern Windows 10 & 11)
where msedge >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    start msedge --app="${appUrl}" --window-size=1360,860 --window-position=50,50
    exit /b 0
)

:: Check for Google Chrome
where chrome >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    start chrome --app="${appUrl}" --window-size=1360,860 --window-position=50,50
    exit /b 0
)

:: Fallback to default system browser
start "" "${appUrl}"
exit /b 0
`;
}

// Windows PowerShell Desktop Shortcut Creator (.ps1)
export function generatePowerShellShortcutScript(appUrl: string): string {
  return `# ========================================================
# OmniFile Desktop by Maodo - Shortcut & Start Menu Creator
# ========================================================
$WScriptShell = New-Object -ComObject WScript.Shell
$DesktopPath = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Desktop)
$ProgramsPath = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Programs)

# Desktop Shortcut
$ShortcutDesktop = $WScriptShell.CreateShortcut("$DesktopPath\\OmniFile Desktop by Maodo.lnk")
$ShortcutDesktop.TargetPath = "msedge.exe"
$ShortcutDesktop.Arguments = "--app=${appUrl} --window-size=1360,860"
$ShortcutDesktop.Description = "OmniFile Desktop by Maodo File Utility"
$ShortcutDesktop.Save()

# Start Menu Shortcut
$ShortcutStartMenu = $WScriptShell.CreateShortcut("$ProgramsPath\\OmniFile Desktop by Maodo.lnk")
$ShortcutStartMenu.TargetPath = "msedge.exe"
$ShortcutStartMenu.Arguments = "--app=${appUrl} --window-size=1360,860"
$ShortcutStartMenu.Description = "OmniFile Desktop by Maodo File Utility"
$ShortcutStartMenu.Save()

Write-Host "OmniFile Desktop by Maodo shortcuts created on Desktop and Start Menu!" -ForegroundColor Green
Start-Sleep -Seconds 3
`;
}

// Inno Setup Script (.iss) for creating a native Windows Setup.exe
export function generateInnoSetupScript(): string {
  return `; ========================================================
; Inno Setup Script for OmniFile Desktop by Maodo
; Compiles directly with Inno Setup Compiler
; ========================================================

[Setup]
AppId={{8B3F5D21-7A1E-4B39-9A01-C7D4E5B891A2}
AppName=OmniFile Desktop by Maodo
AppVersion=1.0.0
AppPublisher=Maodo
AppPublisherURL=https://omnifile.local
DefaultDirName={autopf}\\OmniFile Desktop by Maodo
DefaultGroupName=OmniFile Desktop by Maodo
OutputDir=dist-win
OutputBaseFilename=OmniFile-Desktop-by-Maodo-Setup-v1.0.0
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
DisableWelcomePage=no
PrivilegesRequired=lowest

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[Files]
Source: "Launch-OmniFile.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "icon.ico"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\\OmniFile Desktop by Maodo"; Filename: "{app}\\Launch-OmniFile.bat"; IconFilename: "{app}\\icon.ico"
Name: "{group}\\Uninstall OmniFile"; Filename: "{uninstallexe}"
Name: "{autodesktop}\\OmniFile Desktop by Maodo"; Filename: "{app}\\Launch-OmniFile.bat"; IconFilename: "{app}\\icon.ico"; Tasks: desktopicon

[Run]
Filename: "{app}\\Launch-OmniFile.bat"; Description: "{cm:LaunchProgram,OmniFile Desktop by Maodo}"; Flags: nowait postinstall skipifsilent
`;
}

// Electron Package Bundle (.zip) for compiling to .exe via electron-builder
export async function downloadElectronWindowsBundle(appUrl: string): Promise<void> {
  const zip = new JSZip();

  const electronPackageJson = {
    name: 'omnifile-desktop',
    version: '1.0.0',
    description: 'OmniFile Desktop by Maodo — Windows file utility for batch renaming, compression, tree flattening, geospatial bundling, and cloud sync.',
    main: 'main.js',
    scripts: {
      start: 'electron .',
      'pack:win': 'electron-builder --win --x64',
      'build:exe': 'electron-builder --win nsis',
    },
    devDependencies: {
      electron: '^34.0.0',
      'electron-builder': '^25.1.8',
    },
    build: {
      appId: 'com.omnifile.desktop',
      productName: 'OmniFile Desktop by Maodo',
      directories: {
        output: 'dist-exe',
      },
      win: {
        target: ['nsis', 'portable'],
        icon: 'assets/icon.ico',
        artifactName: '${productName}-Setup-${version}.${ext}',
      },
      nsis: {
        oneClick: false,
        perMachine: false,
        allowToChangeInstallationDirectory: true,
        createDesktopShortcut: true,
        createStartMenuShortcut: true,
      },
    },
  };

  const electronMainJs = `// OmniFile Desktop by Maodo - Electron Native Windows Host
const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1380,
    height: 880,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#0f172a',
    title: 'OmniFile Desktop by Maodo',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadURL('${appUrl}');
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
`;

  const electronPreloadJs = `// Preload script for safe desktop APIs
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('desktopAPI', {
  platform: 'win32',
  isNativeExecutable: true,
  version: '1.0.0'
});
`;

  const readmeMd = `# OmniFile Desktop by Maodo - Build Native Windows .exe

This bundle contains the complete Electron setup to build a standalone Windows \`.exe\` installer and portable \`.exe\`.

## 3 Easy Steps to Build the Windows .exe:

1. **Extract this ZIP folder** on your Windows computer.
2. Open PowerShell or Command Prompt inside the folder and install dependencies:
   \`\`\`bash
   npm install
   \`\`\`
3. Run the Windows builder:
   \`\`\`bash
   npm run build:exe
   \`\`\`

The compiled native Windows installer will be generated in the \`dist-exe/\` folder!
`;

  zip.file('package.json', JSON.stringify(electronPackageJson, null, 2));
  zip.file('main.js', electronMainJs);
  zip.file('preload.js', electronPreloadJs);
  zip.file('README-WINDOWS-BUILD.md', readmeMd);
  zip.file('OmniFile-InnoSetup.iss', generateInnoSetupScript());
  zip.file('Launch-OmniFile.bat', generateWindowsBatchLauncher(appUrl));
  zip.file('Install-Desktop-Shortcut.ps1', generatePowerShellShortcutScript(appUrl));

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  triggerFileDownload(zipBlob, 'OmniFile-by-Maodo-Windows-Executable-Bundle.zip');
}
