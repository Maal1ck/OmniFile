import React, { useMemo, useState } from 'react';
import {
  Search,
  CheckSquare,
  Square,
  Trash2,
  FileText,
  FileSpreadsheet,
  FileImage,
  FileAudio,
  FileVideo,
  FileArchive,
  FileCode,
  File,
  Eye,
  SlidersHorizontal,
  Globe,
} from 'lucide-react';
import { VirtualFile, FileCategory } from '../types/fileSystem';
import { formatBytes, formatDate } from '../utils/fileHelpers';
import { useAppSettings } from '../context/AppSettingsContext';

interface FileTableProps {
  files: VirtualFile[];
  onToggleSelect: (id: string) => void;
  onSelectAll: (select: boolean) => void;
  onInvertSelection: () => void;
  onRemoveFile: (id: string) => void;
  onRemoveSelected: () => void;
  onQuickAction: (
    action: 'rename' | 'compress' | 'flatten' | 'organize' | 'semantic' | 'dedup' | 'privacy' | 'visualizer'
  ) => void;
}

export const FileTable: React.FC<FileTableProps> = ({
  files,
  onToggleSelect,
  onSelectAll,
  onInvertSelection,
  onRemoveFile,
  onRemoveSelected,
  onQuickAction,
}) => {
  const { t } = useAppSettings();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<FileCategory | 'all'>('all');
  const [previewFile, setPreviewFile] = useState<VirtualFile | null>(null);
  const [visibleLimit, setVisibleLimit] = useState(200);

  const categories: Array<{ id: FileCategory | 'all'; label: string; count: number }> = useMemo(() => {
    const counts: Record<string, number> = { all: files.length };
    files.forEach((f) => {
      counts[f.category] = (counts[f.category] || 0) + 1;
    });

    const list: Array<{ id: FileCategory | 'all'; label: string; count: number }> = [
      { id: 'all', label: t.fileTable.allFiles, count: files.length },
      { id: 'geospatial', label: t.fileTable.categories.geospatial, count: counts['geospatial'] || 0 },
      { id: 'documents', label: t.fileTable.categories.documents, count: counts['documents'] || 0 },
      { id: 'spreadsheets', label: t.fileTable.categories.spreadsheets, count: counts['spreadsheets'] || 0 },
      { id: 'images', label: t.fileTable.categories.images, count: counts['images'] || 0 },
      { id: 'audio', label: t.fileTable.categories.audio, count: counts['audio'] || 0 },
      { id: 'videos', label: t.fileTable.categories.videos, count: counts['videos'] || 0 },
      { id: 'archives', label: t.fileTable.categories.archives, count: counts['archives'] || 0 },
      { id: 'code', label: t.fileTable.categories.code, count: counts['code'] || 0 },
      { id: 'data', label: t.fileTable.categories.data, count: counts['data'] || 0 },
      { id: 'presentations', label: t.fileTable.categories.presentations, count: counts['presentations'] || 0 },
      { id: 'other', label: t.fileTable.categories.other, count: counts['other'] || 0 },
    ];
    return list.filter((c) => c.id === 'all' || c.count > 0);
  }, [files, t.fileTable]);

  const filteredFiles = useMemo(() => {
    const normalizedQuery = searchQuery.toLowerCase();
    return files.filter((f) => {
      const matchesSearch =
        normalizedQuery === '' ||
        f.name.toLowerCase().includes(normalizedQuery) ||
        f.relativePath.toLowerCase().includes(normalizedQuery);
      const matchesCategory = selectedCategory === 'all' || f.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [files, searchQuery, selectedCategory]);

  const visibleFiles = useMemo(
    () => filteredFiles.slice(0, visibleLimit),
    [filteredFiles, visibleLimit]
  );
  const selectedCount = useMemo(
    () => files.reduce((count, file) => count + Number(file.selected), 0),
    [files]
  );
  const allSelected = files.length > 0 && selectedCount === files.length;
  const isIndeterminate = selectedCount > 0 && selectedCount < files.length;

  const getFileIcon = (cat: FileCategory) => {
    switch (cat) {
      case 'geospatial':
        return <Globe className="w-4 h-4 text-teal-400 shrink-0" />;
      case 'documents':
        return <FileText className="w-4 h-4 text-blue-400 shrink-0" />;
      case 'spreadsheets':
        return <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />;
      case 'images':
        return <FileImage className="w-4 h-4 text-amber-400 shrink-0" />;
      case 'audio':
        return <FileAudio className="w-4 h-4 text-purple-400 shrink-0" />;
      case 'videos':
        return <FileVideo className="w-4 h-4 text-rose-400 shrink-0" />;
      case 'archives':
        return <FileArchive className="w-4 h-4 text-orange-400 shrink-0" />;
      case 'code':
        return <FileCode className="w-4 h-4 text-cyan-400 shrink-0" />;
      default:
        return <File className="w-4 h-4 text-slate-400 shrink-0" />;
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
      {/* Control Toolbar */}
      <div className="p-4 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setVisibleLimit(200);
            }}
            placeholder={t.fileTable.searchPlaceholder}
            className="w-full bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-500 text-xs rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:border-cyan-500 transition-colors"
          />
        </div>

        {/* Quick Batch Actions */}
        <div className="flex items-center gap-2 shrink-0 overflow-x-auto">
          {selectedCount > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 mr-1 whitespace-nowrap">
                <span className="font-mono tabular-nums font-semibold text-cyan-400">{selectedCount}</span>{' '}
                {t.fileTable.of}{' '}
                <span className="font-mono tabular-nums">{files.length}</span> {t.fileTable.selected}
              </span>

              <button
                type="button"
                onClick={() => onQuickAction('semantic')}
                className="px-2.5 py-1 text-xs font-medium text-cyan-300 bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-800 rounded-md transition-colors cursor-pointer whitespace-nowrap"
                title={t.fileTable.dnaTitle}
              >
                {t.fileTable.dnaBtn}
              </button>
              <button
                type="button"
                onClick={() => onQuickAction('dedup')}
                className="px-2.5 py-1 text-xs font-medium text-amber-300 bg-amber-950/60 hover:bg-amber-900/60 border border-amber-800 rounded-md transition-colors cursor-pointer whitespace-nowrap"
                title={t.fileTable.dupTitle}
              >
                {t.fileTable.dupBtn}
              </button>
              <button
                type="button"
                onClick={() => onQuickAction('privacy')}
                className="px-2.5 py-1 text-xs font-medium text-purple-300 bg-purple-950/60 hover:bg-purple-900/60 border border-purple-800 rounded-md transition-colors cursor-pointer whitespace-nowrap"
                title={t.fileTable.privacyTitle}
              >
                {t.fileTable.privacyBtn}
              </button>
              <button
                type="button"
                onClick={() => onQuickAction('rename')}
                className="px-2.5 py-1 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-md transition-colors cursor-pointer whitespace-nowrap"
              >
                {t.fileTable.renameBtn}
              </button>
              <button
                type="button"
                onClick={() => onQuickAction('compress')}
                className="px-2.5 py-1 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-md transition-colors cursor-pointer whitespace-nowrap"
              >
                {t.fileTable.compressBtn}
              </button>
              <button
                type="button"
                onClick={() => onQuickAction('flatten')}
                className="px-2.5 py-1 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-md transition-colors cursor-pointer whitespace-nowrap"
              >
                {t.fileTable.flattenBtn}
              </button>
              <button
                type="button"
                onClick={() => onQuickAction('organize')}
                className="px-2.5 py-1 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-md transition-colors cursor-pointer whitespace-nowrap"
              >
                {t.fileTable.organizeBtn}
              </button>

              <button
                type="button"
                onClick={onRemoveSelected}
                className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-md transition-colors cursor-pointer"
                title={t.fileTable.removeSelectedTitle}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Category Filter Bar */}
      <div className="px-4 py-2 border-b border-slate-800 bg-slate-950/40 flex items-center gap-1.5 overflow-x-auto text-xs">
        <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500 mr-1 shrink-0" />
        {categories.map((cat) => {
          const isActive = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => {
                setSelectedCategory(cat.id);
                setVisibleLimit(200);
              }}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-slate-800 text-cyan-400 border border-slate-700 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
              }`}
            >
              <span>{cat.label}</span>
              <span className="ml-1.5 text-[10px] font-mono tabular-nums text-slate-500">
                {cat.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Selection Control Bar */}
      <div className="px-4 py-2 bg-slate-950/20 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onSelectAll(!allSelected)}
            className="flex items-center gap-1.5 hover:text-slate-200 transition-colors cursor-pointer font-medium"
          >
            {allSelected ? (
              <CheckSquare className="w-3.5 h-3.5 text-cyan-400" />
            ) : isIndeterminate ? (
              <Square className="w-3.5 h-3.5 text-cyan-400" />
            ) : (
              <Square className="w-3.5 h-3.5 text-slate-500" />
            )}
            <span>{t.fileTable.selectAll}</span>
          </button>
          <button
            type="button"
            onClick={onInvertSelection}
            className="hover:text-slate-200 transition-colors cursor-pointer"
          >
            {t.fileTable.invert}
          </button>
        </div>

        <div className="text-[11px] text-slate-500 font-mono">
          {t.fileTable.showing} {visibleFiles.length} {t.fileTable.of} {filteredFiles.length}{' '}
          {t.fileTable.matchingItems}
        </div>
      </div>

      {/* High-density Data Table */}
      <div className="overflow-x-auto max-h-[520px]">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <th className="py-2.5 px-4 w-10"></th>
              <th className="py-2.5 px-4">{t.fileTable.colName}</th>
              <th className="py-2.5 px-4 w-28">{t.fileTable.colType}</th>
              <th className="py-2.5 px-4 w-28 text-right">{t.fileTable.colSize}</th>
              <th className="py-2.5 px-4 w-36 text-right">{t.fileTable.colModified}</th>
              <th className="py-2.5 px-4 w-16 text-center">{t.fileTable.colAction}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-xs">
            {files.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-16 text-center text-slate-500">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <File className="w-8 h-8 text-slate-600 stroke-[1.5]" />
                    <span className="text-sm font-medium text-slate-400">{t.fileTable.emptyTitle}</span>
                    <span className="text-xs text-slate-500">{t.fileTable.emptySubtitle}</span>
                  </div>
                </td>
              </tr>
            ) : visibleFiles.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-500">
                  {t.fileTable.noMatch}
                </td>
              </tr>
            ) : (
              visibleFiles.map((file) => {
                const parentDir = file.relativePath.includes('/')
                  ? file.relativePath.substring(0, file.relativePath.lastIndexOf('/'))
                  : null;

                return (
                  <tr
                    key={file.id}
                    className={`hover:bg-slate-800/40 transition-colors group ${
                      file.selected ? 'bg-cyan-950/15' : ''
                    }`}
                  >
                    <td className="py-2 px-4">
                      <button
                        type="button"
                        onClick={() => onToggleSelect(file.id)}
                        className="cursor-pointer text-slate-500 hover:text-slate-300 transition-colors"
                      >
                        {file.selected ? (
                          <CheckSquare className="w-3.5 h-3.5 text-cyan-400" />
                        ) : (
                          <Square className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </td>

                    <td className="py-2 px-4 min-w-[280px]">
                      <div className="flex items-center gap-2.5">
                        {getFileIcon(file.category)}
                        <div className="overflow-hidden">
                          <div className="font-medium text-slate-200 truncate">{file.name}</div>
                          {parentDir && (
                            <div className="text-[11px] font-mono text-slate-500 truncate">
                              {parentDir}/
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="py-2 px-4 whitespace-nowrap">
                      <span className="font-mono text-[11px] uppercase text-slate-400">
                        .{file.extension || t.fileTable.noneExt}
                      </span>
                    </td>

                    <td className="py-2 px-4 text-right font-mono tabular-nums text-slate-300 whitespace-nowrap">
                      {formatBytes(file.size)}
                    </td>

                    <td className="py-2 px-4 text-right font-mono tabular-nums text-slate-400 whitespace-nowrap">
                      {formatDate(file.lastModified, 'YYYY-MM-DD')}
                    </td>

                    <td className="py-2 px-4 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => setPreviewFile(file)}
                          className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                          title={t.fileTable.inspectMetadata}
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemoveFile(file.id)}
                          className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded transition-colors cursor-pointer"
                          title={t.fileTable.removeFile}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {visibleFiles.length < filteredFiles.length && (
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

      {/* Metadata Quick Inspector Modal */}
      {previewFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-lg w-full shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                {getFileIcon(previewFile.category)}
                <h4 className="font-semibold text-slate-100 truncate max-w-xs">{previewFile.name}</h4>
              </div>
              <button
                onClick={() => setPreviewFile(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="py-4 space-y-3 text-xs">
              <div>
                <span className="text-slate-500 block">{t.fileTable.modalRelPath}</span>
                <span className="font-mono text-slate-300 break-all">{previewFile.relativePath}</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-slate-500 block">{t.fileTable.modalExactSize}</span>
                  <span className="font-mono tabular-nums text-slate-300">
                    {previewFile.size.toLocaleString()} bytes ({formatBytes(previewFile.size)})
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">{t.fileTable.modalCategory}</span>
                  <span className="capitalize text-slate-300">
                    {t.fileTable.categories[previewFile.category]}
                  </span>
                </div>
              </div>
              <div>
                <span className="text-slate-500 block">{t.fileTable.modalModified}</span>
                <span className="font-mono tabular-nums text-slate-300">
                  {formatDate(previewFile.lastModified, 'YYYY-MM-DD HH:mm')}
                </span>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewFile(null)}
                className="px-4 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                {t.fileTable.close}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
