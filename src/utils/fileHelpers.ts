import JSZip from 'jszip';
import {
  VirtualFile,
  FileCategory,
  RenameConfig,
  FlattenConfig,
  OrganizeConfig,
  CustomOrganizeRule,
} from '../types/fileSystem';

export const EXCEL_FILE_EXTENSIONS = new Set([
  'xls', 'xlsx', 'xlsm', 'xlsb', 'xlt', 'xltx', 'xltm', 'xlam', 'xla', 'xlw',
]);

/**
 * Concurrently maps an array of items with a worker pool of given concurrency limit
 */
export async function mapAsyncWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex++;
      results[currentIndex] = await fn(items[currentIndex], currentIndex);
    }
  }

  const workerCount = Math.min(concurrency, items.length);
  const workers: Promise<void>[] = [];
  for (let i = 0; i < workerCount; i++) {
    workers.push(worker());
  }

  await Promise.all(workers);
  return results;
}

export function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  return lastDot >= 0 && lastDot < filename.length - 1
    ? filename.slice(lastDot + 1).toLowerCase()
    : '';
}

export function getFileNameWithoutExtension(filename: string): string {
  const lastDotIndex = filename.lastIndexOf('.');
  return lastDotIndex > 0 ? filename.substring(0, lastDotIndex) : filename;
}

const COMPOUND_GIS_SUFFIXES = [
  '.shp.ea.iso.xml',
  '.shp.iso.xml',
  '.shp.xml',
  '.dbf.xml',
  '.tif.aux.xml',
  '.tiff.aux.xml',
  '.jpg.aux.xml',
  '.jpeg.aux.xml',
  '.png.aux.xml',
  '.jp2.aux.xml',
  '.img.aux.xml',
  '.ecw.aux.xml',
  '.sid.aux.xml',
  '.asc.aux.xml',
  '.vrt.aux.xml',
  '.aux.xml',
  '.tif.vat.dbf',
  '.tiff.vat.dbf',
  '.img.vat.dbf',
  '.vat.dbf',
  '.tif.ovr',
  '.tiff.ovr',
  '.img.ovr',
  '.ecw.ovr',
  '.sid.ovr',
  '.jp2.ovr',
  '.tif.enp',
  '.tif.xml',
  '.tiff.xml',
  '.img.xml',
  '.gpkg-wal',
  '.gpkg-shm',
];

export const GEOSPATIAL_EXTENSIONS = new Set([
  // Vector / Shapefile & companions
  'shp', 'shx', 'dbf', 'prj', 'cpg', 'sbn', 'sbx', 'fbn', 'fbx',
  'ain', 'aih', 'ixs', 'mxs', 'atx', 'qix', 'fix', 'qpj',
  'gpkg', 'gpkg-wal', 'gpkg-shm', 'gpx', 'kml', 'kmz',
  'geojson', 'topojson', 'gml', 'osm', 'pbf', 'fgb',
  // MapInfo
  'tab', 'map', 'ind', 'aid', 'wor', 'mif', 'mid',
  // Georeferenced raster, LiDAR & world/sidecar extensions
  'geotiff', 'vrt', 'dem', 'grd', 'grib', 'grb', 'nc',
  'las', 'laz', 'lax', 'bil', 'bip', 'bsq', 'flt', 'asc',
  'img', 'ige', 'sid', 'ecw', 'jp2', 'ers',
  'tfw', 'tifw', 'tiffw', 'jgw', 'jpgw', 'jpegw',
  'pgw', 'pngw', 'j2w', 'jp2w', 'gfw', 'gifw', 'bpw', 'bmpw',
  'sdw', 'eww', 'wld', 'tfwx', 'jgwx', 'pgwx',
  'ovr', 'rrd', 'aux', 'hdr', 'stx', 'clr', 'rsc',
  // GIS Symbology / Project / Metadata
  'qml', 'sld', 'lyr', 'lyrx', 'qlr', 'mxd',
]);

// Precomputed O(1) lookup table for instant, zero-allocation file classification
const EXT_CATEGORY_MAP = new Map<string, FileCategory>();
for (const ext of ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', 'pages', 'md', 'epub']) {
  EXT_CATEGORY_MAP.set(ext, 'documents');
}
for (const ext of [...EXCEL_FILE_EXTENSIONS, 'csv', 'tsv', 'ods', 'numbers']) {
  EXT_CATEGORY_MAP.set(ext, 'spreadsheets');
}
for (const ext of ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp', 'ico', 'tiff', 'tif', 'heic', 'raw', 'psd']) {
  EXT_CATEGORY_MAP.set(ext, 'images');
}
for (const ext of ['mp3', 'wav', 'aac', 'flac', 'ogg', 'm4a', 'wma', 'aiff']) {
  EXT_CATEGORY_MAP.set(ext, 'audio');
}
for (const ext of ['mp4', 'mov', 'avi', 'mkv', 'webm', 'wmv', 'flv', 'm4v']) {
  EXT_CATEGORY_MAP.set(ext, 'videos');
}
for (const ext of ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'iso']) {
  EXT_CATEGORY_MAP.set(ext, 'archives');
}
for (const ext of ['js', 'ts', 'jsx', 'tsx', 'py', 'html', 'css', 'scss', 'json', 'yaml', 'yml', 'xml', 'sql', 'sh', 'bat', 'c', 'cpp', 'java', 'go', 'rs', 'php']) {
  EXT_CATEGORY_MAP.set(ext, 'code');
}
for (const ext of ['ppt', 'pptx', 'key', 'odp']) {
  EXT_CATEGORY_MAP.set(ext, 'presentations');
}
for (const ext of ['sqlite', 'db', 'parquet', 'log', 'dat', 'bak', 'env']) {
  EXT_CATEGORY_MAP.set(ext, 'data');
}
// Populate geospatial last so geospatial sidecars/datasets always take priority
for (const ext of GEOSPATIAL_EXTENSIONS) {
  EXT_CATEGORY_MAP.set(ext, 'geospatial');
}

