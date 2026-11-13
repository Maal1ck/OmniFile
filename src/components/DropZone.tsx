import React, { useRef, useState } from 'react';
import {
  UploadCloud,
  FolderOpen,
  FilePlus,
  ShieldCheck,
  HardDrive,
} from 'lucide-react';
import { VirtualFile } from '../types/fileSystem';
import {
  readFilesFromDataTransfer,
  parseFileList,
  getFileExtension,
  classifyFileCategory,
} from '../utils/fileHelpers';
import { useAppSettings } from '../context/AppSettingsContext';

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
  const { t } = useAppSettings();
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
      onStartProgress(t.dropzone.ingestingDrop);
      onUpdateProgress?.(5, t.dropzone.parsingEntries);
    }

    try {
      if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
        const extracted = await readFilesFromDataTransfer(
          e.dataTransfer.items,
          (percent, currentItem, count) => {
            onUpdateProgress?.(percent, `${currentItem} (${count} ${t.filesCount})`);
          }
        );
        if (extracted.length > 0) {
          onFilesAdded(extracted);
        }
      } else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const parsed = parseFileList(
          e.dataTransfer.files,
          (percent, currentItem, count) => {
            onUpdateProgress?.(percent, `${currentItem} (${count} ${t.filesCount})`);
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
        onStartProgress(t.dropzone.ingestingSelected);
      }
      const parsed = parseFileList(
        e.target.files,
        (percent, currentItem, count) => {
          onUpdateProgress?.(percent, `${currentItem} (${count} ${t.filesCount})`);
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
    if ('showDirectoryPicker' in window) {
      try {
        const dirHandle = await (window as unknown as {
          showDirectoryPicker: () => Promise<FileSystemDirectoryHandle>;
        }).showDirectoryPicker();

        if (onStartProgress) {
          onStartProgress(t.dropzone.ingestingDir(dirHandle.name));
        }

        const gatheredFiles: VirtualFile[] = [];
        let count = 0;
        let lastReport = 0;

        const processHandleQueue = async (
          handles: { handle: FileSystemDirectoryHandle; path: string }[]
        ) => {
          while (handles.length > 0) {
            const current = handles.shift();
            if (!current) break;

            const subHandles: { handle: FileSystemDirectoryHandle; path: string }[] = [];
            const filePromises: Promise<void>[] = [];

            for await (const entry of (current.handle as any).values()) {
              if (entry.kind === 'file') {
                const fileHandle = entry as unknown as FileSystemFileHandle;
                filePromises.push(
                  fileHandle.getFile().then((file) => {
                    count++;
                    const now = performance.now();
                    if (now - lastReport > 60) {
                      lastReport = now;
                      onUpdateProgress?.(
                        Math.min(98, Math.round((count / (count + 10)) * 100)),
                        `${file.name} (${count} ${t.dropzone.filesIndexedSuffix})`
                      );
                    }
                    const relativePath = current.path ? `${current.path}/${file.name}` : file.name;
                    const ext = getFileExtension(file.name);

                    gatheredFiles.push({
                      id: `native-${Date.now()}-${count}-${Math.random().toString(36).slice(2, 6)}`,
                      name: file.name,
                      relativePath,
                      size: file.size,
                      type: file.type,
                      extension: ext,
                      lastModified: file.lastModified,
                      category: classifyFileCategory(ext, file.name),
                      selected: true,
                      content: file,
                    });
                  })
                );
              } else if (entry.kind === 'directory') {
                const subDirHandle = entry as unknown as FileSystemDirectoryHandle;
                const newPath = current.path ? `${current.path}/${entry.name}` : entry.name;
                subHandles.push({ handle: subDirHandle, path: newPath });
              }
            }

            await Promise.all(filePromises);
            for (const sub of subHandles) {
              handles.push(sub);
            }
          }
        };

        await processHandleQueue([{ handle: dirHandle, path: dirHandle.name }]);
        if (gatheredFiles.length > 0) {
          onFilesAdded(gatheredFiles);
        }
        if (onFinishProgress) {
          onFinishProgress();
        }
        return;
      } catch (err) {
        if (onFinishProgress) onFinishProgress();
        if ((err as Error).name !== 'AbortError') {
          folderInputRef.current?.click();
        }
        return;
      }
    }

    folderInputRef.current?.click();
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
            ? t.dropzone.releaseTitle
            : hasFiles
            ? t.dropzone.addMoreTitle
            : t.dropzone.emptyTitle}
        </h3>

        <p className="text-xs text-slate-400 mb-6 max-w-md">
          {t.dropzone.subtitle}
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={handleOpenFolderNative}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg transition-colors cursor-pointer shadow-sm"
          >
            <FolderOpen className="w-4 h-4 text-cyan-400" />
            <span>{t.dropzone.selectFolder}</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-200 bg-slate-850 hover:bg-slate-800 border border-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            <FilePlus className="w-4 h-4 text-slate-400" />
            <span>{t.dropzone.selectFiles}</span>
          </button>
        </div>

        <div className="mt-6 flex items-center gap-6 text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>{t.dropzone.zeroUpload}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5 text-blue-400" />
            <span>{t.dropzone.nativeApi}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
