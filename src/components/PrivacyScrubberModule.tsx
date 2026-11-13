import React, { useMemo, useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Lock,
  KeyRound,
  MapPin,
  Eye,
  CheckCircle2,
} from 'lucide-react';
import { VirtualFile, PrivacyInspectionResult } from '../types/fileSystem';
import { inspectFilePrivacy } from '../utils/groundbreakingEngines';
import { mapAsyncWithConcurrency } from '../utils/fileHelpers';
import { useAppSettings } from '../context/AppSettingsContext';

interface PrivacyScrubberModuleProps {
  files: VirtualFile[];
  onApplySanitizedFiles: (sanitizedFiles: VirtualFile[]) => void;
  onStartProgress: (title: string) => void;
  onUpdateProgress: (percent: number, item: string) => void;
  onFinishProgress: () => void;
}

export const PrivacyScrubberModule: React.FC<PrivacyScrubberModuleProps> = ({
  files,
  onApplySanitizedFiles,
  onStartProgress,
  onUpdateProgress,
  onFinishProgress,
}) => {
  const { t } = useAppSettings();
  const [inspections, setInspections] = useState<PrivacyInspectionResult[]>([]);
  const [inspecting, setInspecting] = useState<boolean>(true);
  const [activeInspect, setActiveInspect] = useState<PrivacyInspectionResult | null>(null);
  const [visibleLimit, setVisibleLimit] = useState<number>(200);

  useEffect(() => {
    let cancelled = false;
    async function inspectAll() {
      setInspecting(true);
      const results = await mapAsyncWithConcurrency(files, 24, inspectFilePrivacy);
      if (!cancelled) {
        setInspections(results);
        setInspecting(false);
      }
    }
    inspectAll();
    return () => {
      cancelled = true;
    };
  }, [files]);

  const visibleInspections = useMemo(
    () => inspections.slice(0, visibleLimit),
    [inspections, visibleLimit]
  );

  const flaggedFiles = useMemo(() => {
    return inspections.filter(
      (ins) => ins.hasExifLocation || ins.detectedSecrets.length > 0 || ins.cleanableMetadata.length > 0
    );
  }, [inspections]);

  const totalSecretsFound = useMemo(() => {
    return inspections.reduce((acc, ins) => acc + ins.detectedSecrets.length, 0);
  }, [inspections]);

  const totalGpsTagged = useMemo(() => {
    return inspections.filter((ins) => ins.hasExifLocation).length;
  }, [inspections]);

  const handleSanitizeAllFlagged = () => {
    onStartProgress(t.privacy.progressTitle);
    onUpdateProgress(40, t.privacy.progressSub1);

    const inspectionById = new Map(inspections.map((ins) => [ins.file.id, ins]));

    const updated = files.map((file) => {
      const match = inspectionById.get(file.id);
      if (match && typeof file.content === 'string' && match.detectedSecrets.length > 0) {
        let scrubbed = file.content;
        match.detectedSecrets.forEach((sec) => {
          scrubbed = scrubbed.replace(sec.match, '[REDACTED_SECRET]');
        });
        return {
          ...file,
          content: scrubbed,
        };
      }
      return file;
    });

    onUpdateProgress(90, t.privacy.progressSub2);
    onFinishProgress();
    onApplySanitizedFiles(updated);
    setInspections((prev) =>
      prev.map((ins) => ({
        ...ins,
        hasExifLocation: false,
        cleanableMetadata: [],
        detectedSecrets: [],
        sanitized: true,
      }))
    );
  };

  return (
    <div className="space-y-6">
      {/* Control Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-800 gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-950/40 shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">{t.privacy.title}</h2>
                <span className="text-[11px] font-mono text-purple-400 px-2 py-0.5 rounded bg-purple-950/60 border border-purple-800/60 font-semibold">
                  {t.privacy.badge}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                {t.privacy.subtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleSanitizeAllFlagged}
              disabled={inspecting || flaggedFiles.length === 0}
              className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-40 rounded-lg transition-all cursor-pointer shadow-md shadow-indigo-950/40"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{t.privacy.sanitizeBtn(flaggedFiles.length)}</span>
            </button>
          </div>
        </div>

        {/* Highlight Metrics */}
        <div className="pt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between">
            <div>
              <div className="text-[11px] text-slate-400">{t.privacy.metricSecrets}</div>
              <div className="text-lg font-mono font-bold text-rose-400 mt-0.5 tabular-nums">
                {totalSecretsFound} {t.privacy.detected}
              </div>
            </div>
            <KeyRound className="w-6 h-6 text-slate-600" />
          </div>

          <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between">
            <div>
              <div className="text-[11px] text-slate-400">{t.privacy.metricGps}</div>
              <div className="text-lg font-mono font-bold text-amber-400 mt-0.5 tabular-nums">
                {totalGpsTagged} {t.privacy.images}
              </div>
            </div>
            <MapPin className="w-6 h-6 text-slate-600" />
          </div>

          <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between">
            <div>
              <div className="text-[11px] text-slate-400">{t.privacy.metricFlagged}</div>
              <div className="text-lg font-mono font-bold text-purple-400 mt-0.5 tabular-nums">
                {flaggedFiles.length} {t.filesCount}
              </div>
            </div>
            <Lock className="w-6 h-6 text-slate-600" />
          </div>
        </div>
      </div>

      {/* Flagged Items List */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <span className="font-semibold text-slate-100">{t.privacy.tableTitle}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {inspections.length} {t.privacy.scanned}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto max-h-[500px]">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-2.5 px-4 w-72">{t.privacy.colFile}</th>
                <th className="py-2.5 px-4">{t.privacy.colExposure}</th>
                <th className="py-2.5 px-4 w-36">{t.privacy.colStatus}</th>
                <th className="py-2.5 px-4 w-20 text-center">{t.privacy.colInspect}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {inspections.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-slate-500 font-sans">
                    {inspecting ? t.privacy.inspecting : t.privacy.emptyTable}
                  </td>
                </tr>
              ) : (
                visibleInspections.map((ins) => {
                  const hasIssues =
                    ins.hasExifLocation || ins.detectedSecrets.length > 0 || ins.cleanableMetadata.length > 0;

                  return (
                    <tr
                      key={ins.file.id}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        hasIssues && !ins.sanitized ? 'bg-purple-950/10' : ''
                      }`}
                    >
                      <td className="py-2.5 px-4">
                        <div className="font-medium text-slate-200 truncate max-w-xs">
                          {ins.file.name}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500 truncate max-w-xs">
                          {ins.file.relativePath}
                        </div>
                      </td>

                      <td className="py-2.5 px-4">
                        {ins.sanitized ? (
                          <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{t.privacy.sanitizedStatus}</span>
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {ins.hasExifLocation && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-950/60 border border-amber-800 text-amber-300 text-[11px]">
                                <MapPin className="w-3 h-3" />
                                <span>{t.privacy.gpsTagged}</span>
                              </span>
                            )}
                            {ins.detectedSecrets.map((s, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-950/60 border border-rose-800 text-rose-300 text-[11px] font-mono"
                              >
                                <KeyRound className="w-3 h-3" />
                                <span>{s.type}: {s.match}</span>
                              </span>
                            ))}
                            {ins.cleanableMetadata.length > 0 && !ins.hasExifLocation && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 text-[11px]">
                                <span>{t.privacy.authorTags(ins.cleanableMetadata.length)}</span>
                              </span>
                            )}
                            {!hasIssues && (
                              <span className="text-slate-500 text-[11px]">{t.privacy.clean}</span>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="py-2.5 px-4 text-xs font-mono">
                        {ins.sanitized ? (
                          <span className="text-emerald-400">{t.privacy.clean}</span>
                        ) : hasIssues ? (
                          <span className="text-purple-400 font-semibold">{t.privacy.exposed}</span>
                        ) : (
                          <span className="text-slate-500">{t.privacy.verified}</span>
                        )}
                      </td>

                      <td className="py-2.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => setActiveInspect(ins)}
                          className="p-1 text-slate-400 hover:text-slate-200 cursor-pointer"
                          title={t.privacy.viewDetails}
                        >
                          <Eye className="w-4 h-4 mx-auto" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {visibleInspections.length < inspections.length && (
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

      {/* Inspect Modal */}
      {activeInspect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-lg w-full shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-purple-400" />
                <h4 className="font-semibold text-slate-100 truncate max-w-xs">
                  {activeInspect.file.name}
                </h4>
              </div>
              <button
                onClick={() => setActiveInspect(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="py-4 space-y-3 text-xs">
              <div>
                <span className="text-slate-500 block">{t.privacy.exposedMetaFields}</span>
                <ul className="mt-1 space-y-1 text-slate-300 list-disc list-inside">
                  {activeInspect.cleanableMetadata.length > 0 ? (
                    activeInspect.cleanableMetadata.map((m, idx) => <li key={idx}>{m}</li>)
                  ) : (
                    <li className="text-slate-500 list-none">{t.privacy.noMetaTags}</li>
                  )}
                </ul>
              </div>

              {activeInspect.detectedSecrets.length > 0 && (
                <div>
                  <span className="text-rose-400 block font-semibold mb-1">
                    {t.privacy.detectedSensitiveKeys}
                  </span>
                  <div className="space-y-1.5">
                    {activeInspect.detectedSecrets.map((s, idx) => (
                      <div
                        key={idx}
                        className="p-2 bg-slate-950 border border-slate-800 rounded font-mono text-[11px] text-slate-300"
                      >
                        <div className="text-rose-400">{s.type}</div>
                        <div className="truncate text-slate-400">{s.lineText}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveInspect(null)}
                className="px-4 py-1.5 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                {t.privacy.close}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