// Fast-path guard: all COMPOUND_GIS_SUFFIXES end with one of these tails
function mayHaveCompoundGisSuffix(lowerName: string): boolean {
  return (
    lowerName.endsWith('.xml') ||
    lowerName.endsWith('.dbf') ||
    lowerName.endsWith('.ovr') ||
    lowerName.endsWith('.enp') ||
    lowerName.endsWith('-wal') ||
    lowerName.endsWith('-shm')
  );
}

export function getEffectiveExtensionToken(filename: string): string {
  const lower = filename.toLowerCase();
  if (mayHaveCompoundGisSuffix(lower)) {
    for (let i = 0; i < COMPOUND_GIS_SUFFIXES.length; i++) {
      const suffix = COMPOUND_GIS_SUFFIXES[i];
      if (lower.endsWith(suffix)) {
        return suffix.slice(1); // without leading dot
      }
    }
  }
  return getFileExtension(filename);
}

export function classifyFileCategory(extension: string, filename?: string): FileCategory {
  const ext = extension.toLowerCase();
  if (filename) {
    const lower = filename.toLowerCase();
    if (mayHaveCompoundGisSuffix(lower)) {
      for (let i = 0; i < COMPOUND_GIS_SUFFIXES.length; i++) {
        if (lower.endsWith(COMPOUND_GIS_SUFFIXES[i])) {
          return 'geospatial';
        }
      }
    }
  }
  return EXT_CATEGORY_MAP.get(ext) || 'other';
}

export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function formatDate(timestamp: number, formatPattern: string = 'YYYY-MM-DD'): string {
  const d = new Date(timestamp);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');

  switch (formatPattern) {
    case 'YYYY-MM-DD':
      return `${year}-${month}-${day}`;
    case 'YYYYMMDD':
      return `${year}${month}${day}`;
    case 'DD-MM-YYYY':
      return `${day}-${month}-${year}`;
    case 'YYYY/MM':
      return `${year}/${month}`;
    case 'YYYY-MM':
      return `${year}-${month}`;
    case 'YYYY/MM/DD':
      return `${year}/${month}/${day}`;
    case 'YYYY-Quarter': {
      const q = Math.ceil((d.getMonth() + 1) / 3);
      return `${year}-Q${q}`;
    }
    default:
      return `${year}-${month}-${day} ${hours}:${minutes}`;
  }
}

// Case conversion helpers
export function convertCase(
  text: string,
  caseType: 'lower' | 'upper' | 'title' | 'camel' | 'kebab' | 'snake'
): string {
  if (!text) return text;
  
  // Split words by space, underscore, hyphen, or camelCase transitions
  const words = text
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[\-_]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  switch (caseType) {
    case 'lower':
      return text.toLowerCase();
    case 'upper':
      return text.toUpperCase();
    case 'title':
      return words
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
    case 'camel':
      return words
        .map((w, i) =>
          i === 0
            ? w.toLowerCase()
            : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
        )
        .join('');
    case 'kebab':
      return words.map((w) => w.toLowerCase()).join('-');
    case 'snake':
      return words.map((w) => w.toLowerCase()).join('_');
    default:
      return text;
  }
}

export interface RenameResult {
  file: VirtualFile;
  originalName: string;
  originalPath: string;
  computedName: string;
  targetPath: string;
  isModified: boolean;
  hasCollision: boolean;
  collisionResolvedName: string;
}

