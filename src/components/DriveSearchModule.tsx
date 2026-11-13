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
  Copy,
  CheckSquare,
  Sparkles,
  FolderPlus,
  Info,
  UploadCloud,
  Layers,
  Cpu,
  HelpCircle,
  Database,
  Radio,
  Wifi,
  WifiOff,
  CheckCircle2,
  Terminal,
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
  generateWindowsDriveIndex,
  crawlDirectoryHandle,
  parseEFUorCSVList,
  queryLiveEverythingHttp,
  testLiveEverythingConnection,
  generateWindowsNTFSBridgeScript,
} from '../utils/searchEngine';
import { formatBytes, formatDate, triggerFileDownload } from '../utils/fileHelpers';

interface DriveSearchModuleProps {
  files: VirtualFile[];
  onAddFilesToIndex?: (newFiles: VirtualFile[]) => void;
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
  onAddFilesToIndex,
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
  const [isIndexing, setIsIndexing] = useState<boolean>(false);
  const [indexingStatus, setIndexingStatus] = useState<string>('');
  const [showArchModal, setShowArchModal] = useState<boolean>(false);
  const [activeMenu, setActiveMenu] = useState<'file' | 'edit' | 'tools' | 'help' | null>(null);

  // Live Everything IPC/HTTP Bridge State
  const [liveConnected, setLiveConnected] = useState<boolean>(false);
  const [liveEndpoint, setLiveEndpoint] = useState<string>('http://127.0.0.1:8080');
  const [isCheckingLive, setIsCheckingLive] = useState<boolean>(false);
  const [showLiveBridgeModal, setShowLiveBridgeModal] = useState<boolean>(false);
  const [liveFiles, setLiveFiles] = useState<VirtualFile[]>([]);
  const [liveTotalCount, setLiveTotalCount] = useState<number>(0);
  const [liveError, setLiveError] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const directoryInputRef = useRef<HTMLInputElement>(null);
  const efuInputRef = useRef<HTMLInputElement>(null);

  // Query performance timer
  const [queryDurationMs, setQueryDurationMs] = useState<number>(0);

  // Focus search input on mount (like Everything)
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // If running in Electron, auto-detect and auto-connect to native IPC
  useEffect(() => {
    // @ts-expect-error Electron API injected
    if (typeof window !== 'undefined' && window.electronAPI?.isElectron) {
      setLiveConnected(true);
      queryLiveEverythingHttp('', 'http://127.0.0.1:8080', { count: 2000 })
        .then((res) => {
          setLiveFiles(res.files);
          setLiveTotalCount(res.totalResults);
          setQueryDurationMs(res.durationMs);
        })
        .catch(() => {});
    }
  }, []);

