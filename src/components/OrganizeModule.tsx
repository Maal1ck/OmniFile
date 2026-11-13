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
  Globe,
} from 'lucide-react';
import { FileCategory, VirtualFile, OrganizeConfig, OrganizeStrategy } from '../types/fileSystem';
import {
  analyzeComplementaryBundles,
  classifyFileCategory,
  computeSmartOrganization,
  createZipArchive,
  triggerFileDownload,
} from '../utils/fileHelpers';
import { useAppSettings } from '../context/AppSettingsContext';

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
  const { t, language } = useAppSettings();

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
    groupComplementaryFiles: true,
    bundleGeospatialSubfolders: true,
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
  const [visibleLimit, setVisibleLimit] = useState(200);

  const selectedFiles = useMemo(() => {
    const sel = files.filter((f) => f.selected);
    return sel.length > 0 ? sel : files;
  }, [files]);

  const excludedExtSet = useMemo(
    () => new Set(config.excludedExtensions),
    [config.excludedExtensions]
  );

  const includedTypeFiles = useMemo(
    () =>
      excludedExtSet.size === 0
        ? selectedFiles
        : selectedFiles.filter((file) => !excludedExtSet.has(file.extension.toLowerCase())),
    [selectedFiles, excludedExtSet]
  );

  // Detected geospatial & complementary bundles (computed once and shared with computeSmartOrganization)
  const bundleAnalysis = useMemo(() => {
    return analyzeComplementaryBundles(includedTypeFiles);
  }, [includedTypeFiles]);
  const detectedBundles = bundleAnalysis.bundles;

  const bundledFileCount = useMemo(
    () => detectedBundles.reduce((sum, b) => sum + b.files.length, 0),
    [detectedBundles]
  );

  // Compute live mapping
  const previewResults = useMemo(() => {
    return computeSmartOrganization(includedTypeFiles, config, bundleAnalysis);
  }, [includedTypeFiles, config, bundleAnalysis]);

  const visibleResults = useMemo(
    () => previewResults.slice(0, visibleLimit),
    [previewResults, visibleLimit]
  );

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
  const excludedTypeCount = selectedFiles.length - includedTypeFiles.length;

  // Folder clusters summary
  const destinationFolders = useMemo(() => {
    const map = new Map<string, number>();
    includedResults.forEach((r) => {
      map.set(r.destinationFolder, (map.get(r.destinationFolder) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [includedResults]);

  const handleApplyToWorkspace = () => {
    const resultById = new Map(includedResults.map((r) => [r.file.id, r]));
    const updated = files.map((file) => {
      const match = resultById.get(file.id);
      if (match) {
        return {
          ...file,
          relativePath: match.targetPath,
          category: match.category,
        };
      }
      return file;
    });

    onApplyOrganization(updated);
  };

  const handleExportOrganizedZip = async () => {
    onStartProgress(t.organize.exportProgress);
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

  const formatBundleBadge = (kind: string, count: number) => {
    if (language === 'fr') {
      if (kind === 'shapefile') return `Shapefile SIG (${count} fichiers)`;
      if (kind === 'mapinfo') return `MapInfo SIG (${count} fichiers)`;
      if (kind === 'georef_raster') return `Raster Géoréférencé (${count} fichiers)`;
      if (kind === 'geospatial_dataset') return `Jeu de données SIG (${count} fichiers)`;
      return `Lot complémentaire (${count} fichiers)`;
    }
    if (kind === 'shapefile') return `GIS Shapefile (${count} files)`;
    if (kind === 'mapinfo') return `GIS MapInfo (${count} files)`;
    if (kind === 'georef_raster') return `Georeferenced Raster (${count} files)`;
    if (kind === 'geospatial_dataset') return `GIS Dataset (${count} files)`;
    return `Complementary bundle (${count} files)`;
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
                {t.organize.title}
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {t.organize.subtitle}
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
              <span>{t.organize.applyBtn}</span>
            </button>

            <button
              type="button"
              onClick={handleExportOrganizedZip}
              disabled={includedResults.length === 0}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors cursor-pointer shadow-sm"
            >
              <Download className="w-4 h-4 text-cyan-400" />
              <span>{t.organize.exportBtn}</span>
            </button>
          </div>
        </div>

        {/* Geospatial & Complementary File Bundling Panel */}
        <div className="mt-6 p-4 rounded-xl bg-slate-950 border border-cyan-800/50 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-cyan-400 shrink-0" />
              <span className="text-xs font-bold text-slate-100">{t.organize.gisPanelTitle}</span>
            </div>
            <span className="text-[11px] font-mono text-cyan-400">
              {detectedBundles.length > 0
                ? t.organize.gisDetectedSummary(detectedBundles.length, bundledFileCount)
                : t.organize.gisNoBundles}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-4 text-xs">
            <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={config.groupComplementaryFiles !== false}
                onChange={(e) =>
                  setConfig({ ...config, groupComplementaryFiles: e.target.checked })
                }
                className="accent-cyan-500"
              />
              <span>{t.organize.gisToggleGroup}</span>
            </label>

            <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={config.bundleGeospatialSubfolders !== false}
                disabled={config.groupComplementaryFiles === false}
                onChange={(e) =>
                  setConfig({ ...config, bundleGeospatialSubfolders: e.target.checked })
                }
                className="accent-cyan-500"
              />
              <span>{t.organize.gisToggleSubfolder}</span>
            </label>
          </div>

          {detectedBundles.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {detectedBundles.slice(0, 12).map((b) => (
                <span
                  key={b.id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-cyan-950/60 border border-cyan-800/60 text-[11px] font-mono text-cyan-300"
                >
                  <Globe className="w-3 h-3 shrink-0" />
                  <span>{b.displayName}</span>
                  <span className="text-slate-400">·</span>
                  <span>{b.files.length}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* File types to include */}
        <div className="mt-6 pt-6 border-t border-slate-800">
          <div className="flex items-center justify-between gap-3 mb-3">
            <label className="text-xs font-semibold text-slate-300">{t.organize.fileTypesTitle}</label>
            <button
              type="button"
              onClick={() => setConfig({ ...config, excludedExtensions: [] })}
              className="text-xs text-cyan-400 hover:text-cyan-300 cursor-pointer"
            >
              {t.organize.includeAll}
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
                  <span className="font-mono">{extension ? `.${extension}` : t.organize.noExtension}</span>
                  <span className="text-slate-500 truncate">{t.organize.folderNames[category]}</span>
                  <span className="ml-auto tabular-nums text-slate-500">{count}</span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="text-xs font-semibold text-slate-300">
            {t.organize.outputRoot}
            <input
              type="text"
              value={config.outputFolderName}
              onChange={(event) => setConfig({ ...config, outputFolderName: event.target.value })}
              placeholder="Organized"
              className="mt-2 block w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-2 text-slate-200 font-mono font-normal"
            />
          </label>
          <label className="text-xs font-semibold text-slate-300">
            {t.organize.folderPrefix}
            <input
              type="text"
              value={config.folderPrefix}
              onChange={(event) => setConfig({ ...config, folderPrefix: event.target.value })}
              placeholder={t.organize.optional}
              className="mt-2 block w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-2 text-slate-200 font-mono font-normal"
            />
          </label>
          <label className="text-xs font-semibold text-slate-300">
            {t.organize.folderSuffix}
            <input
              type="text"
              value={config.folderSuffix}
              onChange={(event) => setConfig({ ...config, folderSuffix: event.target.value })}
              placeholder={t.organize.optional}
              className="mt-2 block w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-2 text-slate-200 font-mono font-normal"
            />
          </label>
          <label className="text-xs font-semibold text-slate-300">
            {t.organize.collisionLabel}
            <select
              value={config.collisionResolution}
              onChange={(event) => setConfig({
                ...config,
                collisionResolution: event.target.value as OrganizeConfig['collisionResolution'],
              })}
              className="mt-2 block w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-2 text-slate-200 font-normal"
            >
              <option value="number_suffix">{t.organize.collisionKeepBoth}</option>
              <option value="skip">{t.organize.collisionSkip}</option>
            </select>
          </label>
        </div>

        {/* Sorter Strategy Controls */}
        <div className="pt-6">
          <label className="text-xs font-semibold text-slate-300 block mb-2">{t.organize.strategyLabel}</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
            {(
              [
                'category_date',
                'category',
                'extension_date',
                'extension',
                'date',
              ] as OrganizeStrategy[]
            ).map((stratId) => {
              const strat = t.organize.strategies[stratId];
              return (
                <button
                  key={stratId}
                  type="button"
                  onClick={() => setConfig({ ...config, strategy: stratId })}
                  className={`p-3 rounded-lg text-left text-xs transition-colors cursor-pointer border ${
                    config.strategy === stratId
                      ? 'bg-slate-800 border-cyan-500 text-slate-100'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="font-semibold text-slate-200">{strat.label}</div>
                  <div className="text-[11px] text-slate-500 font-mono mt-0.5">{strat.desc}</div>
                </button>
              );
            })}
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
                {t.organize.dateFormatLabel}
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
              <span>{t.organize.timestampSource}</span>
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
                  {t.organize.lastModifiedDate}
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
                  {t.organize.creationDate}
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
              <label className="text-xs font-semibold text-slate-300">{t.organize.customRulesTitle}</label>
              <span className="text-xs text-slate-500">{t.organize.customRulesHint}</span>
            </div>
            <button
              type="button"
              onClick={() => setShowAddRule(!showAddRule)}
              className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 cursor-pointer font-medium"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t.organize.addCustomRule}</span>
            </button>
          </div>

          {showAddRule && (
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg mb-3 flex flex-wrap items-center gap-3 text-xs">
              <input
                type="text"
                placeholder={t.organize.ruleNamePlaceholder}
                value={newRuleName}
                onChange={(e) => setNewRuleName(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 flex-1 min-w-[140px]"
              />
              <input
                type="text"
                placeholder={t.organize.ruleExtsPlaceholder}
                value={newRuleExts}
                onChange={(e) => setNewRuleExts(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 font-mono w-48"
              />
              <input
                type="text"
                placeholder={t.organize.ruleFolderPlaceholder}
                value={newRuleFolder}
                onChange={(e) => setNewRuleFolder(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 font-mono w-48"
              />
              <button
                type="button"
                onClick={handleAddCustomRule}
                className="px-3 py-1.5 text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white rounded cursor-pointer"
              >
                {t.organize.saveRule}
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
          {t.organize.breakdownTitle(destinationFolders.length)}
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {destinationFolders.map(([folder, count]) => (
            <div
              key={folder}
              className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex flex-col justify-between"
            >
              <div className="flex items-center gap-2 text-cyan-400 mb-1">
                <Folder className="w-4 h-4 shrink-0" />
                <span className="text-xs font-semibold font-mono truncate text-slate-200" title={folder}>
                  {folder}
                </span>
              </div>
              <span className="text-[11px] font-mono tabular-nums text-slate-500">
                {count} {count === 1 ? t.fileSingular : t.filesCount}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Live File Mapping Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <span className="font-semibold text-slate-100">{t.organize.liveRouting}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {includedResults.length} {t.organize.filesIncluded}
            </span>
            {excludedTypeCount > 0 && (
              <span className="text-slate-500">
                {excludedTypeCount} {t.organize.excludedByType}
              </span>
            )}
            {previewResults.some((item) => item.hasCollision) && (
              <span className="text-amber-400">
                {previewResults.filter((item) => item.hasCollision).length} {t.organize.conflictsResolved}
              </span>
            )}
          </div>
        </div>

        <div className="overflow-x-auto max-h-[480px]">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-2.5 px-4">{t.organize.colSource}</th>
                <th className="py-2.5 px-4 w-10 text-center"></th>
                <th className="py-2.5 px-4">{t.organize.colTarget}</th>
                <th className="py-2.5 px-4 w-56 text-right">{t.organize.colRule}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {previewResults.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-slate-500 font-sans">
                    {t.organize.emptyTable}
                  </td>
                </tr>
              ) : (
                visibleResults.map((item) => (
                  <tr key={item.file.id} className="hover:bg-slate-800/30 transition-colors">
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
                        <span className="text-rose-400 font-medium">{t.organize.skippedDuplicate}</span>
                      ) : item.hasCollision ? (
                        <span className="text-amber-400 font-medium">{t.organize.renamedConflict}</span>
                      ) : item.bundleKind && item.bundleCount ? (
                        <span className="text-emerald-400 font-medium">
                          {formatBundleBadge(item.bundleKind, item.bundleCount)}
                        </span>
                      ) : item.ruleMatched ? (
                        <span className="text-amber-400 font-medium">{item.ruleMatched}</span>
                      ) : (
                        <span className="capitalize">{t.fileTable.categories[item.category]}</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {visibleResults.length < previewResults.length && (
          <div className="flex justify-center border-t border-slate-800 p-3">
            <button
              type="button"
              onClick={() => setVisibleLimit((limit) => limit + 200)}
              className="rounded-md border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white cursor-pointer"
            >
              {t.fileTable.showMore}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