// Compute batch rename preview
export function computeBatchRename(
  files: VirtualFile[],
  config: RenameConfig
): RenameResult[] {
  const results: RenameResult[] = [];
  const nameOccurrences = new Map<string, number>();

  files.forEach((file, index) => {
    const ext = config.changeExtension && config.newExtension
      ? config.newExtension.replace(/^\./, '').toLowerCase()
      : file.extension;
    const baseName = getFileNameWithoutExtension(file.name);
    let newBaseName = baseName;

    const fileDate = new Date(file.lastModified);
    const dateFormatted = formatDate(file.lastModified, config.dateFormat);
    const paddedIndex = String(config.startNumber + index * config.stepNumber).padStart(
      config.digitsPadding,
      '0'
    );

    switch (config.mode) {
      case 'template': {
        newBaseName = config.template
          .replace(/\[name\]|\{name\}/gi, baseName)
          .replace(/\[num\]|\{num\}|\{index\}|\[index\]/gi, paddedIndex)
          .replace(/\{num:(\d+)\}/gi, (_, padding) =>
            String(config.startNumber + index * config.stepNumber).padStart(Number(padding), '0')
          )
          .replace(/\[date\]|\{date\}/gi, dateFormatted)
          .replace(/\{YYYY\}/gi, String(fileDate.getFullYear()))
          .replace(/\{MM\}/gi, String(fileDate.getMonth() + 1).padStart(2, '0'))
          .replace(/\{DD\}/gi, String(fileDate.getDate()).padStart(2, '0'))
          .replace(/\[ext\]|\{ext\}/gi, ext);
        break;
      }

      case 'replace': {
        if (config.search) {
          try {
            if (config.useRegex) {
              const flags = config.matchCase ? 'g' : 'gi';
              const regex = new RegExp(config.search, flags);
              newBaseName = baseName.replace(regex, config.replace || '');
            } else {
              if (config.matchCase) {
                newBaseName = baseName.split(config.search).join(config.replace || '');
              } else {
                const regex = new RegExp(
                  config.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
                  'gi'
                );
                newBaseName = baseName.replace(regex, config.replace || '');
              }
            }
          } catch {
            // Regex error fallback
            newBaseName = baseName;
          }
        }
        break;
      }

      case 'prefix_suffix': {
        newBaseName = `${config.prefix || ''}${baseName}${config.suffix || ''}`;
        break;
      }

      case 'case': {
        newBaseName = convertCase(baseName, config.caseType);
        break;
      }

      case 'numbering': {
        newBaseName = `${paddedIndex}_${baseName}`;
        break;
      }

      case 'date': {
        newBaseName = `${dateFormatted}_${baseName}`;
        break;
      }
    }

    if (config.includeParentFolders) {
      const parentFolders = file.relativePath
        .replace(/\\/g, '/')
        .split('/')
        .slice(0, -1);
      const levelCount = Math.max(1, Math.floor(config.parentFolderLevels) || 1);
      const folderPrefix = parentFolders.slice(-levelCount).join('_');
      if (folderPrefix) newBaseName = `${folderPrefix}_${newBaseName}`;
    }

    const computedFullName = ext ? `${newBaseName}.${ext}` : newBaseName;
    const parentDir = file.relativePath.includes('/')
      ? file.relativePath.substring(0, file.relativePath.lastIndexOf('/') + 1)
      : '';
    const targetPath = `${parentDir}${computedFullName}`;

    // Collision detection within the target directory
    const dirKey = `${parentDir}__${computedFullName.toLowerCase()}`;
    const count = (nameOccurrences.get(dirKey) || 0) + 1;
    nameOccurrences.set(dirKey, count);

    let hasCollision = count > 1;
    let collisionResolvedName = computedFullName;

    if (hasCollision && config.collisionResolution === 'number_suffix') {
      const disambiguated = ext
        ? `${newBaseName} (${count - 1}).${ext}`
        : `${newBaseName} (${count - 1})`;
      collisionResolvedName = disambiguated;
    }

    results.push({
      file,
      originalName: file.name,
      originalPath: file.relativePath,
      computedName: computedFullName,
      targetPath,
      isModified: computedFullName !== file.name,
      hasCollision,
      collisionResolvedName,
    });
  });

  return results;
}

export interface FlattenResult {
  file: VirtualFile;
  originalPath: string;
  flattenedName: string;
  hasCollision: boolean;
  depth: number;
}

// Compute flattening preview (all_files_flat)
export function computeDirectoryFlattening(
  files: VirtualFile[],
  config: FlattenConfig
): FlattenResult[] {
  const results: FlattenResult[] = [];
  const occurrences = new Map<string, number>();

  files.forEach((file) => {
    const pathParts = file.relativePath.split('/').filter(Boolean);
    const depth = Math.max(0, pathParts.length - 1);
    const ext = file.extension;
    const baseName = getFileNameWithoutExtension(file.name);

    let flattenedBase = baseName;

    if (config.collisionStrategy === 'path_prefix' && depth > 0) {
      // Prefix with ancestor folders: FolderA_FolderB_filename.ext
      const folderPrefix = pathParts
        .slice(0, -1)
        .join(config.separator);
      flattenedBase = `${folderPrefix}${config.separator}${baseName}`;
    }

    if (config.caseHandling === 'lowercase') {
      flattenedBase = flattenedBase.toLowerCase();
    }

    let preliminaryName = ext ? `${flattenedBase}.${ext}` : flattenedBase;
    const lowerKey = preliminaryName.toLowerCase();
    const count = (occurrences.get(lowerKey) || 0) + 1;
    occurrences.set(lowerKey, count);

    let finalName = preliminaryName;
    let hasCollision = count > 1;

    if (hasCollision) {
      if (config.collisionStrategy === 'number_suffix') {
        finalName = ext
          ? `${flattenedBase} (${count - 1}).${ext}`
          : `${flattenedBase} (${count - 1})`;
      } else if (config.collisionStrategy === 'timestamp') {
        const timeToken = formatDate(file.lastModified, 'YYYYMMDD');
        finalName = ext
          ? `${flattenedBase}_${timeToken}_${count}.${ext}`
          : `${flattenedBase}_${timeToken}_${count}`;
      }
    }

    results.push({
      file,
      originalPath: file.relativePath,
      flattenedName: finalName,
      hasCollision,
      depth,
    });
  });

  return results;
}

export type BundleKind =
  | 'shapefile'
  | 'mapinfo'
  | 'georef_raster'
  | 'geospatial_dataset'
  | 'complementary_pair';

export interface ComplementaryBundle {
  id: string;
  kind: BundleKind;
  displayName: string;
  primaryFile: VirtualFile;
  files: VirtualFile[];
  isGeospatial: boolean;
}

export interface OrganizeResult {
  file: VirtualFile;
  originalPath: string;
  destinationFolder: string;
  targetPath: string;
  category: FileCategory;
  ruleMatched?: string;
  hasCollision: boolean;
  included: boolean;
  bundleKind?: BundleKind;
  bundleName?: string;
  bundleCount?: number;
}

