import React, { useMemo, useState } from 'react';
import {
  Search,
  HardDrive,
  SlidersHorizontal,
  FolderOpen,
  Filter,
  Check,
  Calendar,
  X,
  FileCheck2,
  FolderSync,
  Tag,
  Download,
  Trash2,
  Laptop,
  Layers,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import {
  VirtualFile,
  DriveInfo,
  DeepSearchFilters,
  FileCategory,
} from '../types/fileSystem';
import { DEFAULT_DRIVES, executeDeepDriveSearch } from '../utils/searchEngine';
import { formatBytes, formatDate, getFileExtension } from '../utils/fileHelpers';

interface DriveSearchModuleProps {
  files: VirtualFile[];
  onSelectFilesForAction: (selectedIds: string[]) => void;
  onSendToBatchAction: (action: 'rename' | 'compress' | 'organize' | 'flatten') => void;
  onMountDirectoryAsDrive?: () => void;
}

export const DriveSearchModule: React.FC<DriveSearchModuleProps> = ({
  files,
  onSelectFilesForAction,
  onSendToBatchAction,
  onMountDirectoryAsDrive,
}) => {
  const [drives, setDrives] = useState<DriveInfo[]>(DEFAULT_DRIVES);

  const [filters, setFilters] = useState<DeepSearchFilters>({
    query: '',
    selectedDrives: ['ALL'],
    selectedExtensions: [],
    selectedCategories: [],
    minSize: 0,
    maxSize: 0,
    dateRange: 'all',
    matchCase: false,
    useRegex: false,
    contentSearchText: '',
  });

  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(false);

  // Compute live file counts & sizes per drive
  const driveStats = useMemo(() => {
    const stats = new Map<string, { count: number; size: number }>();
    files.forEach((f) => {
      const drive = f.drive || 'C:';
      const curr = stats.get(drive) || { count: 0, size: 0 };
      curr.count += 1;
      curr.size += f.size;
      stats.set(drive, curr);
    });
    return stats;
  }, [files]);

  // Aggregate all discovered file extensions in index
  const availableExtensions = useMemo(() => {
    const counts = new Map<string, number>();
    files.forEach((f) => {
      const ext = f.extension.toLowerCase();
      if (ext) {
        counts.set(ext, (counts.get(ext) || 0) + 1);
      }
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [files]);

  // Search Results
  const searchResults = useMemo(() => {
    return executeDeepDriveSearch(files, filters);
  }, [files, filters]);

  const totalResultsSize = useMemo(() => {
    return searchResults.reduce((acc, f) => acc + f.size, 0);
  }, [searchResults]);

  const handleToggleDriveFilter = (driveLetter: string) => {
    setFilters((prev) => {
      if (driveLetter === 'ALL') {
        return { ...prev, selectedDrives: ['ALL'] };
      }
      let current = prev.selectedDrives.filter((d) => d !== 'ALL');
      if (current.includes(driveLetter)) {
        current = current.filter((d) => d !== driveLetter);
      } else {
        current.push(driveLetter);
      }
      if (current.length === 0) current = ['ALL'];
      return { ...prev, selectedDrives: current };
    });
  };

  const handleToggleExtensionFilter = (ext: string) => {
    setFilters((prev) => {
      const lower = ext.toLowerCase();
      const current = prev.selectedExtensions.includes(lower)
        ? prev.selectedExtensions.filter((e) => e !== lower)
        : [...prev.selectedExtensions, lower];
      return { ...prev, selectedExtensions: current };
    });
  };

  const handleToggleSelectFile = (id: string) => {
    setSelectedFileIds((prev) => {
      const updated = new Set(prev);
      if (updated.has(id)) updated.delete(id);
      else updated.add(id);
      return updated;
    });
  };

  const handleSelectAllResults = (selectAll: boolean) => {
    if (selectAll) {
      setSelectedFileIds(new Set(searchResults.map((f) => f.id)));
    } else {
      setSelectedFileIds(new Set());
    }
  };

  const handleForwardToWorkspaceAction = (action: 'rename' | 'compress' | 'organize' | 'flatten') => {
    const ids = Array.from(selectedFileIds.size > 0 ? selectedFileIds : new Set(searchResults.map((f) => f.id)));
    onSelectFilesForAction(ids);
    onSendToBatchAction(action);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: PC & Connected Storage Drives Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-800 gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-cyan-950/40 shrink-0">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  PC & Connected Drive Search Engine
                </h2>
                <span className="text-[11px] font-mono text-cyan-400 px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-800/60 font-semibold">
                  Multi-Volume Indexer
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                Scan your local PC drives (C:), secondary storage volumes (D:), removable external drives/USBs (E:), and network shares with instant keyword and extension filtering.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onMountDirectoryAsDrive && (
              <button
                type="button"
                onClick={onMountDirectoryAsDrive}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                <FolderOpen className="w-3.5 h-3.5 text-cyan-400" />
                <span>Mount Drive / Volume</span>
              </button>
            )}
          </div>
        </div>

        {/* Drives Status Grid */}
        <div className="pt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* All Drives Filter Card */}
          <div
            onClick={() => handleToggleDriveFilter('ALL')}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
              filters.selectedDrives.includes('ALL')
                ? 'bg-slate-800/90 border-cyan-500 shadow-md shadow-cyan-950/40'
                : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-cyan-400" />
                <span className="font-semibold text-xs text-slate-100">All Storage Volumes</span>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                Unified
              </span>
            </div>
            <div className="flex justify-between items-baseline text-[11px] font-mono text-slate-400">
              <span>{files.length} indexed files</span>
              <span className="text-cyan-300 font-bold">{formatBytes(files.reduce((a, b) => a + b.size, 0))}</span>
            </div>
          </div>

          {/* Individual Drive Cards */}
          {drives.map((drive) => {
            const isSelected = filters.selectedDrives.includes(drive.letter);
            const liveStats = driveStats.get(drive.letter) || { count: 0, size: 0 };
            const usedPct = Math.round((drive.usedSpace / drive.totalSpace) * 100);

            return (
              <div
                key={drive.id}
                onClick={() => handleToggleDriveFilter(drive.letter)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-slate-800/90 border-cyan-500 shadow-md shadow-cyan-950/40'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 truncate">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: drive.color }}
                    />
                    <span className="font-semibold text-xs text-slate-100 truncate">
                      {drive.name}
                    </span>
                  </div>
                  <span className="font-mono text-xs font-bold text-slate-300 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-850 shrink-0">
                    {drive.letter}
                  </span>
                </div>

                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between text-[10px] font-mono text-slate-400">
                    <span>{liveStats.count} files ({formatBytes(liveStats.size)})</span>
                    <span>{usedPct}% full</span>
                  </div>
                  <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${usedPct}%`, backgroundColor: drive.color }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Global Search Input Box */}
        <div className="mt-6 pt-6 border-t border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={filters.query}
                onChange={(e) => setFilters({ ...filters, query: e.target.value })}
                placeholder="Search by file name, directory path, or wildcard across all PC drives..."
                className="w-full bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 text-xs rounded-xl pl-10 pr-10 py-3 focus:outline-none focus:border-cyan-500 font-mono transition-colors shadow-inner"
              />
              {filters.query && (
                <button
                  type="button"
                  onClick={() => setFilters({ ...filters, query: '' })}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                showAdvancedFilters || filters.selectedExtensions.length > 0 || filters.dateRange !== 'all'
                  ? 'bg-slate-800 border-cyan-500 text-cyan-300'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Filters {filters.selectedExtensions.length > 0 ? `(${filters.selectedExtensions.length} exts)` : ''}</span>
            </button>
          </div>

          {/* Quick Extension Pills Bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto text-xs py-1">
            <span className="text-[11px] text-slate-500 shrink-0 mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3" />
              <span>Quick Ext:</span>
            </span>
            {availableExtensions.slice(0, 10).map(([ext, count]) => {
              const isSelected = filters.selectedExtensions.includes(ext);
              return (
                <button
                  key={ext}
                  type="button"
                  onClick={() => handleToggleExtensionFilter(ext)}
                  className={`px-2.5 py-1 rounded-md text-xs font-mono transition-colors whitespace-nowrap cursor-pointer border ${
                    isSelected
                      ? 'bg-cyan-950 text-cyan-300 border-cyan-700 font-bold'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  .{ext} <span className="text-[10px] text-slate-500 font-normal">({count})</span>
                </button>
              );
            })}
            {filters.selectedExtensions.length > 0 && (
              <button
                type="button"
                onClick={() => setFilters({ ...filters, selectedExtensions: [] })}
                className="text-[11px] text-slate-500 hover:text-rose-400 cursor-pointer ml-1 underline"
              >
                Clear exts
              </button>
            )}
          </div>

          {/* Expandable Advanced Filtering Panel */}
          {showAdvancedFilters && (
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-4 text-xs animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Search in File Contents */}
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Full-Text Content Search
                  </label>
                  <input
                    type="text"
                    value={filters.contentSearchText || ''}
                    onChange={(e) => setFilters({ ...filters, contentSearchText: e.target.value })}
                    placeholder="Search text inside files (invoices, code)..."
                    className="w-full bg-slate-900 border border-slate-700 text-slate-100 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {/* Date Modified Range */}
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1 flex items-center gap-1.5">
                    <Calendar className="w-3 h-3 text-cyan-400" />
                    <span>Date Modified</span>
                  </label>
                  <select
                    value={filters.dateRange}
                    onChange={(e) => setFilters({ ...filters, dateRange: e.target.value as DeepSearchFilters['dateRange'] })}
                    className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2"
                  >
                    <option value="all">Any Time</option>
                    <option value="today">Today (Past 24 hours)</option>
                    <option value="week">Past 7 days</option>
                    <option value="month">Past 30 days</option>
                    <option value="year">Past year</option>
                  </select>
                </div>

                {/* Min / Max Size */}
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    File Size Threshold
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={filters.minSize}
                      onChange={(e) => setFilters({ ...filters, minSize: Number(e.target.value) })}
                      className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-2 py-2"
                    >
                      <option value={0}>Min Size (Any)</option>
                      <option value={1048576}>&gt; 1 MB</option>
                      <option value={10485760}>&gt; 10 MB</option>
                      <option value={104857600}>&gt; 100 MB</option>
                    </select>

                    <select
                      value={filters.maxSize}
                      onChange={(e) => setFilters({ ...filters, maxSize: Number(e.target.value) })}
                      className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-2 py-2"
                    >
                      <option value={0}>Max Size (Any)</option>
                      <option value={1048576}>&lt; 1 MB</option>
                      <option value={10485760}>&lt; 10 MB</option>
                      <option value={104857600}>&lt; 100 MB</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Toggles */}
              <div className="flex items-center gap-6 pt-2 border-t border-slate-850 text-slate-400">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.matchCase}
                    onChange={(e) => setFilters({ ...filters, matchCase: e.target.checked })}
                    className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                  />
                  <span>Match Case Exactly</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.useRegex}
                    onChange={(e) => setFilters({ ...filters, useRegex: e.target.checked })}
                    className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                  />
                  <span>Regular Expression Syntax</span>
                </label>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Search Results Deck */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <span className="font-semibold text-slate-100">Index Query Matches</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums text-cyan-300 font-bold">{searchResults.length} files found</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums text-slate-400">{formatBytes(totalResultsSize)}</span>
            {selectedFileIds.size > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums text-emerald-400 font-semibold">
                  {selectedFileIds.size} selected
                </span>
              </>
            )}
          </div>

          {/* Action forwarding toolbar */}
          {searchResults.length > 0 && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400 text-[11px] mr-1">Batch Forward:</span>
              <button
                type="button"
                onClick={() => handleForwardToWorkspaceAction('rename')}
                className="px-2.5 py-1 text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 rounded-md transition-colors cursor-pointer"
                title="Send matched results to Batch Renamer"
              >
                Rename ({selectedFileIds.size > 0 ? selectedFileIds.size : searchResults.length})
              </button>
              <button
                type="button"
                onClick={() => handleForwardToWorkspaceAction('compress')}
                className="px-2.5 py-1 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md transition-colors cursor-pointer"
                title="Compress matches into a ZIP"
              >
                Compress ZIP
              </button>
              <button
                type="button"
                onClick={() => handleForwardToWorkspaceAction('organize')}
                className="px-2.5 py-1 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md transition-colors cursor-pointer"
                title="Organize matches into folders"
              >
                Organize
              </button>
            </div>
          )}
        </div>

        {/* Results Data Grid */}
        <div className="overflow-x-auto max-h-[520px]">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-2.5 px-4 w-10">
                  <input
                    type="checkbox"
                    checked={searchResults.length > 0 && selectedFileIds.size === searchResults.length}
                    onChange={(e) => handleSelectAllResults(e.target.checked)}
                    className="rounded border-slate-700 text-cyan-500 focus:ring-0 cursor-pointer"
                  />
                </th>
                <th className="py-2.5 px-4 w-16">Drive</th>
                <th className="py-2.5 px-4">File Name & Source Location</th>
                <th className="py-2.5 px-4 w-24">Extension</th>
                <th className="py-2.5 px-4 w-28 text-right">Size</th>
                <th className="py-2.5 px-4 w-32 text-right">Last Modified</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {searchResults.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    No files found matching your search query or selected storage drives.
                  </td>
                </tr>
              ) : (
                searchResults.map((file) => {
                  const isChecked = selectedFileIds.has(file.id);
                  const fileDrive = file.drive || 'C:';

                  return (
                    <tr
                      key={file.id}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        isChecked ? 'bg-cyan-950/20' : ''
                      }`}
                    >
                      <td className="py-2 px-4">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleSelectFile(file.id)}
                          className="rounded border-slate-700 text-cyan-500 focus:ring-0 cursor-pointer"
                        />
                      </td>

                      <td className="py-2 px-4">
                        <span className="font-mono text-xs font-bold text-cyan-400 px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800">
                          {fileDrive}
                        </span>
                      </td>

                      <td className="py-2 px-4 min-w-[280px]">
                        <div className="font-medium text-slate-200 truncate">{file.name}</div>
                        <div className="text-[11px] font-mono text-slate-500 truncate">
                          {file.relativePath}
                        </div>
                      </td>

                      <td className="py-2 px-4 font-mono uppercase text-slate-400">
                        .{file.extension || 'none'}
                      </td>

                      <td className="py-2 px-4 text-right font-mono tabular-nums text-slate-300">
                        {formatBytes(file.size)}
                      </td>

                      <td className="py-2 px-4 text-right font-mono tabular-nums text-slate-400">
                        {formatDate(file.lastModified, 'YYYY-MM-DD')}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
