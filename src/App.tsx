import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Laptop,
  CheckCircle2,
  Trash2,
  Download,
  Command,
  Sparkles,
} from 'lucide-react';
import { VirtualFile } from './types/fileSystem';
import {
  formatBytes,
  createZipArchive,
  triggerFileDownload,
} from './utils/fileHelpers';
import { useAppSettings } from './context/AppSettingsContext';
import { Header, ActiveTab } from './components/Header';
import { DropZone } from './components/DropZone';
import { FileTable } from './components/FileTable';
import { BatchRenameModule } from './components/BatchRenameModule';
import { CompressModule } from './components/CompressModule';
import { FlattenModule } from './components/FlattenModule';
import { OrganizeModule } from './components/OrganizeModule';
import { CloudSyncModule } from './components/CloudSyncModule';
import { SemanticIntelligenceModule } from './components/SemanticIntelligenceModule';
import { DeduplicationModule } from './components/DeduplicationModule';
import { PrivacyScrubberModule } from './components/PrivacyScrubberModule';
import { DiskVisualizerModule } from './components/DiskVisualizerModule';
import { WindowsPackagingModal } from './components/WindowsPackagingModal';
import { ExecutionModal } from './components/ExecutionModal';

export default function App() {
  const { t } = useAppSettings();
  const [files, setFiles] = useState<VirtualFile[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>('workspace');
  const [isWindowsPackagerOpen, setIsWindowsPackagerOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Execution Progress Modal State
  const [progressState, setProgressState] = useState({
    isOpen: false,
    title: '',
    percent: 0,
    currentItem: '',
    isComplete: false,
  });

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 4500);
  }, []);

  // Total size calculated with tabular precision
  const totalSizeBytes = useMemo(() => {
    return files.reduce((acc, f) => acc + f.size, 0);
  }, [files]);

  const totalSizeFormatted = useMemo(() => {
    return formatBytes(totalSizeBytes);
  }, [totalSizeBytes]);

  // File Handlers
  const handleFilesAdded = useCallback(
    (newFiles: VirtualFile[]) => {
      if (newFiles.length === 0) {
        setFiles([]);
        return;
      }
      setFiles((prev) => {
        if (prev.length === 0) return newFiles;
        const existingIds = new Set(prev.map((f) => f.id));
        const fresh = newFiles.filter((f) => !existingIds.has(f.id));
        return [...fresh, ...prev];
      });
      showToast(t.app.toastAdded(newFiles.length));
    },
    [showToast, t.app]
  );

  const handleToggleSelect = useCallback((id: string) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, selected: !f.selected } : f))
    );
  }, []);

  const handleSelectAll = useCallback((select: boolean) => {
    setFiles((prev) => prev.map((f) => ({ ...f, selected: select })));
  }, []);

  const handleInvertSelection = useCallback(() => {
    setFiles((prev) => prev.map((f) => ({ ...f, selected: !f.selected })));
  }, []);

  const handleRemoveFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const handleRemoveSelected = useCallback(() => {
    setFiles((prev) => {
      const remaining = prev.filter((f) => !f.selected);
      showToast(t.app.toastRemovedSelected);
      return remaining;
    });
  }, [showToast, t.app]);

  const handleResetWorkspace = useCallback(() => {
    if (files.length === 0) return;
    if (window.confirm(t.app.confirmClear)) {
      setFiles([]);
      showToast(t.app.toastCleared);
    }
  }, [files.length, showToast, t.app]);

  const handleApplyRenames = useCallback(
    (updated: VirtualFile[]) => {
      setFiles(updated);
      setActiveTab('workspace');
      showToast(t.app.toastRenamesApplied);
    },
    [showToast, t.app]
  );

  const handleApplyFlatten = useCallback(
    (updated: VirtualFile[]) => {
      setFiles(updated);
      setActiveTab('workspace');
      showToast(t.app.toastFlattenApplied);
    },
    [showToast, t.app]
  );

  const handleApplyOrganization = useCallback(
    (updated: VirtualFile[]) => {
      setFiles(updated);
      setActiveTab('workspace');
      showToast(t.app.toastOrganizeApplied);
    },
    [showToast, t.app]
  );

  // Export all current workspace files as ZIP
  const handleExportAllZip = useCallback(async () => {
    if (files.length === 0) return;
    setProgressState({
      isOpen: true,
      title: t.app.exportingZip,
      percent: 0,
      currentItem: t.app.compiling,
      isComplete: false,
    });

    try {
      const items = files.map((f) => ({ path: f.relativePath, file: f }));
      const zipBlob = await createZipArchive(items, {
        compressionLevel: 6,
        onProgress: (p, item) => {
          setProgressState((prev) => ({
            ...prev,
            percent: p,
            currentItem: item,
          }));
        },
      });

      triggerFileDownload(zipBlob, `OmniFile_Maodo_Workspace_${Date.now()}.zip`);
      setProgressState((prev) => ({ ...prev, percent: 100, isComplete: true }));
    } catch {
      setProgressState((prev) => ({ ...prev, isOpen: false }));
    }
  }, [files, t.app]);

  // Progress modal helpers
  const handleStartProgress = useCallback(
    (title: string) => {
      setProgressState({
        isOpen: true,
        title,
        percent: 0,
        currentItem: t.app.initializing,
        isComplete: false,
      });
    },
    [t.app.initializing]
  );

  const handleUpdateProgress = useCallback((percent: number, item: string) => {
    setProgressState((prev) => ({
      ...prev,
      percent,
      currentItem: item,
    }));
  }, []);

  const handleFinishProgress = useCallback(() => {
    setProgressState((prev) => ({
      ...prev,
      percent: 100,
      isComplete: true,
    }));
    setTimeout(() => {
      setProgressState((prev) => ({ ...prev, isOpen: false }));
    }, 200);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key >= '1' && e.key <= '6') {
        e.preventDefault();
        const tabs: ActiveTab[] = ['workspace', 'rename', 'compress', 'flatten', 'organize', 'cloud'];
        const index = parseInt(e.key) - 1;
        if (tabs[index]) setActiveTab(tabs[index]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans transition-colors duration-200">
      {/* Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        fileCount={files.length}
        totalSizeFormatted={totalSizeFormatted}
        onOpenWindowsPackager={() => setIsWindowsPackagerOpen(true)}
        onResetWorkspace={handleResetWorkspace}
      />

      {/* Main Workspace Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Workspace Quick Actions Bar */}
        {activeTab === 'workspace' && (
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 rounded-xl bg-slate-900 border border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-cyan-400 border border-slate-700 shrink-0">
                <Laptop className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-base font-bold text-white tracking-tight">
                  {t.app.pipelineTitle}
                </h1>
                <p className="text-xs text-slate-400">
                  {t.app.pipelineSubtitle}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('semantic')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-cyan-300 bg-cyan-950/70 hover:bg-cyan-900/60 border border-cyan-800 rounded-lg transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{t.app.smartAutoRename}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('dedup')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-300 bg-amber-950/70 hover:bg-amber-900/60 border border-amber-800 rounded-lg transition-colors cursor-pointer"
              >
                <span>{t.app.findDuplicates}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('visualizer')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-300 bg-emerald-950/70 hover:bg-emerald-900/60 border border-emerald-800 rounded-lg transition-colors cursor-pointer"
              >
                <span>{t.app.diskHeatmap}</span>
              </button>

              <button
                type="button"
                onClick={handleExportAllZip}
                disabled={files.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors cursor-pointer disabled:opacity-40"
              >
                <Download className="w-3.5 h-3.5 text-cyan-400" />
                <span>{t.app.exportZip}</span>
              </button>

              <button
                type="button"
                onClick={() => setFiles([])}
                disabled={files.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-400 hover:text-rose-300 bg-rose-950/30 hover:bg-rose-950/50 border border-rose-900/50 rounded-lg transition-colors cursor-pointer disabled:opacity-40"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{t.app.clear}</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab 1: Workspace Dashboard */}
        {activeTab === 'workspace' && (
          <div className="space-y-6">
            <DropZone
              onFilesAdded={handleFilesAdded}
              hasFiles={files.length > 0}
              onStartProgress={handleStartProgress}
              onUpdateProgress={handleUpdateProgress}
              onFinishProgress={handleFinishProgress}
            />
            <FileTable
              files={files}
              onToggleSelect={handleToggleSelect}
              onSelectAll={handleSelectAll}
              onInvertSelection={handleInvertSelection}
              onRemoveFile={handleRemoveFile}
              onRemoveSelected={handleRemoveSelected}
              onQuickAction={(action) => setActiveTab(action)}
            />
          </div>
        )}

        {/* Tab 2: Semantic Content Intelligence */}
        {activeTab === 'semantic' && (
          <SemanticIntelligenceModule
            files={files}
            onApplyRenamesAndSort={(updated) => {
              setFiles(updated);
              setActiveTab('workspace');
              showToast(t.app.toastSemanticApplied);
            }}
            onStartProgress={handleStartProgress}
            onUpdateProgress={handleUpdateProgress}
            onFinishProgress={handleFinishProgress}
          />
        )}

        {/* Tab 3: Cryptographic Hash Deduplication */}
        {activeTab === 'dedup' && (
          <DeduplicationModule
            files={files}
            onApplyDeduplication={(remaining) => {
              setFiles(remaining);
              setActiveTab('workspace');
              showToast(t.app.toastDedupApplied);
            }}
            onStartProgress={handleStartProgress}
            onUpdateProgress={handleUpdateProgress}
            onFinishProgress={handleFinishProgress}
          />
        )}

        {/* Tab 4: Privacy & Secret Scrubber */}
        {activeTab === 'privacy' && (
          <PrivacyScrubberModule
            files={files}
            onApplySanitizedFiles={(sanitized) => {
              setFiles(sanitized);
              setActiveTab('workspace');
              showToast(t.app.toastPrivacyApplied);
            }}
            onStartProgress={handleStartProgress}
            onUpdateProgress={handleUpdateProgress}
            onFinishProgress={handleFinishProgress}
          />
        )}

        {/* Tab 5: Interactive Disk Treemap & Heatmap */}
        {activeTab === 'visualizer' && (
          <DiskVisualizerModule
            files={files}
            onFilterByCategory={(cat) => {
              setActiveTab('workspace');
              showToast(t.app.toastFilteredCat(cat));
            }}
          />
        )}

        {/* Tab 6: Batch Renamer */}
        {activeTab === 'rename' && (
          <BatchRenameModule
            files={files}
            onApplyRenames={handleApplyRenames}
            onStartProgress={handleStartProgress}
            onUpdateProgress={handleUpdateProgress}
            onFinishProgress={handleFinishProgress}
          />
        )}

        {/* Tab 7: Compress & ZIP */}
        {activeTab === 'compress' && (
          <CompressModule
            files={files}
            onFilesAdded={handleFilesAdded}
            onStartProgress={handleStartProgress}
            onUpdateProgress={handleUpdateProgress}
            onFinishProgress={handleFinishProgress}
          />
        )}

        {/* Tab 8: Flatten Directories */}
        {activeTab === 'flatten' && (
          <FlattenModule
            files={files}
            onApplyFlatten={handleApplyFlatten}
            onStartProgress={handleStartProgress}
            onUpdateProgress={handleUpdateProgress}
            onFinishProgress={handleFinishProgress}
          />
        )}

        {/* Tab 9: Smart Document & Geospatial Organizer */}
        {activeTab === 'organize' && (
          <OrganizeModule
            files={files}
            onApplyOrganization={handleApplyOrganization}
            onStartProgress={handleStartProgress}
            onUpdateProgress={handleUpdateProgress}
            onFinishProgress={handleFinishProgress}
          />
        )}

        {/* Tab 10: Cloud Sync */}
        {activeTab === 'cloud' && (
          <CloudSyncModule
            files={files}
            onStartProgress={handleStartProgress}
            onUpdateProgress={handleUpdateProgress}
            onFinishProgress={handleFinishProgress}
          />
        )}
      </main>

      {/* Footer Bar */}
      <footer className="mt-auto border-t border-slate-800 bg-slate-900/95 py-2.5 px-6 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-4 text-[11px]">
            <span className="flex items-center gap-1.5 text-slate-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>{t.app.footerReady}</span>
            </span>
            <span aria-hidden="true" className="text-slate-700">|</span>
            <span className="font-mono tabular-nums text-slate-400">
              {files.length} {t.app.activeObjects}
            </span>
            <span aria-hidden="true" className="text-slate-700">|</span>
            <span className="font-mono tabular-nums text-slate-400">
              {totalSizeFormatted}
            </span>
          </div>

          <div className="flex items-center gap-4 text-[11px] text-slate-400">
            <div className="hidden md:flex items-center gap-2">
              <Command className="w-3 h-3 text-slate-400" />
              <span>{t.app.shortcuts}</span>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-slate-300">
                Ctrl+1..6
              </kbd>
            </div>
            <button
              onClick={() => setIsWindowsPackagerOpen(true)}
              className="text-cyan-400 hover:text-cyan-300 font-medium cursor-pointer transition-colors"
            >
              {t.app.packagingGuide}
            </button>
          </div>
        </div>
      </footer>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-12 right-6 z-50 flex items-center gap-2.5 bg-slate-900 border border-cyan-500/40 text-slate-200 text-xs px-4 py-2.5 rounded-xl shadow-xl shadow-black/50 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="ml-2 text-slate-400 hover:text-white cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Windows Executable Packaging Modal */}
      <WindowsPackagingModal
        isOpen={isWindowsPackagerOpen}
        onClose={() => setIsWindowsPackagerOpen(false)}
      />

      {/* Long-running Task Progress Modal */}
      <ExecutionModal
        isOpen={progressState.isOpen}
        title={progressState.title}
        percent={progressState.percent}
        currentItem={progressState.currentItem}
        isComplete={progressState.isComplete}
        onClose={() => setProgressState((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
