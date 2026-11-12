import React, { useMemo, useState, useRef, useEffect } from 'react';
import {
  Search,
  HardDrive,
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
  SlidersHorizontal,
  FileText,
  FileSpreadsheet,
  FileImage,
  FileAudio,
  FileVideo,
  FileArchive,
  FileCode,
  File,
  Folder,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  ExternalLink,
  ChevronDown,
} from 'lucide-react';
import {
  VirtualFile,
  DriveInfo,
  DeepSearchFilters,
  FileCategory,
} from '../types/fileSystem';
import {
  executeDeepDriveSearch,
  EVERYTHING_FILTERS,
  EverythingFilterType,
  EverythingSortOption,
} from '../utils/searchEngine';
import { formatBytes, formatDate } from '../utils/fileHelpers';
import { Copy, CheckSquare, Sparkles, FolderPlus } from 'lucide-react';

interface DriveSearchModuleProps {
  files: VirtualFile[];
  onSelectFilesForAction: (selectedIds: string[]) => void;
  onSendToBatchAction: (action: 'rename' | 'compress' | 'organize' | 'flatten') => void;
  onMountDirectoryAsDrive?: () => void;
}

interface ContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
  file: VirtualFile | null;
}

export const DriveSearchModule: React.FC<DriveSearchModuleProps> = ({
  files,
  onSelectFilesForAction,
  onSendToBatchAction,
  onMountDirectoryAsDrive,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [everythingFilter, setEverythingFilter] = useState<EverythingFilterType>('all');
  const [matchCase, setMatchCase] = useState<boolean>(false);
  const [matchWholeWord, setMatchWholeWord] = useState<boolean>(false);
  const [matchPath, setMatchPath] = useState<boolean>(true);
  const [useRegex, setUseRegex] = useState<boolean>(false);

  // Sorting state (matches Everything: Name, Path, Size, Date Modified, Extension, Type)
  const [sortOption, setSortOption] = useState<EverythingSortOption>({
    field: 'name',
    order: 'asc',
  });

  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    isOpen: false,
    x: 0,
    y: 0,
    file: null,
  });
  const [clipboardNotice, setClipboardNotice] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Query performance timer
  const [queryDurationMs, setQueryDurationMs] = useState<number>(0);

  // Focus search input on mount (like Everything)
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Close context menu on outside click
  useEffect(() => {
    const handleClickOutside = () => {
      if (contextMenu.isOpen) {
        setContextMenu((prev) => ({ ...prev, isOpen: false }));
      }
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, [contextMenu.isOpen]);

  const searchFilters: DeepSearchFilters = useMemo(() => ({
    query: searchQuery,
    selectedDrives: ['ALL'],
    selectedExtensions: [],
    selectedCategories: [],
    minSize: 0,
    maxSize: 0,
    dateRange: 'all',
    matchCase,
    useRegex,
  }), [searchQuery, matchCase, useRegex]);

  // Execute instantaneous Voidtools Everything query
  const rawResults = useMemo(() => {
    const start = performance.now();
    const res = executeDeepDriveSearch(
      files,
      searchFilters,
      everythingFilter,
      matchPath,
      matchWholeWord
    );
    const duration = performance.now() - start;
    setQueryDurationMs(parseFloat(duration.toFixed(2)));
    return res;
  }, [files, searchFilters, everythingFilter, matchPath, matchWholeWord]);

  // Sort matched results
  const searchResults = useMemo(() => {
    const list = [...rawResults];
    const { field, order } = sortOption;
    list.sort((a, b) => {
      let comparison = 0;
      switch (field) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'path': {
          const pathA = `${a.drive || 'C:'}\\${a.relativePath}`;
          const pathB = `${b.drive || 'C:'}\\${b.relativePath}`;
          comparison = pathA.localeCompare(pathB);
          break;
        }
        case 'size':
          comparison = a.size - b.size;
          break;
        case 'dateModified':
          comparison = a.lastModified - b.lastModified;
          break;
        case 'extension':
          comparison = a.extension.localeCompare(b.extension);
          break;
        case 'type':
          comparison = a.category.localeCompare(b.category);
          break;
      }
      return order === 'asc' ? comparison : -comparison;
    });
    return list;
  }, [rawResults, sortOption]);

  const totalResultsSize = useMemo(() => {
    return searchResults.reduce((acc, f) => acc + f.size, 0);
  }, [searchResults]);

  const handleSort = (field: EverythingSortOption['field']) => {
    setSortOption((prev) => {
      if (prev.field === field) {
        return { field, order: prev.order === 'asc' ? 'desc' : 'asc' };
      }
      return { field, order: 'asc' };
    });
  };

  const handleToggleSelectFile = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
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

  const showCopyToast = (text: string) => {
    setClipboardNotice(text);
    setTimeout(() => {
      setClipboardNotice((prev) => (prev === text ? null : prev));
    }, 2500);
  };

  const handleCopyFullPath = (file: VirtualFile) => {
    const driveLetter = file.drive || 'C:';
    const fullPath = `${driveLetter}\\${file.relativePath.replace(/\//g, '\\')}`;
    navigator.clipboard.writeText(fullPath).then(() => {
      showCopyToast(`Copied path: ${fullPath}`);
    }).catch(() => {
      showCopyToast(`Copied path: ${fullPath}`);
    });
    setContextMenu((prev) => ({ ...prev, isOpen: false }));
  };

  const handleCopyFileName = (file: VirtualFile) => {
    navigator.clipboard.writeText(file.name).then(() => {
      showCopyToast(`Copied name: ${file.name}`);
    }).catch(() => {
      showCopyToast(`Copied name: ${file.name}`);
    });
    setContextMenu((prev) => ({ ...prev, isOpen: false }));
  };

  const getFileIcon = (cat: FileCategory, ext: string) => {
    switch (cat) {
      case 'documents':
        return <FileText className="w-3.5 h-3.5 text-blue-400 shrink-0" />;
      case 'spreadsheets':
        return <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
      case 'images':
        return <FileImage className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
      case 'audio':
        return <FileAudio className="w-3.5 h-3.5 text-purple-400 shrink-0" />;
      case 'videos':
        return <FileVideo className="w-3.5 h-3.5 text-rose-400 shrink-0" />;
      case 'archives':
        return <FileArchive className="w-3.5 h-3.5 text-orange-400 shrink-0" />;
      case 'code':
        return <FileCode className="w-3.5 h-3.5 text-cyan-400 shrink-0" />;
      default:
        return <File className="w-3.5 h-3.5 text-slate-400 shrink-0" />;
    }
  };

  // Keyboard navigation up / down / copy / select all
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(searchResults.length - 1, prev + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(0, prev - 1));
    } else if (e.key === 'Escape') {
      setSearchQuery('');
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
      e.preventDefault();
      handleSelectAllResults(true);
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'c' && selectedIndex >= 0 && searchResults[selectedIndex]) {
      handleCopyFullPath(searchResults[selectedIndex]);
    }
  };

  return (
    <div className="flex flex-col h-[780px] bg-slate-900 border border-slate-700/80 rounded-lg overflow-hidden shadow-2xl font-sans text-xs select-none">
      {/* 1. Classic Windows Menu Bar (File, Edit, View, Search, Bookmarks, Tools, Help) */}
      <div className="bg-slate-950 px-3 py-1 border-b border-slate-800 flex items-center justify-between text-[11px] text-slate-300">
        <div className="flex items-center gap-4">
          <span className="font-bold text-white flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5 text-orange-400" />
            <span>Everything</span>
          </span>
          <div className="flex items-center gap-3 text-slate-400">
            <button
              type="button"
              onClick={onMountDirectoryAsDrive}
              className="hover:text-cyan-300 cursor-pointer bg-transparent border-0 p-0 text-[11px] font-medium"
              title="Index local directory or external drive"
            >
              File
            </button>
            <button
              type="button"
              onClick={() => handleSelectAllResults(selectedFileIds.size !== searchResults.length)}
              className="hover:text-cyan-300 cursor-pointer bg-transparent border-0 p-0 text-[11px]"
            >
              Edit
            </button>
            <span className="hover:text-white cursor-pointer">View</span>
            <span className="hover:text-white cursor-pointer font-medium text-slate-200">Search</span>
            <button
              type="button"
              onClick={() => setSearchQuery('size:>10mb')}
              className="hover:text-cyan-300 cursor-pointer bg-transparent border-0 p-0 text-[11px]"
              title="Bookmark: Large files >10MB"
            >
              Bookmarks
            </button>
            <span className="hover:text-white cursor-pointer">Tools</span>
            <span className="hover:text-white cursor-pointer">Help</span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-slate-400">
          <span className="font-mono text-slate-500">v1.4.1 (64-bit)</span>
          <span className="font-mono text-emerald-400">{queryDurationMs} ms</span>
        </div>
      </div>

      {/* 2. Voidtools Search Toolbar (Instant Input + Everything Filter Dropdown + Search Options) */}
      <div className="bg-slate-900 p-2 border-b border-slate-800 space-y-2">
        <div className="flex items-center gap-2">
          {/* Main Search Input */}
          <div className="relative flex-1">
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search filename or path (e.g. *.pdf, invoice size:>100kb, ext:docx;xlsx, !backup)"
              className="w-full bg-slate-950 border border-slate-700 text-slate-100 placeholder-slate-500 text-xs px-2.5 py-1.5 rounded focus:outline-none focus:border-cyan-500 font-mono shadow-inner"
              spellCheck={false}
              autoComplete="off"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Everything Category Filter Dropdown */}
          <div className="relative shrink-0">
            <select
              value={everythingFilter}
              onChange={(e) => setEverythingFilter(e.target.value as EverythingFilterType)}
              className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded px-2.5 py-1.5 focus:outline-none focus:border-cyan-500 font-medium cursor-pointer"
            >
              {EVERYTHING_FILTERS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Search Modifiers Bar (Match Case, Match Whole Word, Match Path, Enable Regex) */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-1.5 cursor-pointer hover:text-slate-200">
              <input
                type="checkbox"
                checked={matchCase}
                onChange={(e) => setMatchCase(e.target.checked)}
                className="rounded border-slate-700 text-cyan-500 focus:ring-0 w-3 h-3"
              />
              <span>Match Case</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer hover:text-slate-200">
              <input
                type="checkbox"
                checked={matchWholeWord}
                onChange={(e) => setMatchWholeWord(e.target.checked)}
                className="rounded border-slate-700 text-cyan-500 focus:ring-0 w-3 h-3"
              />
              <span>Match Whole Word</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer hover:text-slate-200">
              <input
                type="checkbox"
                checked={matchPath}
                onChange={(e) => setMatchPath(e.target.checked)}
                className="rounded border-slate-700 text-cyan-500 focus:ring-0 w-3 h-3"
              />
              <span>Match Path</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer hover:text-slate-200">
              <input
                type="checkbox"
                checked={useRegex}
                onChange={(e) => setUseRegex(e.target.checked)}
                className="rounded border-slate-700 text-cyan-500 focus:ring-0 w-3 h-3"
              />
              <span>Enable Regex</span>
            </label>
          </div>

          {/* Quick Syntax Hints */}
          <div className="hidden lg:flex items-center gap-2 text-[10px] font-mono text-slate-500">
            <span>Syntax:</span>
            <span className="text-slate-400 cursor-pointer hover:text-cyan-400" onClick={() => setSearchQuery('ext:pdf')}>ext:pdf</span>
            <span className="text-slate-400 cursor-pointer hover:text-cyan-400" onClick={() => setSearchQuery('size:>5mb')}>size:&gt;5mb</span>
            <span className="text-slate-400 cursor-pointer hover:text-cyan-400" onClick={() => setSearchQuery('*.xlsx|*.docx')}>a|b (OR)</span>
            <span className="text-slate-400 cursor-pointer hover:text-cyan-400" onClick={() => setSearchQuery('!backup')}>!not</span>
          </div>
        </div>
      </div>

      {/* 3. Action Toolbar (Send selected to Renamer, Zipper, Organizer) */}
      <div className="bg-slate-950/70 px-3 py-1.5 border-b border-slate-800 flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <span className="text-slate-400 font-mono text-[11px]">
            {searchResults.length.toLocaleString()} objects
            {selectedFileIds.size > 0 && ` (${selectedFileIds.size} selected)`}
          </span>
          <span className="text-slate-700">|</span>
          <span className="font-mono text-slate-400 text-[11px] tabular-nums">
            {formatBytes(totalResultsSize)}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {onMountDirectoryAsDrive && (
            <button
              type="button"
              onClick={onMountDirectoryAsDrive}
              className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-cyan-300 bg-cyan-950/50 hover:bg-cyan-900/60 border border-cyan-800 rounded transition-colors cursor-pointer mr-1"
            >
              <FolderPlus className="w-3 h-3 text-cyan-400" />
              <span>Index Folder</span>
            </button>
          )}

          {selectedFileIds.size > 0 && (
            <button
              type="button"
              onClick={() => {
                const selected = searchResults.filter((f) => selectedFileIds.has(f.id));
                const text = selected.map((f) => `${f.drive || 'C:'}\\${f.relativePath.replace(/\//g, '\\')}`).join('\n');
                navigator.clipboard.writeText(text);
                showCopyToast(`Copied ${selected.length} paths to clipboard`);
              }}
              className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded transition-colors cursor-pointer mr-1"
              title="Copy paths of selected files (Ctrl+C)"
            >
              <Copy className="w-3 h-3" />
              <span>Copy Paths</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => handleForwardToWorkspaceAction('rename')}
            className="px-2 py-0.5 text-[11px] font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded transition-colors cursor-pointer"
          >
            Rename
          </button>
          <button
            type="button"
            onClick={() => handleForwardToWorkspaceAction('compress')}
            className="px-2 py-0.5 text-[11px] font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded transition-colors cursor-pointer"
          >
            ZIP
          </button>
          <button
            type="button"
            onClick={() => handleForwardToWorkspaceAction('organize')}
            className="px-2 py-0.5 text-[11px] font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded transition-colors cursor-pointer"
          >
            Organize
          </button>
        </div>
      </div>

      {/* 4. Everything Native High-Density Results Grid */}
      <div className="flex-1 overflow-auto bg-slate-950 font-mono text-[11px]">
        <table className="w-full text-left border-collapse table-fixed">
          <thead className="sticky top-0 bg-slate-900 border-b border-slate-700/80 text-slate-300 font-semibold select-none z-10">
            <tr>
              <th className="py-1 px-2 w-8 text-center border-r border-slate-800">
                <input
                  type="checkbox"
                  checked={searchResults.length > 0 && selectedFileIds.size === searchResults.length}
                  onChange={(e) => handleSelectAllResults(e.target.checked)}
                  className="rounded border-slate-700 text-cyan-500 focus:ring-0 w-3 h-3 cursor-pointer"
                />
              </th>
              {/* Name Column */}
              <th
                onClick={() => handleSort('name')}
                className="py-1 px-2.5 w-72 border-r border-slate-800 hover:bg-slate-800/80 cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span>Name</span>
                  {sortOption.field === 'name' && (
                    sortOption.order === 'asc' ? <ArrowUp className="w-3 h-3 text-cyan-400" /> : <ArrowDown className="w-3 h-3 text-cyan-400" />
                  )}
                </div>
              </th>
              {/* Path Column */}
              <th
                onClick={() => handleSort('path')}
                className="py-1 px-2.5 w-[340px] border-r border-slate-800 hover:bg-slate-800/80 cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span>Path</span>
                  {sortOption.field === 'path' && (
                    sortOption.order === 'asc' ? <ArrowUp className="w-3 h-3 text-cyan-400" /> : <ArrowDown className="w-3 h-3 text-cyan-400" />
                  )}
                </div>
              </th>
              {/* Size Column */}
              <th
                onClick={() => handleSort('size')}
                className="py-1 px-2.5 w-24 text-right border-r border-slate-800 hover:bg-slate-800/80 cursor-pointer"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Size</span>
                  {sortOption.field === 'size' && (
                    sortOption.order === 'asc' ? <ArrowUp className="w-3 h-3 text-cyan-400" /> : <ArrowDown className="w-3 h-3 text-cyan-400" />
                  )}
                </div>
              </th>
              {/* Date Modified Column */}
              <th
                onClick={() => handleSort('dateModified')}
                className="py-1 px-2.5 w-36 text-right border-r border-slate-800 hover:bg-slate-800/80 cursor-pointer"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Date Modified</span>
                  {sortOption.field === 'dateModified' && (
                    sortOption.order === 'asc' ? <ArrowUp className="w-3 h-3 text-cyan-400" /> : <ArrowDown className="w-3 h-3 text-cyan-400" />
                  )}
                </div>
              </th>
              {/* Extension Column */}
              <th
                onClick={() => handleSort('extension')}
                className="py-1 px-2.5 w-20 border-r border-slate-800 hover:bg-slate-800/80 cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span>Ext</span>
                  {sortOption.field === 'extension' && (
                    sortOption.order === 'asc' ? <ArrowUp className="w-3 h-3 text-cyan-400" /> : <ArrowDown className="w-3 h-3 text-cyan-400" />
                  )}
                </div>
              </th>
              {/* Type Column */}
              <th
                onClick={() => handleSort('type')}
                className="py-1 px-2.5 w-28 hover:bg-slate-800/80 cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span>Type</span>
                  {sortOption.field === 'type' && (
                    sortOption.order === 'asc' ? <ArrowUp className="w-3 h-3 text-cyan-400" /> : <ArrowDown className="w-3 h-3 text-cyan-400" />
                  )}
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-900/90 text-slate-300">
            {searchResults.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-16 text-center text-slate-500 font-sans">
                  {files.length === 0 ? (
                    <div className="space-y-1.5">
                      <div className="text-slate-400 font-medium">Search index is currently empty (0 files indexed)</div>
                      <div className="text-[11px] text-slate-500">
                        Drop files or folders into Workspace, or click <button type="button" onClick={onMountDirectoryAsDrive} className="text-cyan-400 hover:underline cursor-pointer">File &gt; Index Folder</button> to search your PC.
                      </div>
                    </div>
                  ) : (
                    <div>No files matching query: <code className="text-cyan-400">{searchQuery}</code></div>
                  )}
                </td>
              </tr>
            ) : (
              searchResults.map((file, idx) => {
                const isSelected = selectedFileIds.has(file.id);
                const isCursorActive = selectedIndex === idx;
                const driveLetter = file.drive || 'C:';
                const parentFolder = file.relativePath.includes('/')
                  ? `${driveLetter}\\${file.relativePath.substring(0, file.relativePath.lastIndexOf('/')).replace(/\//g, '\\')}`
                  : `${driveLetter}\\`;

                return (
                  <tr
                    key={file.id}
                    onClick={(e) => {
                      setSelectedIndex(idx);
                      handleToggleSelectFile(file.id, e);
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setSelectedIndex(idx);
                      setContextMenu({
                        isOpen: true,
                        x: Math.min(e.clientX, window.innerWidth - 220),
                        y: Math.min(e.clientY, window.innerHeight - 260),
                        file,
                      });
                    }}
                    className={`cursor-pointer transition-colors leading-none h-6 ${
                      isCursorActive
                        ? 'bg-blue-600 text-white'
                        : isSelected
                        ? 'bg-blue-950/60 text-cyan-200'
                        : idx % 2 === 0
                        ? 'bg-slate-950 hover:bg-slate-850'
                        : 'bg-slate-900/40 hover:bg-slate-850'
                    }`}
                  >
                    <td className="py-1 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelectFile(file.id)}
                        className="rounded border-slate-700 text-cyan-500 focus:ring-0 w-3 h-3 cursor-pointer"
                      />
                    </td>

                    {/* Name with icon */}
                    <td className="py-1 px-2.5 truncate">
                      <div className="flex items-center gap-1.5">
                        {getFileIcon(file.category, file.extension)}
                        <span className="truncate">{file.name}</span>
                      </div>
                    </td>

                    {/* Path */}
                    <td className="py-1 px-2.5 truncate text-slate-400 font-normal">
                      <span className={isCursorActive ? 'text-blue-100' : ''}>
                        {parentFolder}
                      </span>
                    </td>

                    {/* Size */}
                    <td className="py-1 px-2.5 text-right tabular-nums">
                      {formatBytes(file.size)}
                    </td>

                    {/* Date Modified */}
                    <td className="py-1 px-2.5 text-right tabular-nums text-slate-400">
                      <span className={isCursorActive ? 'text-blue-100' : ''}>
                        {formatDate(file.lastModified, 'YYYY-MM-DD HH:mm')}
                      </span>
                    </td>

                    {/* Extension */}
                    <td className="py-1 px-2.5 uppercase text-slate-400">
                      <span className={isCursorActive ? 'text-blue-100' : ''}>
                        {file.extension || ''}
                      </span>
                    </td>

                    {/* Category Type */}
                    <td className="py-1 px-2.5 capitalize text-slate-400">
                      <span className={isCursorActive ? 'text-blue-100' : ''}>
                        {file.category}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 5. Classic Windows Status Bar (Total objects, selected items, search speed) */}
      <div className="bg-slate-950 px-3 py-1 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-400">
        <div className="flex items-center gap-3">
          <span>{searchResults.length.toLocaleString()} objects</span>
          {selectedFileIds.size > 0 && (
            <>
              <span className="text-slate-700">|</span>
              <span className="text-cyan-400 font-semibold">{selectedFileIds.size} selected</span>
            </>
          )}
          <span className="text-slate-700">|</span>
          <span>{formatBytes(totalResultsSize)}</span>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-emerald-400 font-medium">Index: Active (NTFS/FAT/RAM)</span>
          <span className="text-slate-500">Query: {queryDurationMs} ms</span>
        </div>
      </div>

      {/* 6. Voidtools Context Menu (Right-Click) */}
      {contextMenu.isOpen && contextMenu.file && (
        <div
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className="fixed z-50 w-56 bg-slate-900 border border-slate-700 rounded shadow-2xl py-1 text-slate-200 text-xs font-sans animate-fade-in"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1 font-semibold text-slate-400 text-[10px] uppercase tracking-wider border-b border-slate-800">
            {contextMenu.file.name}
          </div>
          <button
            type="button"
            onClick={() => handleCopyFullPath(contextMenu.file!)}
            className="w-full text-left px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between cursor-pointer"
          >
            <span>Copy Full Path</span>
            <span className="text-[10px] text-slate-400">Ctrl+C</span>
          </button>
          <button
            type="button"
            onClick={() => handleCopyFileName(contextMenu.file!)}
            className="w-full text-left px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between cursor-pointer"
          >
            <span>Copy File Name</span>
          </button>
          <div className="my-1 border-t border-slate-800" />
          <button
            type="button"
            onClick={() => {
              handleToggleSelectFile(contextMenu.file!.id);
              setContextMenu((prev) => ({ ...prev, isOpen: false }));
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center gap-2 cursor-pointer"
          >
            <CheckSquare className="w-3.5 h-3.5 text-cyan-400" />
            <span>Toggle Selection</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onSelectFilesForAction([contextMenu.file!.id]);
              onSendToBatchAction('rename');
              setContextMenu((prev) => ({ ...prev, isOpen: false }));
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center gap-2 cursor-pointer"
          >
            <Tag className="w-3.5 h-3.5 text-blue-400" />
            <span>Send to Batch Renamer</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onSelectFilesForAction([contextMenu.file!.id]);
              onSendToBatchAction('compress');
              setContextMenu((prev) => ({ ...prev, isOpen: false }));
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center gap-2 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-orange-400" />
            <span>Compress to ZIP</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onSelectFilesForAction([contextMenu.file!.id]);
              onSendToBatchAction('organize');
              setContextMenu((prev) => ({ ...prev, isOpen: false }));
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center gap-2 cursor-pointer"
          >
            <FolderSync className="w-3.5 h-3.5 text-emerald-400" />
            <span>Organize into Folder</span>
          </button>
        </div>
      )}

      {/* 7. Clipboard Notice Toast */}
      {clipboardNotice && (
        <div className="fixed bottom-14 left-1/2 -translate-x-1/2 z-50 bg-slate-900 border border-cyan-500/50 text-cyan-200 text-xs px-3.5 py-1.5 rounded-md shadow-2xl font-mono flex items-center gap-2 animate-fade-in">
          <Copy className="w-3.5 h-3.5 text-cyan-400" />
          <span>{clipboardNotice}</span>
        </div>
      )}
    </div>
  );
};
