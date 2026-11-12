import { VirtualFile, DriveInfo, DeepSearchFilters } from '../types/fileSystem';

export const DEFAULT_DRIVES: DriveInfo[] = [
  {
    id: 'drive-c',
    name: 'Windows OS & System',
    letter: 'C:',
    type: 'local',
    totalSpace: 512000000000, // 512 GB
    usedSpace: 348000000000,
    fileCount: 0,
    isMounted: true,
    color: '#0284c7', // sky
  },
  {
    id: 'drive-d',
    name: 'Data, Projects & Code',
    letter: 'D:',
    type: 'local',
    totalSpace: 1099511627776, // 1 TB
    usedSpace: 642000000000,
    fileCount: 0,
    isMounted: true,
    color: '#0d9488', // teal
  },
  {
    id: 'drive-e',
    name: 'Samsung T7 Shield (USB)',
    letter: 'E:',
    type: 'removable',
    totalSpace: 2000000000000, // 2 TB
    usedSpace: 890000000000,
    fileCount: 0,
    isMounted: true,
    color: '#e11d48', // rose
  },
  {
    id: 'drive-z',
    name: 'Synology NAS (Network)',
    letter: 'Z:',
    type: 'network',
    totalSpace: 8000000000000, // 8 TB
    usedSpace: 4120000000000,
    fileCount: 0,
    isMounted: false,
    color: '#8b5cf6', // purple
  },
];

export function executeDeepDriveSearch(
  files: VirtualFile[],
  filters: DeepSearchFilters
): VirtualFile[] {
  const queryLower = filters.query.trim().toLowerCase();
  const contentLower = filters.contentSearchText ? filters.contentSearchText.trim().toLowerCase() : '';

  let regex: RegExp | null = null;
  if (filters.useRegex && filters.query.trim()) {
    try {
      regex = new RegExp(filters.query, filters.matchCase ? '' : 'i');
    } catch {
      regex = null;
    }
  }

  const now = Date.now();
  const dayMs = 86400000;

  return files.filter((file) => {
    // 1. Drive letter filter
    if (filters.selectedDrives.length > 0 && !filters.selectedDrives.includes('ALL')) {
      const fileDrive = file.drive || 'C:';
      if (!filters.selectedDrives.includes(fileDrive)) {
        return false;
      }
    }

    // 2. Extension filter
    if (filters.selectedExtensions.length > 0) {
      const fileExt = file.extension.toLowerCase();
      const matchesExt = filters.selectedExtensions.some(
        (ext) => ext.replace(/^\./, '').toLowerCase() === fileExt
      );
      if (!matchesExt) return false;
    }

    // 3. Category filter
    if (filters.selectedCategories.length > 0) {
      if (!filters.selectedCategories.includes(file.category)) {
        return false;
      }
    }

    // 4. File Size bounds
    if (filters.minSize > 0 && file.size < filters.minSize) {
      return false;
    }
    if (filters.maxSize > 0 && file.size > filters.maxSize) {
      return false;
    }

    // 5. Date Range
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

    // 6. Name / Path Query Match
    if (queryLower) {
      if (regex) {
        if (!regex.test(file.name) && !regex.test(file.relativePath)) {
          return false;
        }
      } else if (filters.matchCase) {
        if (!file.name.includes(filters.query) && !file.relativePath.includes(filters.query)) {
          return false;
        }
      } else {
        if (!file.name.toLowerCase().includes(queryLower) && !file.relativePath.toLowerCase().includes(queryLower)) {
          return false;
        }
      }
    }

    // 7. Full-Text Content Search (if text stream or content exists)
    if (contentLower) {
      if (typeof file.content === 'string') {
        if (!file.content.toLowerCase().includes(contentLower)) {
          return false;
        }
      } else {
        // Fallback checks on name/path if binary
        if (!file.name.toLowerCase().includes(contentLower) && !file.relativePath.toLowerCase().includes(contentLower)) {
          return false;
        }
      }
    }

    return true;
  });
}
