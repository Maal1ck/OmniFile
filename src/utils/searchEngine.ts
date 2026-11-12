import { VirtualFile, DeepSearchFilters } from '../types/fileSystem';

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
