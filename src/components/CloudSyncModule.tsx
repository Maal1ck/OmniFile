import React, { useState } from 'react';
import {
  Cloud,
  RefreshCw,
  HardDrive,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeftRight,
  Shield,
  Layers,
  Settings,
} from 'lucide-react';
import {
  CloudAccount,
  CloudProvider,
  SyncMode,
  ConflictStrategy,
  AutoSyncInterval,
  SyncLogItem,
  VirtualFile,
} from '../types/fileSystem';
import { formatBytes, formatDate } from '../utils/fileHelpers';

interface CloudSyncModuleProps {
  files: VirtualFile[];
  onStartProgress: (title: string) => void;
  onUpdateProgress: (percent: number, item: string) => void;
  onFinishProgress: () => void;
}

export const CloudSyncModule: React.FC<CloudSyncModuleProps> = ({
  files,
  onStartProgress,
  onUpdateProgress,
  onFinishProgress,
}) => {
  const [accounts, setAccounts] = useState<CloudAccount[]>([
    {
      provider: 'google_drive',
      name: 'Google Drive',
      connected: true,
      accountEmail: 'user.desktop@gmail.com',
      targetRemoteFolder: 'My Drive/OmniFile_Sync',
      syncMode: 'two_way',
      conflictStrategy: 'local_priority',
      autoSyncInterval: '1h',
      storageUsedBytes: 48500000000, // 48.5 GB
      storageTotalBytes: 107374182400, // 100 GB
      lastSyncTime: Date.now() - 3600000 * 2, // 2 hours ago
    },
    {
      provider: 'onedrive',
      name: 'Microsoft OneDrive',
      connected: false,
      accountEmail: 'work.enterprise@outlook.com',
      targetRemoteFolder: 'OneDrive - Enterprise/OmniFile_Vault',
      syncMode: 'upload_backup',
      conflictStrategy: 'keep_both',
      autoSyncInterval: 'daily',
      storageUsedBytes: 124000000000,
      storageTotalBytes: 1099511627776, // 1 TB
      lastSyncTime: undefined,
    },
    {
      provider: 'dropbox',
      name: 'Dropbox',
      connected: false,
      accountEmail: undefined,
      targetRemoteFolder: 'Dropbox/Backups',
      syncMode: 'upload_backup',
      conflictStrategy: 'cloud_priority',
      autoSyncInterval: 'manual',
      storageUsedBytes: 1200000000,
      storageTotalBytes: 21474836480, // 20 GB
      lastSyncTime: undefined,
    },
  ]);

  const [activeProvider, setActiveProvider] = useState<CloudProvider>('google_drive');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncLogs, setSyncLogs] = useState<SyncLogItem[]>([
    {
      id: 'log-1',
      timestamp: Date.now() - 3600000 * 2,
      provider: 'google_drive',
      action: 'synced',
      fileName: 'Accounting/Invoices/Pending/Invoice_ACME_Corp_0089.pdf',
      status: 'success',
      details: 'Transferred 421 KB with MD5 checksum verification.',
    },
    {
      id: 'log-2',
      timestamp: Date.now() - 3600000 * 2.1,
      provider: 'google_drive',
      action: 'uploaded',
      fileName: 'Q3_Financial_Statement_Final.xlsx',
      status: 'success',
      details: 'Uploaded updated revision (142 KB).',
    },
    {
      id: 'log-3',
      timestamp: Date.now() - 3600000 * 24,
      provider: 'google_drive',
      action: 'conflict_resolved',
      fileName: 'client_consulting_agreement_v2.docx',
      status: 'warning',
      details: 'Local modification was newer; updated cloud copy.',
    },
  ]);

  const currentAccount = accounts.find((a) => a.provider === activeProvider)!;

  const handleToggleConnection = (provider: CloudProvider) => {
    setAccounts(
      accounts.map((acc) => {
        if (acc.provider === provider) {
          const willConnect = !acc.connected;
          return {
            ...acc,
            connected: willConnect,
            accountEmail: willConnect
              ? acc.accountEmail || `${provider}_sync@account.io`
              : undefined,
          };
        }
        return acc;
      })
    );
  };

  const handleUpdateAccount = (updates: Partial<CloudAccount>) => {
    setAccounts(
      accounts.map((acc) => {
        if (acc.provider === activeProvider) {
          return { ...acc, ...updates };
        }
        return acc;
      })
    );
  };

  const handleSyncNow = async () => {
    if (!currentAccount.connected) {
      alert('Please connect this cloud provider first.');
      return;
    }

    setIsSyncing(true);
    onStartProgress(`Synchronizing with ${currentAccount.name}...`);

    try {
      const syncBatch = files.slice(0, 10);
      for (let i = 0; i < syncBatch.length; i++) {
        const file = syncBatch[i];
        const percent = Math.round(((i + 1) / syncBatch.length) * 100);
        onUpdateProgress(percent, `Syncing: ${file.name}`);
        await new Promise((r) => setTimeout(r, 220));
      }

      // Add fresh log entries
      const newLogs: SyncLogItem[] = syncBatch.slice(0, 3).map((f, idx) => ({
        id: `log-${Date.now()}-${idx}`,
        timestamp: Date.now(),
        provider: activeProvider,
        action: currentAccount.syncMode === 'upload_backup' ? 'uploaded' : 'synced',
        fileName: f.relativePath,
        status: 'success',
        details: `Cloud replica updated in ${currentAccount.targetRemoteFolder}`,
      }));

      setSyncLogs((prev) => [...newLogs, ...prev]);

      // Update account last sync time
      handleUpdateAccount({
        lastSyncTime: Date.now(),
        storageUsedBytes: currentAccount.storageUsedBytes + 1500000,
      });
    } finally {
      setIsSyncing(false);
      onFinishProgress();
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Overview & Provider Switcher */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-800 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Cloud className="w-5 h-5 text-cyan-400" />
              <h2 className="text-lg font-bold text-white tracking-tight">Cloud Storage Synchronization</h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Synchronize, backup, and mirror your local organized folders with cloud providers and remote drives.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSyncNow}
              disabled={!currentAccount.connected || isSyncing}
              className="flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-40 rounded-lg transition-all cursor-pointer shadow-sm"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Synchronizing...' : 'Sync Now'}</span>
            </button>
          </div>
        </div>

        {/* Provider Cards */}
        <div className="pt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          {accounts.map((acc) => {
            const isCurrent = acc.provider === activeProvider;
            const percentUsed = Math.round((acc.storageUsedBytes / acc.storageTotalBytes) * 100);

            return (
              <div
                key={acc.provider}
                onClick={() => setActiveProvider(acc.provider)}
                className={`p-4 rounded-xl border transition-all cursor-pointer ${
                  isCurrent
                    ? 'bg-slate-800/90 border-cyan-500 shadow-md shadow-cyan-950/40'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <Cloud className={`w-5 h-5 ${acc.connected ? 'text-cyan-400' : 'text-slate-500'}`} />
                    <span className="font-semibold text-sm text-slate-100">{acc.name}</span>
                  </div>

                  <span
                    className={`text-[11px] font-mono px-2 py-0.5 rounded ${
                      acc.connected
                        ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/60'
                        : 'bg-slate-900 text-slate-500 border border-slate-800'
                    }`}
                  >
                    {acc.connected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>

                <div className="text-xs text-slate-400 mb-3 truncate">
                  {acc.connected ? acc.accountEmail : 'Click to configure and link'}
                </div>

                {/* Storage Quota Bar */}
                {acc.connected && (
                  <div className="space-y-1.5 pt-2 border-t border-slate-750">
                    <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                      <span>{formatBytes(acc.storageUsedBytes)}</span>
                      <span>{formatBytes(acc.storageTotalBytes)} ({percentUsed}%)</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full"
                        style={{ width: `${percentUsed}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Active Provider Configuration Deck */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white tracking-tight">
              {currentAccount.name} Sync Settings
            </h3>
          </div>

          <button
            type="button"
            onClick={() => handleToggleConnection(currentAccount.provider)}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              currentAccount.connected
                ? 'bg-rose-950/60 text-rose-300 border border-rose-800 hover:bg-rose-900/60'
                : 'bg-cyan-600 text-white hover:bg-cyan-500'
            }`}
          >
            {currentAccount.connected ? 'Disconnect Account' : 'Connect Account'}
          </button>
        </div>

        <div className="pt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Sync Direction */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-2">Sync Direction</label>
            <div className="space-y-2">
              {[
                {
                  id: 'two_way',
                  label: 'Two-Way Mirror',
                  desc: 'Sync local changes and fetch cloud changes',
                  icon: ArrowLeftRight,
                },
                {
                  id: 'upload_backup',
                  label: 'Upload / Backup Only',
                  desc: 'Pushes local changes without pulling cloud edits',
                  icon: ArrowUpRight,
                },
                {
                  id: 'download_mirror',
                  label: 'Download / Restore',
                  desc: 'Replaces local folder with latest cloud snapshot',
                  icon: ArrowDownLeft,
                },
              ].map((m) => {
                const Icon = m.icon;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleUpdateAccount({ syncMode: m.id as SyncMode })}
                    className={`w-full p-2.5 rounded-lg text-left text-xs transition-colors cursor-pointer border flex items-start gap-2.5 ${
                      currentAccount.syncMode === m.id
                        ? 'bg-slate-800 border-cyan-500 text-slate-100'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Icon className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-slate-200">{m.label}</div>
                      <div className="text-[11px] text-slate-500">{m.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Conflict Resolution & Folder Target */}
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Remote Cloud Folder
              </label>
              <input
                type="text"
                value={currentAccount.targetRemoteFolder}
                onChange={(e) => handleUpdateAccount({ targetRemoteFolder: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 text-slate-100 font-mono text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Conflict Resolution Strategy
              </label>
              <select
                value={currentAccount.conflictStrategy}
                onChange={(e) =>
                  handleUpdateAccount({ conflictStrategy: e.target.value as ConflictStrategy })
                }
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-3 py-2"
              >
                <option value="local_priority">Local Priority (Always overwrite cloud copy)</option>
                <option value="cloud_priority">Cloud Priority (Protect cloud revision)</option>
                <option value="keep_both">Keep Both (Append timestamp suffix on conflict)</option>
              </select>
            </div>
          </div>

          {/* Sync Frequency Schedule */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-2">Sync Schedule</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'manual', label: 'Manual Only' },
                { id: '15m', label: 'Every 15 Mins' },
                { id: '1h', label: 'Hourly' },
                { id: 'daily', label: 'Daily Backup' },
              ].map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() =>
                    handleUpdateAccount({ autoSyncInterval: s.id as AutoSyncInterval })
                  }
                  className={`p-2.5 rounded-lg text-center text-xs transition-colors cursor-pointer border ${
                    currentAccount.autoSyncInterval === s.id
                      ? 'bg-slate-800 border-cyan-500 text-cyan-300 font-semibold'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <div className="mt-4 p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs space-y-1">
              <div className="text-slate-500">Last Synced:</div>
              <div className="font-mono text-slate-200">
                {currentAccount.lastSyncTime
                  ? formatDate(currentAccount.lastSyncTime, 'YYYY-MM-DD HH:mm')
                  : 'Never'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sync Log Stream */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-semibold text-slate-100">Sync Execution Logs & Audits</span>
          </div>
          <button
            type="button"
            onClick={() => setSyncLogs([])}
            className="text-[11px] text-slate-500 hover:text-slate-300 cursor-pointer"
          >
            Clear Log
          </button>
        </div>

        <div className="overflow-x-auto max-h-60">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-2 px-4 w-36">Timestamp</th>
                <th className="py-2 px-4 w-28">Action</th>
                <th className="py-2 px-4">File Affected</th>
                <th className="py-2 px-4">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
              {syncLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-800/20">
                  <td className="py-2 px-4 text-slate-500 text-[11px] tabular-nums">
                    {formatDate(log.timestamp, 'YYYY-MM-DD HH:mm')}
                  </td>
                  <td className="py-2 px-4">
                    <span
                      className={`text-[11px] uppercase font-semibold ${
                        log.action === 'uploaded'
                          ? 'text-cyan-400'
                          : log.action === 'synced'
                          ? 'text-emerald-400'
                          : 'text-amber-400'
                      }`}
                    >
                      {log.action}
                    </span>
                  </td>
                  <td className="py-2 px-4 truncate max-w-xs text-slate-200 font-sans">
                    {log.fileName}
                  </td>
                  <td className="py-2 px-4 text-slate-400 font-sans text-[11px]">
                    {log.details}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
