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
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop()!.toLowerCase() : '';
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

export function getEffectiveExtensionToken(filename: string): string {
  const lower = filename.toLowerCase();
  for (const suffix of COMPOUND_GIS_SUFFIXES) {
    if (lower.endsWith(suffix)) {
      return suffix.slice(1); // without leading dot
    }
  }
  return getFileExtension(filename);
}

export function classifyFileCategory(extension: string, filename?: string): FileCategory {
  const ext = extension.toLowerCase();
  const effectiveToken = filename ? getEffectiveExtensionToken(filename) : ext;

  if (
    filename &&
    COMPOUND_GIS_SUFFIXES.some((s) => filename.toLowerCase().endsWith(s))
  ) {
    return 'geospatial';
  }

  const documents = ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', 'pages', 'md', 'epub'];
  const spreadsheets = [...EXCEL_FILE_EXTENSIONS, 'csv', 'tsv', 'ods', 'numbers'];
  const images = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp', 'ico', 'tiff', 'tif', 'heic', 'raw', 'psd'];
  const audio = ['mp3', 'wav', 'aac', 'flac', 'ogg', 'm4a', 'wma', 'aiff'];
  const videos = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'wmv', 'flv', 'm4v'];
  const archives = ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'iso'];
  const code = ['js', 'ts', 'jsx', 'tsx', 'py', 'html', 'css', 'scss', 'json', 'yaml', 'yml', 'xml', 'sql', 'sh', 'bat', 'c', 'cpp', 'java', 'go', 'rs', 'php'];
  const presentations = ['ppt', 'pptx', 'key', 'odp'];
  const data = ['sqlite', 'db', 'parquet', 'log', 'dat', 'bak', 'env'];

  if (GEOSPATIAL_EXTENSIONS.has(ext) || GEOSPATIAL_EXTENSIONS.has(effectiveToken)) return 'geospatial';
  if (documents.includes(ext)) return 'documents';
  if (spreadsheets.includes(ext)) return 'spreadsheets';
  if (images.includes(ext)) return 'images';
  if (audio.includes(ext)) return 'audio';
  if (videos.includes(ext)) return 'videos';
  if (archives.includes(ext)) return 'archives';
  if (code.includes(ext)) return 'code';
  if (presentations.includes(ext)) return 'presentations';
  if (data.includes(ext)) return 'data';

  return 'other';
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
  const normalized = relativePath.replace(/\\/g, '/');
  const slashIdx = normalized.lastIndexOf('/');
  const dir = slashIdx >= 0 ? normalized.slice(0, slashIdx) : '';
  const fileName = slashIdx >= 0 ? normalized.slice(slashIdx + 1) : normalized;
  const lowerName = fileName.toLowerCase();

  for (const suffix of COMPOUND_GIS_SUFFIXES) {
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

  for (const file of files) {
    const info = extractDatasetStem(file.relativePath || file.name);
    const key = `${info.dirKey}::${info.stemKey}`;
    const existing = groups.get(key) || { displayName: info.displayName, entries: [] };
    existing.entries.push({ file, token: info.token });
    groups.set(key, existing);
  }

  const bundles: ComplementaryBundle[] = [];
  const fileToBundle = new Map<string, ComplementaryBundle>();

  for (const [bundleId, group] of groups.entries()) {
    if (group.entries.length < 2) continue;

    const tokens = group.entries.map((e) => e.token);
    const hasShp = tokens.includes('shp');
    const shapefileSidecarCount = tokens.filter((t) => SHAPEFILE_COMPANIONS.has(t)).length;

    const hasTab = tokens.includes('tab');
    const hasMapInfoPartner = tokens.some((t) => t !== 'tab' && MAPINFO_COMPANIONS.has(t));

    const rasterEntry = group.entries.find((e) => RASTER_PRIMARIES.has(e.token));
    const hasRasterSidecar = group.entries.some(
      (e) => e !== rasterEntry && RASTER_SIDECARS.has(e.token)
    );

    const vectorGisEntry = group.entries.find((e) => VECTOR_GIS_PRIMARIES.has(e.token));
    const hasVectorGisSidecar = group.entries.some(
      (e) => e !== vectorGisEntry && VECTOR_GIS_SIDECARS.has(e.token)
    );

    let bundle: ComplementaryBundle | null = null;

    if (hasShp || (shapefileSidecarCount >= 2 && tokens.some((t) => ['shx', 'dbf', 'prj', 'qix', 'sbn'].includes(t)))) {
      const primary =
        group.entries.find((e) => e.token === 'shp')?.file ||
        group.entries.find((e) => e.token === 'dbf')?.file ||
        group.entries[0].file;
      bundle = {
        id: bundleId,
        kind: 'shapefile',
        displayName: group.displayName,
        primaryFile: primary,
        files: group.entries.map((e) => e.file),
        isGeospatial: true,
      };
    } else if (hasTab && hasMapInfoPartner) {
      const primary = group.entries.find((e) => e.token === 'tab')!.file;
      bundle = {
        id: bundleId,
        kind: 'mapinfo',
        displayName: group.displayName,
        primaryFile: primary,
        files: group.entries.map((e) => e.file),
        isGeospatial: true,
      };
    } else if (rasterEntry && hasRasterSidecar) {
      bundle = {
        id: bundleId,
        kind: 'georef_raster',
        displayName: group.displayName,
        primaryFile: rasterEntry.file,
        files: group.entries.map((e) => e.file),
        isGeospatial: true,
      };
    } else if (vectorGisEntry && hasVectorGisSidecar) {
      bundle = {
        id: bundleId,
        kind: 'geospatial_dataset',
        displayName: group.displayName,
        primaryFile: vectorGisEntry.file,
        files: group.entries.map((e) => e.file),
        isGeospatial: true,
      };
    } else {
      const sidecarEntries = group.entries.filter((e) => GENERIC_SIDECARS.has(e.token));
      const primaryEntries = group.entries.filter((e) => !GENERIC_SIDECARS.has(e.token));
      if (sidecarEntries.length > 0 && primaryEntries.length > 0) {
        bundle = {
          id: bundleId,
          kind: 'complementary_pair',
          displayName: group.displayName,
          primaryFile: primaryEntries[0].file,
          files: group.entries.map((e) => e.file),
          isGeospatial: false,
        };
      }
    }

    if (bundle) {
      bundles.push(bundle);
      bundle.files.forEach((f) => fileToBundle.set(f.id, bundle!));
    }
  }

  return { bundles, fileToBundle };
}

