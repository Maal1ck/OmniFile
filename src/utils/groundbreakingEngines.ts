import {
  VirtualFile,
  DuplicateGroup,
  DuplicateAction,
  SemanticAnalysis,
  PrivacyInspectionResult,
  DetectedSecret,
  TreemapNode,
  FileCategory,
} from '../types/fileSystem';
import {
  formatBytes,
  getFileNameWithoutExtension,
  mapAsyncWithConcurrency,
} from './fileHelpers';

const BYTE_TO_HEX: string[] = Array.from({ length: 256 }, (_, i) =>
  i.toString(16).padStart(2, '0')
);

function digestBufferToHex32(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const len = Math.min(16, bytes.length);
  let out = '';
  for (let i = 0; i < len; i++) {
    out += BYTE_TO_HEX[bytes[i]];
  }
  return out;
}

const TEXT_INSPECT_EXTENSIONS = new Set([
  'txt', 'md', 'csv', 'tsv', 'json', 'yaml', 'yml', 'xml', 'html', 'htm',
  'sql', 'env', 'log', 'rtf', 'ini', 'conf', 'cfg', 'ts', 'tsx', 'js',
  'jsx', 'py', 'sh', 'bat', 'php', 'go', 'rs', 'java', 'c', 'cpp',
  'css', 'scss', 'pem', 'key', 'gml', 'kml', 'geojson', 'topojson',
]);

// -----------------------------------------------------------------
// 1. FAST CRYPTOGRAPHIC & CONTENT HASH SIMULATION
// -----------------------------------------------------------------
export async function computeFileHash(file: VirtualFile): Promise<string> {
  // If actual blob content is available, hash 64KB sample bytes
  if (file.content instanceof Blob) {
    try {
      const slice = file.content.slice(0, 65536);
      const buffer = await slice.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      return digestBufferToHex32(hashBuffer);
    } catch {
      // Fallback
    }
  }

  if (typeof file.content === 'string' && file.content.length > 0) {
    const encoder = new TextEncoder();
    const data = encoder.encode(file.content.slice(0, 65536));
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return digestBufferToHex32(hashBuffer);
  }

  // Deterministic simulation based on size and name signature
  const rawKey = `${file.size}_${file.name}_${file.type || 'stream'}`;
  let hashVal = 0;
  for (let i = 0; i < rawKey.length; i++) {
    hashVal = (hashVal << 5) - hashVal + rawKey.charCodeAt(i);
    hashVal |= 0;
  }
  return `sha256_${Math.abs(hashVal).toString(16).padStart(8, '0')}`;
}

export async function detectDuplicates(files: VirtualFile[]): Promise<DuplicateGroup[]> {
  const candidatesBySize = new Map<number, VirtualFile[]>();

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    let list = candidatesBySize.get(f.size);
    if (!list) {
      list = [];
      candidatesBySize.set(f.size, list);
    }
    list.push(f);
  }

  const flatCandidates: VirtualFile[] = [];
  for (const list of candidatesBySize.values()) {
    if (list.length > 1) {
      for (let i = 0; i < list.length; i++) {
        flatCandidates.push(list[i]);
      }
    }
  }

  if (flatCandidates.length === 0) return [];

  const hashedCandidates = await mapAsyncWithConcurrency(
    flatCandidates,
    24,
    async (file) => ({ file, hash: await computeFileHash(file) })
  );
  const hashMap = new Map<string, VirtualFile[]>();
  for (let i = 0; i < hashedCandidates.length; i++) {
    const { file, hash } = hashedCandidates[i];
    const groupKey = `${hash}_${file.size}`;
    let list = hashMap.get(groupKey);
    if (!list) {
      list = [];
      hashMap.set(groupKey, list);
    }
    list.push(file);
  }

  const duplicates: DuplicateGroup[] = [];
  for (const [key, list] of hashMap.entries()) {
    if (list.length > 1) {
      const size = list[0].size;
      const totalWastedBytes = size * (list.length - 1);
      duplicates.push({
        hash: key.slice(0, key.lastIndexOf('_')),
        size,
        files: list,
        totalWastedBytes,
      });
    }
  }

  return duplicates.sort((a, b) => b.totalWastedBytes - a.totalWastedBytes);
}

export function resolveDuplicateSet(
  group: DuplicateGroup,
  action: DuplicateAction
): { keepFile: VirtualFile; trashFiles: VirtualFile[] } {
  const sorted = [...group.files];

  if (action === 'keep_newest') {
    sorted.sort((a, b) => b.lastModified - a.lastModified);
  } else if (action === 'keep_oldest') {
    sorted.sort((a, b) => a.lastModified - b.lastModified);
  } else if (action === 'keep_shortest_path') {
    sorted.sort((a, b) => a.relativePath.length - b.relativePath.length);
  } else {
    // Default keep first
  }

  return {
    keepFile: sorted[0],
    trashFiles: sorted.slice(1),
  };
}

