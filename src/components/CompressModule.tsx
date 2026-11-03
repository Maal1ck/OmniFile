import React, { useState, useRef } from 'react';
import {
  FolderArchive,
  Download,
  FileCheck,
  HardDrive,
  PackageCheck,
  FolderInput,
  FolderTree,
} from 'lucide-react';
import JSZip from 'jszip';
import { VirtualFile, CompressConfig } from '../types/fileSystem';
import {
  formatBytes,
  createZipArchive,
  triggerFileDownload,
  getFileExtension,
  classifyFileCategory,
} from '../utils/fileHelpers';

interface CompressModuleProps {
  files: VirtualFile[];
  onFilesAdded: (newFiles: VirtualFile[]) => void;
  onStartProgress: (title: string) => void;
  onUpdateProgress: (percent: number, item: string) => void;
  onFinishProgress: () => void;
}

export const CompressModule: React.FC<CompressModuleProps> = ({
  files,
  onFilesAdded,
  onStartProgress,
  onUpdateProgress,
  onFinishProgress,
}) => {
  const [config, setConfig] = useState<CompressConfig>({
    archiveName: `OmniFile_Archive_${new Date().toISOString().slice(0, 10)}`,
    archiveMode: 'single',
    compressionLevel: 6,
    maintainDirectoryStructure: true,
    includeRootFolder: false,
    rootFolderName: 'bundle',
  });

  const [inspectingZip, setInspectingZip] = useState<boolean>(false);
  const [inspectedItems, setInspectedItems] = useState<
    Array<{ name: string; size: number; isDir: boolean }>
  >([]);
  const [inspectedZipName, setInspectedZipName] = useState<string>('');
  const [inspectedZipFiles, setInspectedZipFiles] = useState<VirtualFile[]>([]);
  const zipInputRef = useRef<HTMLInputElement>(null);

  const selectedFiles = files.filter((f) => f.selected);
  const targetFiles = selectedFiles.length > 0 ? selectedFiles : files;
  const totalUncompressedSize = targetFiles.reduce((acc, f) => acc + f.size, 0);

  // Compression level descriptions
  const getLevelLabel = (lvl: number) => {
    if (lvl === 0) return 'Level 0: Store (Fastest, zero compression)';
    if (lvl <= 3) return `Level ${lvl}: Fast Compression`;
    if (lvl <= 6) return `Level ${lvl}: Balanced Deflate (Standard)`;
    return `Level ${lvl}: Maximum Compression (Compact file)`;
  };

  const handleCreateZip = async () => {
    if (targetFiles.length === 0) return;

    onStartProgress('Compressing selected files into ZIP archive...');

    try {
      if (config.archiveMode === 'single') {
        const itemsToZip = targetFiles.map((file) => {
          let zipPath = config.maintainDirectoryStructure ? file.relativePath : file.name;
          if (config.includeRootFolder && config.rootFolderName) {
            zipPath = `${config.rootFolderName}/${zipPath}`;
          }
          return { path: zipPath, file };
        });

        const zipBlob = await createZipArchive(itemsToZip, {
          compressionLevel: config.compressionLevel,
          onProgress: (percent, currentFile) => {
            onUpdateProgress(percent, currentFile);
          },
        });

        const cleanArchiveName = config.archiveName.endsWith('.zip')
          ? config.archiveName
          : `${config.archiveName}.zip`;

        triggerFileDownload(zipBlob, cleanArchiveName);
      } else {
        // Individual archives per file
        for (let i = 0; i < targetFiles.length; i++) {
          const file = targetFiles[i];
          const progressPercent = Math.round(((i + 1) / targetFiles.length) * 100);
          onUpdateProgress(progressPercent, file.name);

          const singleItem = [{ path: file.name, file }];
          const singleBlob = await createZipArchive(singleItem, {
            compressionLevel: config.compressionLevel,
          });

          const base = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
          triggerFileDownload(singleBlob, `${base}.zip`);
          // Brief pause between multiple downloads
          await new Promise((r) => setTimeout(r, 200));
        }
      }
    } finally {
      onFinishProgress();
    }
  };

  // Inspect & Extract external ZIP
  const handleInspectZipFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setInspectingZip(true);
    setInspectedZipName(file.name);

    try {
      const zip = await JSZip.loadAsync(file);
      const items: Array<{ name: string; size: number; isDir: boolean }> = [];
      const extractedVirtualFiles: VirtualFile[] = [];

      for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
        items.push({
          name: relativePath,
          // @ts-expect-error JSZip internal size property
          size: zipEntry._data?.uncompressedSize || 0,
          isDir: zipEntry.dir,
        });

        if (!zipEntry.dir) {
          const blob = await zipEntry.async('blob');
          const ext = getFileExtension(zipEntry.name);
          extractedVirtualFiles.push({
            id: `zip-extracted-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            name: zipEntry.name.split('/').pop() || zipEntry.name,
            relativePath,
            size: blob.size,
            type: blob.type,
            extension: ext,
            lastModified: zipEntry.date ? zipEntry.date.getTime() : Date.now(),
            category: classifyFileCategory(ext),
            selected: true,
            content: blob,
          });
        }
      }

      setInspectedItems(items);
      setInspectedZipFiles(extractedVirtualFiles);
    } catch {
      alert('Could not inspect the selected file as a valid ZIP archive.');
    } finally {
      setInspectingZip(false);
      e.target.value = '';
    }
  };

  const handleImportExtractedToWorkspace = () => {
    if (inspectedZipFiles.length > 0) {
      onFilesAdded(inspectedZipFiles);
      setInspectedItems([]);
      setInspectedZipFiles([]);
      setInspectedZipName('');
    }
  };

  return (
    <div className="space-y-6">
      {/* Configuration Box */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-800 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <FolderArchive className="w-5 h-5 text-cyan-400" />
              <h2 className="text-lg font-bold text-white tracking-tight">ZIP Compression & Archiving</h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Package multiple files and nested directories into compressed standard `.zip` archives.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleCreateZip}
              disabled={targetFiles.length === 0}
              className="flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-40 rounded-lg transition-all cursor-pointer shadow-sm"
            >
              <Download className="w-4 h-4" />
              <span>Create & Download ZIP</span>
            </button>
          </div>
        </div>

        {/* Form Options */}
        <div className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Archive Output Filename
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={config.archiveName}
                  onChange={(e) => setConfig({ ...config, archiveName: e.target.value })}
                  className="flex-1 bg-slate-950 border border-slate-800 text-slate-100 font-mono text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500"
                />
                <span className="text-xs font-mono text-slate-400">.zip</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-2">Archive Mode</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setConfig({ ...config, archiveMode: 'single' })}
                  className={`p-3 rounded-lg text-left text-xs transition-colors cursor-pointer border ${
                    config.archiveMode === 'single'
                      ? 'bg-slate-800 border-cyan-500 text-slate-100'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <PackageCheck className="w-4 h-4 text-cyan-400 mb-1" />
                  <div className="font-semibold text-slate-200">Single Master Archive</div>
                  <div className="text-[11px] text-slate-500">All files bundled in one .zip</div>
                </button>

                <button
                  type="button"
                  onClick={() => setConfig({ ...config, archiveMode: 'individual' })}
                  className={`p-3 rounded-lg text-left text-xs transition-colors cursor-pointer border ${
                    config.archiveMode === 'individual'
                      ? 'bg-slate-800 border-cyan-500 text-slate-100'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <FolderArchive className="w-4 h-4 text-cyan-400 mb-1" />
                  <div className="font-semibold text-slate-200">Individual Archives</div>
                  <div className="text-[11px] text-slate-500">Compress each file separately</div>
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-300">Compression Level</label>
                <span className="text-[11px] font-mono text-cyan-400">{getLevelLabel(config.compressionLevel)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={9}
                value={config.compressionLevel}
                onChange={(e) => setConfig({ ...config, compressionLevel: Number(e.target.value) })}
                className="w-full accent-cyan-400 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
                <span>0 (Fast Store)</span>
                <span>3 (Fast)</span>
                <span>6 (Standard)</span>
                <span>9 (Max Deflate)</span>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.maintainDirectoryStructure}
                  onChange={(e) =>
                    setConfig({ ...config, maintainDirectoryStructure: e.target.checked })
                  }
                  className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                />
                <span>Preserve nested directory structure in archive</span>
              </label>

              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.includeRootFolder}
                  onChange={(e) => setConfig({ ...config, includeRootFolder: e.target.checked })}
                  className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                />
                <span>Nest everything inside a root folder:</span>
              </label>

              {config.includeRootFolder && (
                <input
                  type="text"
                  value={config.rootFolderName}
                  onChange={(e) => setConfig({ ...config, rootFolderName: e.target.value })}
                  placeholder="e.g. project_export"
                  className="w-full bg-slate-950 border border-slate-800 text-slate-100 font-mono text-xs rounded-lg px-3 py-1.5 ml-6"
                />
              )}
            </div>
          </div>
        </div>

        {/* Compression Summary Bar */}
        <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <FileCheck className="w-3.5 h-3.5 text-cyan-400" />
              <span className="font-mono tabular-nums text-slate-200">{targetFiles.length} files</span> targeted
            </span>
            <span aria-hidden="true">·</span>
            <span className="flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-blue-400" />
              <span>Uncompressed:</span>
              <span className="font-mono tabular-nums text-slate-200">
                {formatBytes(totalUncompressedSize)}
              </span>
            </span>
          </div>

          <div className="text-[11px] text-slate-500">
            Powered by WebAssembly JSZip engine
          </div>
        </div>
      </div>

      {/* ZIP Inspector & Extraction Utility */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <FolderInput className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white tracking-tight">ZIP Archive Inspector & Extractor</h3>
          </div>

          <div>
            <input
              type="file"
              ref={zipInputRef}
              accept=".zip"
              onChange={handleInspectZipFile}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => zipInputRef.current?.click()}
              className="px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors cursor-pointer"
            >
              Inspect Existing .ZIP
            </button>
          </div>
        </div>

        {inspectingZip ? (
          <div className="py-8 text-center text-xs text-slate-400">
            Reading and parsing ZIP archive headers...
          </div>
        ) : inspectedItems.length > 0 ? (
          <div className="pt-4 space-y-4">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300 font-medium">
                Contents of <span className="font-mono text-cyan-400">{inspectedZipName}</span> ({inspectedItems.length} entries)
              </span>
              <button
                type="button"
                onClick={handleImportExtractedToWorkspace}
                className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 rounded-md transition-colors cursor-pointer"
              >
                <FolderTree className="w-3.5 h-3.5" />
                <span>Import {inspectedZipFiles.length} Files to Active Workspace</span>
              </button>
            </div>

            <div className="max-h-48 overflow-y-auto bg-slate-950 border border-slate-800 rounded-lg divide-y divide-slate-850 text-xs font-mono">
              {inspectedItems.map((item, idx) => (
                <div key={idx} className="px-3 py-1.5 flex items-center justify-between text-slate-300">
                  <span className="truncate max-w-md">{item.name}</span>
                  <span className="text-slate-500 text-[11px] tabular-nums">
                    {item.isDir ? 'DIR' : formatBytes(item.size)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="py-6 text-center text-xs text-slate-500">
            Drop or select any external `.zip` file from your computer to inspect its structure and extract files into your active workspace.
          </div>
        )}
      </div>
    </div>
  );
};