// Category folder names
export const CATEGORY_FOLDER_NAMES: Record<FileCategory, string> = {
  documents: 'Documents',
  spreadsheets: 'Spreadsheets',
  images: 'Images',
  audio: 'Audio',
  videos: 'Videos',
  archives: 'Archives',
  code: 'Code & Scripts',
  presentations: 'Presentations',
  data: 'Data & Databases',
  geospatial: 'Geospatial',
  other: 'Miscellaneous',
};

const SHAPEFILE_COMPANIONS = new Set([
  'shp', 'shx', 'dbf', 'prj', 'cpg', 'sbn', 'sbx', 'fbn', 'fbx',
  'ain', 'aih', 'ixs', 'mxs', 'atx', 'qix', 'fix', 'qpj',
  'shp.xml', 'shp.iso.xml', 'shp.ea.iso.xml', 'dbf.xml', 'xml',
  'qml', 'sld', 'lyr', 'lyrx', 'qlr', 'mxd', 'idx',
]);

const MAPINFO_COMPANIONS = new Set([
  'tab', 'dat', 'id', 'map', 'ind', 'aid', 'wor', 'xml', 'qml', 'sld',
]);

const RASTER_PRIMARIES = new Set([
  'tif', 'tiff', 'geotiff', 'jpg', 'jpeg', 'png', 'jp2', 'bmp', 'gif',
  'img', 'ecw', 'sid', 'vrt', 'asc', 'grd', 'dem', 'bil', 'bip', 'bsq',
  'flt', 'ers', 'nc', 'grib', 'grb',
]);

const RASTER_SIDECARS = new Set([
  'tfw', 'tifw', 'tiffw', 'jgw', 'jpgw', 'jpegw', 'pgw', 'pngw', 'j2w', 'jp2w',
  'gfw', 'gifw', 'bpw', 'bmpw', 'sdw', 'eww', 'wld', 'tfwx', 'jgwx', 'pgwx',
  'prj', 'qpj', 'aux', 'aux.xml', 'tif.aux.xml', 'tiff.aux.xml', 'jpg.aux.xml',
  'jpeg.aux.xml', 'png.aux.xml', 'jp2.aux.xml', 'img.aux.xml', 'ecw.aux.xml',
  'sid.aux.xml', 'asc.aux.xml', 'vrt.aux.xml', 'ovr', 'tif.ovr', 'tiff.ovr',
  'img.ovr', 'ecw.ovr', 'sid.ovr', 'jp2.ovr', 'rrd', 'hdr', 'stx', 'clr',
  'rsc', 'ige', 'vat.dbf', 'tif.vat.dbf', 'tiff.vat.dbf', 'img.vat.dbf',
  'tif.enp', 'tif.xml', 'tiff.xml', 'img.xml', 'xml', 'tab', 'qml', 'sld',
  'lyr', 'lyrx', 'qlr',
]);

const VECTOR_GIS_PRIMARIES = new Set([
  'gpkg', 'geojson', 'topojson', 'kml', 'kmz', 'gml', 'gpx', 'las', 'laz', 'fgb', 'osm', 'pbf',
]);

const VECTOR_GIS_SIDECARS = new Set([
  'gpkg-wal', 'gpkg-shm', 'lax', 'prj', 'qpj', 'qml', 'sld', 'lyr', 'lyrx', 'qlr', 'xml', 'aux.xml',
]);

const GENERIC_SIDECARS = new Set([
  'xmp', 'srt', 'vtt', 'sub', 'idx', 'nfo', 'cue', 'md5', 'sha256', 'sig', 'meta', 'prj', 'hdr', 'xml',
]);

function extractDatasetStem(relativePath: string): {
  dirKey: string;
  stemKey: string;
  displayName: string;
  token: string;
} {
  const normalized = relativePath.indexOf('\\') >= 0 ? relativePath.replace(/\\/g, '/') : relativePath;
  const slashIdx = normalized.lastIndexOf('/');
  const dir = slashIdx >= 0 ? normalized.slice(0, slashIdx) : '';
  const fileName = slashIdx >= 0 ? normalized.slice(slashIdx + 1) : normalized;
  const lowerName = fileName.toLowerCase();

  if (mayHaveCompoundGisSuffix(lowerName)) {
    for (let i = 0; i < COMPOUND_GIS_SUFFIXES.length; i++) {
      const suffix = COMPOUND_GIS_SUFFIXES[i];
      if (lowerName.endsWith(suffix)) {
        const stem = fileName.slice(0, fileName.length - suffix.length);
        return {
          dirKey: dir.toLowerCase(),
          stemKey: stem.toLowerCase(),
          displayName: stem || fileName,
          token: suffix.slice(1),
        };
      }
    }
  }

  const lastDot = fileName.lastIndexOf('.');
  const stem = lastDot > 0 ? fileName.slice(0, lastDot) : fileName;
  const token = lastDot > 0 ? fileName.slice(lastDot + 1).toLowerCase() : '';
  return {
    dirKey: dir.toLowerCase(),
    stemKey: stem.toLowerCase(),
    displayName: stem || fileName,
    token,
  };
}

/**
 * Detects Shapefile sets, MapInfo TAB sets, georeferenced raster + world/aux bundles,
 * and complementary sidecar pairs sharing the same stem in the same source folder.
 */
