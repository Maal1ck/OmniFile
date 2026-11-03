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

export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop()!.toLowerCase() : '';
}

export function getFileNameWithoutExtension(filename: string): string {
  const lastDotIndex = filename.lastIndexOf('.');
  return lastDotIndex > 0 ? filename.substring(0, lastDotIndex) : filename;
}

export function classifyFileCategory(extension: string): FileCategory {
  const ext = extension.toLowerCase();
  
  const documents = ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', 'pages', 'md', 'epub'];
  const spreadsheets = [...EXCEL_FILE_EXTENSIONS, 'csv', 'tsv', 'ods', 'numbers'];
  const images = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp', 'ico', 'tiff', 'heic', 'raw', 'psd'];
  const audio = ['mp3', 'wav', 'aac', 'flac', 'ogg', 'm4a', 'wma', 'aiff'];
  const videos = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'wmv', 'flv', 'm4v'];
  const archives = ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'iso'];
  const code = ['js', 'ts', 'jsx', 'tsx', 'py', 'html', 'css', 'scss', 'json', 'yaml', 'yml', 'xml', 'sql', 'sh', 'bat', 'c', 'cpp', 'java', 'go', 'rs', 'php'];
  const presentations = ['ppt', 'pptx', 'key', 'odp'];
  const data = ['sqlite', 'db', 'parquet', 'log', 'dat', 'bak', 'env'];
  const geospatial = [
    'shp', 'shx', 'dbf', 'prj', 'cpg', 'qix', 'gpkg', 'gpx', 'kml', 'kmz',
    'geojson', 'gml', 'vrt', 'dem', 'grd', 'grib', 'nc', 'las', 'laz', 'bil',
    'img', 'sid', 'jp2', 'osm', 'pbf', 'geotiff',
  ];

  if (geospatial.includes(ext)) return 'geospatial';
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

