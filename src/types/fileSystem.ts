export type FileCategory =
  | 'documents'
  | 'spreadsheets'
  | 'images'
  | 'audio'
  | 'videos'
  | 'archives'
  | 'code'
  | 'presentations'
  | 'data'
  | 'geospatial'
  | 'other';

export interface VirtualFile {
  id: string;
  name: string;
  relativePath: string;
  size: number;
  type: string;
  extension: string;
  lastModified: number;
  category: FileCategory;
  selected?: boolean;
  content?: Blob | ArrayBuffer | string;
}

export type RenameMode = 'template' | 'replace' | 'prefix_suffix' | 'case' | 'numbering' | 'date';

export interface RenameConfig {
  mode: RenameMode;
  template: string;
  search: string;
  replace: string;
  useRegex: boolean;
  matchCase: boolean;
  prefix: string;
  suffix: string;
  caseType: 'lower' | 'upper' | 'title' | 'camel' | 'kebab' | 'snake';
  startNumber: number;
  stepNumber: number;
  digitsPadding: number;
  dateFormat: 'YYYY-MM-DD' | 'YYYYMMDD' | 'DD-MM-YYYY' | 'YYYY-MM';
  includeParentFolders: boolean;
  parentFolderLevels: number;
  changeExtension: boolean;
  newExtension: string;
  collisionResolution: 'number_suffix' | 'keep_original';
}

export interface CompressConfig {
  archiveName: string;
  archiveMode: 'single' | 'individual';
  compressionLevel: number; // 0 to 9
  maintainDirectoryStructure: boolean;
  includeRootFolder: boolean;
  rootFolderName: string;
}

export interface FlattenConfig {
  separator: '_' | '-' | '.' | ' / ';
  collisionStrategy: 'number_suffix' | 'path_prefix' | 'timestamp' | 'skip';
  maxDepth: number;
  caseHandling: 'preserve' | 'lowercase';
}

export type OrganizeStrategy =
  | 'category'
  | 'extension'
  | 'date'
  | 'category_date'
  | 'extension_date';

export interface CustomOrganizeRule {
  id: string;
  name: string;
  extensions: string[];
  targetFolder: string;
}

export interface OrganizeConfig {
  strategy: OrganizeStrategy;
  dateFormat: 'YYYY/MM' | 'YYYY-MM' | 'YYYY/MM/DD' | 'YYYY-Quarter';
  dateField: 'modified' | 'created';
  flattenSourceSubdirs: boolean;
  customRules: CustomOrganizeRule[];
  excludedExtensions: string[];
  outputFolderName: string;
  folderPrefix: string;
  folderSuffix: string;
  collisionResolution: 'number_suffix' | 'skip';
}

export type CloudProvider = 'google_drive' | 'onedrive' | 'dropbox' | 'nas_local';
export type SyncMode = 'two_way' | 'upload_backup' | 'download_mirror';
export type ConflictStrategy = 'cloud_priority' | 'local_priority' | 'keep_both';
export type AutoSyncInterval = 'manual' | '15m' | '1h' | 'daily';

export interface CloudAccount {
  provider: CloudProvider;
  name: string;
  connected: boolean;
  accountEmail?: string;
  targetRemoteFolder: string;
  syncMode: SyncMode;
  conflictStrategy: ConflictStrategy;
  autoSyncInterval: AutoSyncInterval;
  storageUsedBytes: number;
  storageTotalBytes: number;
  lastSyncTime?: number;
}

export interface SyncLogItem {
  id: string;
  timestamp: number;
  provider: CloudProvider;
  action: 'uploaded' | 'downloaded' | 'synced' | 'conflict_resolved' | 'backup_created';
  fileName: string;
  status: 'success' | 'warning' | 'error';
  details: string;
}

// -------------------------------------------------------------
// GROUNDBREAKING FEATURE 1: DUPLICATES & HASH DEDUPLICATION
// -------------------------------------------------------------
export interface DuplicateGroup {
  hash: string;
  size: number;
  files: VirtualFile[];
  totalWastedBytes: number;
}

export type DuplicateAction = 'keep_newest' | 'keep_oldest' | 'keep_shortest_path' | 'trash_redundant';

// -------------------------------------------------------------
// GROUNDBREAKING FEATURE 2: SEMANTIC AI & CONTENT DNA
// -------------------------------------------------------------
export interface SemanticAnalysis {
  fileId: string;
  detectedType: 'invoice' | 'receipt' | 'contract' | 'code_config' | 'dataset' | 'media_asset' | 'generic';
  confidence: number;
  extractedMetadata: {
    vendor?: string;
    amount?: string;
    currency?: string;
    date?: string;
    invoiceNumber?: string;
    summary?: string;
    languageOrFramework?: string;
    environment?: 'production' | 'staging' | 'development';
    dimensions?: string;
  };
  suggestedName: string;
  suggestedCategory: FileCategory;
  suggestedFolder: string;
  tags: string[];
}

// -------------------------------------------------------------
// GROUNDBREAKING FEATURE 3: PRIVACY & SECRET SCRUBBER
// -------------------------------------------------------------
export interface DetectedSecret {
  type: 'api_key' | 'private_key' | 'jwt_token' | 'email_pii' | 'aws_key' | 'password';
  lineText: string;
  match: string;
  severity: 'critical' | 'high' | 'medium';
}

export interface PrivacyInspectionResult {
  file: VirtualFile;
  hasExifLocation: boolean;
  gpsCoordinates?: { lat: number; lng: number };
  detectedSecrets: DetectedSecret[];
  cleanableMetadata: string[];
  sanitized: boolean;
}

// -------------------------------------------------------------
// GROUNDBREAKING FEATURE 4: DISK SPACE VISUALIZER & TREEMAP
// -------------------------------------------------------------
export interface TreemapNode {
  name: string;
  path: string;
  size: number;
  formattedSize: string;
  category?: FileCategory;
  extension?: string;
  color?: string;
  children?: TreemapNode[];
  fileCount: number;
}

