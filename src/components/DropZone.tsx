import React, { useRef, useState } from 'react';
import {
  UploadCloud,
  FolderOpen,
  FilePlus,
  Sparkles,
  ShieldCheck,
  HardDrive,
} from 'lucide-react';
import { VirtualFile } from '../types/fileSystem';
import {
  readFilesFromDataTransfer,
  parseFileList,
  generateSampleFiles,
  getFileExtension,
  classifyFileCategory,
} from '../utils/fileHelpers';

interface DropZoneProps {
  onFilesAdded: (newFiles: VirtualFile[]) => void;
  hasFiles: boolean;
  onStartProgress?: (title: string) => void;
  onUpdateProgress?: (percent: number, item: string) => void;
  onFinishProgress?: () => void;
}

export const DropZone: React.FC<DropZoneProps> = ({
  onFilesAdded,
  hasFiles,
  onStartProgress,
  onUpdateProgress,
  onFinishProgress,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (onStartProgress) {
      onStartProgress('Ingesting Dropped Files & Directories...');
      onUpdateProgress?.(5, 'Parsing directory entries...');
    }

    try {
      if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
        const extracted = await readFilesFromDataTransfer(
          e.dataTransfer.items,
          (percent, currentItem, count) => {
            onUpdateProgress?.(percent, `${currentItem} (${count} files)`);
          }
        );
        if (extracted.length > 0) {
          onFilesAdded(extracted);
        }
      } else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const parsed = parseFileList(
          e.dataTransfer.files,
          (percent, currentItem, count) => {
            onUpdateProgress?.(percent, `${currentItem} (${count} files)`);
          }
        );
        if (parsed.length > 0) {
          onFilesAdded(parsed);
        }
      }
    } finally {
      if (onFinishProgress) {
        onFinishProgress();
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      if (onStartProgress) {
        onStartProgress('Ingesting Selected Files...');
      }
      const parsed = parseFileList(
        e.target.files,
        (percent, currentItem, count) => {
          onUpdateProgress?.(percent, `${currentItem} (${count} files)`);
        }
      );
      onFilesAdded(parsed);
      e.target.value = '';
      if (onFinishProgress) {
        onFinishProgress();
      }
    }
  };

  const handleOpenFolderNative = async () => {
    // Check if Chromium / Windows Native Directory Picker is available
    if ('showDirectoryPicker' in window) {
      try {
        const dirHandle = await (window as unknown as {
          showDirectoryPicker: () => Promise<FileSystemDirectoryHandle>;
        }).showDirectoryPicker();

        if (onStartProgress) {
          onStartProgress(`Ingesting Directory: ${dirHandle.name}...`);
        }

        const gatheredFiles: VirtualFile[] = [];
        let count = 0;

        const readDirectoryHandle = async (
          handle: FileSystemDirectoryHandle,
          currentPath: string = ''
        ) => {
          for await (const entry of (handle as unknown as { values: () => AsyncIterable<FileSystemHandle> }).values()) {
            if (entry.kind === 'file') {
              const fileHandle = entry as unknown as FileSystemFileHandle;
              const file = await fileHandle.getFile();
              const relativePath = currentPath ? `${currentPath}/${file.name}` : file.name;
              const ext = getFileExtension(file.name);
              count++;
              onUpdateProgress?.(
                Math.min(95, Math.round((count / (count + 5)) * 100)),
                `${file.name} (${count} files)`
              );
              gatheredFiles.push({
                id: `native-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
                name: file.name,
                relativePath,
                size: file.size,
                type: file.type,
                extension: ext,
                lastModified: file.lastModified,
                category: classifyFileCategory(ext),
                selected: true,
                content: file,
              });
            } else if (entry.kind === 'directory') {
              const subDirHandle = entry as unknown as FileSystemDirectoryHandle;
              const newPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
              onUpdateProgress?.(Math.min(95, count * 2), `Scanning folder: ${entry.name}`);
              await readDirectoryHandle(subDirHandle, newPath);
            }
          }
        };

        await readDirectoryHandle(dirHandle, dirHandle.name);
        if (gatheredFiles.length > 0) {
          onFilesAdded(gatheredFiles);
        }
        if (onFinishProgress) {
          onFinishProgress();
        }
        return;
      } catch (err) {
        // User canceled or denied permission, fall back to input
        if (onFinishProgress) onFinishProgress();
        if ((err as Error).name !== 'AbortError') {
          folderInputRef.current?.click();
        }
        return;
      }
    }

    // Standard fallback
    folderInputRef.current?.click();
  };

  const handleLoadSampleDataset = () => {
    if (onStartProgress) {
      onStartProgress('Generating Sample Workspace Dataset...');
      onUpdateProgress?.(20, 'Creating financial invoices...');
    }
    setTimeout(() => {
      onUpdateProgress?.(60, 'Synthesizing media, source code & archives...');
      const samples = generateSampleFiles();
      setTimeout(() => {
        onUpdateProgress?.(100, 'Populating workspace...');
        onFilesAdded(samples);
        if (onFinishProgress) onFinishProgress();
      }, 250);
    }, 200);
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative rounded-xl border-2 transition-all p-8 text-center ${
        isDragging
          ? 'border-cyan-400 bg-cyan-950/20 shadow-lg shadow-cyan-950/50 scale-[1.005]'
          : hasFiles
          ? 'border-dashed border-slate-700 bg-slate-900/40 hover:border-slate-600'
          : 'border-dashed border-slate-700 bg-slate-900/60 hover:border-cyan-500/50 py-12'
      }`}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        multiple
        className="hidden"
      />
      <input
        type="file"
        ref={folderInputRef}
        onChange={handleFileInputChange}
        {...({ webkitdirectory: '', directory: '' } as React.InputHTMLAttributes<HTMLInputElement>)}
        multiple
        className="hidden"
      />

      <div className="max-w-xl mx-auto flex flex-col items-center">
        <div
          className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-colors ${
            isDragging
              ? 'bg-cyan-500 text-slate-950'
              : 'bg-slate-800 text-cyan-400 border border-slate-700'
          }`}
        >
          <UploadCloud className="w-7 h-7" />
        </div>

        <h3 className="text-lg font-semibold text-white tracking-tight mb-1">
          {isDragging
            ? 'Release to ingest files & folder tree'
            : hasFiles
            ? 'Drop additional files or folders here'
            : 'Drop your files or folders to get started'}
        </h3>

        <p className="text-xs text-slate-400 mb-6 max-w-md">
          Supports nested directory trees, batch multi-select, PDF documents, media, code, and archives. All processing runs 100% locally on your machine.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={handleOpenFolderNative}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg transition-colors cursor-pointer shadow-sm"
          >
            <FolderOpen className="w-4 h-4 text-cyan-400" />
            <span>Select Directory / Folder</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-200 bg-slate-850 hover:bg-slate-800 border border-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            <FilePlus className="w-4 h-4 text-slate-400" />
            <span>Select Files</span>
          </button>

          <button
            type="button"
            onClick={handleLoadSampleDataset}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-cyan-300 bg-cyan-950/40 hover:bg-cyan-900/50 border border-cyan-800/80 rounded-lg transition-colors cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span>Load Sample Workspace (20 Files)</span>
          </button>
        </div>

        <div className="mt-6 flex items-center gap-6 text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Zero server upload · 100% Client-side</span>
          </div>
          <div className="flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5 text-blue-400" />
            <span>Native Windows FileSystem Access API</span>
          </div>
        </div>
      </div>
    </div>
  );
};