export function analyzeComplementaryBundles(files: VirtualFile[]): {
  bundles: ComplementaryBundle[];
  fileToBundle: Map<string, ComplementaryBundle>;
} {
  const groups = new Map<
    string,
    { displayName: string; entries: Array<{ file: VirtualFile; token: string }> }
  >();

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const info = extractDatasetStem(file.relativePath || file.name);
    const key = `${info.dirKey}::${info.stemKey}`;
    let existing = groups.get(key);
    if (!existing) {
      existing = { displayName: info.displayName, entries: [] };
      groups.set(key, existing);
    }
    existing.entries.push({ file, token: info.token });
  }

  const bundles: ComplementaryBundle[] = [];
  const fileToBundle = new Map<string, ComplementaryBundle>();

  for (const [bundleId, group] of groups.entries()) {
    if (group.entries.length < 2) continue;

    const entries = group.entries;
    const tokens = entries.map((e) => e.token);
    const hasShp = tokens.includes('shp');
    let shapefileSidecarCount = 0;
    for (let i = 0; i < tokens.length; i++) {
      if (SHAPEFILE_COMPANIONS.has(tokens[i])) shapefileSidecarCount++;
    }

    const hasTab = tokens.includes('tab');
    const hasMapInfoPartner = hasTab && tokens.some((t) => t !== 'tab' && MAPINFO_COMPANIONS.has(t));

    const rasterEntry = entries.find((e) => RASTER_PRIMARIES.has(e.token));
    const hasRasterSidecar = rasterEntry
      ? entries.some((e) => e !== rasterEntry && RASTER_SIDECARS.has(e.token))
      : false;

    const vectorGisEntry = entries.find((e) => VECTOR_GIS_PRIMARIES.has(e.token));
    const hasVectorGisSidecar = vectorGisEntry
      ? entries.some((e) => e !== vectorGisEntry && VECTOR_GIS_SIDECARS.has(e.token))
      : false;

    let bundle: ComplementaryBundle | null = null;

    if (hasShp || (shapefileSidecarCount >= 2 && tokens.some((t) => t === 'shx' || t === 'dbf' || t === 'prj' || t === 'qix' || t === 'sbn'))) {
      const primary =
        entries.find((e) => e.token === 'shp')?.file ||
        entries.find((e) => e.token === 'dbf')?.file ||
        entries[0].file;
      bundle = {
        id: bundleId,
        kind: 'shapefile',
        displayName: group.displayName,
        primaryFile: primary,
        files: entries.map((e) => e.file),
        isGeospatial: true,
      };
    } else if (hasTab && hasMapInfoPartner) {
      const primary = entries.find((e) => e.token === 'tab')!.file;
      bundle = {
        id: bundleId,
        kind: 'mapinfo',
        displayName: group.displayName,
        primaryFile: primary,
        files: entries.map((e) => e.file),
        isGeospatial: true,
      };
    } else if (rasterEntry && hasRasterSidecar) {
      bundle = {
        id: bundleId,
        kind: 'georef_raster',
        displayName: group.displayName,
        primaryFile: rasterEntry.file,
        files: entries.map((e) => e.file),
        isGeospatial: true,
      };
    } else if (vectorGisEntry && hasVectorGisSidecar) {
      bundle = {
        id: bundleId,
        kind: 'geospatial_dataset',
        displayName: group.displayName,
        primaryFile: vectorGisEntry.file,
        files: entries.map((e) => e.file),
        isGeospatial: true,
      };
    } else {
      const sidecarEntries = entries.filter((e) => GENERIC_SIDECARS.has(e.token));
      const primaryEntries = entries.filter((e) => !GENERIC_SIDECARS.has(e.token));
      if (sidecarEntries.length > 0 && primaryEntries.length > 0) {
        bundle = {
          id: bundleId,
          kind: 'complementary_pair',
          displayName: group.displayName,
          primaryFile: primaryEntries[0].file,
          files: entries.map((e) => e.file),
          isGeospatial: false,
        };
      }
    }

    if (bundle) {
      bundles.push(bundle);
      for (let i = 0; i < bundle.files.length; i++) {
        fileToBundle.set(bundle.files[i].id, bundle);
      }
    }
  }

  return { bundles, fileToBundle };
}

