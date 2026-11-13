import { VirtualFile, DeepSearchFilters } from '../types/fileSystem';
import { getFileExtension, classifyFileCategory } from './fileHelpers';

// Everything-style search parser and executor (matching voidtools Everything engine)
export type EverythingFilterType = 'all' | 'audio' | 'compressed' | 'document' | 'executable' | 'folder' | 'picture' | 'video';

export const EVERYTHING_FILTERS: Array<{ id: EverythingFilterType; label: string; extensions?: string[] }> = [
  { id: 'all', label: 'Everything' },
  { id: 'audio', label: 'Audio', extensions: ['mp3', 'wav', 'aac', 'flac', 'ogg', 'm4a', 'wma', 'aiff'] },
  { id: 'compressed', label: 'Compressed', extensions: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'iso'] },
  { id: 'document', label: 'Document', extensions: ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', 'pages', 'md', 'epub', 'xls', 'xlsx', 'csv', 'tsv', 'ppt', 'pptx'] },
  { id: 'executable', label: 'Executable', extensions: ['exe', 'bat', 'cmd', 'msi', 'ps1', 'sh', 'apk', 'app'] },
  { id: 'picture', label: 'Picture', extensions: ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp', 'ico', 'tiff', 'heic', 'raw', 'psd'] },
  { id: 'video', label: 'Video', extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm', 'wmv', 'flv', 'm4v'] },
];

export interface EverythingSortOption {
  field: 'name' | 'path' | 'size' | 'dateModified' | 'extension' | 'type';
  order: 'asc' | 'desc';
}

export function parseByteUnit(str: string): number {
  const match = str.trim().toLowerCase().match(/^([0-9.]+)\s*(kb|mb|gb|tb|b)?$/);
  if (!match) return 0;
  const num = parseFloat(match[1]);
  const unit = match[2] || 'b';
  switch (unit) {
    case 'kb': return num * 1024;
    case 'mb': return num * 1024 * 1024;
    case 'gb': return num * 1024 * 1024 * 1024;
    case 'tb': return num * 1024 * 1024 * 1024 * 1024;
    default: return num;
  }
}

export function executeDeepDriveSearch(
  files: VirtualFile[],
  filters: DeepSearchFilters,
  everythingFilter: EverythingFilterType = 'all',
  matchPath: boolean = true,
  wholeWord: boolean = false
): VirtualFile[] {
  let rawQuery = filters.query.trim();

  // 1. Everything quick filter category check (Audio, Compressed, Document, Picture, Video)
  const activeCategorySpec = EVERYTHING_FILTERS.find((f) => f.id === everythingFilter);
  const categoryAllowedExts = activeCategorySpec?.extensions ? new Set(activeCategorySpec.extensions) : null;

  // 2. Parse Everything search modifiers from rawQuery
  // e.g. ext:pdf;docx  size:>5mb  dm:today  path:Accounting
  let queryExtFilter: Set<string> | null = null;
  let queryMinSize = filters.minSize || 0;
  let queryMaxSize = filters.maxSize || 0;

  // Extract ext:modifier
  const extMatch = rawQuery.match(/ext:([a-zA-Z0-9;,|]+)/i);
  if (extMatch) {
    const exts = extMatch[1].split(/[;,|]/).map((e) => e.trim().toLowerCase().replace(/^\./, '')).filter(Boolean);
    queryExtFilter = new Set(exts);
    rawQuery = rawQuery.replace(extMatch[0], '').trim();
  }

  // Extract size:>X or size:<Y modifier
  const sizeMatch = rawQuery.match(/size:([><]=?)([0-9.]+[a-zA-Z]*)/i);
  if (sizeMatch) {
    const op = sizeMatch[1];
    const byteVal = parseByteUnit(sizeMatch[2]);
    if (op.startsWith('>')) queryMinSize = byteVal;
    if (op.startsWith('<')) queryMaxSize = byteVal;
    rawQuery = rawQuery.replace(sizeMatch[0], '').trim();
  }

  // Extract regex modifier: regex:pattern
  let isRegex = filters.useRegex;
  if (rawQuery.startsWith('regex:')) {
    isRegex = true;
    rawQuery = rawQuery.replace(/^regex:/, '').trim();
  }

  // Prepare Regex or Token Parser
  let compiledRegex: RegExp | null = null;
  if (isRegex && rawQuery) {
    try {
      compiledRegex = new RegExp(rawQuery, filters.matchCase ? '' : 'i');
    } catch {
      compiledRegex = null;
    }
  }

  // Multi-term space-separated tokens (Everything defaults to AND matching for space separated words)
  // or vertical bar | for OR matching
  const searchTokens = rawQuery ? rawQuery.split(/\s+/).filter(Boolean) : [];

  const now = Date.now();
  const dayMs = 86400000;

  return files.filter((file) => {
    const fileExt = file.extension.toLowerCase();
    const fileDrive = file.drive || 'C:';

    // Everything category filter
    if (categoryAllowedExts && !categoryAllowedExts.has(fileExt)) {
      return false;
    }

    // Drive filter
    if (filters.selectedDrives.length > 0 && !filters.selectedDrives.includes('ALL')) {
      if (!filters.selectedDrives.includes(fileDrive)) {
        return false;
      }
    }

    // Query ext: filter
    if (queryExtFilter && !queryExtFilter.has(fileExt)) {
      return false;
    }

    // UI extension filter
    if (filters.selectedExtensions.length > 0) {
      const matchesExt = filters.selectedExtensions.some(
        (ext) => ext.replace(/^\./, '').toLowerCase() === fileExt
      );
      if (!matchesExt) return false;
    }

    // Category filter
    if (filters.selectedCategories.length > 0) {
      if (!filters.selectedCategories.includes(file.category)) {
        return false;
      }
    }

    // File Size bounds
    if (queryMinSize > 0 && file.size < queryMinSize) return false;
    if (queryMaxSize > 0 && file.size > queryMaxSize) return false;

    // Date Modified Range
    if (filters.dateRange !== 'all') {
      const ageMs = now - file.lastModified;
      if (filters.dateRange === 'today' && ageMs > dayMs) return false;
      if (filters.dateRange === 'week' && ageMs > dayMs * 7) return false;
      if (filters.dateRange === 'month' && ageMs > dayMs * 30) return false;
      if (filters.dateRange === 'year' && ageMs > dayMs * 365) return false;
      if (filters.dateRange === 'custom') {
        if (filters.customStartDate && file.lastModified < filters.customStartDate) return false;
        if (filters.customEndDate && file.lastModified > filters.customEndDate) return false;
      }
    }

    // Query Matching (Voidtools Everything fast substring/regex engine)
    if (rawQuery) {
      const textToSearch = matchPath ? `${fileDrive}\\${file.relativePath.replace(/\//g, '\\')}` : file.name;
      const compareText = filters.matchCase ? textToSearch : textToSearch.toLowerCase();

      if (compiledRegex) {
        if (!compiledRegex.test(textToSearch)) return false;
      } else {
        // All tokens must match (AND semantics like Everything)
        for (const token of searchTokens) {
          const needle = filters.matchCase ? token : token.toLowerCase();

          // Handle NOT operator: !keyword
          if (needle.startsWith('!') && needle.length > 1) {
            const notNeedle = needle.slice(1);
            if (compareText.includes(notNeedle)) return false;
            continue;
          }

          // Handle OR operator: word1|word2
          if (needle.includes('|')) {
            const orTerms = needle.split('|').filter(Boolean);
            const matchesAny = orTerms.some((t) => compareText.includes(t));
            if (!matchesAny) return false;
            continue;
          }

          if (wholeWord) {
            const regexWord = new RegExp(`\\b${needle}\\b`, filters.matchCase ? '' : 'i');
            if (!regexWord.test(textToSearch)) return false;
          } else {
            if (!compareText.includes(needle)) return false;
          }
        }
      }
    }

    // Content search
    if (filters.contentSearchText) {
      const cQuery = filters.contentSearchText.toLowerCase();
      if (typeof file.content === 'string') {
        if (!file.content.toLowerCase().includes(cQuery)) return false;
      } else {
        if (!file.name.toLowerCase().includes(cQuery) && !file.relativePath.toLowerCase().includes(cQuery)) {
          return false;
        }
      }
    }

    return true;
  });
}

/**
 * Recursively crawls a FileSystemDirectoryHandle (File System Access API) to index files in real time.
 */
export async function crawlDirectoryHandle(
  dirHandle: FileSystemDirectoryHandle,
  onProgress?: (count: number, currentItem: string) => void
): Promise<VirtualFile[]> {
  const files: VirtualFile[] = [];
  let count = 0;
  let lastProgressUpdate = 0;

  async function walk(handle: FileSystemDirectoryHandle, currentPath: string, depth = 0) {
    if (depth > 25) return;
    for await (const [name, entry] of handle.entries()) {
      if (entry.kind === 'file') {
        try {
          const file = await (entry as FileSystemFileHandle).getFile();
          count++;
          const now = performance.now();
          if (now - lastProgressUpdate > 60) {
            lastProgressUpdate = now;
            onProgress?.(count, name);
          }
          const ext = getFileExtension(name);
          const relPath = currentPath ? `${currentPath}/${name}` : name;
          files.push({
            id: `fs-drive-${Date.now()}-${count}-${Math.random().toString(36).slice(2, 6)}`,
            name,
            relativePath: relPath,
            size: file.size,
            type: file.type,
            extension: ext,
            lastModified: file.lastModified || Date.now(),
            category: classifyFileCategory(ext),
            selected: true,
            content: file,
            drive: 'C:',
          });
        } catch {
          // Skip inaccessible file
        }
      } else if (entry.kind === 'directory') {
        const subPath = currentPath ? `${currentPath}/${name}` : name;
        try {
          await walk(entry as FileSystemDirectoryHandle, subPath, depth + 1);
        } catch {
          // Skip permission-denied directory
        }
      }
    }
  }

  await walk(dirHandle, '');
  return files;
}

/**
 * Parses native Voidtools Everything File List (.efu or .csv) exports into VirtualFiles.
 */
export function parseEFUorCSVList(content: string): VirtualFile[] {
  const lines = content.split(/\r?\n/).filter(Boolean);
  const files: VirtualFile[] = [];
  let count = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('Filename,') || line.startsWith('"Filename"')) continue;

    let filename = '';
    let size = 0;

    if (line.startsWith('"')) {
      const closingQuote = line.indexOf('"', 1);
      if (closingQuote > 1) {
        filename = line.substring(1, closingQuote);
        const rest = line.substring(closingQuote + 1).split(',');
        if (rest[1]) size = parseInt(rest[1], 10) || 0;
      }
    } else {
      const parts = line.split(',');
      filename = parts[0] || '';
      if (parts[1]) size = parseInt(parts[1], 10) || 0;
    }

    if (!filename) continue;

    const normalizedPath = filename.replace(/\//g, '\\');
    const driveMatch = normalizedPath.match(/^([A-Za-z]:)/);
    const drive = driveMatch ? driveMatch[1].toUpperCase() : 'C:';
    const pathWithoutDrive = normalizedPath.replace(/^[A-Za-z]:\\?/, '');
    const segments = pathWithoutDrive.split('\\');
    const name = segments[segments.length - 1] || 'unnamed';
    const ext = getFileExtension(name);

    count++;
    files.push({
      id: `efu-${count}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      relativePath: pathWithoutDrive.replace(/\\/g, '/'),
      size,
      type: 'application/octet-stream',
      extension: ext,
      lastModified: Date.now() - Math.floor(Math.random() * 86400000 * 60),
      category: classifyFileCategory(ext),
      selected: true,
      drive,
    });
  }

  return files;
}

/**
 * Generates an authentic Windows NTFS Master File Table simulation
 * with realistic Windows OS, Program Files, User Libraries, and secondary storage volumes.
 */
export function generateWindowsDriveIndex(): VirtualFile[] {
  const now = Date.now();
  const day = 86400000;

  const entries: Array<{
    path: string;
    size: number;
    daysAgo: number;
    drive: string;
  }> = [
    // Windows OS & System files
    { path: 'Windows/explorer.exe', size: 5210000, daysAgo: 14, drive: 'C:' },
    { path: 'Windows/notepad.exe', size: 234000, daysAgo: 60, drive: 'C:' },
    { path: 'Windows/regedit.exe', size: 412000, daysAgo: 85, drive: 'C:' },
    { path: 'Windows/System32/cmd.exe', size: 289000, daysAgo: 120, drive: 'C:' },
    { path: 'Windows/System32/ntdll.dll', size: 2150000, daysAgo: 10, drive: 'C:' },
    { path: 'Windows/System32/kernel32.dll', size: 780000, daysAgo: 10, drive: 'C:' },
    { path: 'Windows/System32/taskmgr.exe', size: 1420000, daysAgo: 30, drive: 'C:' },
    { path: 'Windows/System32/drivers/etc/hosts', size: 824, daysAgo: 5, drive: 'C:' },
    { path: 'Windows/System32/WindowsPowerShell/v1.0/powershell.exe', size: 452000, daysAgo: 90, drive: 'C:' },
    { path: 'Windows/System32/msvcrt.dll', size: 648000, daysAgo: 400, drive: 'C:' },
    { path: 'Windows/System32/calc.exe', size: 32000, daysAgo: 180, drive: 'C:' },
    { path: 'Windows/Fonts/segoeui.ttf', size: 940000, daysAgo: 300, drive: 'C:' },
    { path: 'Windows/Logs/CBS/CBS.log', size: 14500000, daysAgo: 1, drive: 'C:' },
    { path: 'Windows/win.ini', size: 512, daysAgo: 600, drive: 'C:' },

    // Program Files (x86 / 64)
    { path: 'Program Files/Google/Chrome/Application/chrome.exe', size: 3120000, daysAgo: 3, drive: 'C:' },
    { path: 'Program Files/Microsoft VS Code/Code.exe', size: 135000000, daysAgo: 8, drive: 'C:' },
    { path: 'Program Files/7-Zip/7z.exe', size: 580000, daysAgo: 240, drive: 'C:' },
    { path: 'Program Files/7-Zip/7z.dll', size: 1890000, daysAgo: 240, drive: 'C:' },
    { path: 'Program Files/Everything/Everything.exe', size: 2100000, daysAgo: 45, drive: 'C:' },
    { path: 'Program Files/Git/bin/git.exe', size: 3200000, daysAgo: 70, drive: 'C:' },
    { path: 'Program Files/Nodejs/node.exe', size: 68500000, daysAgo: 20, drive: 'C:' },
    { path: 'Program Files/Python311/python.exe', size: 104000, daysAgo: 110, drive: 'C:' },
    { path: 'Program Files/VideoLAN/VLC/vlc.exe', size: 198000, daysAgo: 150, drive: 'C:' },
    { path: 'Program Files/Windows NT/Accessories/wordpad.exe', size: 245000, daysAgo: 365, drive: 'C:' },

    // Users & Personal Libraries
    { path: 'Users/Admin/Desktop/Project_Roadmap_2025.xlsx', size: 145000, daysAgo: 4, drive: 'C:' },
    { path: 'Users/Admin/Desktop/Meeting_Notes.txt', size: 2400, daysAgo: 1, drive: 'C:' },
    { path: 'Users/Admin/Documents/Financials/2025_Annual_Budget.xlsx', size: 489000, daysAgo: 12, drive: 'C:' },
    { path: 'Users/Admin/Documents/Invoices/Invoice_ACME_Corp_0089.pdf', size: 421000, daysAgo: 7, drive: 'C:' },
    { path: 'Users/Admin/Documents/Invoices/Invoice_GlobalTech_0090.pdf', size: 389000, daysAgo: 18, drive: 'C:' },
    { path: 'Users/Admin/Documents/Contracts/Client_Agreement_Signed.docx', size: 124000, daysAgo: 25, drive: 'C:' },
    { path: 'Users/Admin/Documents/Contracts/Mutual_NDA_Standard.pdf', size: 260000, daysAgo: 80, drive: 'C:' },
    { path: 'Users/Admin/Pictures/Screenshots/Bug_Report_Screen.png', size: 1840000, daysAgo: 2, drive: 'C:' },
    { path: 'Users/Admin/Pictures/Wallpapers/mountains_sunset_4k.jpg', size: 4890000, daysAgo: 45, drive: 'C:' },
    { path: 'Users/Admin/Music/Podcasts/Episode_14_Master.mp3', size: 38500000, daysAgo: 15, drive: 'C:' },
    { path: 'Users/Admin/Music/AudioTracks/guitar_riff_clean.wav', size: 14200000, daysAgo: 9, drive: 'C:' },
    { path: 'Users/Admin/Videos/Captures/software_demo_screencast.mp4', size: 74200000, daysAgo: 6, drive: 'C:' },
    { path: 'Users/Admin/Downloads/VSCodeUserSetup-x64-1.94.exe', size: 98500000, daysAgo: 8, drive: 'C:' },
    { path: 'Users/Admin/Downloads/Git-64-bit-installer.exe', size: 54100000, daysAgo: 70, drive: 'C:' },
    { path: 'Users/Admin/Downloads/q3_presentation_slides.pptx', size: 6800000, daysAgo: 14, drive: 'C:' },
    { path: 'Users/Admin/AppData/Local/Google/Chrome/User Data/Default/History', size: 8400000, daysAgo: 0, drive: 'C:' },

    // D: Drive - Code Repositories & Data
    { path: 'Projects/OmniFile/package.json', size: 2400, daysAgo: 1, drive: 'D:' },
    { path: 'Projects/OmniFile/src/App.tsx', size: 19800, daysAgo: 1, drive: 'D:' },
    { path: 'Projects/OmniFile/src/components/DriveSearchModule.tsx', size: 32000, daysAgo: 1, drive: 'D:' },
    { path: 'Projects/OmniFile/src/utils/searchEngine.ts', size: 12000, daysAgo: 1, drive: 'D:' },
    { path: 'Projects/OmniFile/README.md', size: 4500, daysAgo: 2, drive: 'D:' },
    { path: 'Database/Backups/postgresql_cluster_dump.sql', size: 142000000, daysAgo: 5, drive: 'D:' },
    { path: 'VirtualMachines/Ubuntu_Server_24.04.vdi', size: 8540000000, daysAgo: 19, drive: 'D:' },
    { path: 'Archives/Project_Assets_2024.zip', size: 489000000, daysAgo: 140, drive: 'D:' },

    // E: Drive - Removable USB & Media
    { path: 'Backups/Whole_System_Image_Backup.iso', size: 18400000000, daysAgo: 30, drive: 'E:' },
    { path: 'Footage/B_Roll_Drone_4K.mp4', size: 1420000000, daysAgo: 22, drive: 'E:' },
    { path: 'Raw_Audio/Podcast_Recording_Session.wav', size: 650000000, daysAgo: 14, drive: 'E:' },
    { path: 'Encrypted_Vault/Personal_Backup.7z', size: 2400000000, daysAgo: 60, drive: 'E:' },
  ];

  return entries.map((entry, idx) => {
    const filename = entry.path.split('/').pop() || entry.path;
    const ext = getFileExtension(filename);
    return {
      id: `ntfs-file-${idx}-${Date.now()}`,
      name: filename,
      relativePath: entry.path,
      size: entry.size,
      type: 'application/octet-stream',
      extension: ext,
      lastModified: now - entry.daysAgo * day,
      category: classifyFileCategory(ext),
      selected: false,
      drive: entry.drive,
    };
  });
}

export interface LiveEverythingItem {
  name: string;
  path: string;
  size: number | string;
  date_modified?: number | string;
  type?: 'file' | 'folder';
}

export interface LiveEverythingResponse {
  totalResults: number;
  results: LiveEverythingItem[];
}

export function fileTimeToUnixMs(fileTime: number | string): number {
  try {
    const num = typeof fileTime === 'string' ? BigInt(fileTime) : BigInt(Math.floor(fileTime));
    if (num > 100000000000000n) {
      // Windows FILETIME (100-nanosecond intervals since Jan 1, 1601)
      const ms = Number(num / 10000n - 11644473600000n);
      return Number.isFinite(ms) && ms > 0 ? ms : Date.now();
    }
    if (num > 10000000000n) {
      return Number(num);
    }
    if (num > 0n) {
      return Number(num * 1000n);
    }
  } catch {
    // fallback
  }
  return Date.now();
}

export function mapEverythingResultsToVirtualFiles(results: LiveEverythingItem[]): VirtualFile[] {
  return results.map((item, idx) => {
    const ext = getFileExtension(item.name);
    const driveMatch = item.path.match(/^([a-zA-Z]:)/);
    const drive = driveMatch ? driveMatch[1] : 'C:';
    const cleanPath = item.path.replace(/^[a-zA-Z]:[\\/]/, '').replace(/\\/g, '/');
    const relPath = cleanPath ? `${cleanPath}/${item.name}` : item.name;
    const rawSize = typeof item.size === 'number' ? item.size : parseInt(item.size, 10) || 0;
    const mtime = item.date_modified ? fileTimeToUnixMs(item.date_modified) : Date.now();

    return {
      id: `live-ev-${idx}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: item.name,
      relativePath: relPath,
      size: rawSize,
      type: item.type === 'folder' ? 'inode/directory' : 'application/octet-stream',
      extension: ext,
      lastModified: mtime,
      category: classifyFileCategory(ext),
      selected: false,
      drive,
    };
  });
}

/**
 * Queries the live Voidtools Everything HTTP/REST Server API or Electron IPC bridge.
 */
export async function queryLiveEverythingHttp(
  query: string,
  endpoint = 'http://127.0.0.1:8080',
  options: {
    count?: number;
    matchCase?: boolean;
    useRegex?: boolean;
    matchPath?: boolean;
    matchWholeWord?: boolean;
  } = {}
): Promise<{ files: VirtualFile[]; totalResults: number; durationMs: number }> {
  const start = performance.now();

  // 1. Check if running inside Electron desktop container with IPC bridge
  // @ts-expect-error window.electronAPI is injected via preload.cjs
  if (typeof window !== 'undefined' && window.electronAPI?.queryLiveEverything) {
    try {
      // @ts-expect-error window.electronAPI
      const res = await window.electronAPI.queryLiveEverything(query, options);
      if (res && res.success && res.data) {
        const files = mapEverythingResultsToVirtualFiles(res.data.results || []);
        return {
          files,
          totalResults: res.data.totalResults ?? files.length,
          durationMs: parseFloat((performance.now() - start).toFixed(2)),
        };
      }
    } catch {
      // fallback to HTTP fetch
    }
  }

  // 2. Fetch directly from Everything HTTP Server API
  const cleanEndpoint = endpoint.replace(/\/+$/, '');
  const url = new URL(cleanEndpoint.startsWith('http') ? cleanEndpoint : `http://${cleanEndpoint}`);
  url.searchParams.set('search', query || '');
  url.searchParams.set('json', '1');
  url.searchParams.set('count', String(options.count || 2000));
  url.searchParams.set('path_column', '1');
  url.searchParams.set('size_column', '1');
  url.searchParams.set('date_modified_column', '1');
  if (options.matchCase) url.searchParams.set('case', '1');
  if (options.useRegex) url.searchParams.set('regex', '1');
  if (options.matchPath) url.searchParams.set('path', '1');
  if (options.matchWholeWord) url.searchParams.set('wholeword', '1');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3500);

  const res = await fetch(url.toString(), {
    signal: controller.signal,
    headers: { Accept: 'application/json' },
  });
  clearTimeout(timeoutId);

  if (!res.ok) {
    throw new Error(`Everything HTTP API responded with status ${res.status}`);
  }

  const data: LiveEverythingResponse = await res.json();
  const files = mapEverythingResultsToVirtualFiles(data.results || []);

  return {
    files,
    totalResults: data.totalResults ?? files.length,
    durationMs: parseFloat((performance.now() - start).toFixed(2)),
  };
}

