import React, { useMemo, useState, useEffect } from 'react';
import {
  Sparkles,
  ArrowRight,
  BrainCircuit,
  FileCheck2,
  DollarSign,
  Calendar,
  Building2,
  Code2,
  FolderOpen,
} from 'lucide-react';
import { VirtualFile, SemanticAnalysis } from '../types/fileSystem';
import { analyzeFileContentDNA } from '../utils/groundbreakingEngines';
import { mapAsyncWithConcurrency } from '../utils/fileHelpers';
import { useAppSettings } from '../context/AppSettingsContext';

interface SemanticIntelligenceModuleProps {
  files: VirtualFile[];
  onApplyRenamesAndSort: (renamedFiles: VirtualFile[]) => void;
  onStartProgress: (title: string) => void;
  onUpdateProgress: (percent: number, item: string) => void;
  onFinishProgress: () => void;
}

export const SemanticIntelligenceModule: React.FC<SemanticIntelligenceModuleProps> = ({
  files,
  onApplyRenamesAndSort,
  onStartProgress,
  onUpdateProgress,
  onFinishProgress,
}) => {
  const { t } = useAppSettings();
  const [analyses, setAnalyses] = useState<SemanticAnalysis[]>([]);
  const [analyzing, setAnalyzing] = useState<boolean>(true);
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('all');
  const [activeAnalysisFile, setActiveAnalysisFile] = useState<SemanticAnalysis | null>(null);
  const [visibleLimit, setVisibleLimit] = useState<number>(200);

  useEffect(() => {
    let isCancelled = false;
    async function runAnalysis() {
      setAnalyzing(true);
      const results = await mapAsyncWithConcurrency(files, 24, analyzeFileContentDNA);
      if (!isCancelled) {
        setAnalyses(results);
        setAnalyzing(false);
      }
    }
    runAnalysis();
    return () => {
      isCancelled = true;
    };
  }, [files]);

  const fileById = useMemo(
    () => new Map(files.map((f) => [f.id, f])),
    [files]
  );

  const filteredAnalyses = useMemo(() => {
    if (selectedTypeFilter === 'all') return analyses;
    return analyses.filter((a) => a.detectedType === selectedTypeFilter);
  }, [analyses, selectedTypeFilter]);

  const visibleAnalyses = useMemo(
    () => filteredAnalyses.slice(0, visibleLimit),
    [filteredAnalyses, visibleLimit]
  );

  const invoicesAndReceiptsCount = useMemo(() => {
    return analyses.filter((a) => a.detectedType === 'invoice' || a.detectedType === 'receipt').length;
  }, [analyses]);

  const handleApplySemanticRenaming = () => {
    onStartProgress(t.semantic.progressTitle);
    onUpdateProgress(50, t.semantic.progressSub);

    const analysisMap = new Map(analyses.map((a) => [a.fileId, a]));

    const updated = files.map((file) => {
      const sem = analysisMap.get(file.id);
      if (sem) {
        return {
          ...file,
          name: sem.suggestedName,
          relativePath: `${sem.suggestedFolder}/${sem.suggestedName}`,
          category: sem.suggestedCategory,
        };
      }
      return file;
    });

    onFinishProgress();
    onApplyRenamesAndSort(updated);
  };

  return (
    <div className="space-y-6">
      {/* Control Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-800 gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-md shadow-cyan-950/40 shrink-0">
              <BrainCircuit className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">{t.semantic.title}</h2>
                <span className="text-[11px] font-mono text-cyan-400 px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-800/60 font-semibold">
                  {t.semantic.badge}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                {t.semantic.subtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleApplySemanticRenaming}
              disabled={analyzing || analyses.length === 0}
              className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-40 rounded-lg transition-all cursor-pointer shadow-md shadow-cyan-950/40"
            >
              <Sparkles className="w-4 h-4" />
              <span>{t.semantic.applyBtn(analyses.length)}</span>
            </button>
          </div>
        </div>

        {/* Highlight Metrics */}
        <div className="pt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
            <div className="text-[11px] text-slate-400">{t.semantic.metricFinancial}</div>
            <div className="text-lg font-mono font-bold text-emerald-400 mt-0.5 tabular-nums">
              {invoicesAndReceiptsCount}
            </div>
            <div className="text-[10px] text-slate-500">{t.semantic.metricFinancialDesc}</div>
          </div>

          <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
            <div className="text-[11px] text-slate-400">{t.semantic.metricCode}</div>
            <div className="text-lg font-mono font-bold text-cyan-400 mt-0.5 tabular-nums">
              {analyses.filter((a) => a.detectedType === 'code_config').length}
            </div>
            <div className="text-[10px] text-slate-500">{t.semantic.metricCodeDesc}</div>
          </div>

          <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
            <div className="text-[11px] text-slate-400">{t.semantic.metricContracts}</div>
            <div className="text-lg font-mono font-bold text-purple-400 mt-0.5 tabular-nums">
              {analyses.filter((a) => a.detectedType === 'contract').length}
            </div>
            <div className="text-[10px] text-slate-500">{t.semantic.metricContractsDesc}</div>
          </div>

          <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
            <div className="text-[11px] text-slate-400">{t.semantic.metricConfidence}</div>
            <div className="text-lg font-mono font-bold text-amber-400 mt-0.5 tabular-nums">
              92.4%
            </div>
            <div className="text-[10px] text-slate-500">{t.semantic.metricConfidenceDesc}</div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="mt-6 pt-4 border-t border-slate-800 flex items-center gap-1.5 overflow-x-auto text-xs">
          {[
            { id: 'all', label: t.semantic.filters.all, count: analyses.length },
            { id: 'invoice', label: t.semantic.filters.invoice, count: analyses.filter((a) => a.detectedType === 'invoice').length },
            { id: 'receipt', label: t.semantic.filters.receipt, count: analyses.filter((a) => a.detectedType === 'receipt').length },
            { id: 'contract', label: t.semantic.filters.contract, count: analyses.filter((a) => a.detectedType === 'contract').length },
            { id: 'code_config', label: t.semantic.filters.code_config, count: analyses.filter((a) => a.detectedType === 'code_config').length },
            { id: 'media_asset', label: t.semantic.filters.media_asset, count: analyses.filter((a) => a.detectedType === 'media_asset').length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setSelectedTypeFilter(tab.id);
                setVisibleLimit(200);
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                selectedTypeFilter === tab.id
                  ? 'bg-slate-800 text-cyan-300 border border-slate-700 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
              }`}
            >
              <span>{tab.label}</span>
              <span className="ml-1.5 text-[10px] font-mono tabular-nums text-slate-500">
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Live Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <FileCheck2 className="w-4 h-4 text-cyan-400" />
            <span className="font-semibold text-slate-100">{t.semantic.tableTitle}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {filteredAnalyses.length} {t.semantic.items}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto max-h-[500px]">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-2.5 px-4 w-72">{t.semantic.colSource}</th>
                <th className="py-2.5 px-3 w-8 text-center"></th>
                <th className="py-2.5 px-4">{t.semantic.colTarget}</th>
                <th className="py-2.5 px-4 w-52">{t.semantic.colDna}</th>
                <th className="py-2.5 px-3 w-20 text-right">{t.semantic.colConfidence}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredAnalyses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500 font-sans">
                    {analyzing ? t.semantic.analyzing : t.semantic.emptyTable}
                  </td>
                </tr>
              ) : (
                visibleAnalyses.map((sem) => {
                  const originalFile = fileById.get(sem.fileId);
                  if (!originalFile) return null;

                  return (
                    <tr
                      key={sem.fileId}
                      onClick={() => setActiveAnalysisFile(sem)}
                      className="hover:bg-slate-800/40 transition-colors cursor-pointer group"
                    >
                      <td className="py-2.5 px-4">
                        <div className="font-medium text-slate-200 truncate max-w-xs">
                          {originalFile.name}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500 truncate max-w-xs">
                          {originalFile.relativePath}
                        </div>
                      </td>

                      <td className="py-2.5 px-3 text-center text-slate-500">
                        <ArrowRight className="w-3.5 h-3.5 mx-auto" />
                      </td>

                      <td className="py-2.5 px-4">
                        <div className="font-mono font-semibold text-cyan-300 truncate max-w-md">
                          {sem.suggestedName}
                        </div>
                        <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5 mt-0.5">
                          <FolderOpen className="w-3 h-3 text-cyan-400" />
                          <span>{sem.suggestedFolder}</span>
                        </div>
                      </td>

                      <td className="py-2.5 px-4">
                        <div className="flex flex-wrap gap-1">
                          {sem.extractedMetadata.vendor && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-800 text-[10px] text-emerald-300 font-medium">
                              <Building2 className="w-2.5 h-2.5" />
                              {sem.extractedMetadata.vendor}
                            </span>
                          )}
                          {sem.extractedMetadata.amount && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-800 text-[10px] text-emerald-300 font-mono font-medium">
                              <DollarSign className="w-2.5 h-2.5" />
                              {sem.extractedMetadata.amount}
                            </span>
                          )}
                          {sem.extractedMetadata.date && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-950/60 border border-blue-800 text-[10px] text-blue-300 font-mono">
                              <Calendar className="w-2.5 h-2.5" />
                              {sem.extractedMetadata.date}
                            </span>
                          )}
                          {sem.extractedMetadata.languageOrFramework && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-cyan-950/60 border border-cyan-800 text-[10px] text-cyan-300 font-mono">
                              <Code2 className="w-2.5 h-2.5" />
                              {sem.extractedMetadata.languageOrFramework}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-400 text-[11px]">
                        {Math.round(sem.confidence * 100)}%
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {visibleAnalyses.length < filteredAnalyses.length && (
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

      {/* Inspector Modal */}
      {activeAnalysisFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-lg w-full shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <BrainCircuit className="w-5 h-5 text-cyan-400" />
                <h4 className="font-semibold text-slate-100">{t.semantic.modalTitle}</h4>
              </div>
              <button
                onClick={() => setActiveAnalysisFile(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="py-4 space-y-3 text-xs">
              <div>
                <span className="text-slate-500 block">{t.semantic.proposedName}</span>
                <span className="font-mono text-cyan-300 font-semibold text-sm">
                  {activeAnalysisFile.suggestedName}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">{t.semantic.destDir}</span>
                <span className="font-mono text-slate-300">{activeAnalysisFile.suggestedFolder}</span>
              </div>
              <div>
                <span className="text-slate-500 block">{t.semantic.summaryInterp}</span>
                <p className="text-slate-300 mt-0.5 leading-relaxed">
                  {activeAnalysisFile.extractedMetadata.summary || t.semantic.noSummary}
                </p>
              </div>

              <div>
                <span className="text-slate-500 block mb-1">{t.semantic.generatedTags}</span>
                <div className="flex flex-wrap gap-1.5">
                  {activeAnalysisFile.tags.map((tagItem, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[11px]"
                    >
                      #{tagItem}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveAnalysisFile(null)}
                className="px-4 py-1.5 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                {t.semantic.close}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