// Compute Smart Document & File Organization preview
export function computeSmartOrganization(
  files: VirtualFile[],
  config: OrganizeConfig,
  precomputedBundles?: { bundles: ComplementaryBundle[]; fileToBundle: Map<string, ComplementaryBundle> }
): OrganizeResult[] {
  const usedPaths = new Set<string>();
  const groupComplementary = config.groupComplementaryFiles !== false;
  const bundleGeospatialSubfolders = config.bundleGeospatialSubfolders !== false;

  const { fileToBundle } = groupComplementary
    ? (precomputedBundles || analyzeComplementaryBundles(files))
    : { fileToBundle: new Map<string, ComplementaryBundle>() };

  // Precompute custom rules lookup map for O(1) resolution
  const customRuleByExt = new Map<string, CustomOrganizeRule>();
  for (let i = 0; i < config.customRules.length; i++) {
    const rule = config.customRules[i];
    for (let j = 0; j < rule.extensions.length; j++) {
      const cleanExt = rule.extensions[j].replace(/^\./, '').toLowerCase();
      if (cleanExt && !customRuleByExt.has(cleanExt)) {
        customRuleByExt.set(cleanExt, rule);
      }
    }
  }

  // Hoist config string normalization outside per-file loop
  const outputFolderName = config.outputFolderName.trim().replace(/[\\/]/g, '_').replace(/^\.+$/, '');
  const folderNamePrefix = config.folderPrefix.replace(/[\\/]/g, '_');
  const folderNameSuffix = config.folderSuffix.replace(/[\\/]/g, '_');
  const needsDate =
    config.strategy === 'date' ||
    config.strategy === 'category_date' ||
    config.strategy === 'extension_date';
  const dateCache = new Map<number, string>();

  const getCachedDate = (ts: number): string => {
    let val = dateCache.get(ts);
    if (val === undefined) {
      val = formatDate(ts, config.dateFormat);
      dateCache.set(ts, val);
    }
    return val;
  };

  // Pre-resolve target folder for each bundle using its primary file so all companions stay together
  const bundleFolderCache = new Map<
    string,
    { targetFolder: string; category: FileCategory; ruleMatched: string }
  >();

  const resolveStandaloneFolder = (
    file: VirtualFile,
    forcedCategory?: FileCategory,
    allowCustomRules = true
  ): { targetFolder: string; category: FileCategory; ruleMatched?: string } => {
    const ext = file.extension.toLowerCase();
    const category = forcedCategory || file.category || classifyFileCategory(ext, file.name);
    let targetFolder = '';
    let ruleMatched: string | undefined = undefined;

    const matchedCustom = allowCustomRules ? customRuleByExt.get(ext) : undefined;

    if (EXCEL_FILE_EXTENSIONS.has(ext) && category !== 'geospatial') {
      targetFolder = 'Excel Files';
      ruleMatched = 'Excel file grouping';
    } else if (matchedCustom) {
      targetFolder = matchedCustom.targetFolder;
      ruleMatched = matchedCustom.name;
    } else {
      const dateSegment = needsDate ? getCachedDate(file.lastModified) : '';

      switch (config.strategy) {
        case 'category':
          targetFolder = CATEGORY_FOLDER_NAMES[category] || 'Miscellaneous';
          break;

        case 'extension':
          targetFolder = ext ? ext.toUpperCase() : 'NO_EXTENSION';
          break;

        case 'date':
          targetFolder = dateSegment;
          break;

        case 'category_date':
          targetFolder = `${CATEGORY_FOLDER_NAMES[category] || 'Miscellaneous'}/${dateSegment}`;
          break;

        case 'extension_date':
          targetFolder = `${ext ? ext.toUpperCase() : 'NO_EXTENSION'}/${dateSegment}`;
          break;
      }
    }

    return { targetFolder, category, ruleMatched };
  };

  const results: OrganizeResult[] = new Array(files.length);

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const bundle = groupComplementary ? fileToBundle.get(file.id) : undefined;
    let targetFolder = '';
    let category: FileCategory;
    let ruleMatched: string | undefined;

    if (bundle) {
      let cached = bundleFolderCache.get(bundle.id);
      if (!cached) {
        if (bundle.isGeospatial) {
          const base = resolveStandaloneFolder(bundle.primaryFile, 'geospatial', false);
          const subFolder = bundleGeospatialSubfolders ? `/${bundle.displayName}` : '';
          const ruleLabel =
            bundle.kind === 'shapefile'
              ? `GIS Shapefile (${bundle.files.length} files)`
              : bundle.kind === 'mapinfo'
              ? `GIS MapInfo (${bundle.files.length} files)`
              : bundle.kind === 'georef_raster'
              ? `Georeferenced Raster (${bundle.files.length} files)`
              : `GIS Dataset (${bundle.files.length} files)`;
          cached = {
            targetFolder: `${base.targetFolder}${subFolder}`,
            category: 'geospatial',
            ruleMatched: ruleLabel,
          };
        } else {
          const base = resolveStandaloneFolder(bundle.primaryFile, undefined, true);
          cached = {
            targetFolder: base.targetFolder,
            category: base.category,
            ruleMatched: base.ruleMatched || `Complementary bundle (${bundle.files.length} files)`,
          };
        }
        bundleFolderCache.set(bundle.id, cached);
      }
      targetFolder = cached.targetFolder;
      category = cached.category;
      ruleMatched = cached.ruleMatched;
    } else {
      const resolved = resolveStandaloneFolder(file);
      targetFolder = resolved.targetFolder;
      category = resolved.category;
      ruleMatched = resolved.ruleMatched;
    }

    // Clean folder path
    targetFolder = targetFolder.replace(/\/+/g, '/').replace(/^\/|\/$/g, '');
    if (outputFolderName) targetFolder = `${outputFolderName}/${targetFolder}`;
    if (folderNamePrefix || folderNameSuffix) {
      const folderParts = targetFolder.split('/');
      const targetPrefixIndex = bundle?.isGeospatial && bundleGeospatialSubfolders && folderParts.length > 1
        ? folderParts.length - 2
        : folderParts.length - 1;
      folderParts[targetPrefixIndex] = `${folderNamePrefix}${folderParts[targetPrefixIndex]}${folderNameSuffix}`;
      targetFolder = folderParts.join('/');
    }

    let targetPath = `${targetFolder}/${file.name}`;
    let lowerTarget = targetPath.toLowerCase();
    const hasCollision = usedPaths.has(lowerTarget);
    let included = true;

    if (hasCollision && config.collisionResolution === 'skip') {
      included = false;
    } else if (hasCollision) {
      const dotIndex = file.name.lastIndexOf('.');
      const baseName = dotIndex > 0 ? file.name.slice(0, dotIndex) : file.name;
      const extension = dotIndex > 0 ? file.name.slice(dotIndex) : '';
      let suffix = 2;
      do {
        targetPath = `${targetFolder}/${baseName} (${suffix})${extension}`;
        lowerTarget = targetPath.toLowerCase();
        suffix += 1;
      } while (usedPaths.has(lowerTarget));
    }

    if (included) usedPaths.add(lowerTarget);

    results[i] = {
      file,
      originalPath: file.relativePath,
      destinationFolder: targetFolder,
      targetPath,
      category,
      ruleMatched,
      hasCollision,
      included,
      bundleKind: bundle?.kind,
      bundleName: bundle?.displayName,
      bundleCount: bundle?.files.length,
    };
  }

  return results;
}

