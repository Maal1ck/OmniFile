import JSZip from 'jszip';
import { triggerFileDownload } from './fileHelpers';

// Windows Batch Launcher (.bat)
export function generateWindowsBatchLauncher(appUrl: string): string {
  return `@echo off
title OmniFile Desktop Launcher
echo ========================================================
echo       OmniFile Desktop - Windows Native App Launcher
echo ========================================================
echo.
echo Launching OmniFile in dedicated desktop window...
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
# OmniFile Desktop - Windows Shortcut & Start Menu Creator
# ========================================================
$WScriptShell = New-Object -ComObject WScript.Shell
$DesktopPath = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Desktop)
$ProgramsPath = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Programs)

# Desktop Shortcut
$ShortcutDesktop = $WScriptShell.CreateShortcut("$DesktopPath\\OmniFile Desktop.lnk")
$ShortcutDesktop.TargetPath = "msedge.exe"
$ShortcutDesktop.Arguments = "--app=${appUrl} --window-size=1360,860"
$ShortcutDesktop.Description = "OmniFile Desktop File Utility"
$ShortcutDesktop.Save()

# Start Menu Shortcut
$ShortcutStartMenu = $WScriptShell.CreateShortcut("$ProgramsPath\\OmniFile Desktop.lnk")
$ShortcutStartMenu.TargetPath = "msedge.exe"
$ShortcutStartMenu.Arguments = "--app=${appUrl} --window-size=1360,860"
$ShortcutStartMenu.Description = "OmniFile Desktop File Utility"
$ShortcutStartMenu.Save()

Write-Host "OmniFile Desktop shortcuts successfully created on your Desktop and Start Menu!" -ForegroundColor Green
Write-Host "You can now launch OmniFile as an independent Windows window."
Start-Sleep -Seconds 3
`;
}

// Inno Setup Script (.iss) for creating a native Windows Setup.exe
export function generateInnoSetupScript(): string {
  return `; ========================================================
; Inno Setup Script for OmniFile Desktop Windows Installer
; Compiles directly with Inno Setup Compiler into OmniFile-Setup.exe
; ========================================================

[Setup]
AppId={{8B3F5D21-7A1E-4B39-9A01-C7D4E5B891A2}
AppName=OmniFile Desktop
AppVersion=1.0.0
AppPublisher=OmniFile Systems
AppPublisherURL=https://omnifile.local
DefaultDirName={autopf}\\OmniFile Desktop
DefaultGroupName=OmniFile Desktop
OutputDir=dist-win
OutputBaseFilename=OmniFile-Desktop-Setup-v1.0.0
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
DisableWelcomePage=no
PrivilegesRequired=lowest

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[Files]
Source: "OmniFile.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "icon.ico"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\\OmniFile Desktop"; Filename: "{app}\\OmniFile.bat"; IconFilename: "{app}\\icon.ico"
Name: "{group}\\Uninstall OmniFile"; Filename: "{uninstallexe}"
Name: "{autodesktop}\\OmniFile Desktop"; Filename: "{app}\\OmniFile.bat"; IconFilename: "{app}\\icon.ico"; Tasks: desktopicon

[Run]
Filename: "{app}\\OmniFile.bat"; Description: "{cm:LaunchProgram,OmniFile Desktop}"; Flags: nowait postinstall skipifsilent
`;
}

// Electron Package Bundle (.zip) for compiling to .exe via electron-builder
export async function downloadElectronWindowsBundle(appUrl: string): Promise<void> {
  const zip = new JSZip();

  const electronPackageJson = {
    name: 'omnifile-desktop',
    version: '1.0.0',
    description: 'Windows desktop file utility for batch renaming, compression, tree flattening, format/date sorting, and cloud sync.',
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
      productName: 'OmniFile Desktop',
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

  const electronMainJs = `// OmniFile Desktop - Electron Native Windows Host
const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('path');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1380,
    height: 880,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#0f172a',
    title: 'OmniFile Desktop',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Load the web app URL or local build
  mainWindow.loadURL('${appUrl}');

  // Open external links in default browser
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

  const readmeMd = `# OmniFile Desktop - Build Native Windows .exe

This bundle contains the complete Electron setup to build an official standalone Windows \`.exe\` installer (\`OmniFile-Desktop-Setup-1.0.0.exe\`) and a portable \`.exe\`.

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

The compiled native Windows installer \`OmniFile-Desktop-Setup-1.0.0.exe\` will be generated in the \`dist-exe/\` folder!
`;

  zip.file('package.json', JSON.stringify(electronPackageJson, null, 2));
  zip.file('main.js', electronMainJs);
  zip.file('preload.js', electronPreloadJs);
  zip.file('README-WINDOWS-BUILD.md', readmeMd);
  zip.file('OmniFile-InnoSetup.iss', generateInnoSetupScript());
  zip.file('Launch-OmniFile.bat', generateWindowsBatchLauncher(appUrl));
  zip.file('Install-Desktop-Shortcut.ps1', generatePowerShellShortcutScript(appUrl));

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  triggerFileDownload(zipBlob, 'OmniFile-Windows-Executable-Bundle.zip');
}
