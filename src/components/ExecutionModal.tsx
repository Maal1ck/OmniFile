import React from 'react';
import { Loader2, CheckCircle2 } from 'lucide-react';

interface ExecutionModalProps {
  isOpen: boolean;
  title: string;
  percent: number;
  currentItem: string;
  isComplete: boolean;
  onClose: () => void;
}

export const ExecutionModal: React.FC<ExecutionModalProps> = ({
  isOpen,
  title,
  percent,
  currentItem,
  isComplete,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          {isComplete ? (
            <div className="w-10 h-10 rounded-xl bg-emerald-950/80 border border-emerald-800 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-xl bg-cyan-950/80 border border-cyan-800 flex items-center justify-center text-cyan-400">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          )}
          <div>
            <h4 className="text-base font-bold text-white tracking-tight">{title}</h4>
            <p className="text-xs text-slate-400">
              {isComplete ? 'Operation completed successfully.' : 'Processing file pipeline...'}
            </p>
          </div>
        </div>

        {/* Progress Bar & Numeric Readout */}
        <div className="space-y-2.5 my-4">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-slate-300 font-medium truncate max-w-[260px] flex items-center gap-1.5">
              {!isComplete && <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />}
              <span>{currentItem || 'Processing pipeline...'}</span>
            </span>
            <span className="text-cyan-400 tabular-nums font-bold text-sm">{percent}%</span>
          </div>

          <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800 p-0.5 shadow-inner">
            <div
              className={`h-full transition-all duration-200 rounded-full ${
                isComplete
                  ? 'bg-emerald-400'
                  : 'bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 shadow-sm shadow-cyan-500/50'
              }`}
              style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
            />
          </div>

          <div className="flex justify-between items-center text-[11px] text-slate-500 font-mono pt-1">
            <span>{isComplete ? 'All items processed' : 'Active task running in background'}</span>
            <span>{percent === 100 ? 'Complete' : 'In Progress'}</span>
          </div>
        </div>

        {isComplete && (
          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
