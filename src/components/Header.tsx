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
  Sun,
  Moon,
  Languages,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useAppSettings } from '../context/AppSettingsContext';

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

/**
 * Backgroundless OmniFile vector emblem (no solid dark card behind it).
 */
const BrandLogoMark: React.FC<{ className?: string }> = ({ className = 'w-9 h-9' }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 512 512"
    className={className}
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="hdrFolderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#0284c7" />
        <stop offset="100%" stopColor="#2563eb" />
      </linearGradient>
      <linearGradient id="hdrTabGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#38bdf8" />
        <stop offset="100%" stopColor="#0284c7" />
      </linearGradient>
      <linearGradient id="hdrGlowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#38bdf8" />
        <stop offset="100%" stopColor="#818cf8" />
      </linearGradient>
    </defs>
    <path
      d="M72 132 C72 110 90 92 112 92 L200 92 C218 92 234 102 244 118 L266 152 L400 152 C422 152 440 170 440 192 L440 256 L72 256 Z"
      fill="url(#hdrTabGrad)"
      opacity="0.92"
    />
    <rect x="52" y="182" width="408" height="242" rx="34" fill="url(#hdrFolderGrad)" />
    <g transform="translate(128, 222)">
      <rect x="0" y="0" width="112" height="66" rx="14" fill="#ffffff" fillOpacity="0.22" />
      <rect x="144" y="0" width="112" height="66" rx="14" fill="#ffffff" fillOpacity="0.22" />
      <rect x="0" y="90" width="112" height="66" rx="14" fill="#ffffff" fillOpacity="0.22" />
      <rect x="144" y="90" width="112" height="66" rx="14" fill="#ffffff" fillOpacity="0.22" />
      <circle cx="128" cy="78" r="40" fill="#0f172a" />
      <circle cx="128" cy="78" r="34" fill="url(#hdrGlowGrad)" />
      <path
        d="M118 68 A14 14 0 0 1 138 66 L138 58 L148 70 L138 82 L138 74 A20 20 0 0 0 112 82 Z"
        fill="#0f172a"
      />
      <path
        d="M138 88 A14 14 0 0 1 118 90 L118 98 L108 86 L118 74 L118 82 A20 20 0 0 0 144 74 Z"
        fill="#0f172a"
      />
    </g>
  </svg>
);

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  fileCount,
  totalSizeFormatted,
  onOpenWindowsPackager,
  onResetWorkspace,
}) => {
  const { isInstallable, isInstalled, install } = usePWAInstall();
  const { language, toggleLanguage, theme, toggleTheme, t } = useAppSettings();

  const navItems: Array<{ id: ActiveTab; label: string; icon: React.ElementType; badge?: string }> = [
    { id: 'workspace', label: t.nav.workspace, icon: Layers },
    { id: 'semantic', label: t.nav.semantic, icon: BrainCircuit, badge: 'AI' },
    { id: 'dedup', label: t.nav.dedup, icon: CopyCheck },
    { id: 'privacy', label: t.nav.privacy, icon: ShieldAlert },
    { id: 'visualizer', label: t.nav.visualizer, icon: PieChart },
    { id: 'rename', label: t.nav.rename, icon: Tag },
    { id: 'compress', label: t.nav.compress, icon: FolderArchive },
    { id: 'flatten', label: t.nav.flatten, icon: FolderTree },
    { id: 'organize', label: t.nav.organize, icon: FolderSync },
    { id: 'cloud', label: t.nav.cloud, icon: Cloud },
  ];

  return (
    <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-4 px-6 py-3">
        {/* Zone 1: Backgroundless Logo & Wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <BrandLogoMark className="w-9 h-9 shrink-0 drop-shadow-sm" />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold tracking-tight text-white whitespace-nowrap">
                {t.brandName}
              </span>
              <span className="hidden sm:inline-block text-[11px] font-mono text-cyan-400 font-medium px-1.5 py-0.5 rounded bg-cyan-950/60 border border-cyan-800/60">
                {t.winReady}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="font-mono tabular-nums">
                {fileCount} {fileCount === 1 ? t.fileSingular : t.filesCount}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{totalSizeFormatted}</span>
            </div>
          </div>
        </div>

        {/* Zone 2: Primary Navigation Links */}
        <nav className="hidden xl:flex items-center gap-4 text-sm font-medium text-slate-300 overflow-x-auto">
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

        {/* Zone 3: Language Switch, Theme Switch, Windows Packager, Install & Reset */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Language Switcher EN / FR */}
          <button
            type="button"
            onClick={toggleLanguage}
            title={t.header.switchLanguage}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            <Languages className="w-3.5 h-3.5 text-cyan-400" />
            <span>{language.toUpperCase()}</span>
          </button>

          {/* Dark / Light Theme Toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            title={theme === 'dark' ? t.header.switchToLight : t.header.switchToDark}
            aria-label={theme === 'dark' ? t.header.switchToLight : t.header.switchToDark}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            {theme === 'dark' ? (
              <Sun className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <Moon className="w-3.5 h-3.5 text-blue-400" />
            )}
            <span className="hidden sm:inline">{theme === 'dark' ? 'Light' : 'Dark'}</span>
          </button>

          {/* Windows Packager CTA */}
          <button
            onClick={onOpenWindowsPackager}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-600 rounded-lg hover:from-blue-500 hover:to-cyan-500 transition-all shadow-sm hover:shadow-cyan-900/30 whitespace-nowrap shrink-0 cursor-pointer"
            title={t.header.packagerTitle}
          >
            <Laptop className="w-3.5 h-3.5" />
            <span className="hidden md:inline">{t.header.packagerCta}</span>
          </button>

          {/* Direct PWA Install Button if available */}
          {isInstallable && !isInstalled && (
            <button
              onClick={install}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-cyan-300 bg-cyan-950/60 border border-cyan-800 rounded-lg hover:bg-cyan-900/40 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              title={t.header.installTitle}
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.header.installCta}</span>
            </button>
          )}

          {isInstalled && (
            <div className="hidden sm:flex items-center gap-1 text-xs text-emerald-400 px-2.5 py-1 rounded bg-emerald-950/40 border border-emerald-900/50">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{t.header.installedApp}</span>
            </div>
          )}

          <button
            onClick={onResetWorkspace}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 rounded-lg transition-colors cursor-pointer"
            title={t.header.resetTitle}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tablet / Compact Sub-Navigation Bar */}
      <div className="xl:hidden flex items-center gap-2 px-4 py-2 overflow-x-auto border-t border-slate-800/60 bg-slate-900/50">
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