// Compute Smart Document & File Organization preview
export function computeSmartOrganization(
  files: VirtualFile[],
  config: OrganizeConfig
): OrganizeResult[] {
  const usedPaths = new Set<string>();
  const groupComplementary = config.groupComplementaryFiles !== false;
  const bundleGeospatialSubfolders = config.bundleGeospatialSubfolders !== false;

  const { fileToBundle } = groupComplementary
    ? analyzeComplementaryBundles(files)
    : { fileToBundle: new Map<string, ComplementaryBundle>() };

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
    const category = forcedCategory || classifyFileCategory(ext, file.name);
    let targetFolder = '';
    let ruleMatched: string | undefined = undefined;

    const matchedCustom = allowCustomRules
      ? config.customRules.find((rule) =>
          rule.extensions.some((e) => e.replace(/^\./, '').toLowerCase() === ext)
        )
      : undefined;

    if (EXCEL_FILE_EXTENSIONS.has(ext) && category !== 'geospatial') {
      targetFolder = 'Excel Files';
      ruleMatched = 'Excel file grouping';
    } else if (matchedCustom) {
      targetFolder = matchedCustom.targetFolder;
      ruleMatched = matchedCustom.name;
    } else {
      const dateVal = config.dateField === 'created' ? file.lastModified : file.lastModified;
      const dateSegment = formatDate(dateVal, config.dateFormat);

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

  return files.map((file) => {
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
    const outputFolderName = config.outputFolderName.trim().replace(/[\\/]/g, '_').replace(/^\.+$/, '');
    if (outputFolderName) targetFolder = `${outputFolderName}/${targetFolder}`;
    const folderParts = targetFolder.split('/');
    const folderNamePrefix = config.folderPrefix.replace(/[\\/]/g, '_');
    const folderNameSuffix = config.folderSuffix.replace(/[\\/]/g, '_');
    const targetPrefixIndex = bundle?.isGeospatial && bundleGeospatialSubfolders && folderParts.length > 1
      ? folderParts.length - 2
      : folderParts.length - 1;
    folderParts[targetPrefixIndex] = `${folderNamePrefix}${folderParts[targetPrefixIndex]}${folderNameSuffix}`;
    targetFolder = folderParts.join('/');

    let targetPath = `${targetFolder}/${file.name}`;
    const hasCollision = usedPaths.has(targetPath.toLowerCase());
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
        suffix += 1;
      } while (usedPaths.has(targetPath.toLowerCase()));
    }

    if (included) usedPaths.add(targetPath.toLowerCase());

    return {
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
  });
}

