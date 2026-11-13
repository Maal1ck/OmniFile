import React, { useMemo, useState } from 'react';
import {
  FolderTree,
  ArrowRight,
  Sparkles,
  Download,
  AlertTriangle,
  Layers,
  HelpCircle,
} from 'lucide-react';
import { VirtualFile, FlattenConfig } from '../types/fileSystem';
import {
  computeDirectoryFlattening,
  createZipArchive,
  triggerFileDownload,
} from '../utils/fileHelpers';
import { useAppSettings } from '../context/AppSettingsContext';

interface FlattenModuleProps {
  files: VirtualFile[];
  onApplyFlatten: (updatedFiles: VirtualFile[]) => void;
  onStartProgress: (title: string) => void;
  onUpdateProgress: (percent: number, item: string) => void;
  onFinishProgress: () => void;
}

export const FlattenModule: React.FC<FlattenModuleProps> = ({
  files,
  onApplyFlatten,
  onStartProgress,
  onUpdateProgress,
  onFinishProgress,
}) => {
  const { t } = useAppSettings();
  const [config, setConfig] = useState<FlattenConfig>({
    separator: '_',
    collisionStrategy: 'path_prefix',
    maxDepth: 10,
    caseHandling: 'preserve',
  });

  const selectedFiles = useMemo(() => {
    const sel = files.filter((f) => f.selected);
    return sel.length > 0 ? sel : files;
  }, [files]);

  const previewResults = useMemo(() => {
    return computeDirectoryFlattening(selectedFiles, config);
  }, [selectedFiles, config]);

  const collisionCount = previewResults.filter((r) => r.hasCollision).length;
  const deepFilesCount = previewResults.filter((r) => r.depth > 0).length;

  const handleApplyToWorkspace = () => {
    const updated = files.map((file) => {
      const match = previewResults.find((r) => r.file.id === file.id);
      if (match) {
        return {
          ...file,
          name: match.flattenedName,
          relativePath: match.flattenedName,
        };
      }
      return file;
    });

    onApplyFlatten(updated);
  };

  const handleExportFlattenedZip = async () => {
    onStartProgress(t.flatten.progress);
    const itemsToZip = previewResults.map((r) => ({
      path: r.flattenedName,
      file: r.file,
    }));

    try {
      const zipBlob = await createZipArchive(itemsToZip, {
        compressionLevel: 6,
        onProgress: (p, item) => onUpdateProgress(p, item),
      });
      triggerFileDownload(zipBlob, `flattened_directory_${Date.now()}.zip`);
    } finally {
      onFinishProgress();
    }
  };

  return (
    <div className="space-y-6">
      {/* Control Box */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-800 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <FolderTree className="w-5 h-5 text-cyan-400" />
              <h2 className="text-lg font-bold text-white tracking-tight">{t.flatten.title}</h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">{t.flatten.subtitle}</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleApplyToWorkspace}
              disabled={deepFilesCount === 0}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:pointer-events-none rounded-lg transition-colors cursor-pointer shadow-sm"
            >
              <Sparkles className="w-4 h-4" />
              <span>{t.flatten.applyBtn}</span>
            </button>

            <button
              type="button"
              onClick={handleExportFlattenedZip}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors cursor-pointer shadow-sm"
            >
              <Download className="w-4 h-4 text-cyan-400" />
              <span>{t.flatten.exportBtn}</span>
            </button>
          </div>
        </div>

        {/* Configuration Grid */}
        <div className="pt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-2">
              {t.flatten.strategyLabel}
            </label>
            <div className="space-y-2">
              {(['path_prefix', 'number_suffix', 'timestamp'] as const).map((stratId) => {
                const strat = t.flatten.strategies[stratId];
                return (
                  <button
                    key={stratId}
                    type="button"
                    onClick={() =>
                      setConfig({
                        ...config,
                        collisionStrategy: stratId,
                      })
                    }
                    className={`w-full p-2.5 rounded-lg text-left text-xs transition-colors cursor-pointer border ${
                      config.collisionStrategy === stratId
                        ? 'bg-slate-800 border-cyan-500 text-slate-100'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="font-semibold text-slate-200">{strat.label}</div>
                    <div className="text-[11px] text-slate-500 font-mono">{strat.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-2">
              {t.flatten.separatorLabel}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { sep: '_', label: t.flatten.sepUnderscore },
                { sep: '-', label: t.flatten.sepHyphen },
                { sep: '.', label: t.flatten.sepDot },
              ].map((s) => (
                <button
                  key={s.sep}
                  type="button"
                  onClick={() => setConfig({ ...config, separator: s.sep as FlattenConfig['separator'] })}
                  className={`p-3 rounded-lg text-center text-xs font-mono transition-colors cursor-pointer border ${
                    config.separator === s.sep
                      ? 'bg-slate-800 border-cyan-500 text-cyan-300 font-bold'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t border-slate-800">
              <label className="text-xs font-semibold text-slate-300 block mb-2">
                {t.flatten.casingLabel}
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfig({ ...config, caseHandling: 'preserve' })}
                  className={`flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-colors cursor-pointer border ${
                    config.caseHandling === 'preserve'
                      ? 'bg-slate-800 border-cyan-500 text-slate-100'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  {t.flatten.preserveCase}
                </button>
                <button
                  type="button"
                  onClick={() => setConfig({ ...config, caseHandling: 'lowercase' })}
                  className={`flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-colors cursor-pointer border ${
                    config.caseHandling === 'lowercase'
                      ? 'bg-slate-800 border-cyan-500 text-slate-100'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  {t.flatten.normalizeLower}
                </button>
              </div>
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 mb-2">
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                <span>{t.flatten.depthTitle}</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                {t.flatten.depthDesc1}{' '}
                <span className="font-mono text-cyan-400 tabular-nums">{deepFilesCount}</span>{' '}
                {t.flatten.depthDesc2}
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-850 flex items-center justify-between text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
                <span>{t.flatten.safePreview}</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Live Preview Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <span className="font-semibold text-slate-100">{t.flatten.previewTitle}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{previewResults.length} {t.filesCount}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums text-cyan-400">
              {deepFilesCount} {t.flatten.extractedSubdirs}
            </span>
            {collisionCount > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="flex items-center gap-1 font-mono tabular-nums text-amber-400">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {collisionCount} {t.flatten.resolvedConflicts}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="overflow-x-auto max-h-[480px]">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-2.5 px-4">{t.flatten.colOriginal}</th>
                <th className="py-2.5 px-4 w-10 text-center"></th>
                <th className="py-2.5 px-4">{t.flatten.colFlattened}</th>
                <th className="py-2.5 px-4 w-28 text-right">{t.flatten.colDepth}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {previewResults.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-slate-500 font-sans">
                    {t.flatten.emptyTable}
                  </td>
                </tr>
              ) : (
                previewResults.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 px-4 text-slate-400 truncate max-w-sm">
                      {item.originalPath}
                    </td>
                    <td className="py-2.5 px-4 text-center text-slate-500">
                      <ArrowRight className="w-3.5 h-3.5 mx-auto" />
                    </td>
                    <td className="py-2.5 px-4 truncate max-w-sm">
                      <span className="text-cyan-300 font-semibold">{item.flattenedName}</span>
                      {item.hasCollision && (
                        <span className="ml-2 text-[10px] text-amber-400 font-sans px-1.5 py-0.5 rounded bg-amber-950/50 border border-amber-900">
                          {t.flatten.resolvedBadge}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-right tabular-nums text-slate-400 font-sans">
                      {item.depth === 0 ? t.flatten.rootLabel : t.flatten.levelsDeep(item.depth)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
