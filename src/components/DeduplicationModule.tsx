import React, { useMemo, useState, useEffect } from 'react';
import {
  CopyCheck,
  Trash2,
  HardDrive,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Check,
  Layers,
} from 'lucide-react';
import { VirtualFile, DuplicateGroup, DuplicateAction } from '../types/fileSystem';
import { detectDuplicates, resolveDuplicateSet } from '../utils/groundbreakingEngines';
import { formatBytes, formatDate } from '../utils/fileHelpers';

interface DeduplicationModuleProps {
  files: VirtualFile[];
  onApplyDeduplication: (remainingFiles: VirtualFile[]) => void;
  onStartProgress: (title: string) => void;
  onUpdateProgress: (percent: number, item: string) => void;
  onFinishProgress: () => void;
}

export const DeduplicationModule: React.FC<DeduplicationModuleProps> = ({
  files,
  onApplyDeduplication,
  onStartProgress,
  onUpdateProgress,
  onFinishProgress,
}) => {
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [scanning, setScanning] = useState<boolean>(true);
  const [actionStrategy, setActionStrategy] = useState<DuplicateAction>('keep_newest');

  // Compute duplicate clusters on load
  useEffect(() => {
    let cancelled = false;
    async function scan() {
      setScanning(true);
      const groups = await detectDuplicates(files);
      if (!cancelled) {
        setDuplicateGroups(groups);
        setScanning(false);
      }
    }
    scan();
    return () => {
      cancelled = true;
    };
  }, [files]);

  const totalWastedBytes = useMemo(() => {
    return duplicateGroups.reduce((acc, g) => acc + g.totalWastedBytes, 0);
  }, [duplicateGroups]);

  const totalRedundantFilesCount = useMemo(() => {
    return duplicateGroups.reduce((acc, g) => acc + (g.files.length - 1), 0);
  }, [duplicateGroups]);

  const handleExecuteDeduplication = () => {
    if (duplicateGroups.length === 0) return;

    onStartProgress('Purging Redundant File Duplicates...');
    onUpdateProgress(30, 'Calculating cryptographic SHA-256 signatures...');

    const trashedIds = new Set<string>();

    for (const group of duplicateGroups) {
      const { trashFiles } = resolveDuplicateSet(group, actionStrategy);
      trashFiles.forEach((f) => trashedIds.add(f.id));
    }

    onUpdateProgress(80, 'Freeing reclaimed workspace capacity...');

    const remaining = files.filter((f) => !trashedIds.has(f.id));

    setTimeout(() => {
      onFinishProgress();
      onApplyDeduplication(remaining);
    }, 400);
  };

  return (
    <div className="space-y-6">
      {/* Control Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-800 gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-rose-600 flex items-center justify-center text-white shadow-md shadow-rose-950/40 shrink-0">
              <CopyCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  Cryptographic Hash Duplicate Cleaner
                </h2>
                <span className="text-[11px] font-mono text-amber-400 px-2 py-0.5 rounded bg-amber-950/60 border border-amber-800/60 font-semibold">
                  SHA-256 Engine
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                Detects identical file contents even when files have completely different names, extensions, or are hidden across separate deep subdirectories.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleExecuteDeduplication}
              disabled={scanning || duplicateGroups.length === 0}
              className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 disabled:opacity-40 rounded-lg transition-all cursor-pointer shadow-md shadow-rose-950/40"
            >
              <Trash2 className="w-4 h-4" />
              <span>Clean Redundant Copies ({totalRedundantFilesCount})</span>
            </button>
          </div>
        </div>

        {/* Highlights */}
        <div className="pt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between">
            <div>
              <div className="text-[11px] text-slate-400">Wasted Disk Space</div>
              <div className="text-lg font-mono font-bold text-rose-400 mt-0.5 tabular-nums">
                {formatBytes(totalWastedBytes)}
              </div>
            </div>
            <HardDrive className="w-6 h-6 text-slate-600" />
          </div>

          <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between">
            <div>
              <div className="text-[11px] text-slate-400">Duplicate Clusters</div>
              <div className="text-lg font-mono font-bold text-amber-400 mt-0.5 tabular-nums">
                {duplicateGroups.length} groups
              </div>
            </div>
            <Layers className="w-6 h-6 text-slate-600" />
          </div>

          <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between">
            <div>
              <div className="text-[11px] text-slate-400">Total Files Examined</div>
              <div className="text-lg font-mono font-bold text-cyan-400 mt-0.5 tabular-nums">
                {files.length} files
              </div>
            </div>
            <ShieldCheck className="w-6 h-6 text-slate-600" />
          </div>
        </div>

        {/* Strategy Selector */}
        <div className="mt-6 pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-300">Keep Preference Rule:</span>
            <div className="flex flex-wrap gap-2 text-xs">
              {[
                { id: 'keep_newest', label: 'Keep Newest Revision' },
                { id: 'keep_oldest', label: 'Keep Oldest Original' },
                { id: 'keep_shortest_path', label: 'Keep Shortest Path (Root)' },
              ].map((s) => (
                <button
                  key={s.id}
                  onClick={() => setActionStrategy(s.id as DuplicateAction)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer border ${
                    actionStrategy === s.id
                      ? 'bg-slate-800 border-cyan-500 text-cyan-300 font-semibold'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Duplicate Sets List */}
      <div className="space-y-4">
        {scanning ? (
          <div className="p-8 text-center text-xs text-slate-400 bg-slate-900 border border-slate-800 rounded-xl">
            Scanning files and calculating SHA-256 byte hashes...
          </div>
        ) : duplicateGroups.length === 0 ? (
          <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-xl">
            <Check className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
            <h4 className="font-semibold text-slate-200 text-sm">Zero Duplicates Found</h4>
            <p className="text-xs text-slate-400 mt-1">
              All files in your active workspace have distinct content signatures.
            </p>
          </div>
        ) : (
          duplicateGroups.map((group, gIdx) => {
            const { keepFile } = resolveDuplicateSet(group, actionStrategy);

            return (
              <div
                key={gIdx}
                className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm space-y-3"
              >
                <div className="flex items-center justify-between text-xs pb-3 border-b border-slate-850">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-cyan-400 font-semibold">
                      {group.hash}
                    </span>
                    <span className="text-slate-500">·</span>
                    <span className="font-mono tabular-nums text-slate-300">
                      {formatBytes(group.size)} each
                    </span>
                    <span className="text-slate-500">·</span>
                    <span className="text-rose-400 font-mono tabular-nums font-semibold">
                      +{formatBytes(group.totalWastedBytes)} wasted
                    </span>
                  </div>

                  <span className="text-[11px] text-slate-400 font-mono">
                    {group.files.length} identical copies
                  </span>
                </div>

                <div className="space-y-1.5">
                  {group.files.map((file) => {
                    const isRetained = file.id === keepFile.id;

                    return (
                      <div
                        key={file.id}
                        className={`flex items-center justify-between p-2.5 rounded-lg text-xs font-mono transition-colors ${
                          isRetained
                            ? 'bg-emerald-950/20 border border-emerald-900/50 text-emerald-200'
                            : 'bg-slate-950/60 border border-slate-850 text-slate-400'
                        }`}
                      >
                        <div className="truncate max-w-lg">
                          <span className={isRetained ? 'font-semibold text-white' : ''}>
                            {file.name}
                          </span>
                          <span className="ml-2 text-[11px] text-slate-500">
                            ({file.relativePath})
                          </span>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 text-[11px]">
                          <span className="tabular-nums">
                            {formatDate(file.lastModified, 'YYYY-MM-DD')}
                          </span>
                          {isRetained ? (
                            <span className="px-2 py-0.5 rounded bg-emerald-900/40 text-emerald-300 text-[10px] font-sans font-semibold">
                              KEEP
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-rose-950/40 text-rose-400 text-[10px] font-sans">
                              TRASH
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