// Generate ZIP file with JSZip
export async function createZipArchive(
  items: Array<{ path: string; file: VirtualFile }>,
  options: {
    compressionLevel?: number;
    onProgress?: (percent: number, currentItem: string) => void;
  }
): Promise<Blob> {
  const zip = new JSZip();

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    let content: Blob | ArrayBuffer | string = item.file.content || '';

    // If no content in virtual file, create empty placeholder with metadata
    if (!content) {
      content = `[File content for: ${item.file.name} | Size: ${item.file.size} bytes]`;
    }

    zip.file(item.path, content);
  }

  const compression = options.compressionLevel && options.compressionLevel > 0 ? 'DEFLATE' : 'STORE';
  const compressionOptions = {
    level: options.compressionLevel || 6,
  };

  const blob = await zip.generateAsync(
    {
      type: 'blob',
      compression,
      compressionOptions,
    },
    (metadata) => {
      if (options.onProgress) {
        options.onProgress(Math.round(metadata.percent), metadata.currentFile || 'Compiling...');
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

// Read files from HTML DataTransfer with directory recursion
// Ultra-fast, highly optimized file ingestion using concurrent worker queues & chunking
export async function readFilesFromDataTransfer(
  items: DataTransferItemList,
  onProgress?: (percent: number, currentItem: string, count: number) => void
): Promise<VirtualFile[]> {
  const files: VirtualFile[] = [];
  let processedCount = 0;
  let lastProgressUpdate = 0;

  // Track progress with throttling to reduce DOM render overhead
  const reportProgress = (name: string, force = false) => {
    if (!onProgress) return;
    const now = performance.now();
    if (force || now - lastProgressUpdate > 60) {
      lastProgressUpdate = now;
      onProgress(
        Math.min(98, Math.round((processedCount / (processedCount + 15)) * 100)),
        name,
        processedCount
      );
    }
  };

  const pendingEntries: { entry: FileSystemEntry; path: string }[] = [];

  // Seed top-level entries
  for (let i = 0; i < items.length; i++) {
    const entry = items[i].webkitGetAsEntry?.();
    if (entry) {
      pendingEntries.push({ entry, path: '' });
    }
  }

  // Concurrent queue worker
  const CONCURRENCY_LIMIT = 8;
  const activeWorkers: Promise<void>[] = [];

  async function processEntry({ entry, path }: { entry: FileSystemEntry; path: string }) {
    if (entry.isFile) {
      const fileEntry = entry as FileSystemFileEntry;
      await new Promise<void>((resolve) => {
        fileEntry.file(
          (realFile) => {
            const relativePath = path ? `${path}/${realFile.name}` : realFile.name;
            const ext = getFileExtension(realFile.name);
            processedCount++;
            reportProgress(realFile.name);

            // Infer drive if root path starts with drive letter e.g. "C:/"
            files.push({
              id: `file-${Date.now()}-${processedCount}-${Math.random().toString(36).slice(2, 7)}`,
              name: realFile.name,
              relativePath,
              size: realFile.size,
              type: realFile.type,
              extension: ext,
              lastModified: realFile.lastModified || Date.now(),
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
      reportProgress(`Scanning directory ${dirEntry.name}`);

      const dirReader = dirEntry.createReader();

      const readAllDirectoryBatches = async (): Promise<FileSystemEntry[]> => {
        const batchEntries: FileSystemEntry[] = [];
        return new Promise<FileSystemEntry[]>((resolve) => {
          const readNextBatch = () => {
            dirReader.readEntries(
              (results) => {
                if (results.length === 0) {
                  resolve(batchEntries);
                } else {
                  batchEntries.push(...results);
                  readNextBatch();
                }
              },
              () => resolve(batchEntries)
            );
          };
          readNextBatch();
        });
      };

      const children = await readAllDirectoryBatches();
      for (const child of children) {
        pendingEntries.push({ entry: child, path: currentPath });
      }
    }
  }

  // Run pool of concurrent workers until pendingEntries is exhausted
  async function worker() {
    while (pendingEntries.length > 0) {
      const item = pendingEntries.shift();
      if (item) {
        await processEntry(item);
      }
    }
  }

  for (let w = 0; w < CONCURRENCY_LIMIT; w++) {
    activeWorkers.push(worker());
  }

  await Promise.all(activeWorkers);

  if (onProgress) {
    onProgress(100, `Completed ingestion of ${files.length} files`, files.length);
  }
  return files;
}

// Convert standard FileList with high-speed chunking and drive detection
export function parseFileList(
  fileList: FileList,
  onProgress?: (percent: number, currentItem: string, count: number) => void
): VirtualFile[] {
  const files: VirtualFile[] = new Array(fileList.length);
  const total = fileList.length;
  let lastReport = 0;

  for (let i = 0; i < total; i++) {
    const f = fileList[i];
    const relativePath = (f as unknown as { webkitRelativePath?: string }).webkitRelativePath || f.name;
    const ext = getFileExtension(f.name);

    if (onProgress && (i % 25 === 0 || i === total - 1)) {
      const now = performance.now();
      if (now - lastReport > 50 || i === total - 1) {
        lastReport = now;
        const percent = Math.round(((i + 1) / total) * 100);
        onProgress(percent, f.name, i + 1);
      }
    }

    files[i] = {
      id: `file-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
      name: f.name,
      relativePath,
      size: f.size,
      type: f.type,
      extension: ext,
      lastModified: f.lastModified || Date.now(),
      category: classifyFileCategory(ext, f.name),
      selected: true,
      content: f,
    };
  }
  return files;
}
