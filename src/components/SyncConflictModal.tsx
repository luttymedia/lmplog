import React from 'react';
import { AlertCircle, Cloud, HardDrive, RefreshCw } from 'lucide-react';

interface SyncConflictModalProps {
  onMerge: () => void;
  onDiscardLocal: () => void;
  onDiscardCloud: () => void;
}

export const SyncConflictModal: React.FC<SyncConflictModalProps> = ({
  onMerge,
  onDiscardLocal,
  onDiscardCloud
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[#1e1e22] border border-red-500/30 rounded-3xl shadow-2xl overflow-hidden scale-105">
        <div className="p-6 text-center border-b border-white/5 relative">
          <div className="mx-auto w-12 h-12 bg-red-500/20 text-red-400 rounded-full flex items-center justify-center mb-4">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Sync Conflict Detected</h2>
          <p className="text-sm text-white/70">
            We found data in the cloud that conflicts with your current local offline data. How would you like to proceed?
          </p>
        </div>
        
        <div className="p-6 flex flex-col gap-3">
          <button
            onClick={onMerge}
            className="w-full flex items-center gap-3 p-4 rounded-xl bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 border border-orange-500/30 transition-colors text-left"
          >
            <RefreshCw className="w-5 h-5 flex-shrink-0" />
            <div>
              <div className="font-bold">Merge (Recommended)</div>
              <div className="text-xs opacity-80 mt-1">Combine your local data with your cloud data.</div>
            </div>
          </button>

          <button
            onClick={onDiscardLocal}
            className="w-full flex items-center gap-3 p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors text-left text-white"
          >
            <Cloud className="w-5 h-5 flex-shrink-0" />
            <div>
              <div className="font-bold">Use Cloud Data</div>
              <div className="text-xs opacity-60 mt-1">Delete local changes and pull everything from the cloud.</div>
            </div>
          </button>

          <button
            onClick={onDiscardCloud}
            className="w-full flex items-center gap-3 p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors text-left text-white"
          >
            <HardDrive className="w-5 h-5 flex-shrink-0" />
            <div>
              <div className="font-bold">Use Local Data</div>
              <div className="text-xs opacity-60 mt-1">Overwrite the cloud with your current local data.</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