const ALREADY_COMPRESSED_EXTS = new Set([
  'jpg', 'jpeg', 'png', 'webp', 'gif', 'heic',
  'mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v',
  'mp3', 'aac', 'ogg', 'flac', 'm4a',
  'zip', 'rar', '7z', 'gz', 'bz2',
  'docx', 'xlsx', 'pptx', 'pdf', 'kmz',
  'laz', 'ecw', 'jp2',
]);

// Generate ZIP file with JSZip (skips redundant DEFLATE on already-compressed binary formats)
export async function createZipArchive(
  items: Array<{ path: string; file: VirtualFile }>,
  options: {
    compressionLevel?: number;
    onProgress?: (percent: number, currentItem: string) => void;
  }
): Promise<Blob> {
  const zip = new JSZip();
  const useDeflate = Boolean(options.compressionLevel && options.compressionLevel > 0);
  const compression = useDeflate ? 'DEFLATE' : 'STORE';
  const compressionOptions = {
    level: options.compressionLevel || 6,
  };

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    let content: Blob | ArrayBuffer | string = item.file.content || '';

    if (!content) {
      content = `[File content for: ${item.file.name} | Size: ${item.file.size} bytes]`;
    }

    const ext = item.file.extension.toLowerCase();
    if (useDeflate && ALREADY_COMPRESSED_EXTS.has(ext)) {
      zip.file(item.path, content, { compression: 'STORE' });
    } else {
      zip.file(item.path, content);
    }
  }

  let lastProgressAt = 0;
  const blob = await zip.generateAsync(
    {
      type: 'blob',
      compression,
      compressionOptions,
    },
    (metadata) => {
      if (options.onProgress) {
        const now = performance.now();
        const pct = Math.round(metadata.percent);
        if (pct >= 100 || now - lastProgressAt > 80) {
          lastProgressAt = now;
          options.onProgress(pct, metadata.currentFile || 'Compiling...');
        }
      }
    }
  );

  return blob;
}

// Download file utility
export function triggerFileDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Ultra-fast concurrent DataTransfer ingestion with O(1) work-stealing queue & throttled progress
export async function readFilesFromDataTransfer(
  items: DataTransferItemList,
  onProgress?: (percent: number, currentItem: string, count: number) => void
): Promise<VirtualFile[]> {
  const files: VirtualFile[] = [];
  let processedCount = 0;
  let lastProgressUpdate = 0;
  const batchTimestamp = Date.now();
  const idPrefix = `file-${batchTimestamp}-`;

  const reportProgress = (name: string, force = false) => {
    if (!onProgress) return;
    const now = performance.now();
    if (force || now - lastProgressUpdate > 80) {
      lastProgressUpdate = now;
      onProgress(
        Math.min(98, Math.round((processedCount / (processedCount + 15)) * 100)),
        name,
        processedCount
      );
    }
  };

  const pendingEntries: Array<{ entry: FileSystemEntry; path: string }> = [];
  for (let i = 0; i < items.length; i++) {
    const entry = items[i].webkitGetAsEntry?.();
    if (entry) {
      pendingEntries.push({ entry, path: '' });
    }
  }

  let head = 0;
  let inFlight = 0;
  const waiters: Array<() => void> = [];
  const wakeWaiters = () => {
    while (waiters.length > 0) {
      waiters.pop()!();
    }
  };

  async function processEntry({ entry, path }: { entry: FileSystemEntry; path: string }) {
    if (entry.isFile) {
      const fileEntry = entry as FileSystemFileEntry;
      await new Promise<void>((resolve) => {
        fileEntry.file(
          (realFile) => {
            const relativePath = path ? `${path}/${realFile.name}` : realFile.name;
            const ext = getFileExtension(realFile.name);
            const idx = ++processedCount;
            reportProgress(realFile.name);

            files.push({
              id: `${idPrefix}${idx}`,
              name: realFile.name,
              relativePath,
              size: realFile.size,
              type: realFile.type,
              extension: ext,
              lastModified: realFile.lastModified || batchTimestamp,
              category: classifyFileCategory(ext, realFile.name),
              selected: true,
              content: realFile,
            });
            resolve();
          },
          () => resolve()
        );
      });
    } else if (entry.isDirectory) {
      const dirEntry = entry as FileSystemDirectoryEntry;
      const currentPath = path ? `${path}/${dirEntry.name}` : dirEntry.name;
      reportProgress(dirEntry.name);

      const dirReader = dirEntry.createReader();
      await new Promise<void>((resolve) => {
        const readNextBatch = () => {
          dirReader.readEntries(
            (results) => {
              if (results.length === 0) {
                resolve();
              } else {
                for (let i = 0; i < results.length; i++) {
                  pendingEntries.push({ entry: results[i], path: currentPath });
                }
                wakeWaiters();
                readNextBatch();
              }
            },
            () => resolve()
          );
        };
        readNextBatch();
      });
    }
  }

  const CONCURRENCY_LIMIT = 32;
  async function worker() {
    while (true) {
      if (head < pendingEntries.length) {
        const item = pendingEntries[head++];
        inFlight++;
        try {
          await processEntry(item);
        } finally {
          inFlight--;
          wakeWaiters();
        }
      } else if (inFlight > 0) {
        await new Promise<void>((resolve) => waiters.push(resolve));
      } else {
        break;
      }
    }
  }

  const activeWorkers: Promise<void>[] = new Array(CONCURRENCY_LIMIT);
  for (let w = 0; w < CONCURRENCY_LIMIT; w++) {
    activeWorkers[w] = worker();
  }
  await Promise.all(activeWorkers);

  if (onProgress) {
    onProgress(100, `${files.length}`, files.length);
  }
  return files;
}

