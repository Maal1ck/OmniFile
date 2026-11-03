import React, { useMemo, useState } from 'react';
import {
  Tag,
  ArrowRight,
  Sparkles,
  Download,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { VirtualFile, RenameConfig, RenameMode } from '../types/fileSystem';
import {
  computeBatchRename,
  createZipArchive,
  triggerFileDownload,
} from '../utils/fileHelpers';

interface BatchRenameModuleProps {
  files: VirtualFile[];
  onApplyRenames: (updatedFiles: VirtualFile[]) => void;
  onStartProgress: (title: string) => void;
  onUpdateProgress: (percent: number, item: string) => void;
  onFinishProgress: () => void;
}

export const BatchRenameModule: React.FC<BatchRenameModuleProps> = ({
  files,
  onApplyRenames,
  onStartProgress,
  onUpdateProgress,
  onFinishProgress,
}) => {
  const [config, setConfig] = useState<RenameConfig>({
    mode: 'template',
    template: 'Doc_{YYYY}-{MM}_{num:3}',
    search: 'Invoice_',
    replace: 'Bill_',
    useRegex: false,
    matchCase: false,
    prefix: 'Client_',
    suffix: '_v1',
    caseType: 'snake',
    startNumber: 1,
    stepNumber: 1,
    digitsPadding: 3,
    dateFormat: 'YYYY-MM-DD',
    includeParentFolders: false,
    parentFolderLevels: 1,
    changeExtension: false,
    newExtension: '',
    collisionResolution: 'number_suffix',
  });

  const selectedFiles = useMemo(() => {
    const sel = files.filter((f) => f.selected);
    return sel.length > 0 ? sel : files;
  }, [files]);

  // Real-time calculated rename preview
  const previewResults = useMemo(() => {
    return computeBatchRename(selectedFiles, config);
  }, [selectedFiles, config]);

  const modifiedCount = previewResults.filter((r) => r.isModified).length;
  const collisionCount = previewResults.filter((r) => r.hasCollision).length;

  const handleApplyToWorkspace = () => {
    const updated = files.map((file) => {
      const match = previewResults.find((r) => r.file.id === file.id);
      if (match && match.isModified) {
        return {
          ...file,
          name: match.collisionResolvedName,
          relativePath: match.targetPath,
          extension: match.collisionResolvedName.split('.').pop() || '',
        };
      }
      return file;
    });

    onApplyRenames(updated);
  };

  const handleExportRenamedZip = async () => {
    onStartProgress('Compressing & Exporting Renamed Files...');
    const itemsToZip = previewResults.map((r) => ({
      path: r.collisionResolvedName,
      file: r.file,
    }));

    try {
      const zipBlob = await createZipArchive(itemsToZip, {
        compressionLevel: 6,
        onProgress: (p, item) => onUpdateProgress(p, item),
      });
      triggerFileDownload(zipBlob, `renamed_batch_${Date.now()}.zip`);
    } finally {
      onFinishProgress();
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Control Deck */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-800 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Tag className="w-5 h-5 text-cyan-400" />
              <h2 className="text-lg font-bold text-white tracking-tight">Batch File Renamer</h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Construct dynamic patterns, regex substitutions, and casing transformations with instant live preview.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleApplyToWorkspace}
              disabled={modifiedCount === 0}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:pointer-events-none rounded-lg transition-colors cursor-pointer shadow-sm"
            >
              <Sparkles className="w-4 h-4" />
              <span>Apply to Workspace ({modifiedCount})</span>
            </button>

            <button
              type="button"
              onClick={handleExportRenamedZip}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors cursor-pointer shadow-sm"
            >
              <Download className="w-4 h-4 text-cyan-400" />
              <span>Export as ZIP</span>
            </button>
          </div>
        </div>

        {/* Mode Selector Tabs (Clean segmented control buttons) */}
        <div className="pt-6">
          <label className="text-xs font-semibold text-slate-300 block mb-2">Rename Strategy</label>
          <div className="flex flex-wrap gap-2 p-1 bg-slate-950 border border-slate-800 rounded-lg">
            {[
              { id: 'template', label: 'Pattern Template' },
              { id: 'replace', label: 'Search & Replace / Regex' },
              { id: 'prefix_suffix', label: 'Prefix & Suffix' },
              { id: 'case', label: 'Case Conversion' },
              { id: 'numbering', label: 'Sequence Numbering' },
              { id: 'date', label: 'Date Stamping' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setConfig({ ...config, mode: tab.id as RenameMode })}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  config.mode === tab.id
                    ? 'bg-slate-800 text-cyan-400 shadow-sm border border-slate-700'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic Mode Form Controls */}
        <div className="mt-6 pt-6 border-t border-slate-800/80">
          {config.mode === 'template' && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Template Pattern
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={config.template}
                    onChange={(e) => setConfig({ ...config, template: e.target.value })}
                    className="flex-1 bg-slate-950 border border-slate-800 text-slate-100 font-mono text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500"
                    placeholder="e.g. Invoice_{YYYY}-{MM}_{num:3}"
                  />
                </div>
              </div>

              {/* Token Quick Inserts */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
                <span className="text-[11px] text-slate-500">Insert token:</span>
                {[
                  { token: '[name]', desc: 'Original Name' },
                  { token: '{num:3}', desc: 'Padded # (001)' },
                  { token: '{YYYY}', desc: 'Year' },
                  { token: '{MM}', desc: 'Month' },
                  { token: '{DD}', desc: 'Day' },
                  { token: '[ext]', desc: 'Extension' },
                ].map((item) => (
                  <button
                    key={item.token}
                    type="button"
                    onClick={() => setConfig({ ...config, template: `${config.template}${item.token}` })}
                    className="px-2 py-0.5 font-mono text-[11px] bg-slate-800/80 hover:bg-slate-750 text-cyan-300 rounded border border-slate-700 transition-colors cursor-pointer"
                    title={item.desc}
                  >
                    {item.token}
                  </button>
                ))}
              </div>
            </div>
          )}

          {config.mode === 'replace' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Find Text / Regex</label>
                <input
                  type="text"
                  value={config.search}
                  onChange={(e) => setConfig({ ...config, search: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-100 font-mono text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500"
                  placeholder="Text to replace..."
                />
                <div className="mt-2 flex items-center gap-4 text-xs">
                  <label className="flex items-center gap-1.5 text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.useRegex}
                      onChange={(e) => setConfig({ ...config, useRegex: e.target.checked })}
                      className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                    />
                    <span>Use Regular Expression</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.matchCase}
                      onChange={(e) => setConfig({ ...config, matchCase: e.target.checked })}
                      className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                    />
                    <span>Match Case</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Replace With</label>
                <input
                  type="text"
                  value={config.replace}
                  onChange={(e) => setConfig({ ...config, replace: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-100 font-mono text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500"
                  placeholder="Replacement string..."
                />
              </div>
            </div>
          )}

          {config.mode === 'prefix_suffix' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Add Prefix</label>
                <input
                  type="text"
                  value={config.prefix}
                  onChange={(e) => setConfig({ ...config, prefix: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-100 font-mono text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500"
                  placeholder="e.g. 2025_"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Add Suffix</label>
                <input
                  type="text"
                  value={config.suffix}
                  onChange={(e) => setConfig({ ...config, suffix: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-100 font-mono text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500"
                  placeholder="e.g. _FINAL"
                />
              </div>
            </div>
          )}

          {config.mode === 'case' && (
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-2">Target Casing</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                {[
                  { id: 'lower', label: 'lowercase' },
                  { id: 'upper', label: 'UPPERCASE' },
                  { id: 'title', label: 'Title Case' },
                  { id: 'camel', label: 'camelCase' },
                  { id: 'kebab', label: 'kebab-case' },
                  { id: 'snake', label: 'snake_case' },
                ].map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setConfig({ ...config, caseType: c.id as RenameConfig['caseType'] })}
                    className={`px-3 py-2 rounded-lg text-xs font-mono transition-colors text-center cursor-pointer border ${
                      config.caseType === c.id
                        ? 'bg-slate-800 border-cyan-500 text-cyan-300 font-semibold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {config.mode === 'numbering' && (
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Start Number</label>
                <input
                  type="number"
                  value={config.startNumber}
                  onChange={(e) => setConfig({ ...config, startNumber: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-100 font-mono text-xs rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Step Increment</label>
                <input
                  type="number"
                  value={config.stepNumber}
                  onChange={(e) => setConfig({ ...config, stepNumber: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-100 font-mono text-xs rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Digit Padding</label>
                <input
                  type="number"
                  min={1}
                  max={6}
                  value={config.digitsPadding}
                  onChange={(e) => setConfig({ ...config, digitsPadding: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-100 font-mono text-xs rounded-lg px-3 py-2"
                />
              </div>
            </div>
          )}

          {config.mode === 'date' && (
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-2">Date Format</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {['YYYY-MM-DD', 'YYYYMMDD', 'DD-MM-YYYY', 'YYYY-MM'].map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => setConfig({ ...config, dateFormat: fmt as RenameConfig['dateFormat'] })}
                    className={`px-3 py-2 rounded-lg text-xs font-mono transition-colors text-center cursor-pointer border ${
                      config.dateFormat === fmt
                        ? 'bg-slate-800 border-cyan-500 text-cyan-300 font-semibold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {fmt}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Secondary Options */}
        <div className="mt-6 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.includeParentFolders}
                  onChange={(e) => setConfig({ ...config, includeParentFolders: e.target.checked })}
                  className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                />
                <span>Include parent folders in name</span>
              </label>
              {config.includeParentFolders && (
                <label className="flex items-center gap-2">
                  <span>Levels</span>
                  <input
                    type="number"
                    min={1}
                    value={config.parentFolderLevels}
                    onChange={(e) =>
                      setConfig({ ...config, parentFolderLevels: Math.max(1, Number(e.target.value)) })
                    }
                    className="w-16 bg-slate-950 border border-slate-800 text-slate-100 font-mono text-xs rounded px-2 py-1"
                    aria-label="Parent folder levels to include"
                  />
                </label>
              )}
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.changeExtension}
                onChange={(e) => setConfig({ ...config, changeExtension: e.target.checked })}
                className="rounded border-slate-700 text-cyan-500 focus:ring-0"
              />
              <span>Change file extension to:</span>
            </label>
            {config.changeExtension && (
              <input
                type="text"
                value={config.newExtension}
                onChange={(e) => setConfig({ ...config, newExtension: e.target.value })}
                placeholder="e.g. pdf"
                className="w-20 bg-slate-950 border border-slate-800 text-slate-100 font-mono text-xs rounded px-2 py-1"
              />
            )}
          </div>

          <div className="flex items-center gap-2">
            <span>Collision Policy:</span>
            <select
              value={config.collisionResolution}
              onChange={(e) =>
                setConfig({
                  ...config,
                  collisionResolution: e.target.value as 'number_suffix' | 'keep_original',
                })
              }
              className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded px-2 py-1"
            >
              <option value="number_suffix">Auto-increment: name (1).ext</option>
              <option value="keep_original">Retain original name on conflict</option>
            </select>
          </div>
        </div>
      </div>

      {/* Live Preview Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <span className="font-semibold text-slate-100">Live Transformation Preview</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{previewResults.length} files</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums text-cyan-400">{modifiedCount} modified</span>
            {collisionCount > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="flex items-center gap-1 font-mono tabular-nums text-amber-400">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {collisionCount} resolved collisions
                </span>
              </>
            )}
          </div>
        </div>

        <div className="overflow-x-auto max-h-[480px]">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-2.5 px-4">Original Name & Path</th>
                <th className="py-2.5 px-4 w-10 text-center"></th>
                <th className="py-2.5 px-4">Resulting Name</th>
                <th className="py-2.5 px-4 w-32 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {previewResults.map((item, idx) => (
                <tr
                  key={idx}
                  className={`hover:bg-slate-800/30 transition-colors ${
                    item.isModified ? 'bg-cyan-950/10' : ''
                  }`}
                >
                  <td className="py-2.5 px-4 font-mono text-slate-400 truncate max-w-xs">
                    {item.originalPath}
                  </td>
                  <td className="py-2.5 px-4 text-center text-slate-500">
                    <ArrowRight className="w-3.5 h-3.5 mx-auto" />
                  </td>
                  <td className="py-2.5 px-4 font-mono font-medium truncate max-w-sm">
                    <span className={item.isModified ? 'text-cyan-300 font-semibold' : 'text-slate-300'}>
                      {item.collisionResolvedName}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    {item.hasCollision ? (
                      <span className="text-[11px] text-amber-400">Auto-numbered</span>
                    ) : item.isModified ? (
                      <span className="text-[11px] text-cyan-400">Renamed</span>
                    ) : (
                      <span className="text-[11px] text-slate-500">Unchanged</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
