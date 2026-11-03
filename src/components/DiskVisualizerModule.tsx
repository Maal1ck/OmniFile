import React, { useMemo, useState } from 'react';
import {
  PieChart,
  HardDrive,
  FolderOpen,
  File,
  Layers,
  ChevronRight,
  Filter,
  Download,
} from 'lucide-react';
import { VirtualFile, TreemapNode, FileCategory } from '../types/fileSystem';
import { buildDirectoryTreemap, CATEGORY_COLORS } from '../utils/groundbreakingEngines';
import { formatBytes } from '../utils/fileHelpers';

interface DiskVisualizerModuleProps {
  files: VirtualFile[];
  onFilterByCategory?: (category: FileCategory) => void;
}

export const DiskVisualizerModule: React.FC<DiskVisualizerModuleProps> = ({
  files,
  onFilterByCategory,
}) => {
  const rootNode = useMemo(() => {
    return buildDirectoryTreemap(files);
  }, [files]);

  const [currentPath, setCurrentPath] = useState<string>('');
  const [selectedNode, setSelectedNode] = useState<TreemapNode | null>(null);

  // Get active directory node
  const activeDirectory = useMemo(() => {
    if (!currentPath) return rootNode;

    const parts = currentPath.split('/').filter(Boolean);
    let curr: TreemapNode = rootNode;

    for (const part of parts) {
      const match = curr.children?.find((c) => c.name === part);
      if (match) curr = match;
      else break;
    }
    return curr;
  }, [rootNode, currentPath]);

  // Breakdown by category for high-level storage stats
  const categoryBreakdown = useMemo(() => {
    const map = new Map<FileCategory, { count: number; size: number }>();
    files.forEach((f) => {
      const existing = map.get(f.category) || { count: 0, size: 0 };
      existing.count += 1;
      existing.size += f.size;
      map.set(f.category, existing);
    });

    return Array.from(map.entries()).sort((a, b) => b[1].size - a[1].size);
  }, [files]);

  const handleDrillDown = (node: TreemapNode) => {
    if (node.children && node.children.length > 0) {
      setCurrentPath(node.path);
      setSelectedNode(null);
    } else {
      setSelectedNode(node);
    }
  };

  const handleNavigateBreadcrumb = (path: string) => {
    setCurrentPath(path);
    setSelectedNode(null);
  };

  const breadcrumbs = useMemo(() => {
    if (!currentPath) return [{ name: 'Root Workspace', path: '' }];
    const parts = currentPath.split('/').filter(Boolean);
    const crumbs = [{ name: 'Root Workspace', path: '' }];
    let accum = '';
    for (const p of parts) {
      accum = accum ? `${accum}/${p}` : p;
      crumbs.push({ name: p, path: accum });
    }
    return crumbs;
  }, [currentPath]);

  return (
    <div className="space-y-6">
      {/* Control Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-800 gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-md shadow-emerald-950/40 shrink-0">
              <PieChart className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  Interactive Disk Space Treemap & Heatmap
                </h2>
                <span className="text-[11px] font-mono text-emerald-400 px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/60 font-semibold">
                  WinDirStat Mode
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                Visually explore folder hierarchy scale, locate massive storage hogs, and pinpoint nested subdirectory payloads with immediate proportional drill-downs.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
            <span>Total Inspected:</span>
            <span className="text-emerald-400 font-bold tabular-nums text-sm">
              {rootNode.formattedSize}
            </span>
          </div>
        </div>

        {/* Category Storage Proportions Bar */}
        <div className="pt-6">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2 font-medium">
            <span>Storage Allocation by Format</span>
            <span className="font-mono tabular-nums text-slate-500">{files.length} total items</span>
          </div>

          {/* Proportional Strip */}
          <div className="w-full h-3 rounded-full bg-slate-950 overflow-hidden flex shadow-inner">
            {categoryBreakdown.map(([cat, data]) => {
              const pct = rootNode.size > 0 ? (data.size / rootNode.size) * 100 : 0;
              if (pct < 0.5) return null;
              return (
                <div
                  key={cat}
                  style={{
                    width: `${pct}%`,
                    backgroundColor: CATEGORY_COLORS[cat] || '#64748b',
                  }}
                  title={`${cat}: ${formatBytes(data.size)} (${pct.toFixed(1)}%)`}
                  className="h-full hover:opacity-80 transition-opacity cursor-pointer"
                />
              );
            })}
          </div>

          {/* Legend Chips */}
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
            {categoryBreakdown.slice(0, 6).map(([cat, data]) => {
              const pct = rootNode.size > 0 ? (data.size / rootNode.size) * 100 : 0;
              return (
                <div key={cat} className="flex items-center gap-1.5 text-slate-300">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: CATEGORY_COLORS[cat] || '#64748b' }}
                  />
                  <span className="capitalize">{cat}:</span>
                  <span className="font-mono tabular-nums text-slate-400">
                    {formatBytes(data.size)} ({pct.toFixed(0)}%)
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Interactive Treemap Canvas Viewport */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
        {/* Breadcrumb Navigator */}
        <div className="flex items-center gap-1.5 text-xs text-slate-400 overflow-x-auto pb-2 border-b border-slate-800">
          <FolderOpen className="w-4 h-4 text-emerald-400 shrink-0 mr-1" />
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={crumb.path}>
              {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />}
              <button
                type="button"
                onClick={() => handleNavigateBreadcrumb(crumb.path)}
                className={`font-mono transition-colors whitespace-nowrap cursor-pointer hover:underline ${
                  idx === breadcrumbs.length - 1
                    ? 'text-emerald-300 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {crumb.name}
              </button>
            </React.Fragment>
          ))}
        </div>

        {/* Proportional Grid Nodes in Current Directory */}
        <div className="pt-2">
          <div className="text-xs text-slate-400 mb-3 flex items-center justify-between">
            <span>
              Contents of <span className="font-mono text-emerald-300">{activeDirectory.name}</span> ({activeDirectory.children?.length || 0} nodes)
            </span>
            <span className="font-mono text-slate-500 tabular-nums">
              Folder total: {activeDirectory.formattedSize}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {activeDirectory.children?.map((child) => {
              const isFolder = !!(child.children && child.children.length > 0);
              const parentSize = activeDirectory.size || 1;
              const ratio = Math.round((child.size / parentSize) * 100);

              return (
                <div
                  key={child.path}
                  onClick={() => handleDrillDown(child)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                    isFolder
                      ? 'bg-slate-950/80 border-slate-800 hover:border-emerald-500 hover:bg-slate-850'
                      : 'bg-slate-950/50 border-slate-850 hover:border-cyan-500'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 truncate">
                      {isFolder ? (
                        <FolderOpen className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <File className="w-4 h-4 text-cyan-400 shrink-0" />
                      )}
                      <span className="font-medium text-xs text-slate-200 truncate">
                        {child.name}
                      </span>
                    </div>

                    <span className="text-[10px] font-mono tabular-nums text-slate-500 shrink-0">
                      {ratio}%
                    </span>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-slate-850/60">
                    <div className="flex justify-between items-center text-[11px] font-mono text-slate-400">
                      <span className="text-emerald-400 font-semibold">{child.formattedSize}</span>
                      <span>{isFolder ? `${child.fileCount} items` : `.${child.extension}`}</span>
                    </div>

                    <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${Math.min(100, Math.max(5, ratio))}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected File Details Box */}
        {selectedNode && (
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between text-xs text-slate-300">
            <div className="flex items-center gap-3">
              <File className="w-5 h-5 text-cyan-400" />
              <div>
                <div className="font-semibold text-slate-100">{selectedNode.name}</div>
                <div className="font-mono text-slate-500 text-[11px]">{selectedNode.path}</div>
              </div>
            </div>

            <div className="flex items-center gap-4 font-mono">
              <span className="text-emerald-400 font-semibold">{selectedNode.formattedSize}</span>
              <button
                type="button"
                onClick={() => setSelectedNode(null)}
                className="text-slate-500 hover:text-slate-300 cursor-pointer"
              >
                ✕
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