// High-speed concurrent FileSystemDirectoryHandle walker (32-worker pool, O(1) queue cursor)
export async function readDirectoryHandleFast(
  rootHandle: FileSystemDirectoryHandle,
  onProgress?: (percent: number, currentItem: string, count: number) => void
): Promise<VirtualFile[]> {
  const gatheredFiles: VirtualFile[] = [];
  const pendingDirs: Array<{ handle: FileSystemDirectoryHandle; path: string }> = [
    { handle: rootHandle, path: rootHandle.name },
  ];
  let head = 0;
  let inFlight = 0;
  let count = 0;
  let lastReport = 0;
  const batchTimestamp = Date.now();
  const idPrefix = `native-${batchTimestamp}-`;

  const waiters: Array<() => void> = [];
  const wakeWaiters = () => {
    while (waiters.length > 0) {
      waiters.pop()!();
    }
  };

  const reportProgress = (name: string) => {
    if (!onProgress) return;
    const now = performance.now();
    if (now - lastReport > 80) {
      lastReport = now;
      onProgress(
        Math.min(98, Math.round((count / (count + 15)) * 100)),
        name,
        count
      );
    }
  };

  const pendingFileReads: Array<{ fileHandle: FileSystemFileHandle; basePath: string }> = [];
  let fileReadHead = 0;

  async function processDirectory(current: { handle: FileSystemDirectoryHandle; path: string }) {
    const iterable = (current.handle as unknown as {
      values: () => AsyncIterable<FileSystemHandle>;
    }).values();

    for await (const entry of iterable) {
      if (entry.kind === 'directory') {
        const subDirHandle = entry as FileSystemDirectoryHandle;
        const newPath = current.path ? `${current.path}/${entry.name}` : entry.name;
        pendingDirs.push({ handle: subDirHandle, path: newPath });
        wakeWaiters();
      } else if (entry.kind === 'file') {
        pendingFileReads.push({
          fileHandle: entry as FileSystemFileHandle,
          basePath: current.path,
        });
        wakeWaiters();
      }
    }
  }

  async function worker() {
    while (true) {
      if (head < pendingDirs.length) {
        const dir = pendingDirs[head++];
        inFlight++;
        try {
          await processDirectory(dir);
        } finally {
          inFlight--;
          wakeWaiters();
        }
      } else if (fileReadHead < pendingFileReads.length) {
        const task = pendingFileReads[fileReadHead++];
        inFlight++;
        try {
          const file = await task.fileHandle.getFile();
          const idx = ++count;
          reportProgress(file.name);
          const relativePath = task.basePath ? `${task.basePath}/${file.name}` : file.name;
          const ext = getFileExtension(file.name);

          gatheredFiles.push({
            id: `${idPrefix}${idx}`,
            name: file.name,
            relativePath,
            size: file.size,
            type: file.type,
            extension: ext,
            lastModified: file.lastModified || batchTimestamp,
            category: classifyFileCategory(ext, file.name),
            selected: true,
            content: file,
          });
        } catch {
          // Skip unreadable handles safely
        } finally {
          inFlight--;
          wakeWaiters();
        }
      } else if (inFlight > 0) {
        await new Promise<void>((resolve) => waiters.push(resolve));
      } else {
        break;
      }
    }
  }

  const CONCURRENCY_LIMIT = 32;
  const workers: Promise<void>[] = new Array(CONCURRENCY_LIMIT);
  for (let i = 0; i < CONCURRENCY_LIMIT; i++) {
    workers[i] = worker();
  }
  await Promise.all(workers);

  if (onProgress) {
    onProgress(100, `${gatheredFiles.length}`, gatheredFiles.length);
  }
  return gatheredFiles;
}

// Convert standard FileList with O(1) classification and zero per-file PRNG overhead
export function parseFileList(
  fileList: FileList,
  onProgress?: (percent: number, currentItem: string, count: number) => void
): VirtualFile[] {
  const total = fileList.length;
  const files: VirtualFile[] = new Array(total);
  const batchTimestamp = Date.now();
  const idPrefix = `file-${batchTimestamp}-`;
  let lastReport = 0;

  for (let i = 0; i < total; i++) {
    const f = fileList[i];
    const relativePath = (f as unknown as { webkitRelativePath?: string }).webkitRelativePath || f.name;
    const ext = getFileExtension(f.name);

    if (onProgress && (i % 100 === 0 || i === total - 1)) {
      const now = performance.now();
      if (now - lastReport > 80 || i === total - 1) {
        lastReport = now;
        const percent = Math.round(((i + 1) / total) * 100);
        onProgress(percent, f.name, i + 1);
      }
    }

    files[i] = {
      id: `${idPrefix}${i}`,
      name: f.name,
      relativePath,
      size: f.size,
      type: f.type,
      extension: ext,
      lastModified: f.lastModified || batchTimestamp,
      category: classifyFileCategory(ext, f.name),
      selected: true,
      content: f,
    };
  }
  return files;
}
