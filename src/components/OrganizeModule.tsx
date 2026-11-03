import React, { useMemo, useState } from 'react';
import {
  FolderSync,
  Folder,
  ArrowRight,
  Sparkles,
  Download,
  Plus,
  Trash2,
  Calendar,
  Layers,
  FileCheck,
} from 'lucide-react';
import { FileCategory, VirtualFile, OrganizeConfig, OrganizeStrategy } from '../types/fileSystem';
import {
  CATEGORY_FOLDER_NAMES,
  classifyFileCategory,
  computeSmartOrganization,
  createZipArchive,
  triggerFileDownload,
} from '../utils/fileHelpers';

interface OrganizeModuleProps {
  files: VirtualFile[];
  onApplyOrganization: (updatedFiles: VirtualFile[]) => void;
  onStartProgress: (title: string) => void;
  onUpdateProgress: (percent: number, item: string) => void;
  onFinishProgress: () => void;
}

export const OrganizeModule: React.FC<OrganizeModuleProps> = ({
  files,
  onApplyOrganization,
  onStartProgress,
  onUpdateProgress,
  onFinishProgress,
}) => {
  const [config, setConfig] = useState<OrganizeConfig>({
    strategy: 'category_date',
    dateFormat: 'YYYY/MM',
    dateField: 'modified',
    flattenSourceSubdirs: false,
    excludedExtensions: [],
    outputFolderName: 'Organized',
    folderPrefix: '',
    folderSuffix: '',
    collisionResolution: 'number_suffix',
    customRules: [
      {
        id: 'rule-tax',
        name: 'Invoices & Receipts',
        extensions: ['pdf'],
        targetFolder: 'Accounting/Invoices',
      },
    ],
  });

  const [newRuleName, setNewRuleName] = useState('');
  const [newRuleExts, setNewRuleExts] = useState('');
  const [newRuleFolder, setNewRuleFolder] = useState('');
  const [showAddRule, setShowAddRule] = useState(false);

  const selectedFiles = useMemo(() => {
    const sel = files.filter((f) => f.selected);
    return sel.length > 0 ? sel : files;
  }, [files]);

  // Compute live mapping
  const previewResults = useMemo(() => {
    const includedTypeFiles = selectedFiles.filter(
      (file) => !config.excludedExtensions.includes(file.extension.toLowerCase())
    );
    return computeSmartOrganization(includedTypeFiles, config);
  }, [selectedFiles, config]);

  const extensionChoices = useMemo(() => {
    const counts = new Map<string, number>();
    selectedFiles.forEach((file) => {
      const extension = file.extension.toLowerCase();
      counts.set(extension, (counts.get(extension) || 0) + 1);
    });
    return Array.from(counts.entries()).sort(([extensionA], [extensionB]) => {
      const categoryA = classifyFileCategory(extensionA);
      const categoryB = classifyFileCategory(extensionB);
      return categoryA.localeCompare(categoryB) || extensionA.localeCompare(extensionB);
    });
  }, [selectedFiles]);

  const includedResults = useMemo(
    () => previewResults.filter((result) => result.included),
    [previewResults]
  );
  const excludedTypeCount = selectedFiles.filter((file) =>
    config.excludedExtensions.includes(file.extension.toLowerCase())
  ).length;

  // Folder clusters summary
  const destinationFolders = useMemo(() => {
    const map = new Map<string, number>();
    includedResults.forEach((r) => {
      map.set(r.destinationFolder, (map.get(r.destinationFolder) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [includedResults]);

  const handleApplyToWorkspace = () => {
    const updated = files.map((file) => {
      const match = includedResults.find((r) => r.file.id === file.id);
      if (match) {
        return {
          ...file,
          relativePath: match.targetPath,
        };
      }
      return file;
    });

    onApplyOrganization(updated);
  };

  const handleExportOrganizedZip = async () => {
    onStartProgress('Structuring & Exporting Organized Folders...');
    const itemsToZip = includedResults.map((r) => ({
      path: r.targetPath,
      file: r.file,
    }));

    try {
      const zipBlob = await createZipArchive(itemsToZip, {
        compressionLevel: 6,
        onProgress: (p, item) => onUpdateProgress(p, item),
      });
      triggerFileDownload(zipBlob, `organized_documents_${Date.now()}.zip`);
    } finally {
      onFinishProgress();
    }
  };

  const handleAddCustomRule = () => {
    if (!newRuleName || !newRuleExts || !newRuleFolder) return;
    const extensions = newRuleExts
      .split(',')
      .map((e) => e.trim().replace(/^\./, '').toLowerCase())
      .filter(Boolean);

    setConfig({
      ...config,
      customRules: [
        ...config.customRules,
        {
          id: `rule-${Date.now()}`,
          name: newRuleName,
          extensions,
          targetFolder: newRuleFolder,
        },
      ],
    });

    setNewRuleName('');
    setNewRuleExts('');
    setNewRuleFolder('');
    setShowAddRule(false);
  };

  const handleRemoveCustomRule = (id: string) => {
    setConfig({
      ...config,
      customRules: config.customRules.filter((r) => r.id !== id),
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Controls Box */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-800 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <FolderSync className="w-5 h-5 text-cyan-400" />
              <h2 className="text-lg font-bold text-white tracking-tight">
                Automated Document & File Organizer
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Automatically route and sort files into structured directory paths based on file format, extension, and creation/modified dates.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleApplyToWorkspace}
              disabled={includedResults.length === 0}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:pointer-events-none rounded-lg transition-colors cursor-pointer shadow-sm"
            >
              <Sparkles className="w-4 h-4" />
              <span>Apply Organization to Workspace</span>
            </button>

            <button
              type="button"
              onClick={handleExportOrganizedZip}
              disabled={includedResults.length === 0}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors cursor-pointer shadow-sm"
            >
              <Download className="w-4 h-4 text-cyan-400" />
              <span>Export Organized ZIP</span>
            </button>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-slate-800">
          <div className="flex items-center justify-between gap-3 mb-3">
            <label className="text-xs font-semibold text-slate-300">File types to include</label>
            <button
              type="button"
              onClick={() => setConfig({ ...config, excludedExtensions: [] })}
              className="text-xs text-cyan-400 hover:text-cyan-300 cursor-pointer"
            >
              Include all
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-4 gap-y-2">
            {extensionChoices.map(([extension, count]) => {
              const category: FileCategory = classifyFileCategory(extension);
              const isIncluded = !config.excludedExtensions.includes(extension);
              return (
                <label key={extension || 'no-extension'} className="flex items-center gap-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={isIncluded}
                    onChange={(event) => setConfig({
                      ...config,
                      excludedExtensions: event.target.checked
                        ? config.excludedExtensions.filter((item) => item !== extension)
                        : [...config.excludedExtensions, extension],
                    })}
                    className="accent-cyan-500"
                  />
                  <span className="font-mono">{extension ? `.${extension}` : 'No extension'}</span>
                  <span className="text-slate-500 truncate">{CATEGORY_FOLDER_NAMES[category]}</span>
                  <span className="ml-auto tabular-nums text-slate-500">{count}</span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="text-xs font-semibold text-slate-300">
            Output root folder
            <input
              type="text"
              value={config.outputFolderName}
              onChange={(event) => setConfig({ ...config, outputFolderName: event.target.value })}
              placeholder="Organized"
              className="mt-2 block w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-2 text-slate-200 font-mono font-normal"
            />
          </label>
          <label className="text-xs font-semibold text-slate-300">
            Destination folder prefix
            <input
              type="text"
              value={config.folderPrefix}
              onChange={(event) => setConfig({ ...config, folderPrefix: event.target.value })}
              placeholder="Optional"
              className="mt-2 block w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-2 text-slate-200 font-mono font-normal"
            />
          </label>
          <label className="text-xs font-semibold text-slate-300">
            Destination folder suffix
            <input
              type="text"
              value={config.folderSuffix}
              onChange={(event) => setConfig({ ...config, folderSuffix: event.target.value })}
              placeholder="Optional"
              className="mt-2 block w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-2 text-slate-200 font-mono font-normal"
            />
          </label>
          <label className="text-xs font-semibold text-slate-300">
            Same-name files in a destination folder
            <select
              value={config.collisionResolution}
              onChange={(event) => setConfig({
                ...config,
                collisionResolution: event.target.value as OrganizeConfig['collisionResolution'],
              })}
              className="mt-2 block w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-2 text-slate-200 font-normal"
            >
              <option value="number_suffix">Keep both with numbered names</option>
              <option value="skip">Skip later duplicates</option>
            </select>
          </label>
        </div>

        {/* Sorter Strategy Controls */}
        <div className="pt-6">
          <label className="text-xs font-semibold text-slate-300 block mb-2">Sorting Strategy</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
            {[
              {
                id: 'category_date',
                label: 'Category + Date',
                desc: 'e.g. Documents/2025/10/',
              },
              {
                id: 'category',
                label: 'Format Category',
                desc: 'e.g. Documents/, Images/',
              },
              {
                id: 'extension_date',
                label: 'Extension + Date',
                desc: 'e.g. PDF/2025-10/',
              },
              {
                id: 'extension',
                label: 'By Extension',
                desc: 'e.g. PDF/, XLSX/, JPG/',
              },
              {
                id: 'date',
                label: 'By Date Only',
                desc: 'e.g. 2025/10/12/',
              },
            ].map((strat) => (
              <button
                key={strat.id}
                type="button"
                onClick={() => setConfig({ ...config, strategy: strat.id as OrganizeStrategy })}
                className={`p-3 rounded-lg text-left text-xs transition-colors cursor-pointer border ${
                  config.strategy === strat.id
                    ? 'bg-slate-800 border-cyan-500 text-slate-100'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="font-semibold text-slate-200">{strat.label}</div>
                <div className="text-[11px] text-slate-500 font-mono mt-0.5">{strat.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Date Options */}
        {(config.strategy === 'date' ||
          config.strategy === 'category_date' ||
          config.strategy === 'extension_date') && (
          <div className="mt-6 pt-6 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                Date Folder Format:
              </span>
              <div className="flex gap-2">
                {['YYYY/MM', 'YYYY-MM', 'YYYY/MM/DD', 'YYYY-Quarter'].map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() =>
                      setConfig({ ...config, dateFormat: fmt as OrganizeConfig['dateFormat'] })
                    }
                    className={`px-2.5 py-1 text-xs font-mono rounded border transition-colors cursor-pointer ${
                      config.dateFormat === fmt
                        ? 'bg-slate-800 border-cyan-500 text-cyan-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    {fmt}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span>Timestamp Source:</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfig({ ...config, dateField: 'modified' })}
                  className={`px-2.5 py-1 rounded text-xs transition-colors cursor-pointer border ${
                    config.dateField === 'modified'
                      ? 'bg-slate-800 border-cyan-500 text-slate-200'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  Last Modified Date
                </button>
                <button
                  type="button"
                  onClick={() => setConfig({ ...config, dateField: 'created' })}
                  className={`px-2.5 py-1 rounded text-xs transition-colors cursor-pointer border ${
                    config.dateField === 'created'
                      ? 'bg-slate-800 border-cyan-500 text-slate-200'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  Creation Date
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Custom Override Rules */}
        <div className="mt-6 pt-6 border-t border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              <label className="text-xs font-semibold text-slate-300">Custom Priority Rules</label>
              <span className="text-xs text-slate-500">(Override default strategy for specific extensions)</span>
            </div>
            <button
              type="button"
              onClick={() => setShowAddRule(!showAddRule)}
              className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 cursor-pointer font-medium"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Custom Rule</span>
            </button>
          </div>

          {showAddRule && (
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg mb-3 flex flex-wrap items-center gap-3 text-xs">
              <input
                type="text"
                placeholder="Rule Name (e.g. Design Assets)"
                value={newRuleName}
                onChange={(e) => setNewRuleName(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 flex-1 min-w-[140px]"
              />
              <input
                type="text"
                placeholder="Extensions: psd, ai, figma"
                value={newRuleExts}
                onChange={(e) => setNewRuleExts(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 font-mono w-48"
              />
              <input
                type="text"
                placeholder="Target Folder: Creative/Assets"
                value={newRuleFolder}
                onChange={(e) => setNewRuleFolder(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 font-mono w-48"
              />
              <button
                type="button"
                onClick={handleAddCustomRule}
                className="px-3 py-1.5 text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white rounded cursor-pointer"
              >
                Save Rule
              </button>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {config.customRules.map((rule) => (
              <div
                key={rule.id}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs"
              >
                <span className="font-medium text-slate-200">{rule.name}:</span>
                <span className="font-mono text-cyan-400">{rule.extensions.join(', ')}</span>
                <span className="text-slate-500">→</span>
                <span className="font-mono text-slate-300">{rule.targetFolder}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveCustomRule(rule.id)}
                  className="text-slate-500 hover:text-rose-400 transition-colors ml-1 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Target Directory Clusters Summary */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">
          Destination Directory Breakdown ({destinationFolders.length} folders created)
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {destinationFolders.map(([folder, count]) => (
            <div
              key={folder}
              className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex flex-col justify-between"
            >
              <div className="flex items-center gap-2 text-cyan-400 mb-1">
                <Folder className="w-4 h-4 shrink-0" />
                <span className="text-xs font-semibold font-mono truncate text-slate-200">
                  {folder}
                </span>
              </div>
              <span className="text-[11px] font-mono tabular-nums text-slate-500">
                {count} {count === 1 ? 'file' : 'files'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Live File Mapping Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <span className="font-semibold text-slate-100">Live Organization Routing</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{includedResults.length} files included</span>
            {excludedTypeCount > 0 && (
              <span className="text-slate-500">{excludedTypeCount} excluded by type</span>
            )}
            {previewResults.some((item) => item.hasCollision) && (
              <span className="text-amber-400">
                {previewResults.filter((item) => item.hasCollision).length} name conflicts resolved
              </span>
            )}
          </div>
        </div>

        <div className="overflow-x-auto max-h-[480px]">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-2.5 px-4">Source File & Path</th>
                <th className="py-2.5 px-4 w-10 text-center"></th>
                <th className="py-2.5 px-4">New Target Structured Path</th>
                <th className="py-2.5 px-4 w-36 text-right">Rule Applied</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {previewResults.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-2.5 px-4 text-slate-400 truncate max-w-sm">
                    {item.originalPath}
                  </td>
                  <td className="py-2.5 px-4 text-center text-slate-500">
                    <ArrowRight className="w-3.5 h-3.5 mx-auto" />
                  </td>
                  <td className="py-2.5 px-4 truncate max-w-sm">
                    <span className="text-cyan-300 font-semibold">{item.targetPath}</span>
                  </td>
                  <td className="py-2.5 px-4 text-right text-slate-400 font-sans text-[11px]">
                    {!item.included ? (
                      <span className="text-rose-400 font-medium">Skipped duplicate</span>
                    ) : item.hasCollision ? (
                      <span className="text-amber-400 font-medium">Renamed to avoid conflict</span>
                    ) : item.ruleMatched ? (
                      <span className="text-amber-400 font-medium">{item.ruleMatched}</span>
                    ) : (
                      <span className="capitalize">{item.category}</span>
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