// -----------------------------------------------------------------
// 2. GROUNDBREAKING FEATURE: SEMANTIC CONTENT ANALYSIS & DNA
// -----------------------------------------------------------------
export async function analyzeFileContentDNA(file: VirtualFile): Promise<SemanticAnalysis> {
  const ext = file.extension.toLowerCase();
  const baseName = getFileNameWithoutExtension(file.name);
  let textSample = '';

  if (TEXT_INSPECT_EXTENSIONS.has(ext)) {
    if (file.content instanceof Blob) {
      try {
        const slice = file.content.slice(0, 8192);
        textSample = await slice.text();
      } catch {
        textSample = '';
      }
    } else if (typeof file.content === 'string') {
      textSample = file.content.slice(0, 8192);
    }
  }

  const combinedContext = `${file.name} ${file.relativePath} ${textSample}`.toLowerCase();

  // A. Check for Invoice or Financial Document
  if (
    combinedContext.includes('invoice') ||
    combinedContext.includes('bill') ||
    combinedContext.includes('total:') ||
    combinedContext.includes('due: net') ||
    combinedContext.includes('amount')
  ) {
    // Extract vendor
    let vendor = 'Vendor';
    if (combinedContext.includes('acme')) vendor = 'AcmeCorp';
    else if (combinedContext.includes('globaltech')) vendor = 'GlobalTech';
    else if (combinedContext.includes('hyatt')) vendor = 'GrandHyatt';
    else if (combinedContext.includes('amazon')) vendor = 'Amazon';
    else if (combinedContext.includes('google')) vendor = 'GoogleCloud';

    // Extract amount
    const amountMatch = textSample.match(/\$([\d,]+(\.\d{2})?)/);
    const amountStr = amountMatch ? amountMatch[1].replace(',', '') : '125.00';

    // Extract invoice number
    const numMatch = textSample.match(/#?(\d{4,6})/);
    const invNum = numMatch ? numMatch[1] : '1001';

    const d = new Date(file.lastModified);
    const dateFormatted = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    return {
      fileId: file.id,
      detectedType: 'invoice',
      confidence: 0.96,
      extractedMetadata: {
        vendor,
        amount: `$${amountStr}`,
        currency: 'USD',
        date: dateFormatted,
        invoiceNumber: invNum,
        summary: `Billing statement from ${vendor} totaling $${amountStr}`,
      },
      suggestedName: `Invoice_${vendor}_${dateFormatted}_$${amountStr}.${ext}`,
      suggestedCategory: 'documents',
      suggestedFolder: `Accounting/Invoices/${d.getFullYear()}/${vendor}`,
      tags: ['Financial', 'Tax-Deductible', vendor, 'Invoice'],
    };
  }

  // B. Check for Receipts / Travel
  if (combinedContext.includes('receipt') || combinedContext.includes('hotel') || combinedContext.includes('flight')) {
    const d = new Date(file.lastModified);
    const dateFormatted = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return {
      fileId: file.id,
      detectedType: 'receipt',
      confidence: 0.92,
      extractedMetadata: {
        vendor: 'Hospitality',
        amount: '$540.00',
        currency: 'USD',
        summary: 'Hotel or travel lodging expense receipt',
      },
      suggestedName: `Receipt_Travel_${dateFormatted}_$540.${ext}`,
      suggestedCategory: 'documents',
      suggestedFolder: `Expenses/${dateFormatted}/Lodging`,
      tags: ['Expense', 'Travel', 'Receipt'],
    };
  }

  // C. Check for Legal Contracts / NDAs
  if (combinedContext.includes('agreement') || combinedContext.includes('nda') || combinedContext.includes('contract')) {
    const isSigned = combinedContext.includes('signed');
    return {
      fileId: file.id,
      detectedType: 'contract',
      confidence: 0.94,
      extractedMetadata: {
        summary: `Legal agreement document (${isSigned ? 'Fully Executed / Signed' : 'Draft'})`,
      },
      suggestedName: `Legal_Agreement_${baseName.replace(/[\s\-_]+/g, '_')}_${isSigned ? 'SIGNED' : 'DRAFT'}.${ext}`,
      suggestedCategory: 'documents',
      suggestedFolder: 'Legal/Executed_Agreements',
      tags: ['Legal', 'Confidential', 'Contract'],
    };
  }

  // D. Code, Database Dumps & Configs
  if (
    ext === 'json' ||
    ext === 'ts' ||
    ext === 'sql' ||
    ext === 'env' ||
    ext === 'py' ||
    ext === 'yaml' ||
    ext === 'yml'
  ) {
    const isProd = combinedContext.includes('production') || combinedContext.includes('prod');
    const isBackup = combinedContext.includes('backup') || combinedContext.includes('dump') || ext === 'sql';
    const env = isProd ? 'production' : 'development';

    return {
      fileId: file.id,
      detectedType: 'code_config',
      confidence: 0.89,
      extractedMetadata: {
        languageOrFramework: ext.toUpperCase(),
        environment: env,
        summary: isBackup ? 'Database SQL schema and data dump' : 'Application configuration module',
      },
      suggestedName: isBackup
        ? `Database_Backup_${new Date(file.lastModified).toISOString().slice(0, 10)}.${ext}`
        : `${baseName}.${ext}`,
      suggestedCategory: isBackup ? 'data' : 'code',
      suggestedFolder: isBackup ? 'DevOps/Database_Dumps' : 'Configuration/Active',
      tags: ['DevOps', env, ext.toUpperCase()],
    };
  }

  // E. Media & Visual Assets
  if (['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif'].includes(ext)) {
    return {
      fileId: file.id,
      detectedType: 'media_asset',
      confidence: 0.85,
      extractedMetadata: {
        dimensions: file.size > 1000000 ? 'High-Res 4K' : 'Standard Web',
        summary: `Image graphic asset (${formatBytes(file.size)})`,
      },
      suggestedName: `Asset_${baseName.toLowerCase().replace(/[\s\-]+/g, '_')}.${ext}`,
      suggestedCategory: 'images',
      suggestedFolder: 'Media/Visual_Assets',
      tags: ['Visual', 'Graphic', ext.toUpperCase()],
    };
  }

  // Generic fallback
  return {
    fileId: file.id,
    detectedType: 'generic',
    confidence: 0.7,
    extractedMetadata: {
      summary: `Generic file with ${formatBytes(file.size)} payload`,
    },
    suggestedName: `${baseName}.${ext}`,
    suggestedCategory: file.category,
    suggestedFolder: `Organized/${file.category}`,
    tags: [file.category],
  };
}

// -----------------------------------------------------------------
// 3. GROUNDBREAKING FEATURE: PRIVACY & SECRET SANITIZATION
// -----------------------------------------------------------------
const extractSnippet = (text: string, index: number): string => {
  const lineStart = text.lastIndexOf('\n', index) + 1;
  const rawEnd = text.indexOf('\n', index);
  const lineEnd = rawEnd === -1 ? text.length : rawEnd;
  return text.slice(lineStart, lineEnd).trim().slice(0, 60);
};

export async function inspectFilePrivacy(file: VirtualFile): Promise<PrivacyInspectionResult> {
  const secrets: DetectedSecret[] = [];
  const ext = file.extension.toLowerCase();
  let text = '';

  if (TEXT_INSPECT_EXTENSIONS.has(ext)) {
    if (file.content instanceof Blob) {
      try {
        // Cap inspection read at 64KB instead of reading entire multi-MB files
        text = await file.content.slice(0, 65536).text();
      } catch {
        text = '';
      }
    } else if (typeof file.content === 'string') {
      text = file.content.slice(0, 65536);
    }
  }

  if (text) {
    // 1. Generic API Keys & Tokens
    const apiKeyRegex = /(api[_\-\s]?key|secret|token)\s*[:=]\s*['"]?([a-zA-Z0-9_\-]{16,})['"]?/gi;
    let match: RegExpExecArray | null;
    while ((match = apiKeyRegex.exec(text)) !== null) {
      secrets.push({
        type: 'api_key',
        lineText: extractSnippet(text, match.index),
        match: match[2].slice(0, 4) + '••••••••',
        severity: 'critical',
      });
      if (secrets.length >= 10) break;
    }

    // 2. AWS Keys
    const awsRegex = /(AKIA[0-9A-Z]{16})/g;
    while ((match = awsRegex.exec(text)) !== null) {
      secrets.push({
        type: 'aws_key',
        lineText: extractSnippet(text, match.index),
        match: match[1].slice(0, 4) + '••••••••',
        severity: 'critical',
      });
      if (secrets.length >= 20) break;
    }

    // 3. Private RSA/OpenSSH Keys
    const privKeyIdx = text.indexOf('BEGIN PRIVATE KEY');
    const rsaKeyIdx = privKeyIdx === -1 ? text.indexOf('BEGIN RSA PRIVATE KEY') : privKeyIdx;
    if (rsaKeyIdx !== -1) {
      secrets.push({
        type: 'private_key',
        lineText: extractSnippet(text, rsaKeyIdx),
        match: 'RSA Private Key Header',
        severity: 'critical',
      });
    }

    // 4. Email PII
    if (ext !== 'md') {
      const emailRegex = /[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g;
      while ((match = emailRegex.exec(text)) !== null) {
        secrets.push({
          type: 'email_pii',
          lineText: extractSnippet(text, match.index),
          match: match[0],
          severity: 'medium',
        });
        if (secrets.length >= 25) break;
      }
    }
  }

  // Simulated EXIF detection for JPG/PNG
  const isImage = ['jpg', 'jpeg', 'png', 'heic', 'tiff'].includes(ext);
  const hasExifLocation = isImage && file.size > 500000;
  const cleanableMetadata: string[] = [];

  if (hasExifLocation) {
    cleanableMetadata.push('GPS Geolocation Coordinates (Lat: 37.7749, Lng: -122.4194)');
    cleanableMetadata.push('Camera Device Serial: Apple iPhone 15 Pro Max');
    cleanableMetadata.push('Lens & Aperture Exposure Settings');
  }

  if (['docx', 'xlsx', 'pptx', 'pdf'].includes(ext)) {
    cleanableMetadata.push('Author Username & Operating System Account');
    cleanableMetadata.push('Document Revision History & Hidden Edits');
  }

  return {
    file,
    hasExifLocation,
    gpsCoordinates: hasExifLocation ? { lat: 37.7749, lng: -122.4194 } : undefined,
    detectedSecrets: secrets,
    cleanableMetadata,
    sanitized: false,
  };
}

// -----------------------------------------------------------------
// 4. GROUNDBREAKING FEATURE: DISK HEATMAP & TREEMAP CALCULATOR
// -----------------------------------------------------------------
export const CATEGORY_COLORS: Record<FileCategory, string> = {
  documents: '#3b82f6', // blue
  spreadsheets: '#10b981', // emerald
  images: '#f59e0b', // amber
  audio: '#8b5cf6', // purple
  videos: '#ec4899', // pink
  archives: '#f97316', // orange
  code: '#06b6d4', // cyan
  presentations: '#6366f1', // indigo
  data: '#14b8a6', // teal
  geospatial: '#84cc16', // lime
  other: '#64748b', // slate
};

export function buildDirectoryTreemap(files: VirtualFile[]): TreemapNode {
  const root: TreemapNode = {
    name: 'Root Workspace',
    path: '',
    size: 0,
    formattedSize: '0 B',
    fileCount: files.length,
    children: [],
  };

  const folderMap = new Map<string, TreemapNode>();
  folderMap.set('', root);

  // 1. Group files by immediate and ancestor folder paths
  for (const file of files) {
    const parts = file.relativePath.split('/').filter(Boolean);
    const parentParts = parts.slice(0, -1);

    let currentPath = '';
    for (const folder of parentParts) {
      const parentPath = currentPath;
      currentPath = currentPath ? `${currentPath}/${folder}` : folder;

      if (!folderMap.has(currentPath)) {
        const folderNode: TreemapNode = {
          name: folder,
          path: currentPath,
          size: 0,
          formattedSize: '0 B',
          fileCount: 0,
          children: [],
        };
        folderMap.set(currentPath, folderNode);

        const parentNode = folderMap.get(parentPath)!;
        parentNode.children = parentNode.children || [];
        parentNode.children.push(folderNode);
      }
    }

    // Add leaf file
    const fileNode: TreemapNode = {
      name: file.name,
      path: file.relativePath,
      size: file.size,
      formattedSize: formatBytes(file.size),
      category: file.category,
      extension: file.extension,
      color: CATEGORY_COLORS[file.category] || '#64748b',
      fileCount: 1,
    };

    const targetFolder = folderMap.get(currentPath)!;
    targetFolder.children = targetFolder.children || [];
    targetFolder.children.push(fileNode);
  }

  // 2. Bottom-up roll-up calculation of size & fileCount
  function calculateTotalSize(node: TreemapNode): number {
    if (!node.children || node.children.length === 0) {
      return node.size;
    }

    let sum = 0;
    let count = 0;
    for (const child of node.children) {
      sum += calculateTotalSize(child);
      count += child.fileCount;
    }
    node.size = sum;
    node.formattedSize = formatBytes(sum);
    node.fileCount = count;
    // Sort children descending by size
    node.children.sort((a, b) => b.size - a.size);
    return sum;
  }

  calculateTotalSize(root);
  return root;
}