// Generate realistic sample project files for instant user experimentation
export function generateSampleFiles(): VirtualFile[] {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  const samples: Array<{
    name: string;
    relativePath: string;
    size: number;
    daysAgo: number;
    sampleContent: string;
  }> = [
    {
      name: 'Q3_Financial_Statement_Final.xlsx',
      relativePath: 'Accounting/2025/Q3/Q3_Financial_Statement_Final.xlsx',
      size: 142500,
      daysAgo: 45,
      sampleContent: 'Date,Category,Amount\n2025-07-01,Revenue,45000\n2025-08-01,Revenue,52000',
    },
    {
      name: 'Invoice_ACME_Corp_0089.pdf',
      relativePath: 'Accounting/Invoices/Pending/Invoice_ACME_Corp_0089.pdf',
      size: 421000,
      daysAgo: 12,
      sampleContent: '%PDF-1.4 Invoice #0089 ACME Corp Total: $4,200.00 Due: Net 30',
    },
    {
      name: 'Invoice_GlobalTech_0090.pdf',
      relativePath: 'Accounting/Invoices/Paid/Invoice_GlobalTech_0090.pdf',
      size: 389000,
      daysAgo: 25,
      sampleContent: '%PDF-1.4 Invoice #0090 GlobalTech Total: $12,500.00 Paid: 2025-09-15',
    },
    {
      name: 'Expense_Receipt_Hotel_Stay.pdf',
      relativePath: 'Travel/Receipts/2025/Expense_Receipt_Hotel_Stay.pdf',
      size: 215000,
      daysAgo: 8,
      sampleContent: '%PDF-1.4 Grand Hyatt Seattle Room charges 2 nights $540.00',
    },
    {
      name: 'product_showcase_hero.png',
      relativePath: 'Marketing/Assets/Raw_Visuals/product_showcase_hero.png',
      size: 1845000,
      daysAgo: 18,
      sampleContent: 'PNG_IMAGE_SAMPLE_STREAM',
    },
    {
      name: 'product_showcase_hero.png', // duplicate name in different folder to test collisions!
      relativePath: 'Design_Archive/V1/product_showcase_hero.png',
      size: 1520000,
      daysAgo: 95,
      sampleContent: 'PNG_IMAGE_SAMPLE_STREAM_V1',
    },
    {
      name: 'social_banner_twitter.jpg',
      relativePath: 'Marketing/Social/social_banner_twitter.jpg',
      size: 780000,
      daysAgo: 5,
      sampleContent: 'JPEG_IMAGE_DATA_SAMPLE',
    },
    {
      name: 'quarterly_all_hands_deck.pptx',
      relativePath: 'Executive/Presentations/quarterly_all_hands_deck.pptx',
      size: 4500000,
      daysAgo: 30,
      sampleContent: 'PPTX_PRESENTATION_STREAM_SLIDES',
    },
    {
      name: 'client_consulting_agreement_v2.docx',
      relativePath: 'Legal/Contracts/Active/client_consulting_agreement_v2.docx',
      size: 124000,
      daysAgo: 70,
      sampleContent: 'Standard Consulting Services Agreement Terms and Conditions 2025',
    },
    {
      name: 'non_disclosure_agreement_signed.pdf',
      relativePath: 'Legal/NDAs/non_disclosure_agreement_signed.pdf',
      size: 260000,
      daysAgo: 140,
      sampleContent: '%PDF-1.4 Mutual Non-Disclosure Agreement Signed Copy',
    },
    {
      name: 'podcast_episode_14_master.mp3',
      relativePath: 'Media/Audio/Podcasts/podcast_episode_14_master.mp3',
      size: 15800000,
      daysAgo: 14,
      sampleContent: 'ID3_AUDIO_STREAM_PODCAST_MASTER',
    },
    {
      name: 'voiceover_intro_clean.wav',
      relativePath: 'Media/Audio/Raw_Takes/voiceover_intro_clean.wav',
      size: 8900000,
      daysAgo: 3,
      sampleContent: 'RIFF_WAVE_AUDIO_SAMPLE',
    },
    {
      name: 'product_demo_screencast.mp4',
      relativePath: 'Media/Video/Tutorials/product_demo_screencast.mp4',
      size: 48200000,
      daysAgo: 22,
      sampleContent: 'MP4_CONTAINER_VIDEO_STREAM',
    },
    {
      name: 'server_database_backup.sql',
      relativePath: 'DevOps/Backups/Weekly/server_database_backup.sql',
      size: 6700000,
      daysAgo: 7,
      sampleContent: '-- PostgreSQL Database Dump\nCREATE TABLE users (id SERIAL PRIMARY KEY, name TEXT);',
    },
    {
      name: 'app_config_production.json',
      relativePath: 'DevOps/Config/app_config_production.json',
      size: 8400,
      daysAgo: 2,
      sampleContent: '{\n  "environment": "production",\n  "port": 3000,\n  "cache": true\n}',
    },
    {
      name: 'api_routes_handler.ts',
      relativePath: 'Source/Backend/api_routes_handler.ts',
      size: 16500,
      daysAgo: 4,
      sampleContent: 'export async function handleRequest(req: Request) {\n  return new Response("OK");\n}',
    },
    {
      name: 'customer_leads_export_2025.csv',
      relativePath: 'Sales/Exports/customer_leads_export_2025.csv',
      size: 340000,
      daysAgo: 11,
      sampleContent: 'id,first_name,last_name,email,company\n1,Alice,Smith,alice@example.com,Apex\n2,Bob,Miller,bob@example.com,Nexus',
    },
    {
      name: 'project_assets_archive.zip',
      relativePath: 'Archives/Old_Projects/project_assets_archive.zip',
      size: 12500000,
      daysAgo: 180,
      sampleContent: 'PK_ZIP_ARCHIVE_MOCK_CONTENT',
    },
    {
      name: 'production_error_audit.log',
      relativePath: 'System/Logs/production_error_audit.log',
      size: 890000,
      daysAgo: 1,
      sampleContent: '[2025-10-12 14:22:01] INFO Server boot complete\n[2025-10-12 14:25:30] WARN Memory threshold 75%',
    },
    {
      name: 'software_architecture_notes.md',
      relativePath: 'Notes/Tech/software_architecture_notes.md',
      size: 12000,
      daysAgo: 15,
      sampleContent: '# Architecture Overview\n- Client-first file pipeline\n- Real-time batch renaming\n- Zero latency preview',
    },
  ];

  return samples.map((s, index) => {
    const ext = getFileExtension(s.name);
    const category = classifyFileCategory(ext);
    const lastModified = now - s.daysAgo * dayMs;
    const blob = new Blob([s.sampleContent], { type: 'text/plain' });

    return {
      id: `sample-${index}-${Date.now()}`,
      name: s.name,
      relativePath: s.relativePath,
      size: s.size,
      type: blob.type,
      extension: ext,
      lastModified,
      category,
      selected: true,
      content: blob,
    };
  });
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

export interface OrganizeResult {
  file: VirtualFile;
  originalPath: string;
  destinationFolder: string;
  targetPath: string;
  category: FileCategory;
  ruleMatched?: string;
  hasCollision: boolean;
  included: boolean;
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

// Compute Smart Document & File Organization preview
export function computeSmartOrganization(
  files: VirtualFile[],
  config: OrganizeConfig
): OrganizeResult[] {
  const usedPaths = new Set<string>();

  return files.map((file) => {
    const ext = file.extension.toLowerCase();
    const category = classifyFileCategory(ext);
    let targetFolder = '';
    let ruleMatched: string | undefined = undefined;

    // 1. Check custom user rules first
    const matchedCustom = config.customRules.find((rule) =>
      rule.extensions.some((e) => e.replace(/^\./, '').toLowerCase() === ext)
    );

    if (EXCEL_FILE_EXTENSIONS.has(ext)) {
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

    // Clean folder path
    targetFolder = targetFolder.replace(/\/+/g, '/').replace(/^\/|\/$/g, '');
    const outputFolderName = config.outputFolderName.trim().replace(/[\\/]/g, '_').replace(/^\.+$/, '');
    if (outputFolderName) targetFolder = `${outputFolderName}/${targetFolder}`;
    const folderParts = targetFolder.split('/');
    const folderNamePrefix = config.folderPrefix.replace(/[\\/]/g, '_');
    const folderNameSuffix = config.folderSuffix.replace(/[\\/]/g, '_');
    folderParts[folderParts.length - 1] = `${folderNamePrefix}${folderParts[folderParts.length - 1]}${folderNameSuffix}`;
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

export async function mapAsyncWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(
    items.length,
    Math.max(1, Math.floor(concurrency) || 1)
  );

  const workers = Array.from({ length: workerCount }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await mapper(items[index], index);
    }
  });

  await Promise.all(workers);
  return results;
}

// Read files from HTML DataTransfer with directory recursion
export async function readFilesFromDataTransfer(
  items: DataTransferItemList,
  onProgress?: (percent: number, currentItem: string, count: number) => void
): Promise<VirtualFile[]> {
  type FileEntryWithPath = {
    entry: FileSystemFileEntry;
    path: string;
  };

  let discoveredCount = 0;
  let processedCount = 0;

  const traverseFileTree = async (
    item: FileSystemEntry,
    path: string = ''
  ): Promise<FileEntryWithPath[]> => {
    if (item.isFile) {
      discoveredCount++;
      if (onProgress && discoveredCount % 25 === 0) {
        onProgress(
          Math.min(45, Math.round((discoveredCount / (discoveredCount + 10)) * 45)),
          `Found ${item.name}`,
          discoveredCount
        );
      }
      return [{ entry: item as FileSystemFileEntry, path }];
    } else if (item.isDirectory) {
      const dirEntry = item as FileSystemDirectoryEntry;
      const dirReader = dirEntry.createReader();
      const currentPath = path ? `${path}/${dirEntry.name}` : dirEntry.name;
      const directoryEntries: FileEntryWithPath[] = [];
      if (onProgress) {
        onProgress(
          Math.min(45, Math.round((discoveredCount / (discoveredCount + 10)) * 45)),
          `Scanning folder: ${dirEntry.name}`,
          discoveredCount
        );
      }

      const readEntries = async (): Promise<void> => {
        const entries = await new Promise<FileSystemEntry[]>((resolve) => {
          dirReader.readEntries(resolve, () => resolve([]));
        });
        if (entries.length === 0) return;

        const batchEntries = await mapAsyncWithConcurrency(entries, 8, (entry) =>
          traverseFileTree(entry, currentPath)
        );
        directoryEntries.push(...batchEntries.flat());
        await readEntries(); // Read next batch (Chrome limits readEntries to 100 items per call)
      };

      await readEntries();
      return directoryEntries;
    }
    return [];
  };

  const promises: Promise<FileEntryWithPath[]>[] = [];
  for (let i = 0; i < items.length; i++) {
    const entry = items[i].webkitGetAsEntry?.();
    if (entry) {
      promises.push(traverseFileTree(entry));
    }
  }

  const fileEntries = (await Promise.all(promises)).flat();
  onProgress?.(50, `Reading ${fileEntries.length} files...`, 0);
  const ingestedFiles = await mapAsyncWithConcurrency(
    fileEntries,
    8,
    async ({ entry, path }): Promise<VirtualFile | null> => {
      const realFile = await new Promise<File | null>((resolve) => {
        entry.file(resolve, () => resolve(null));
      });
      if (!realFile) return null;

      const relativePath = path ? `${path}/${realFile.name}` : realFile.name;
      const ext = getFileExtension(realFile.name);
      processedCount++;
      if (onProgress && processedCount % 25 === 0) {
        onProgress(
          Math.min(
            95,
            50 + Math.round((processedCount / fileEntries.length) * 45)
          ),
          realFile.name,
          processedCount
        );
      }

      return {
        id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: realFile.name,
        relativePath,
        size: realFile.size,
        type: realFile.type,
        extension: ext,
        lastModified: realFile.lastModified || Date.now(),
        category: classifyFileCategory(ext),
        selected: true,
        content: realFile,
      };
    }
  );
  const files = ingestedFiles.filter((file): file is VirtualFile => file !== null);
  if (onProgress) {
    onProgress(100, `Completed ingestion of ${files.length} files`, files.length);
  }
  return files;
}

// Convert standard FileList (e.g. from input webkitdirectory) to VirtualFile[] with progress support
export async function parseFileList(
  fileList: FileList,
  onProgress?: (percent: number, currentItem: string, count: number, total: number) => void
): Promise<VirtualFile[]> {
  const files: VirtualFile[] = [];
  const total = fileList.length;
  const progressInterval = Math.max(1, Math.ceil(total / 100));

  onProgress?.(0, 'Preparing files...', 0, total);
  await new Promise<void>((resolve) => setTimeout(resolve, 0));

  for (let i = 0; i < total; i++) {
    const f = fileList[i];
    const relativePath = (f as unknown as { webkitRelativePath?: string }).webkitRelativePath || f.name;
    const ext = getFileExtension(f.name);

    if (onProgress && ((i + 1) % progressInterval === 0 || i + 1 === total)) {
      const percent = Math.round(((i + 1) / total) * 100);
      onProgress(percent, f.name, i + 1, total);
    }

    files.push({
      id: `file-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 6)}`,
      name: f.name,
      relativePath,
      size: f.size,
      type: f.type,
      extension: ext,
      lastModified: f.lastModified || Date.now(),
      category: classifyFileCategory(ext),
      selected: true,
      content: f,
    });

    if ((i + 1) % 250 === 0 && i + 1 < total) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  }

  return files;
}
