import React, { useState, useEffect } from 'react';
import { Session } from '../types';
import { AutoGrowingTextarea } from './AutoGrowingTextarea';
import { Save, FolderOpen, Check, Trash2 } from 'lucide-react';

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

  // Template states
  const [locationTemplates, setLocationTemplates] = useState<string[]>(() => JSON.parse(localStorage.getItem('lmplog_template_location') || '[]'));
  const [equipmentTemplates, setEquipmentTemplates] = useState<string[]>(() => JSON.parse(localStorage.getItem('lmplog_template_equipment') || '[]'));
  const [cameraSettingsTemplates, setCameraSettingsTemplates] = useState<string[]>(() => JSON.parse(localStorage.getItem('lmplog_template_cameraSettings') || '[]'));

  const [activeDropdown, setActiveDropdown] = useState<'location' | 'equipment' | 'cameraSettings' | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<'location' | 'equipment' | 'cameraSettings' | null>(null);

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

  const handleSaveTemplate = (field: 'location' | 'equipment' | 'cameraSettings') => {
    const value = data[field]?.trim();
    if (!value) return;

    let templates: string[];
    let setTemplates: React.Dispatch<React.SetStateAction<string[]>>;
    let storageKey = `lmplog_template_${field}`;

    if (field === 'location') { templates = locationTemplates; setTemplates = setLocationTemplates; }
    else if (field === 'equipment') { templates = equipmentTemplates; setTemplates = setEquipmentTemplates; }
    else { templates = cameraSettingsTemplates; setTemplates = setCameraSettingsTemplates; }

    if (!templates.includes(value)) {
      const newTemplates = [...templates, value];
      setTemplates(newTemplates);
      localStorage.setItem(storageKey, JSON.stringify(newTemplates));
    }
    
    setSaveSuccess(field);
    setTimeout(() => setSaveSuccess(null), 1500);
  };

  const handleDeleteTemplate = (field: 'location' | 'equipment' | 'cameraSettings', value: string, e: React.MouseEvent) => {
    e.stopPropagation();
    let templates: string[];
    let setTemplates: React.Dispatch<React.SetStateAction<string[]>>;
    let storageKey = `lmplog_template_${field}`;

    if (field === 'location') { templates = locationTemplates; setTemplates = setLocationTemplates; }
    else if (field === 'equipment') { templates = equipmentTemplates; setTemplates = setEquipmentTemplates; }
    else { templates = cameraSettingsTemplates; setTemplates = setCameraSettingsTemplates; }

    const newTemplates = templates.filter(t => t !== value);
    setTemplates(newTemplates);
    localStorage.setItem(storageKey, JSON.stringify(newTemplates));
  };

  const renderTemplateHeader = (field: 'location' | 'equipment' | 'cameraSettings', label: string) => (
    <div className="flex items-center justify-between mb-1">
      <label className="block text-xs font-medium text-white/60">{label}</label>
      <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
        <button onClick={() => handleSaveTemplate(field)} className="text-white/40 hover:text-white transition-colors" title="Save as template">
          {saveSuccess === field ? <Check size={14} className="text-green-400" /> : <Save size={14} />}
        </button>
        <button onClick={() => setActiveDropdown(activeDropdown === field ? null : field)} className={`transition-colors ${activeDropdown === field ? 'text-brand' : 'text-white/40 hover:text-white'}`} title="Load template">
          <FolderOpen size={14} />
        </button>
      </div>
    </div>
  );

  const renderTemplateDropdown = (field: 'location' | 'equipment' | 'cameraSettings') => {
    if (activeDropdown !== field) return null;
    let templates: string[];
    if (field === 'location') templates = locationTemplates;
    else if (field === 'equipment') templates = equipmentTemplates;
    else templates = cameraSettingsTemplates;

    return (
      <div className="absolute top-[calc(100%+4px)] left-0 right-0 bg-[#2a2a30] border border-white/10 rounded-xl shadow-xl z-20 overflow-hidden" onClick={e => e.stopPropagation()}>
        {templates.length === 0 ? (
          <div className="p-3 text-xs text-white/40 text-center">No templates saved</div>
        ) : (
          <ul className="max-h-40 overflow-y-auto">
            {templates.map((t, i) => (
              <li key={i} className="flex items-center justify-between px-3 py-2 hover:bg-white/5 cursor-pointer text-sm text-white group" onClick={() => { handleChange({ [field]: t }); setActiveDropdown(null); }}>
                <span className="truncate">{t}</span>
                <button onClick={(e) => handleDeleteTemplate(field, t, e)} className="text-white/40 hover:text-red-400 transition-all p-1">
                  <Trash2 size={12} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[80] p-6" onClick={onCancel}>
      <div className="bg-[#1e1e22]/95 border border-white/10 p-6 rounded-3xl max-w-md w-full shadow-2xl flex flex-col max-h-[90vh]" onClick={e => { e.stopPropagation(); setActiveDropdown(null); }}>

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
            <div className="relative">
              {renderTemplateHeader('location', 'Location')}
              <input type="text" className="w-full px-3 py-2.5 bg-white/5 rounded-xl text-sm border border-transparent focus:border-brand/50 outline-none text-white placeholder-white/20 transition-colors"
                value={data.location || ''} onChange={(e) => handleChange({ location: e.target.value })} placeholder="LMP Studio" />
              {renderTemplateDropdown('location')}
            </div>
          </div>

          <div className="relative">
            {renderTemplateHeader('equipment', 'Equipment')}
            <input type="text" className="w-full px-3 py-2.5 bg-white/5 rounded-xl text-sm border border-transparent focus:border-brand/50 outline-none text-white placeholder-white/20 transition-colors"
              value={data.equipment || ''} onChange={(e) => handleChange({ equipment: e.target.value })} placeholder="Camera, Lens, Mic..." />
            {renderTemplateDropdown('equipment')}
          </div>

          <div className="relative">
            {renderTemplateHeader('cameraSettings', 'Camera Settings')}
            <input type="text" className="w-full px-3 py-2.5 bg-white/5 rounded-xl text-sm border border-transparent focus:border-brand/50 outline-none text-white placeholder-white/20 transition-colors"
              value={data.cameraSettings || ''} onChange={(e) => handleChange({ cameraSettings: e.target.value })} placeholder="4K, 60fps, ISO 800..." />
            {renderTemplateDropdown('cameraSettings')}
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