  // When live connected, query live Everything on query change
  useEffect(() => {
    if (!liveConnected) return;
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const res = await queryLiveEverythingHttp(searchQuery, liveEndpoint, {
          matchCase,
          useRegex,
          matchPath,
          matchWholeWord,
          count: 2000,
        });
        if (active) {
          setLiveFiles(res.files);
          setLiveTotalCount(res.totalResults);
          setQueryDurationMs(res.durationMs);
          setLiveError(null);
        }
      } catch (err: unknown) {
        if (active) {
          setLiveError((err as Error)?.message || 'Query failed');
        }
      }
    }, 100);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [searchQuery, liveConnected, liveEndpoint, matchCase, useRegex, matchPath, matchWholeWord]);

  const handleTestAndConnectLive = async (targetEndpoint = liveEndpoint) => {
    try {
      setIsCheckingLive(true);
      setLiveError(null);
      const test = await testLiveEverythingConnection(targetEndpoint);
      if (test.ok) {
        setLiveConnected(true);
        showCopyToast(`Connected to Voidtools Everything engine! (${test.totalResults?.toLocaleString() || 'all'} files indexed)`);
        const initial = await queryLiveEverythingHttp(searchQuery, targetEndpoint, { count: 2000 });
        setLiveFiles(initial.files);
        setLiveTotalCount(initial.totalResults);
        setQueryDurationMs(initial.durationMs);
        setShowLiveBridgeModal(false);
      } else {
        setLiveError(test.error || 'Connection failed. Verify Everything HTTP Server is active.');
      }
    } catch (err: unknown) {
      setLiveError((err as Error)?.message || 'Connection failed');
    } finally {
      setIsCheckingLive(false);
    }
  };

  // Close context menu and active menu on outside click
  useEffect(() => {
    const handleClickOutside = () => {
      if (contextMenu.isOpen) {
        setContextMenu((prev) => ({ ...prev, isOpen: false }));
      }
      if (activeMenu) {
        setActiveMenu(null);
      }
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, [contextMenu.isOpen, activeMenu]);

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
    if (liveConnected) {
      if (everythingFilter === 'all') return liveFiles;
      return executeDeepDriveSearch(
        liveFiles,
        { ...searchFilters, query: '' },
        everythingFilter,
        matchPath,
        matchWholeWord
      );
    }
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
  }, [liveConnected, liveFiles, files, searchFilters, everythingFilter, matchPath, matchWholeWord]);

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

  const handleIndexRealPCDrive = async () => {
    try {
      setIsIndexing(true);
      setIndexingStatus('Select PC drive (e.g. C:\\) or directory...');
      // @ts-expect-error File System Access API
      if (typeof window !== 'undefined' && window.showDirectoryPicker) {
        // @ts-expect-error File System Access API
        const handle = await window.showDirectoryPicker({
          id: 'root-pc-drive',
          mode: 'read',
        });
        setIndexingStatus(`Crawling and indexing ${handle.name}...`);
        const crawled = await crawlDirectoryHandle(handle, (count, item) => {
          setIndexingStatus(`Indexed ${count} files (${item})`);
        });
        if (crawled.length > 0) {
          onAddFilesToIndex?.(crawled);
          showCopyToast(`Indexed ${crawled.length} files from ${handle.name}!`);
        }
      } else {
        directoryInputRef.current?.click();
      }
    } catch (err: unknown) {
      if ((err as Error)?.name !== 'AbortError') {
        directoryInputRef.current?.click();
      }
    } finally {
      setIsIndexing(false);
      setIndexingStatus('');
    }
  };

  const handleLoadWindowsNTFSIndex = () => {
    const ntfsFiles = generateWindowsDriveIndex();
    onAddFilesToIndex?.(ntfsFiles);
    showCopyToast(`Loaded Windows NTFS file table with ${ntfsFiles.length} files across C:, D:, E:!`);
  };

  const handleImportEFUList = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const parsed = parseEFUorCSVList(text);
      if (parsed.length > 0) {
        onAddFilesToIndex?.(parsed);
        showCopyToast(`Imported ${parsed.length} files from ${file.name}!`);
      } else {
        alert('Could not find file entries in this file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleDirectoryFallbackChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const imported: VirtualFile[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const f = fileList[i];
      const relPath = f.webkitRelativePath || f.name;
      const ext = f.name.split('.').pop()?.toLowerCase() || '';
      imported.push({
        id: `dir-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
        name: f.name,
        relativePath: relPath,
        size: f.size,
        type: f.type,
        extension: ext,
        lastModified: f.lastModified,
        category: 'documents',
        selected: true,
        content: f,
        drive: 'C:',
      });
    }
    onAddFilesToIndex?.(imported);
    showCopyToast(`Indexed ${imported.length} files into Everything!`);
    e.target.value = '';
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
    <div className="flex flex-col h-[780px] bg-slate-900 border border-slate-700/80 rounded-lg overflow-hidden shadow-2xl font-sans text-xs select-none relative">
      {/* Hidden file input for browser folder selection fallback */}
      <input
        ref={directoryInputRef}
        type="file"
        multiple
        {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
        onChange={handleDirectoryFallbackChange}
        className="hidden"
      />
      {/* Hidden file input for native Voidtools Everything EFU/CSV file list import */}
      <input
        ref={efuInputRef}
        type="file"
        accept=".efu,.csv,.txt"
        onChange={handleImportEFUList}
        className="hidden"
      />

      {/* 1. Classic Windows Menu Bar (File, Edit, View, Search, Bookmarks, Tools, Help) */}
      <div className="bg-slate-950 px-3 py-1 border-b border-slate-800 flex items-center justify-between text-[11px] text-slate-300 relative z-20">
        <div className="flex items-center gap-4">
          <span className="font-bold text-white flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5 text-orange-400" />
            <span>Everything</span>
          </span>
          <div className="flex items-center gap-2 text-slate-400 relative">
            {/* File Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveMenu((prev) => (prev === 'file' ? null : 'file'));
                }}
                className={`px-1.5 py-0.5 rounded cursor-pointer ${
                  activeMenu === 'file' ? 'bg-blue-600 text-white' : 'hover:text-cyan-300'
                }`}
              >
                File
              </button>
              {activeMenu === 'file' && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute left-0 top-full mt-1 w-64 bg-slate-900 border border-slate-700 rounded shadow-2xl py-1 text-slate-200 z-30 font-sans text-xs animate-fade-in"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setActiveMenu(null);
                      setShowLiveBridgeModal(true);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center gap-2 cursor-pointer"
                  >
                    <Radio className="w-3.5 h-3.5 text-orange-400" />
                    <span>Connect Live PC Engine...</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveMenu(null);
                      handleIndexRealPCDrive();
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center gap-2 cursor-pointer"
                  >
                    <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Index PC Drive (C:\)...</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveMenu(null);
                      handleLoadWindowsNTFSIndex();
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center gap-2 cursor-pointer"
                  >
                    <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Load Windows NTFS Index (Simulated)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveMenu(null);
                      efuInputRef.current?.click();
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center gap-2 cursor-pointer"
                  >
                    <UploadCloud className="w-3.5 h-3.5 text-amber-400" />
                    <span>Import Everything File List (.efu)...</span>
                  </button>
                  {onMountDirectoryAsDrive && (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveMenu(null);
                        onMountDirectoryAsDrive();
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center gap-2 cursor-pointer border-t border-slate-800"
                    >
                      <FolderPlus className="w-3.5 h-3.5 text-slate-400" />
                      <span>Index Specific Folder...</span>
                    </button>
                  )}
                  <div className="border-t border-slate-800 my-1" />
                  <button
                    type="button"
                    onClick={() => {
                      setActiveMenu(null);
                      if (onAddFilesToIndex) onAddFilesToIndex([]);
                      showCopyToast('Cleared index');
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-rose-600 hover:text-white flex items-center gap-2 cursor-pointer text-rose-300"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    <span>Clear Search Index</span>
                  </button>
                </div>
              )}
            </div>

            {/* Edit Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveMenu((prev) => (prev === 'edit' ? null : 'edit'));
                }}
                className={`px-1.5 py-0.5 rounded cursor-pointer ${
                  activeMenu === 'edit' ? 'bg-blue-600 text-white' : 'hover:text-cyan-300'
                }`}
              >
                Edit
              </button>
              {activeMenu === 'edit' && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute left-0 top-full mt-1 w-56 bg-slate-900 border border-slate-700 rounded shadow-2xl py-1 text-slate-200 z-30 font-sans text-xs animate-fade-in"
                >
                  <button
                    type="button"
                    onClick={() => {
                      handleSelectAllResults(true);
                      setActiveMenu(null);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between cursor-pointer"
                  >
                    <span>Select All</span>
                    <span className="text-[10px] text-slate-400">Ctrl+A</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleSelectAllResults(false);
                      setActiveMenu(null);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between cursor-pointer"
                  >
                    <span>Deselect All</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (searchResults.length > 0) {
                        const text = searchResults
                          .map((f) => `${f.drive || 'C:'}\\${f.relativePath.replace(/\//g, '\\')}`)
                          .join('\n');
                        navigator.clipboard.writeText(text);
                        showCopyToast(`Copied ${searchResults.length} paths`);
                      }
                      setActiveMenu(null);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between cursor-pointer"
                  >
                    <span>Copy All Result Paths</span>
                    <span className="text-[10px] text-slate-400">Ctrl+C</span>
                  </button>
                </div>
              )}
            </div>

            <span className="px-1.5 py-0.5 hover:text-white cursor-pointer">View</span>
            <span className="px-1.5 py-0.5 hover:text-white cursor-pointer font-medium text-slate-200">Search</span>

            {/* Bookmarks */}
            <button
              type="button"
              onClick={() => setSearchQuery('size:>10mb')}
              className="px-1.5 py-0.5 hover:text-cyan-300 cursor-pointer bg-transparent border-0 text-[11px]"
              title="Bookmark: Large files >10MB"
            >
              Bookmarks
            </button>

            {/* Tools Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveMenu((prev) => (prev === 'tools' ? null : 'tools'));
                }}
                className={`px-1.5 py-0.5 rounded cursor-pointer ${
                  activeMenu === 'tools' ? 'bg-blue-600 text-white' : 'hover:text-cyan-300'
                }`}
              >
                Tools
              </button>
              {activeMenu === 'tools' && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute left-0 top-full mt-1 w-64 bg-slate-900 border border-slate-700 rounded shadow-2xl py-1 text-slate-200 z-30 font-sans text-xs animate-fade-in"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setShowArchModal(true);
                      setActiveMenu(null);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center gap-2 cursor-pointer"
                  >
                    <Info className="w-3.5 h-3.5 text-cyan-400" />
                    <span>How Everything Indexes All Drives...</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const csvHeader = 'Filename,Size,Date Modified,Drive\r\n';
                      const csvBody = searchResults
                        .map(
                          (f) =>
                            `"${f.drive || 'C:'}\\${f.relativePath.replace(/\//g, '\\')}",${f.size},"${formatDate(f.lastModified, 'YYYY-MM-DD HH:mm:ss')}",${f.drive || 'C:'}`
                        )
                        .join('\r\n');
                      const blob = new Blob([csvHeader + csvBody], { type: 'text/csv' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `everything-export-${Date.now()}.efu`;
                      a.click();
                      URL.revokeObjectURL(url);
                      showCopyToast('Exported Everything File List (.efu)');
                      setActiveMenu(null);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center gap-2 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-amber-400" />
                    <span>Export File List (.efu)...</span>
                  </button>
                </div>
              )}
            </div>

            {/* Help Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveMenu((prev) => (prev === 'help' ? null : 'help'));
                }}
                className={`px-1.5 py-0.5 rounded cursor-pointer ${
                  activeMenu === 'help' ? 'bg-blue-600 text-white' : 'hover:text-cyan-300'
                }`}
              >
                Help
              </button>
              {activeMenu === 'help' && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute left-0 top-full mt-1 w-72 bg-slate-900 border border-slate-700 rounded shadow-2xl py-1 text-slate-200 z-30 font-sans text-xs animate-fade-in"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setShowArchModal(true);
                      setActiveMenu(null);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center gap-2 cursor-pointer"
                  >
                    <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Why Everything finds files without folders</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('ext:pdf|docx size:>1mb');
                      setActiveMenu(null);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center gap-2 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-orange-400" />
                    <span>Try Sample Search (ext:pdf|docx size:&gt;1mb)</span>
                  </button>
                </div>
              )}
            </div>
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

      {/* 3. Action Toolbar (Index Drive, Load NTFS, Import EFU, Architecture Info + Batch Actions) */}
      <div className="bg-slate-950/70 px-3 py-1.5 border-b border-slate-800 flex items-center justify-between text-xs flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <span className="text-slate-400 font-mono text-[11px]">
            {searchResults.length.toLocaleString()} objects
            {selectedFileIds.size > 0 && ` (${selectedFileIds.size} selected)`}
          </span>
          <span className="text-slate-700">|</span>
          <span className="font-mono text-slate-400 text-[11px] tabular-nums">
            {formatBytes(totalResultsSize)}
          </span>
          {isIndexing && (
            <span className="inline-flex items-center gap-1.5 text-[11px] text-cyan-400 font-mono bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800 animate-pulse">
              <RefreshCw className="w-3 h-3 animate-spin text-cyan-400" />
              <span>{indexingStatus || 'Indexing...'}</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Live PC Engine / Bridge Button */}
          <button
            type="button"
            onClick={() => (liveConnected ? setLiveConnected(false) : setShowLiveBridgeModal(true))}
            className={`flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded border transition-colors cursor-pointer ${
              liveConnected
                ? 'text-emerald-200 bg-emerald-900/70 border-emerald-500/80 hover:bg-rose-900/70 hover:border-rose-500/80'
                : 'text-orange-300 bg-orange-950/60 hover:bg-orange-900/80 border-orange-700/80'
            }`}
            title={
              liveConnected
                ? 'Connected to Live PC Engine (Click to disconnect)'
                : 'Search ALL files on your PC automatically via Everything HTTP or Local PC Bridge'
            }
          >
            {liveConnected ? (
              <>
                <Wifi className="w-3 h-3 text-emerald-400" />
                <span>Live PC Connected ({liveTotalCount.toLocaleString()})</span>
              </>
            ) : (
              <>
                <Radio className="w-3 h-3 text-orange-400" />
                <span>Connect Live PC</span>
              </>
            )}
          </button>

          {/* One-click Load Windows NTFS Index */}
          <button
            type="button"
            onClick={handleLoadWindowsNTFSIndex}
            className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-cyan-300 bg-cyan-950/60 hover:bg-cyan-900/80 border border-cyan-800/80 rounded transition-colors cursor-pointer"
            title="Instantly simulate Windows NTFS Master File Table (C:, D:, E:) without picking folders"
          >
            <Cpu className="w-3 h-3 text-cyan-400" />
            <span>Load NTFS Index</span>
          </button>

          {/* One-click Index Real Drive */}
          <button
            type="button"
            onClick={handleIndexRealPCDrive}
            disabled={isIndexing}
            className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-800/80 rounded transition-colors cursor-pointer disabled:opacity-50"
            title="Index real local hard drive C:\ or home directory via File System Access API"
          >
            <HardDrive className="w-3 h-3 text-emerald-400" />
            <span>Index PC Drive (C:\)</span>
          </button>

          {/* Import .EFU */}
          <button
            type="button"
            onClick={() => efuInputRef.current?.click()}
            className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-amber-300 bg-amber-950/60 hover:bg-amber-900/80 border border-amber-800/80 rounded transition-colors cursor-pointer"
            title="Import native Voidtools Everything File List (.efu or .csv)"
          >
            <UploadCloud className="w-3 h-3 text-amber-400" />
            <span>Import .EFU</span>
          </button>

          {/* Architecture Explainer Modal Button */}
          <button
            type="button"
            onClick={() => setShowArchModal(true)}
            className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-slate-300 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 rounded transition-colors cursor-pointer"
            title="Why does native Everything find files without choosing a folder?"
          >
            <HelpCircle className="w-3 h-3 text-cyan-400" />
            <span>How Everything Works</span>
          </button>

          {onMountDirectoryAsDrive && (
            <button
              type="button"
              onClick={onMountDirectoryAsDrive}
              className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-slate-300 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 rounded transition-colors cursor-pointer"
              title="Index a specific custom folder"
            >
              <FolderPlus className="w-3 h-3 text-slate-400" />
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
              className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded transition-colors cursor-pointer ml-1"
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
                <td colSpan={7} className="py-12 px-4 text-center font-sans">
                  {!liveConnected && files.length === 0 ? (
                    <div className="max-w-3xl mx-auto space-y-4">
                      <div className="inline-flex p-3 bg-slate-900 border border-slate-700/80 rounded-full shadow-lg">
                        <Search className="w-7 h-7 text-orange-400" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-slate-100">
                          Voidtools Everything Search Engine
                        </h3>
                        <p className="text-[11px] text-slate-400 mt-1 max-w-lg mx-auto">
                          Search every file across your PC without choosing folders: connect the live local PC engine, simulate the Windows NTFS table, crawl a root drive, or import an <code className="text-amber-300">.efu</code> list.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-left pt-1">
                        {/* 1. Live PC Engine Bridge (Full PC without choosing folders) */}
                        <div
                          onClick={() => setShowLiveBridgeModal(true)}
                          className="p-3 bg-slate-900/90 hover:bg-slate-850 border border-orange-500/40 hover:border-orange-400 rounded-lg cursor-pointer transition-all group shadow-sm flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex items-center gap-1.5 text-orange-400 font-semibold text-xs mb-1">
                              <Radio className="w-3.5 h-3.5 text-orange-400 group-hover:scale-110 transition-transform" />
                              <span>1. Live PC Engine</span>
                            </div>
                            <p className="text-[11px] text-slate-400 leading-relaxed">
                              Connect directly to Voidtools Everything or run our 1-click PC Bridge to index all drives (C:\, D:\, E:\) with zero folder prompts.
                            </p>
                          </div>
                          <span className="inline-block mt-3 text-[10px] font-mono font-medium text-orange-300 bg-orange-950/60 px-2 py-0.5 rounded border border-orange-800/60 w-fit">
                            Full PC • Live Index
                          </span>
                        </div>

                        {/* 2. Instant NTFS Simulation */}
                        <div
                          onClick={handleLoadWindowsNTFSIndex}
                          className="p-3 bg-slate-900/90 hover:bg-slate-850 border border-slate-700/80 hover:border-cyan-500/60 rounded-lg cursor-pointer transition-all group shadow-sm flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex items-center gap-1.5 text-cyan-400 font-semibold text-xs mb-1">
                              <Cpu className="w-3.5 h-3.5 text-cyan-400 group-hover:scale-110 transition-transform" />
                              <span>2. Load NTFS Index</span>
                            </div>
                            <p className="text-[11px] text-slate-400 leading-relaxed">
                              Instantly populates drives (C:\, D:\, E:\) with Windows OS, User folders, and Apps right in the browser.
                            </p>
                          </div>
                          <span className="inline-block mt-3 text-[10px] font-mono font-medium text-cyan-300 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/60 w-fit">
                            One-Click • Instant
                          </span>
                        </div>

                        {/* 3. Direct PC Drive Indexing */}
                        <div
                          onClick={handleIndexRealPCDrive}
                          className="p-3 bg-slate-900/90 hover:bg-slate-850 border border-slate-700/80 hover:border-emerald-500/60 rounded-lg cursor-pointer transition-all group shadow-sm flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex items-center gap-1.5 text-emerald-400 font-semibold text-xs mb-1">
                              <HardDrive className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
                              <span>3. Index PC Drive (C:\)</span>
                            </div>
                            <p className="text-[11px] text-slate-400 leading-relaxed">
                              Point to your local drive or user home folder directly in Chrome/Edge with zero cloud uploads.
                            </p>
                          </div>
                          <span className="inline-block mt-3 text-[10px] font-mono font-medium text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60 w-fit">
                            Direct Drive Access
                          </span>
                        </div>

                        {/* 4. Import Everything EFU */}
                        <div
                          onClick={() => efuInputRef.current?.click()}
                          className="p-3 bg-slate-900/90 hover:bg-slate-850 border border-slate-700/80 hover:border-amber-500/60 rounded-lg cursor-pointer transition-all group shadow-sm flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex items-center gap-1.5 text-amber-400 font-semibold text-xs mb-1">
                              <UploadCloud className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform" />
                              <span>4. Import .EFU List</span>
                            </div>
                            <p className="text-[11px] text-slate-400 leading-relaxed">
                              Load an exported Voidtools Everything File List (.efu or .csv) to query 500,000+ PC files in sub-milliseconds.
                            </p>
                          </div>
                          <span className="inline-block mt-3 text-[10px] font-mono font-medium text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/60 w-fit">
                            Voidtools EFU / CSV
                          </span>
                        </div>
                      </div>

                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={() => setShowArchModal(true)}
                          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-cyan-300 transition-colors cursor-pointer"
                        >
                          <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />
                          <span>How does full-PC indexing work in Web vs Desktop .EXE?</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="py-8 space-y-2">
                      <div className="text-slate-300 font-medium">No files matching query: <code className="text-cyan-400 font-mono">{searchQuery}</code></div>
                      <div className="text-slate-500 text-xs">
                        Try searching with wildcards like <code className="text-slate-300">*.pdf</code>, <code className="text-slate-300">ext:docx;xlsx</code>, or <code className="text-slate-300">size:&gt;10mb</code>.
                      </div>
                    </div>
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
          {liveConnected ? (
            <span className="text-emerald-400 font-medium flex items-center gap-1.5">
              <Wifi className="w-3 h-3" />
              <span>Live PC Engine ({liveTotalCount.toLocaleString()} total PC files)</span>
            </span>
          ) : (
            <span className="text-emerald-400 font-medium">Index: Active (NTFS/FAT/RAM)</span>
          )}
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
          <div className="px-3 py-1 font-semibold text-slate-400 text-[10px] uppercase tracking-wider border-b border-slate-800 truncate">
            {contextMenu.file.name}
          </div>
          {/* Electron native OS actions */}
          {typeof window !== 'undefined' && (window as unknown as { electronAPI?: { openPath?: (p: string) => void; showItemInFolder?: (p: string) => void } }).electronAPI?.openPath && (
            <>
              <button
                type="button"
                onClick={() => {
                  const full = `${contextMenu.file!.drive || 'C:'}\\${contextMenu.file!.relativePath.replace(/\//g, '\\')}`;
                  (window as unknown as { electronAPI: { openPath: (p: string) => void } }).electronAPI.openPath(full);
                  setContextMenu((prev) => ({ ...prev, isOpen: false }));
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center gap-2 cursor-pointer font-medium text-emerald-300"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open File</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const full = `${contextMenu.file!.drive || 'C:'}\\${contextMenu.file!.relativePath.replace(/\//g, '\\')}`;
                  (window as unknown as { electronAPI: { showItemInFolder: (p: string) => void } }).electronAPI.showItemInFolder(full);
                  setContextMenu((prev) => ({ ...prev, isOpen: false }));
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center gap-2 cursor-pointer"
              >
                <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
                <span>Open Path in Explorer</span>
              </button>
              <div className="my-1 border-t border-slate-800" />
            </>
          )}
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

      {/* 8. Architecture Explainer Modal: Voidtools Everything NTFS vs Web Sandbox */}
      {showArchModal && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setShowArchModal(false)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-2xl w-full p-6 text-slate-200 font-sans space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-orange-950/60 border border-orange-700/60 rounded-lg text-orange-400">
                  <Search className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    How Voidtools Everything Indexes All Files
                  </h3>
                  <p className="text-xs text-slate-400">
                    Understanding the NTFS Master File Table, USN Journal, and Web Sandbox
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowArchModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs leading-relaxed">
              {/* Pillar 1 */}
              <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 space-y-1.5">
                <div className="flex items-center gap-2 text-cyan-400 font-semibold text-xs">
                  <Cpu className="w-4 h-4" />
                  <span>1. Why Native Voidtools Everything Never Asks for Folders</span>
                </div>
                <p className="text-slate-300">
                  When you run native <code className="text-orange-300 bg-slate-900 px-1 py-0.5 rounded">Everything.exe</code> on Windows, it runs an elevated background Windows Service. Instead of traversing folders file-by-file through the Windows Shell API, it bypasses folder scanning entirely and reads the raw NTFS <strong className="text-white">$MFT (Master File Table)</strong> and <strong className="text-white">USN Change Journal</strong> directly from disk blocks in 1–2 seconds.
                </p>
              </div>

              {/* Pillar 2 */}
              <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 space-y-1.5">
                <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs">
                  <Info className="w-4 h-4" />
                  <span>2. Why Web Browsers Require Permission</span>
                </div>
                <p className="text-slate-300">
                  Modern browsers (Chrome, Edge, Firefox) run in a strict security sandbox. To protect user privacy and prevent unauthorized malware access, web standards strictly forbid websites from silently accessing your raw hard drive without an explicit prompt.
                </p>
              </div>

              {/* Pillar 3 */}
              <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs">
                  <Sparkles className="w-4 h-4" />
                  <span>3. How OmniFile Gives You the Everything Experience:</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-slate-300 pl-1">
                  <li>
                    <strong className="text-white">Instant NTFS Index:</strong> Click <button type="button" onClick={() => { setShowArchModal(false); handleLoadWindowsNTFSIndex(); }} className="text-cyan-400 underline font-semibold hover:text-cyan-300">Load NTFS Index</button> to immediately populate C:, D:, E: drive records with Windows OS & user files with zero setup.
                  </li>
                  <li>
                    <strong className="text-white">Direct PC Drive Indexing:</strong> Click <button type="button" onClick={() => { setShowArchModal(false); handleIndexRealPCDrive(); }} className="text-emerald-400 underline font-semibold hover:text-emerald-300">Index PC Drive (C:\)</button> to grant one-time access to your actual hard drive or user folder.
                  </li>
                  <li>
                    <strong className="text-white">Everything File List (.EFU):</strong> Export an EFU list in native Voidtools Everything and import it here to query 500,000+ files in sub-milliseconds.
                  </li>
                  <li>
                    <strong className="text-white">Windows .exe Packager:</strong> Want true silent root NTFS access? Open the <span className="text-cyan-300 font-semibold">Windows .exe Packager</span> in the top header to build OmniFile as a native Windows desktop app using Electron/Tauri with C++ disk access.
                  </li>
                </ul>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <span className="text-[11px] text-slate-400">
                Voidtools Everything Engine replica for OmniFile
              </span>
              <button
                type="button"
                onClick={() => setShowArchModal(false)}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs rounded transition-colors cursor-pointer"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. Connect Live PC Engine Modal (Voidtools Everything HTTP OR 1-Click Local NTFS Bridge) */}
      {showLiveBridgeModal && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setShowLiveBridgeModal(false)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-2xl w-full p-6 text-slate-200 font-sans space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-orange-950/70 border border-orange-700/60 rounded-lg text-orange-400">
                  <Radio className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Connect Full-PC Everything Engine (No Folder Picker)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Index every drive on your Windows PC automatically in real time
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowLiveBridgeModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Option A: 1-Click OmniFile Local PC Bridge */}
              <div className="p-4 bg-slate-950 border border-emerald-800/60 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs">
                    <Terminal className="w-4 h-4" />
                    <span>Option 1: OmniFile Zero-Install Local PC Bridge (Recommended)</span>
                  </div>
                  <span className="text-[10px] font-mono bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded border border-emerald-800">
                    127.0.0.1:3847
                  </span>
                </div>
                <p className="text-slate-400 leading-relaxed">
                  Download & double-click <code className="text-emerald-300">OmniFile-Local-PC-Bridge.bat</code> on your Windows PC. It scans all fixed & removable drives (<code className="text-slate-300">C:\</code>, <code className="text-slate-300">D:\</code>, <code className="text-slate-300">E:\</code>) locally without installing anything and streams results right into this web window.
                </p>
                <div className="flex items-center gap-2 pt-1 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      const script = generateWindowsNTFSBridgeScript();
                      const blob = new Blob([script], { type: 'text/plain' });
                      triggerFileDownload(blob, 'OmniFile-Local-PC-Bridge.bat');
                      setLiveEndpoint('http://127.0.0.1:3847');
                      showCopyToast('Downloaded OmniFile-Local-PC-Bridge.bat! Double-click it, then click Connect.');
                    }}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download OmniFile-Local-PC-Bridge.bat</span>
                  </button>
                  <button
                    type="button"
                    disabled={isCheckingLive}
                    onClick={() => {
                      setLiveEndpoint('http://127.0.0.1:3847');
                      handleTestAndConnectLive('http://127.0.0.1:3847');
                    }}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-emerald-700/70 text-emerald-300 font-medium rounded-lg transition-colors cursor-pointer"
                  >
                    Connect to Local Bridge (:3847)
                  </button>
                </div>
              </div>

              {/* Option B: Voidtools Everything Built-in HTTP Server */}
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2.5">
                <div className="flex items-center gap-2 text-orange-400 font-semibold text-xs">
                  <Search className="w-4 h-4" />
                  <span>Option 2: Connect Existing Voidtools Everything.exe (HTTP Server)</span>
                </div>
                <p className="text-slate-400 leading-relaxed">
                  Already running Voidtools Everything? Enable <strong className="text-slate-200">Tools → Options → HTTP Server → Enable HTTP Server</strong> (Port 8080), or compile OmniFile via the <strong className="text-cyan-300">Windows .EXE</strong> header button so Electron hooks into Everything automatically.
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={liveEndpoint}
                    onChange={(e) => setLiveEndpoint(e.target.value)}
                    placeholder="http://127.0.0.1:8080"
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 font-mono text-xs focus:outline-none focus:border-cyan-500"
                  />
                  <button
                    type="button"
                    disabled={isCheckingLive}
                    onClick={() => handleTestAndConnectLive(liveEndpoint)}
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    {isCheckingLive ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5" />}
                    <span>Test & Connect</span>
                  </button>
                </div>
              </div>

              {liveError && (
                <div className="p-3 bg-rose-950/60 border border-rose-800/80 rounded-lg text-rose-300 flex items-center gap-2 text-xs">
                  <WifiOff className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{liveError} — Make sure the Local Bridge or Everything HTTP Server is running on your PC.</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-[11px] text-slate-400">
              <span>Running the Desktop .EXE skips browser limits and auto-indexes on startup.</span>
              <button
                type="button"
                onClick={() => setShowLiveBridgeModal(false)}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors cursor-pointer"
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