/**
 * Pings the local Voidtools Everything server to check if it is active.
 */
export async function testLiveEverythingConnection(
  endpoint = 'http://127.0.0.1:8080'
): Promise<{ ok: boolean; totalResults?: number; error?: string }> {
  try {
    const cleanEndpoint = endpoint.replace(/\/+$/, '');
    const url = new URL(cleanEndpoint.startsWith('http') ? cleanEndpoint : `http://${cleanEndpoint}`);
    url.searchParams.set('search', '');
    url.searchParams.set('json', '1');
    url.searchParams.set('count', '1');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(url.toString(), { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const json = await res.json();
      return { ok: true, totalResults: json.totalResults || 0 };
    }
    return { ok: false, error: `HTTP ${res.status}` };
  } catch (err: unknown) {
    return { ok: false, error: (err as Error)?.message || 'Unreachable' };
  }
}

/**
 * Generates a standalone, zero-install Windows .bat + PowerShell local PC indexer bridge
 * that reads all fixed/removable drives (C:\, D:\, E:\) and serves Everything-compatible JSON
 * with CORS + Private Network Access headers on http://127.0.0.1:3847/
 */
export function generateWindowsNTFSBridgeScript(): string {
  return `<# :
@echo off
title OmniFile Local PC Engine Bridge (127.0.0.1:3847)
echo ====================================================================
echo   OmniFile Local PC Indexer Bridge - Full Drive Search (No Folders)
echo ====================================================================
echo Starting local Everything-compatible drive index server...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-Expression ([System.IO.File]::ReadAllText('%~f0'))"
exit /b
#>

$port = 3847
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:$port/")
$listener.Start()

Write-Host "[1/2] Scanning fixed and removable drives on this PC..." -ForegroundColor Cyan
$index = New-Object System.Collections.Generic.List[object]
$drives = [System.IO.DriveInfo]::GetDrives() | Where-Object { $_.IsReady -and ($_.DriveType -eq 'Fixed' -or $_.DriveType -eq 'Removable') }

foreach ($drv in $drives) {
    Write-Host "  -> Indexing $($drv.Name) ($($drv.VolumeLabel))..." -ForegroundColor Yellow
    $stack = New-Object System.Collections.Generic.Stack[string]
    $stack.Push($drv.RootDirectory.FullName)
    while ($stack.Count -gt 0 -and $index.Count -lt 250000) {
        $dir = $stack.Pop()
        try {
            foreach ($file in [System.IO.Directory]::EnumerateFiles($dir)) {
                try {
                    $fi = New-Object System.IO.FileInfo($file)
                    $index.Add([PSCustomObject]@{
                        name = $fi.Name
                        path = $fi.DirectoryName
                        size = $fi.Length
                        date_modified = [DateTimeOffset]::new($fi.LastWriteTimeUtc).ToUnixTimeMilliseconds()
                        type = 'file'
                    })
                } catch {}
            }
            foreach ($sub in [System.IO.Directory]::EnumerateDirectories($dir)) {
                $name = [System.IO.Path]::GetFileName($sub)
                if ($name -ne '$Recycle.Bin' -and $name -ne 'System Volume Information') {
                    $stack.Push($sub)
                }
            }
        } catch {}
    }
}

Write-Host "[2/2] Indexed $($index.Count) files! Listening on http://127.0.0.1:$port/" -ForegroundColor Green
Write-Host "Keep this window open while using OmniFile in your browser." -ForegroundColor Gray

while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $req = $ctx.Request
    $res = $ctx.Response

    $res.Headers.Add("Access-Control-Allow-Origin", "*")
    $res.Headers.Add("Access-Control-Allow-Private-Network", "true")
    $res.Headers.Add("Access-Control-Allow-Methods", "GET, OPTIONS")
    $res.Headers.Add("Access-Control-Allow-Headers", "*")

    if ($req.HttpMethod -eq "OPTIONS") {
        $res.StatusCode = 204
        $res.Close()
        continue
    }

    $q = $req.QueryString["search"]
    $countParam = 2000
    if ($req.QueryString["count"]) { [int]::TryParse($req.QueryString["count"], [ref]$countParam) | Out-Null }

    $matched = if ([string]::IsNullOrWhiteSpace($q)) {
        $index
    } else {
        $lowerQ = $q.ToLowerInvariant()
        $index | Where-Object { ($_.path + "\\" + $_.name).ToLowerInvariant().Contains($lowerQ) }
    }

    $matchedArr = @($matched)
    $payload = @{
        totalResults = $matchedArr.Count
        results = @($matchedArr | Select-Object -First $countParam)
    } | ConvertTo-Json -Compress -Depth 3

    $bytes = [System.Text.Encoding]::UTF8.GetBytes($payload)
    $res.ContentType = "application/json; charset=utf-8"
    $res.ContentLength64 = $bytes.Length
    $res.OutputStream.Write($bytes, 0, $bytes.Length)
    $res.Close()
}
`;
}


