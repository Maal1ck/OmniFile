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
} from 'lucide-react';
import { VirtualFile, FileCategory } from '../types/fileSystem';
import { formatBytes, formatDate } from '../utils/fileHelpers';

interface FileTableProps {
  files: VirtualFile[];
  onToggleSelect: (id: string) => void;
  onSelectAll: (select: boolean) => void;
  onInvertSelection: () => void;
  onRemoveFile: (id: string) => void;
  onRemoveSelected: () => void;
  onQuickAction: (action: 'rename' | 'compress' | 'flatten' | 'organize' | 'semantic' | 'dedup' | 'privacy' | 'visualizer') => void;
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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<FileCategory | 'all'>('all');
  const [previewFile, setPreviewFile] = useState<VirtualFile | null>(null);

  const categories: Array<{ id: FileCategory | 'all'; label: string; count: number }> = useMemo(() => {
    const counts: Record<string, number> = { all: files.length };
    files.forEach((f) => {
      counts[f.category] = (counts[f.category] || 0) + 1;
    });

    const list: Array<{ id: FileCategory | 'all'; label: string; count: number }> = [
      { id: 'all', label: 'All Files', count: files.length },
      { id: 'documents', label: 'Documents', count: counts['documents'] || 0 },
      { id: 'spreadsheets', label: 'Sheets', count: counts['spreadsheets'] || 0 },
      { id: 'images', label: 'Images', count: counts['images'] || 0 },
      { id: 'audio', label: 'Audio', count: counts['audio'] || 0 },
      { id: 'videos', label: 'Video', count: counts['videos'] || 0 },
      { id: 'archives', label: 'Archives', count: counts['archives'] || 0 },
      { id: 'code', label: 'Code', count: counts['code'] || 0 },
    ];
    return list.filter((c) => c.id === 'all' || c.count > 0);
  }, [files]);

  const filteredFiles = useMemo(() => {
    return files.filter((f) => {
      const matchesSearch =
        searchQuery === '' ||
        f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.relativePath.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || f.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [files, searchQuery, selectedCategory]);

  const selectedCount = files.filter((f) => f.selected).length;
  const allSelected = files.length > 0 && selectedCount === files.length;
  const isIndeterminate = selectedCount > 0 && selectedCount < files.length;

  const getFileIcon = (cat: FileCategory) => {
    switch (cat) {
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
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by file name or directory path..."
            className="w-full bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-500 text-xs rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:border-cyan-500 transition-colors"
          />
        </div>

        {/* Quick Batch Actions if items selected */}
        <div className="flex items-center gap-2 shrink-0">
          {selectedCount > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 mr-1">
                <span className="font-mono tabular-nums font-semibold text-cyan-400">{selectedCount}</span> of{' '}
                <span className="font-mono tabular-nums">{files.length}</span> selected
              </span>

              <button
                type="button"
                onClick={() => onQuickAction('semantic')}
                className="px-2.5 py-1 text-xs font-medium text-cyan-300 bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-800 rounded-md transition-colors cursor-pointer"
                title="Extract invoice & content DNA"
              >
                File DNA
              </button>
              <button
                type="button"
                onClick={() => onQuickAction('dedup')}
                className="px-2.5 py-1 text-xs font-medium text-amber-300 bg-amber-950/60 hover:bg-amber-900/60 border border-amber-800 rounded-md transition-colors cursor-pointer"
                title="Detect hash duplicate files"
              >
                Duplicates
              </button>
              <button
                type="button"
                onClick={() => onQuickAction('privacy')}
                className="px-2.5 py-1 text-xs font-medium text-purple-300 bg-purple-950/60 hover:bg-purple-900/60 border border-purple-800 rounded-md transition-colors cursor-pointer"
                title="Scrub EXIF & private tokens"
              >
                Privacy
              </button>
              <button
                type="button"
                onClick={() => onQuickAction('rename')}
                className="px-2.5 py-1 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-md transition-colors cursor-pointer"
              >
                Rename
              </button>
              <button
                type="button"
                onClick={() => onQuickAction('compress')}
                className="px-2.5 py-1 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-md transition-colors cursor-pointer"
              >
                Compress
              </button>
              <button
                type="button"
                onClick={() => onQuickAction('flatten')}
                className="px-2.5 py-1 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-md transition-colors cursor-pointer"
              >
                Flatten
              </button>
              <button
                type="button"
                onClick={() => onQuickAction('organize')}
                className="px-2.5 py-1 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-md transition-colors cursor-pointer"
              >
                Organize
              </button>

              <button
                type="button"
                onClick={onRemoveSelected}
                className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-md transition-colors cursor-pointer"
                title="Remove selected from workspace"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Category Filter Bar (Interactive segmented controls) */}
      <div className="px-4 py-2 border-b border-slate-800 bg-slate-950/40 flex items-center gap-1.5 overflow-x-auto text-xs">
        <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500 mr-1 shrink-0" />
        {categories.map((cat) => {
          const isActive = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
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
            <span>Select All</span>
          </button>
          <button
            type="button"
            onClick={onInvertSelection}
            className="hover:text-slate-200 transition-colors cursor-pointer"
          >
            Invert
          </button>
        </div>

        <div className="text-[11px] text-slate-500 font-mono">
          Showing {filteredFiles.length} of {files.length} items
        </div>
      </div>

      {/* High-density Data Table */}
      <div className="overflow-x-auto max-h-[520px]">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <th className="py-2.5 px-4 w-10"></th>
              <th className="py-2.5 px-4">File Name & Source Hierarchy</th>
              <th className="py-2.5 px-4 w-28">Type</th>
              <th className="py-2.5 px-4 w-28 text-right">Size</th>
              <th className="py-2.5 px-4 w-36 text-right">Last Modified</th>
              <th className="py-2.5 px-4 w-16 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-xs">
            {filteredFiles.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-500">
                  No files match your search filter
                </td>
              </tr>
            ) : (
              filteredFiles.map((file) => {
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
                    {/* Checkbox */}
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

                    {/* File Name & Path */}
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

                    {/* Type & Extension */}
                    <td className="py-2 px-4 whitespace-nowrap">
                      <span className="font-mono text-[11px] uppercase text-slate-400">
                        .{file.extension || 'none'}
                      </span>
                    </td>

                    {/* Size */}
                    <td className="py-2 px-4 text-right font-mono tabular-nums text-slate-300 whitespace-nowrap">
                      {formatBytes(file.size)}
                    </td>

                    {/* Modified Date */}
                    <td className="py-2 px-4 text-right font-mono tabular-nums text-slate-400 whitespace-nowrap">
                      {formatDate(file.lastModified, 'YYYY-MM-DD')}
                    </td>

                    {/* Actions */}
                    <td className="py-2 px-4 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => setPreviewFile(file)}
                          className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                          title="Inspect metadata"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemoveFile(file.id)}
                          className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded transition-colors cursor-pointer"
                          title="Remove file"
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
                <span className="text-slate-500 block">Relative Directory Path</span>
                <span className="font-mono text-slate-300 break-all">{previewFile.relativePath}</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-slate-500 block">Exact Size</span>
                  <span className="font-mono tabular-nums text-slate-300">
                    {previewFile.size.toLocaleString()} bytes ({formatBytes(previewFile.size)})
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Category</span>
                  <span className="capitalize text-slate-300">{previewFile.category}</span>
                </div>
              </div>
              <div>
                <span className="text-slate-500 block">Last Modified Timestamp</span>
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
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
