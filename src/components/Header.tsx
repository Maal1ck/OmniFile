import React from 'react';
import {
  FolderArchive,
  Layers,
  Tag,
  FolderTree,
  FolderSync,
  Cloud,
  Download,
  Laptop,
  CheckCircle2,
  RefreshCw,
  BrainCircuit,
  CopyCheck,
  ShieldAlert,
  PieChart,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export type ActiveTab =
  | 'workspace'
  | 'semantic'
  | 'dedup'
  | 'privacy'
  | 'visualizer'
  | 'rename'
  | 'compress'
  | 'flatten'
  | 'organize'
  | 'cloud'
  | 'windows_packager';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  fileCount: number;
  totalSizeFormatted: string;
  onOpenWindowsPackager: () => void;
  onResetWorkspace: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  fileCount,
  totalSizeFormatted,
  onOpenWindowsPackager,
  onResetWorkspace,
}) => {
  const { isInstallable, isInstalled, install } = usePWAInstall();

  const navItems: Array<{ id: ActiveTab; label: string; icon: React.ElementType; badge?: string }> = [
    { id: 'workspace', label: 'Workspace', icon: Layers },
    { id: 'semantic', label: 'File DNA', icon: BrainCircuit, badge: 'AI' },
    { id: 'dedup', label: 'Duplicates', icon: CopyCheck },
    { id: 'privacy', label: 'Privacy Guard', icon: ShieldAlert },
    { id: 'visualizer', label: 'Disk Treemap', icon: PieChart },
    { id: 'rename', label: 'Batch Renamer', icon: Tag },
    { id: 'compress', label: 'Compress', icon: FolderArchive },
    { id: 'flatten', label: 'Flatten Tree', icon: FolderTree },
    { id: 'organize', label: 'Organizer', icon: FolderSync },
    { id: 'cloud', label: 'Cloud Sync', icon: Cloud },
  ];

  return (
    <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
      {/* Windows 11 Fluent App Top Bar */}
      <div className="flex items-center justify-between gap-8 px-6 py-3">
        {/* Zone 1: Wordmark & Brand */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-950/40">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold tracking-tight text-white whitespace-nowrap">
                OmniFile Desktop
              </span>
              <span className="hidden sm:inline-block text-[11px] font-mono text-cyan-400 font-medium px-1.5 py-0.5 rounded bg-cyan-950/60 border border-cyan-800/60">
                Win-Ready
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="font-mono tabular-nums">{fileCount} files</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{totalSizeFormatted}</span>
            </div>
          </div>
        </div>

        {/* Zone 2: Primary Navigation Links (Single-line, unboxed, hover underline) */}
        <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-slate-300">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 py-1 cursor-pointer border-b-2 text-xs ${
                  isActive
                    ? 'text-cyan-400 font-semibold border-cyan-400'
                    : 'text-slate-400 hover:text-slate-200 border-transparent'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
                {item.badge && (
                  <span className="text-[9px] font-mono font-bold px-1 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Primary Action & Install Button */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Windows Packager CTA */}
          <button
            onClick={onOpenWindowsPackager}
            className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-600 rounded-lg hover:from-blue-500 hover:to-cyan-500 transition-all shadow-sm hover:shadow-cyan-900/30 whitespace-nowrap shrink-0 cursor-pointer"
            title="Export executable, batch launcher, and Windows installer scripts"
          >
            <Laptop className="w-3.5 h-3.5" />
            <span>Windows .EXE Packager</span>
          </button>

          {/* Direct PWA Install Button if available */}
          {isInstallable && !isInstalled && (
            <button
              onClick={install}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-cyan-300 bg-cyan-950/60 border border-cyan-800 rounded-lg hover:bg-cyan-900/40 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              title="Install as native Windows desktop app"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Install to Windows</span>
            </button>
          )}

          {isInstalled && (
            <div className="hidden sm:flex items-center gap-1 text-xs text-emerald-400 px-2.5 py-1 rounded bg-emerald-950/40 border border-emerald-900/50">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Installed App</span>
            </div>
          )}

          <button
            onClick={onResetWorkspace}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 rounded-lg transition-colors cursor-pointer"
            title="Reset workspace"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mobile/Tablet Sub-Navigation Bar */}
      <div className="lg:hidden flex items-center gap-2 px-4 py-2 overflow-x-auto border-t border-slate-800/60 bg-slate-900/50">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                isActive
                  ? 'bg-cyan-950/70 text-cyan-300 border border-cyan-800 font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
};
