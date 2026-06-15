import React, { useState, useEffect } from 'react';
import { Session } from '../types';
import { AutoGrowingTextarea } from './AutoGrowingTextarea';

interface SessionInfoModalProps {
  initialData: Partial<Session>;
  onConfirm: (data: Partial<Session>) => void;
  onCancel: () => void;
  isNew?: boolean;
}

export function SessionInfoModal({ initialData, onConfirm, onCancel, isNew = false }: SessionInfoModalProps) {
  const [data, setData] = useState<Partial<Session>>(initialData);

  // Sync initialData if it changes while modal is open (unlikely, but safe)
  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  const handleChange = (changes: Partial<Session>) => {
    setData(prev => ({ ...prev, ...changes }));
  };

  const handleSave = () => {
    // Basic validation
    if (!data.title?.trim()) {
      handleChange({ title: 'New Session' });
    }
    onConfirm(data);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[80] p-6" onClick={onCancel}>
      <div className="bg-[#1e1e22]/95 border border-white/10 p-6 rounded-3xl max-w-md w-full shadow-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>

        <div className="flex-none pb-4 border-b border-white/10 mb-4">
          <h2 className="text-xl font-bold text-white">
            {isNew ? 'New Session' : 'General Info'}
          </h2>
          <p className="text-white/40 text-sm mt-1">
            {isNew ? 'Enter details for the new recording session.' : 'Edit session details.'}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 space-y-4">
          <div>
            <label className="block text-xs font-medium text-white/60 mb-1">Title</label>
            <input type="text" className="w-full px-3 py-2.5 bg-white/5 rounded-xl text-sm border border-transparent focus:border-brand/50 outline-none text-white placeholder-white/20 transition-colors"
              value={data.title || ''} onChange={(e) => handleChange({ title: e.target.value })} placeholder="Session Title" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-white/60 mb-1">Date</label>
              <input type="date" className="w-full px-3 py-2.5 bg-white/5 rounded-xl text-sm border border-transparent focus:border-brand/50 outline-none text-white transition-colors"
                value={new Date(data.date || Date.now()).toISOString().split('T')[0]}
                onChange={(e) => handleChange({ date: e.target.valueAsNumber || Date.now() })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/60 mb-1">Location</label>
              <input type="text" className="w-full px-3 py-2.5 bg-white/5 rounded-xl text-sm border border-transparent focus:border-brand/50 outline-none text-white placeholder-white/20 transition-colors"
                value={data.location || ''} onChange={(e) => handleChange({ location: e.target.value })} placeholder="LMP Studio" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-white/60 mb-1">Equipment</label>
            <input type="text" className="w-full px-3 py-2.5 bg-white/5 rounded-xl text-sm border border-transparent focus:border-brand/50 outline-none text-white placeholder-white/20 transition-colors"
              value={data.equipment || ''} onChange={(e) => handleChange({ equipment: e.target.value })} placeholder="Camera, Lens, Mic..." />
          </div>

          <div>
            <label className="block text-xs font-medium text-white/60 mb-1">Camera Settings</label>
            <input type="text" className="w-full px-3 py-2.5 bg-white/5 rounded-xl text-sm border border-transparent focus:border-brand/50 outline-none text-white placeholder-white/20 transition-colors"
              value={data.cameraSettings || ''} onChange={(e) => handleChange({ cameraSettings: e.target.value })} placeholder="4K, 60fps, ISO 800..." />
          </div>

          <div>
            <label className="block text-xs font-medium text-white/60 mb-1">General Notes</label>
            <AutoGrowingTextarea
              value={data.generalNotes || ''}
              onChange={(e) => handleChange({ generalNotes: e.target.value })}
              placeholder="Lighting notes, choreo details..."
              className="w-full px-3 py-2.5 bg-white/5 rounded-xl text-sm border border-transparent focus:border-brand/50 outline-none min-h-[80px] text-white placeholder-white/20 transition-colors"
            />
            <label className="flex items-center gap-2 mt-2 cursor-pointer group w-fit">
              <div className="relative">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={data.showGeneralNotesInReview || false}
                  onChange={(e) => handleChange({ showGeneralNotesInReview: e.target.checked })}
                />
                <div className="w-9 h-5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand"></div>
              </div>
              <span className="text-xs font-medium text-white/60 group-hover:text-white/80 transition-colors">Show in Review Mode</span>
            </label>
          </div>
        </div>

        <div className="flex-none pt-6 mt-2 flex gap-3 justify-end items-center border-t border-white/10">
          <button onClick={onCancel} className="px-5 py-2.5 rounded-xl font-bold bg-white/10 hover:bg-white/20 text-white min-h-[44px] text-sm transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} className="px-5 py-2.5 rounded-xl font-bold bg-brand hover:bg-brand-light text-black min-h-[44px] text-sm transition-colors shadow-[0_0_15px_rgba(45,212,191,0.2)]">
            {isNew ? 'Create Session' : 'Save Details'}
          </button>
        </div>
      </div>
    </div>
  );
}
