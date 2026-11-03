import React, { useState } from 'react';
import {
  Laptop,
  Download,
  Terminal,
  FileCode,
  Copy,
  Check,
  ShieldCheck,
  ChevronRight,
  ExternalLink,
  FolderArchive,
  Layers,
} from 'lucide-react';
import {
  generateWindowsBatchLauncher,
  generatePowerShellShortcutScript,
  generateInnoSetupScript,
  downloadElectronWindowsBundle,
} from '../utils/windowsPackager';
import { triggerFileDownload } from '../utils/fileHelpers';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface WindowsPackagingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WindowsPackagingModal: React.FC<WindowsPackagingModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { isInstallable, isInstalled, install } = usePWAInstall();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'pwa' | 'batch' | 'electron' | 'inno'>('pwa');

  if (!isOpen) return null;

  const currentUrl = typeof window !== 'undefined' ? window.location.href : 'https://omnifile.app';

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleDownloadBat = () => {
    const content = generateWindowsBatchLauncher(currentUrl);
    const blob = new Blob([content], { type: 'text/plain' });
    triggerFileDownload(blob, 'Launch-OmniFile.bat');
  };

  const handleDownloadPs1 = () => {
    const content = generatePowerShellShortcutScript(currentUrl);
    const blob = new Blob([content], { type: 'text/plain' });
    triggerFileDownload(blob, 'Install-Desktop-Shortcut.ps1');
  };

  const handleDownloadInnoSetup = () => {
    const content = generateInnoSetupScript();
    const blob = new Blob([content], { type: 'text/plain' });
    triggerFileDownload(blob, 'OmniFile-InnoSetup.iss');
  };

  const handleDownloadElectronBundle = async () => {
    await downloadElectronWindowsBundle(currentUrl);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden my-8">
        {/* Modal Top Bar */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center text-white shadow-md">
              <Laptop className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight">
                Windows Executable & Desktop Deployment Hub
              </h3>
              <p className="text-xs text-slate-400">
                Run OmniFile as an independent, native Windows app or compile into a standalone <code className="text-cyan-400 font-mono">.exe</code> installer.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 text-sm rounded cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 pt-4 border-b border-slate-800 bg-slate-950/40 flex items-center gap-2 overflow-x-auto text-xs">
          {[
            { id: 'pwa', label: '1. Windows Taskbar App (Instant)' },
            { id: 'batch', label: '2. Batch Launcher (.bat / .ps1)' },
            { id: 'electron', label: '3. Compile .EXE (Electron)' },
            { id: 'inno', label: '4. Inno Setup Wizard (.iss)' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`px-3 py-2 rounded-t-lg font-medium transition-colors cursor-pointer border-b-2 whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-cyan-400 text-cyan-300 bg-slate-900'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content Body */}
        <div className="p-6 space-y-6 text-xs text-slate-300">
          {activeTab === 'pwa' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-slate-100 text-sm">
                    Direct Windows Desktop PWA (Recommended for Speed)
                  </h4>
                  <p className="text-slate-400 mt-1 leading-relaxed">
                    Modern Windows 10 & 11 (via Microsoft Edge or Chrome) allows web apps to install natively as isolated desktop applications with full local disk access, dedicated taskbar pins, and offline cache.
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-4 pt-2">
                {isInstallable && !isInstalled ? (
                  <button
                    onClick={install}
                    className="w-full sm:w-auto px-6 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 rounded-xl transition-all cursor-pointer shadow-md flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>Install to Windows Now</span>
                  </button>
                ) : isInstalled ? (
                  <div className="px-4 py-2 bg-emerald-950/60 border border-emerald-800 text-emerald-300 rounded-lg flex items-center gap-2 font-medium">
                    <Check className="w-4 h-4" />
                    <span>OmniFile is currently installed on this PC</span>
                  </div>
                ) : (
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-slate-400 leading-relaxed">
                    <span className="font-semibold text-slate-200">How to install manually in Microsoft Edge / Chrome:</span>
                    <ol className="list-decimal ml-4 mt-1.5 space-y-1 text-slate-400">
                      <li>Click the <strong>App Available</strong> icon in the right side of the address bar.</li>
                      <li>Or click <strong>Settings (···) → Apps → Install this site as an app</strong>.</li>
                      <li>Check <strong>"Pin to taskbar"</strong> and <strong>"Create Desktop shortcut"</strong>!</li>
                    </ol>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'batch' && (
            <div className="space-y-4">
              <p className="text-slate-400 leading-relaxed">
                Download a native Windows launcher that runs OmniFile in a standalone window (using the standard <code className="text-cyan-400 font-mono">--app</code> flag) without browser tabs, address bars, or extensions:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleDownloadBat}
                  className="p-4 bg-slate-950 border border-slate-800 hover:border-cyan-500 rounded-xl text-left transition-all cursor-pointer flex items-center justify-between"
                >
                  <div>
                    <div className="font-semibold text-slate-100 flex items-center gap-2">
                      <Terminal className="w-4 h-4 text-cyan-400" />
                      <span>Launch-OmniFile.bat</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      Double-click to open standalone desktop window
                    </div>
                  </div>
                  <Download className="w-4 h-4 text-slate-400" />
                </button>

                <button
                  type="button"
                  onClick={handleDownloadPs1}
                  className="p-4 bg-slate-950 border border-slate-800 hover:border-cyan-500 rounded-xl text-left transition-all cursor-pointer flex items-center justify-between"
                >
                  <div>
                    <div className="font-semibold text-slate-100 flex items-center gap-2">
                      <FileCode className="w-4 h-4 text-blue-400" />
                      <span>Install-Desktop-Shortcut.ps1</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      Creates Desktop & Start Menu shortcuts
                    </div>
                  </div>
                  <Download className="w-4 h-4 text-slate-400" />
                </button>
              </div>

              {/* Script Code Preview */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-[11px] overflow-x-auto relative">
                <div className="flex justify-between items-center pb-2 mb-2 border-b border-slate-850 text-slate-500">
                  <span>Batch launcher contents:</span>
                  <button
                    onClick={() =>
                      copyToClipboard(generateWindowsBatchLauncher(currentUrl), 'bat')
                    }
                    className="flex items-center gap-1 text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    {copiedKey === 'bat' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey === 'bat' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <pre className="text-slate-400 leading-tight">
                  {generateWindowsBatchLauncher(currentUrl)}
                </pre>
              </div>
            </div>
          )}

          {activeTab === 'electron' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl">
                <div className="flex items-center gap-2 text-cyan-400 font-semibold mb-1">
                  <FolderArchive className="w-4 h-4" />
                  <span>Electron Builder Windows .EXE Package</span>
                </div>
                <p className="text-slate-400 leading-relaxed text-xs">
                  Generate a complete source bundle pre-configured with <code className="text-cyan-400 font-mono">electron-builder</code> to produce a native Windows NSIS installer (<code className="text-cyan-400 font-mono">OmniFile-Setup-1.0.0.exe</code>).
                </p>
              </div>

              <button
                type="button"
                onClick={handleDownloadElectronBundle}
                className="w-full sm:w-auto px-6 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-xl transition-all cursor-pointer shadow-md flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>Download OmniFile-Windows-Executable-Bundle.zip</span>
              </button>

              <div className="space-y-2 pt-2">
                <div className="font-semibold text-slate-200 text-xs">Compilation commands on Windows:</div>
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 font-mono text-xs text-slate-300 space-y-1">
                  <div>1. Extract the downloaded ZIP archive</div>
                  <div>2. <span className="text-cyan-400">npm install</span></div>
                  <div>3. <span className="text-cyan-400">npm run build:exe</span></div>
                  <div className="text-emerald-400 text-[11px] pt-1">
                    Output: dist-exe/OmniFile-Desktop-Setup-1.0.0.exe
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'inno' && (
            <div className="space-y-4">
              <p className="text-slate-400 leading-relaxed">
                If you already have Inno Setup on Windows, download our compiled setup script (<code className="text-cyan-400 font-mono">.iss</code>) to produce a traditional wizard installer with license, program files registration, and automatic uninstaller:
              </p>

              <button
                type="button"
                onClick={handleDownloadInnoSetup}
                className="px-4 py-2 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors cursor-pointer flex items-center gap-2"
              >
                <Download className="w-4 h-4 text-cyan-400" />
                <span>Download OmniFile-InnoSetup.iss</span>
              </button>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-[11px] overflow-x-auto">
                <div className="flex justify-between items-center pb-2 mb-2 border-b border-slate-850 text-slate-500">
                  <span>Inno Setup Script:</span>
                  <button
                    onClick={() => copyToClipboard(generateInnoSetupScript(), 'inno')}
                    className="flex items-center gap-1 text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    {copiedKey === 'inno' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey === 'inno' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <pre className="text-slate-400 leading-tight">
                  {generateInnoSetupScript()}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs text-slate-500">
          <span>Targeting Windows 10 & 11 x64 architecture</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
