import React, { useState, useEffect, useRef } from 'react';
import { Session, Clip, Marker, SessionMedia } from '../types';
import { db } from '../lib/db';
import { AutoGrowingTextarea } from './AutoGrowingTextarea';
import { CustomSelect } from './CustomSelect';
import { Trash2 } from 'lucide-react';

// Simple unique ID generator
const generateId = () => Math.random().toString(36).substring(2, 15);

interface VideoLoggerProps {
  session: Session;
  updateSession: (id: string, changes: Partial<Session>) => void;
  onBack: () => void;
  showToast?: (msg: string, isError?: boolean) => void;
  sessionMedia: SessionMedia[];
  onOpenGallery: () => void;
}

export default function VideoLogger({
  session,
  updateSession,
  onBack,
  showToast,
  sessionMedia,
  onOpenGallery
}: VideoLoggerProps) {
  const [clips, setClips] = useState<Clip[]>([]);
  const [reviewMode, setReviewMode] = useState(false);
  const [filterType, setFilterType] = useState<string>('All');
  const [clipToDelete, setClipToDelete] = useState<string | null>(null);
  const [markerToDelete, setMarkerToDelete] = useState<{clipId: string, markerId: string} | null>(null);
  const [expandedClips, setExpandedClips] = useState<Record<string, boolean>>({});
  
  // Real-time ticker for running clips
  const [, setTick] = useState(0);

  useEffect(() => {
    // Load clips for this session
    db.getSessionClips(session.id).then(loadedClips => {
      // Sort by start time if available, or keep existing order
      setClips(loadedClips.sort((a, b) => (a.startedAt || 0) - (b.startedAt || 0)));
    });
  }, [session.id]);

  useEffect(() => {
    // Ticker to force re-render every second to update running timers
    const interval = setInterval(() => {
      setTick(t => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const saveClip = async (clip: Clip) => {
    await db.saveClip(clip);
    setClips(prev => {
      const idx = prev.findIndex(c => c.id === clip.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = clip;
        return next;
      }
      return [...prev, clip];
    });
  };

  const handleAddClip = async () => {
    const newClip: Clip = {
      id: `clip-${Date.now()}`,
      sessionId: session.id,
      title: `Take ${clips.length + 1}`,
      startedAt: null,
      endedAt: null,
      markers: []
    };
    await saveClip(newClip);
  };

  const toggleTimer = async (clip: Clip) => {
    if (clip.startedAt && !clip.endedAt) {
      // Stop timer
      const endedClip = { ...clip, endedAt: Date.now() };
      await saveClip(endedClip);
    } else if (!clip.startedAt) {
      // Start timer
      const startedClip = { ...clip, startedAt: Date.now() };
      await saveClip(startedClip);
    }
  };

  const addMarker = async (clip: Clip) => {
    if (!clip.startedAt) return;
    const inTime = Date.now() - clip.startedAt;
    
    const newMarker: Marker = {
      id: `m-${Date.now()}`,
      inTime,
      type: 'Note',
      content: '',
      isResolved: false
    };

    const updatedClip = {
      ...clip,
      markers: [...clip.markers, newMarker]
    };
    await saveClip(updatedClip);
  };

  const updateMarker = async (clipId: string, markerId: string, changes: Partial<Marker>) => {
    const clip = clips.find(c => c.id === clipId);
    if (!clip) return;

    const updatedMarkers = clip.markers.map(m => m.id === markerId ? { ...m, ...changes } : m);
    const updatedClip = { ...clip, markers: updatedMarkers };
    await saveClip(updatedClip);
  };

  const markOutTime = async (clipId: string, markerId: string) => {
    const clip = clips.find(c => c.id === clipId);
    if (!clip || !clip.startedAt) return;
    
    const outTime = Date.now() - clip.startedAt;
    await updateMarker(clipId, markerId, { outTime });
  };

  const executeDeleteMarker = async (clipId: string, markerId: string) => {
    const clip = clips.find(c => c.id === clipId);
    if (!clip) return;
    const updatedClip = { ...clip, markers: clip.markers.filter(m => m.id !== markerId) };
    await saveClip(updatedClip);
    setMarkerToDelete(null);
  };
  const deleteMarker = (clipId: string, markerId: string) => setMarkerToDelete({clipId, markerId});

  const executeDeleteClip = async (clipId: string) => {
    await db.deleteClip(clipId);
    setClips(prev => prev.filter(c => c.id !== clipId));
    setClipToDelete(null);
  };
  const deleteClip = (clipId: string) => setClipToDelete(clipId);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const parseTime = (timeStr: string): number => {
    const parts = timeStr.split(':').map(Number);
    let totalSeconds = 0;
    if (parts.length === 3) {
      totalSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
      totalSeconds = parts[0] * 60 + parts[1];
    } else if (parts.length === 1) {
      totalSeconds = parts[0];
    }
    return isNaN(totalSeconds) ? 0 : totalSeconds * 1000;
  };

  // --- REVIEW MODE ---
  if (reviewMode) {
    let allMarkers = clips.flatMap(c => c.markers.map(m => ({ ...m, clipTitle: c.title, clipId: c.id })));
    if (filterType !== 'All') {
      allMarkers = allMarkers.filter(m => m.type === filterType);
    }
    // Sort chronologically across session (approximate based on clip start + marker inTime)
    allMarkers.sort((a, b) => {
      const aStart = clips.find(c => c.id === a.clipId)?.startedAt || 0;
      const bStart = clips.find(c => c.id === b.clipId)?.startedAt || 0;
      return (aStart + a.inTime) - (bStart + b.inTime);
    });

    return (
      <div className="flex flex-col h-full bg-transparent relative">
        <header className="flex-none bg-white/5 p-4 shadow-sm z-10 flex items-center gap-3">
          <button onClick={() => setReviewMode(false)} className="p-2 -ml-2 text-white/40 hover:text-white/80 rounded-full hover:bg-white/10 transition-colors">
             &larr; Back
          </button>
          <h1 className="flex-1 font-bold text-white text-lg">Review Mode</h1>
          <div className="w-32">
            <CustomSelect
              value={filterType}
              onChange={(val) => setFilterType(val)}
              options={[
                {value: 'All', label: 'All Types'},
                {value: 'Cut', label: 'Cut'},
                {value: 'Zoom', label: 'Zoom'},
                {value: 'Note', label: 'Note'}
              ]}
              position="relative"
            />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 space-y-3">
          {allMarkers.length === 0 ? (
            <div className="text-center text-white/40 mt-10">No markers found.</div>
          ) : (
            allMarkers.map(m => (
              <div key={m.id} className={`bg-black/20 p-3 rounded-2xl shadow-sm border ${m.isResolved ? 'border-green-500/30 bg-green-500/10' : 'border-white/10'} flex gap-3 items-start transition-colors`}>
                <input 
                  type="checkbox" 
                  className="mt-1 w-5 h-5 rounded border-white/20 text-brand focus:ring-brand/50 cursor-pointer"
                  checked={!!m.isResolved}
                  onChange={(e) => updateMarker(m.clipId, m.id, { isResolved: e.target.checked })}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold px-2 py-0.5 bg-white/10 text-white/60 rounded-md">
                      {m.clipTitle}
                    </span>
                    <span className="text-xs font-medium text-white/40">
                      {formatTime(m.inTime)} {m.outTime ? ` - ${formatTime(m.outTime)}` : ''}
                    </span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                      m.type === 'Cut' ? 'bg-red-500/20 text-red-400' :
                      m.type === 'Zoom' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-orange-500/20 text-orange-400'
                    }`}>{m.type}</span>
                  </div>
                  <div className={`text-sm ${m.isResolved ? 'text-white/40 line-through' : 'text-white/90'}`}>
                    {m.content || <span className="italic text-white/20">No notes</span>}
                  </div>
                </div>
              </div>
            ))
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-transparent relative pb-20">
      <main className="flex-1 space-y-6">
        
        <div className="flex justify-end">
          <button onClick={() => setReviewMode(true)} className="px-4 py-2 bg-white/5 text-white/90 text-sm font-medium rounded-full shadow-sm hover:bg-white/10 transition-colors border border-white/10">
            Open Review Mode
          </button>
        </div>

        {/* CLIPS SECTION */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
             <h2 className="text-sm font-bold text-white/40 uppercase tracking-wider">Clips ({clips.length})</h2>
             <button onClick={handleAddClip} className="text-sm font-medium text-brand hover:text-brand-light bg-brand/10 px-3 py-1 rounded-full">
               + Add Clip
             </button>
          </div>

          {clips.length === 0 ? (
            <div className="text-center py-10 text-white/40 bg-black/20 border border-dashed border-white/20 rounded-3xl">
               No clips yet. Add one to start logging!
            </div>
          ) : (
            clips.map((clip, i) => {
              const isRunning = clip.startedAt && !clip.endedAt;
              let elapsed = 0;
              if (clip.startedAt) {
                elapsed = clip.endedAt ? (clip.endedAt - clip.startedAt) : (Date.now() - clip.startedAt);
              }

              return (
                <div key={clip.id} className="bg-black/20 rounded-3xl shadow-sm border border-white/10 overflow-hidden">
                  {/* Clip Header */}
                  <div 
                    className="p-3 border-b border-white/5 flex items-center justify-between bg-white/5 cursor-pointer hover:bg-white/10 transition-colors"
                    onClick={() => setExpandedClips(prev => ({ ...prev, [clip.id]: prev[clip.id] === false ? true : false }))}
                  >
                    <input 
                      type="text" 
                      className="font-semibold text-white bg-transparent outline-none flex-1 cursor-text"
                      value={clip.title}
                      onClick={e => e.stopPropagation()}
                      onChange={(e) => {
                        const updated = { ...clip, title: e.target.value };
                        saveClip(updated);
                      }}
                    />
                    <div className="flex items-center gap-3">
                      <button onClick={(e) => { e.stopPropagation(); deleteClip(clip.id); }} className="text-white/20 hover:text-red-500 p-1">✕</button>
                      <span className="text-white/40 text-xs w-4 text-center">{expandedClips[clip.id] === false ? '▼' : '▲'}</span>
                    </div>
                  </div>

                  {expandedClips[clip.id] !== false && (
                    <div className="p-4 space-y-4">
                      {/* Timer Control */}
                    <div className="flex items-center justify-between bg-white/5 p-2 rounded-2xl">
                       <div className="flex items-center gap-3">
                         <button 
                           onClick={() => toggleTimer(clip)}
                           className={`w-12 h-12 flex items-center justify-center rounded-full shadow-sm transition-all ${
                             isRunning ? 'bg-red-500/20 text-red-500 animate-pulse' : 'bg-black/40 text-white'
                           }`}
                         >
                           {isRunning ? '⏹' : '▶'}
                         </button>
                         <div>
                           <div className="text-2xl font-mono tracking-tight font-light text-white/90">
                             {formatTime(elapsed)}
                           </div>
                           <div className="text-[10px] uppercase font-bold text-white/40 tracking-widest">
                             {isRunning ? 'Recording' : (clip.endedAt ? 'Ended' : 'Ready')}
                           </div>
                         </div>
                       </div>
                       
                       <button 
                         disabled={!isRunning}
                         onClick={() => addMarker(clip)}
                         className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${
                           isRunning ? 'bg-brand text-black shadow-md hover:bg-brand-light active:scale-95' : 'bg-white/10 text-white/40 cursor-not-allowed'
                         }`}
                       >
                         + Marker
                       </button>
                    </div>

                    {/* Markers List */}
                    {clip.markers.length > 0 && (
                      <div className="space-y-2 mt-4">
                        {clip.markers.map(marker => (
                          <div key={marker.id} className="flex flex-col gap-2 p-3 bg-white/5 rounded-2xl border border-white/10">
                            <div className="flex items-center gap-2">
                               <input 
                                 type="text" 
                                 className="text-xs font-mono font-medium text-white/90 bg-black/40 px-2 py-1 rounded-md shadow-sm w-16 text-center border border-transparent outline-none focus:border-brand/50 transition-colors"
                                 value={formatTime(marker.inTime)}
                                 onChange={(e) => updateMarker(clip.id, marker.id, { inTime: parseTime(e.target.value) })}
                               />
                               {marker.outTime ? (
                                 <>
                                  <span className="text-white/40">-</span>
                                  <input 
                                    type="text" 
                                    className="text-xs font-mono font-medium text-white/90 bg-black/40 px-2 py-1 rounded-md shadow-sm w-16 text-center border border-transparent outline-none focus:border-brand/50 transition-colors"
                                    value={formatTime(marker.outTime)}
                                    onChange={(e) => updateMarker(clip.id, marker.id, { outTime: parseTime(e.target.value) })}
                                  />
                                 </>
                               ) : null}
                               {!marker.outTime && isRunning && (
                                 <button onClick={() => markOutTime(clip.id, marker.id)} className="text-xs font-bold text-brand bg-brand/10 px-2 py-1 rounded-md hover:bg-brand/20">
                                   Set Out
                                 </button>
                               )}
                               
                               <div className="ml-auto w-24">
                                 <CustomSelect
                                   value={marker.type}
                                   onChange={(val) => updateMarker(clip.id, marker.id, { type: val as any })}
                                   options={[
                                     {value: 'Cut', label: 'Cut'},
                                     {value: 'Zoom', label: 'Zoom'},
                                     {value: 'Note', label: 'Note'}
                                   ]}
                                   position="relative"
                                 />
                               </div>

                               <button onClick={() => deleteMarker(clip.id, marker.id)} className="text-white/20 hover:text-red-500 ml-1">✕</button>
                            </div>
                            
                            <input 
                               type="text" 
                               placeholder="Add details..."
                               className="w-full bg-black/20 border border-white/20 rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-brand/50 transition-colors"
                               value={marker.content}
                               onChange={(e) => updateMarker(clip.id, marker.id, { content: e.target.value })}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
            })
          )}
        </section>
      </main>

      {/* Modals */}
      {clipToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[70] p-6" onClick={() => setClipToDelete(null)}>
          <div className="bg-[#1e1e22]/95 border border-white/10 p-8 rounded-3xl max-w-sm w-full space-y-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold flex items-center gap-2 text-red-400">
              <Trash2 className="w-5 h-5 text-red-500" />
              Delete Clip?
            </h3>
            <p className="text-white/70 text-sm">This will permanently delete the clip and all its markers.</p>
            <div className="flex gap-3 justify-end items-center mt-6">
              <button onClick={() => setClipToDelete(null)} className="px-5 py-2.5 rounded-xl font-bold bg-white/10 hover:bg-white/20 text-white min-h-[44px] text-xs transition-colors">Cancel</button>
              <button onClick={() => executeDeleteClip(clipToDelete)} className="px-5 py-2.5 rounded-xl font-bold bg-red-600 hover:bg-red-700 text-white min-h-[44px] text-xs transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}

      {markerToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[70] p-6" onClick={() => setMarkerToDelete(null)}>
          <div className="bg-[#1e1e22]/95 border border-white/10 p-8 rounded-3xl max-w-sm w-full space-y-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold flex items-center gap-2 text-red-400">
              <Trash2 className="w-5 h-5 text-red-500" />
              Delete Marker?
            </h3>
            <p className="text-white/70 text-sm">This will remove the marker from the clip.</p>
            <div className="flex gap-3 justify-end items-center mt-6">
              <button onClick={() => setMarkerToDelete(null)} className="px-5 py-2.5 rounded-xl font-bold bg-white/10 hover:bg-white/20 text-white min-h-[44px] text-xs transition-colors">Cancel</button>
              <button onClick={() => executeDeleteMarker(markerToDelete.clipId, markerToDelete.markerId)} className="px-5 py-2.5 rounded-xl font-bold bg-red-600 hover:bg-red-700 text-white min-h-[44px] text-xs transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
