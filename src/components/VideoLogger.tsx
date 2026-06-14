import React, { useState, useEffect, useRef } from 'react';
import { Session, Clip, Marker, SessionMedia } from '../types';
import { db } from '../lib/db';
import { AutoGrowingTextarea } from './AutoGrowingTextarea';
import { CustomSelect } from './CustomSelect';
import { Trash2, MessageSquarePlus, ChevronsUpDown, ChevronsDownUp, NotebookPen } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function SortableClipCard({ id, children, isDraggable = true, isReordering = false }: { id: string; children: React.ReactNode; isDraggable?: boolean; isReordering?: boolean; key?: React.Key }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !isDraggable || !isReordering });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    ...(isReordering ? { touchAction: 'none' } : {})
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(isDraggable && isReordering ? attributes : {})}
      {...(isDraggable && isReordering ? listeners : {})}
      className={isDragging ? 'shadow-2xl scale-[1.02] cursor-grabbing ring-2 ring-brand rounded-3xl bg-[#141414] opacity-80 relative z-50' : (isDraggable && isReordering ? 'cursor-grab touch-none active:scale-[0.99] transition-all ring-2 ring-brand/40 bg-brand/5 rounded-3xl' : 'transition-all')}
    >
      <div className={isDraggable && isReordering && !isDragging ? 'opacity-80 pointer-events-none' : ''}>
        {children}
      </div>
    </div>
  );
}

// Simple unique ID generator
const generateId = () => Math.random().toString(36).substring(2, 15);

interface VideoLoggerProps {
  session: Session;
  updateSession: (id: string, changes: Partial<Session>) => void;
  onBack: () => void;
  showToast?: (msg: string, isError?: boolean) => void;
  sessionMedia: SessionMedia[];
  onOpenGallery: () => void;
  isReordering?: boolean;
  isReviewMode?: boolean;
  onSetReviewMode?: (mode: boolean) => void;
}

export default function VideoLogger({
  session,
  updateSession,
  onBack,
  showToast,
  sessionMedia,
  onOpenGallery,
  isReordering = false,
  isReviewMode = false,
  onSetReviewMode
}: VideoLoggerProps) {
  const [clips, setClips] = useState<Clip[]>([]);
  const [filterType, setFilterType] = useState<string>('All');
  const [clipToDelete, setClipToDelete] = useState<string | null>(null);
  const [markerToDelete, setMarkerToDelete] = useState<{clipId: string, markerId: string} | null>(null);
  const [expandedClips, setExpandedClips] = useState<Record<string, boolean>>({});
  const [showingNoteInput, setShowingNoteInput] = useState<Record<string, boolean>>({});
  const [showingClipNote, setShowingClipNote] = useState<Record<string, boolean>>({});
  
  // Real-time ticker for running clips
  const [, setTick] = useState(0);

  useEffect(() => {
    // Load clips for this session
    db.getSessionClips(session.id).then(loadedClips => {
      if (session.cardOrder && session.cardOrder.length > 0) {
        loadedClips.sort((a, b) => {
          const idxA = session.cardOrder!.indexOf(a.id);
          const idxB = session.cardOrder!.indexOf(b.id);
          if (idxA === -1 && idxB === -1) return (a.startedAt || 0) - (b.startedAt || 0);
          if (idxA === -1) return 1;
          if (idxB === -1) return -1;
          return idxA - idxB;
        });
      } else {
        loadedClips.sort((a, b) => (a.startedAt || 0) - (b.startedAt || 0));
      }
      setClips(loadedClips);
    });
  }, [session.id, session.cardOrder]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const activeId = active.id as string;
      const overId = over.id as string;
      const oldIndex = clips.findIndex((c) => c.id === activeId);
      const newIndex = clips.findIndex((c) => c.id === overId);
      const newClips = arrayMove(clips, oldIndex, newIndex) as Clip[];
      setClips(newClips);
      
      const newOrder = newClips.map(c => c.id);
      updateSession(session.id, { cardOrder: newOrder });
    }
  };

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
    let inTime = 0;
    if (clip.startedAt) {
      inTime = clip.endedAt ? (clip.endedAt - clip.startedAt) : (Date.now() - clip.startedAt);
    }
    
    const newMarker: Marker = {
      id: `m-${Date.now()}`,
      inTime,
      type: 'Note',
      content: '',
      isResolved: false
    };

    const updatedMarkers = [...clip.markers, newMarker];
    updatedMarkers.sort((a, b) => a.inTime - b.inTime);

    const updatedClip = {
      ...clip,
      markers: updatedMarkers
    };
    await saveClip(updatedClip);
  };

  const updateMarker = async (clipId: string, markerId: string, changes: Partial<Marker>) => {
    const clip = clips.find(c => c.id === clipId);
    if (!clip) return;

    const updatedMarkers = clip.markers.map(m => m.id === markerId ? { ...m, ...changes } : m);
    updatedMarkers.sort((a, b) => a.inTime - b.inTime);
    const updatedClip = { ...clip, markers: updatedMarkers };
    await saveClip(updatedClip);
  };

  const markOutTime = async (clipId: string, markerId: string) => {
    const clip = clips.find(c => c.id === clipId);
    if (!clip) return;
    
    let outTime = 0;
    if (clip.startedAt) {
      outTime = clip.endedAt ? (clip.endedAt - clip.startedAt) : (Date.now() - clip.startedAt);
    }
    await updateMarker(clipId, markerId, { outTime: Math.max(0, outTime) });
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
  if (isReviewMode) {
    return (
      <div className="flex flex-col bg-transparent relative pb-20">
        <main className="flex-1 space-y-3">

          {/* Filter + summary row */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-white/40">
              {clips.reduce((n, c) => n + c.markers.length, 0)} marker{clips.reduce((n, c) => n + c.markers.length, 0) !== 1 ? 's' : ''} across {clips.length} clip{clips.length !== 1 ? 's' : ''}
            </p>
            <div className="flex items-center gap-2">
              {clips.length > 0 && (
                <button
                  onClick={() => {
                    const allExpanded = clips.every(c => expandedClips[`review-${c.id}`] !== false);
                    const newState: Record<string, boolean> = {};
                    clips.forEach(c => { newState[`review-${c.id}`] = !allExpanded; });
                    setExpandedClips(prev => ({ ...prev, ...newState }));
                  }}
                  className="p-1.5 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors"
                  title={clips.every(c => expandedClips[`review-${c.id}`] !== false) ? 'Collapse all' : 'Expand all'}
                >
                  {clips.every(c => expandedClips[`review-${c.id}`] !== false)
                    ? <ChevronsDownUp className="w-4 h-4" />
                    : <ChevronsUpDown className="w-4 h-4" />}
                </button>
              )}
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
            </div>
          </div>

          {/* Grouped by clip */}
          {clips.length === 0 ? (
            <div className="text-center text-white/40 mt-10">No clips yet.</div>
          ) : (
            clips.map(clip => {
              let markers = clip.markers;
              if (filterType !== 'All') {
                markers = markers.filter(m => m.type === filterType);
              }

              const isCollapsed = expandedClips[`review-${clip.id}`] === false;
              const resolvedCount = markers.filter(m => m.isResolved).length;

              return (
                <div key={clip.id} className="bg-black/20 rounded-2xl border border-white/10 overflow-hidden">
                  {/* Clip group header */}
                  <div className="w-full flex items-center gap-3 px-4 py-3 bg-white/5">
                    <button
                      className="flex items-center gap-3 flex-1 text-left hover:opacity-80 transition-opacity"
                      onClick={() => setExpandedClips(prev => ({ ...prev, [`review-${clip.id}`]: isCollapsed }))}
                    >
                      <span className="text-white/40 text-xs w-3">{isCollapsed ? '▶' : '▼'}</span>
                      <span className="flex-1 font-semibold text-white/90 text-sm">{clip.title}</span>
                      {markers.length > 0 && (
                        <span className="text-xs text-white/40 font-medium">
                          {resolvedCount}/{markers.length} done
                        </span>
                      )}
                      {markers.length === 0 && (
                        <span className="text-xs text-white/20 italic">no markers</span>
                      )}
                    </button>
                    {/* Note toggle button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (clip.notes) {
                          setShowingClipNote(prev => ({ ...prev, [clip.id]: !prev[clip.id] }));
                        } else {
                          setShowingClipNote(prev => ({ ...prev, [clip.id]: true }));
                        }
                      }}
                      className={`p-1.5 rounded-lg transition-colors shrink-0 ${
                        clip.notes
                          ? 'text-purple-400 bg-purple-500/20 hover:bg-purple-500/30'
                          : 'text-white/30 hover:text-white/70 hover:bg-white/10'
                      }`}
                      title={clip.notes ? (showingClipNote[clip.id] ? 'Hide edit note' : 'Show edit note') : 'Add edit note'}
                    >
                      <NotebookPen className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Clip note (editor note for this take) */}
                  {showingClipNote[clip.id] && (
                    <div className="px-4 pt-3 pb-1 border-b border-white/10 bg-purple-500/5">
                      <AutoGrowingTextarea
                        autoFocus={!clip.notes}
                        rows={1}
                        placeholder="Add editing notes for this take..."
                        className="w-full bg-transparent text-sm text-purple-200/90 outline-none placeholder:text-white/20 resize-none py-0"
                        value={clip.notes || ''}
                        onChange={(e) => {
                          const updated = { ...clip, notes: e.target.value };
                          saveClip(updated);
                        }}
                        onBlur={() => {
                          if (!clip.notes) setShowingClipNote(prev => ({ ...prev, [clip.id]: false }));
                        }}
                      />
                    </div>
                  )}

                  {/* Marker rows */}
                  {!isCollapsed && markers.length > 0 && (
                    <div className="divide-y divide-white/5">
                      {markers.map((m, index) => (
                        <div
                          key={m.id}
                          className={`flex items-center gap-3 px-4 py-2.5 transition-opacity ${m.isResolved ? 'opacity-35' : ''}`}
                        >
                          {/* Checkbox */}
                          <input
                            type="checkbox"
                            className="w-4 h-4 rounded border-white/20 text-brand focus:ring-brand/50 cursor-pointer shrink-0 accent-brand"
                            checked={!!m.isResolved}
                            onChange={(e) => updateMarker(clip.id, m.id, { isResolved: e.target.checked })}
                          />

                          {/* Timecode */}
                          <span className={`text-xs font-mono text-white/60 shrink-0 ${m.isResolved ? 'line-through' : ''}`}>
                            {formatTime(m.inTime)}{m.outTime ? `–${formatTime(m.outTime)}` : ''}
                          </span>

                          {/* Type pill */}
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                            m.type === 'Cut' ? 'bg-red-500/20 text-red-400' :
                            m.type === 'Zoom' ? 'bg-blue-500/20 text-blue-400' :
                            'bg-orange-500/20 text-orange-400'
                          }`}>{m.type}</span>

                          {/* Note */}
                          {m.content && (
                            <span className={`text-sm text-white/70 whitespace-pre-wrap break-words ${m.isResolved ? 'line-through' : ''}`}>
                              {m.content}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </main>
      </div>
    );
  }


  return (
    <div className="flex flex-col bg-transparent relative pb-20">
      <main className="flex-1 space-y-6">

        {/* CLIPS SECTION */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
             <h2 className="text-sm font-bold text-white/40 uppercase tracking-wider">Clips ({clips.length})</h2>
             <div className="flex items-center gap-2">
               {clips.length > 0 && (
                 <button
                   onClick={() => {
                     const allExpanded = clips.every(c => expandedClips[c.id] !== false);
                     const newState: Record<string, boolean> = {};
                     clips.forEach(c => { newState[c.id] = !allExpanded; });
                     setExpandedClips(newState);
                   }}
                   className="p-1.5 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors"
                   title={clips.every(c => expandedClips[c.id] !== false) ? 'Collapse all' : 'Expand all'}
                 >
                   {clips.every(c => expandedClips[c.id] !== false)
                     ? <ChevronsDownUp className="w-4 h-4" />
                     : <ChevronsUpDown className="w-4 h-4" />}
                 </button>
               )}
               <button onClick={handleAddClip} className="text-sm font-medium text-brand hover:text-brand-light bg-brand/10 px-3 py-1 rounded-full">
                 + Add Clip
               </button>
             </div>
          </div>

          {clips.length === 0 ? (
            <div className="text-center py-10 text-white/40 bg-black/20 border border-dashed border-white/20 rounded-3xl">
               No clips yet. Add one to start logging!
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={clips.map(c => c.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-4">
                  {clips.map((clip) => {
                    const isRunning = clip.startedAt && !clip.endedAt;
                    let elapsed = 0;
                    if (clip.startedAt) {
                      elapsed = clip.endedAt ? (clip.endedAt - clip.startedAt) : (Date.now() - clip.startedAt);
                    }

                    return (
                      <SortableClipCard key={clip.id} id={clip.id} isReordering={isReordering}>
                        <div className={`bg-black/20 rounded-3xl overflow-hidden border transition-colors ${
                          isRunning ? 'border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'border-white/10 hover:border-white/20'
                        }`}>
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
                                  onClick={() => addMarker(clip)}
                                  className="px-4 py-2 text-sm font-medium rounded-xl transition-colors bg-brand text-black shadow-md hover:bg-brand-light active:scale-95"
                                >
                                  + Marker
                                </button>
                              </div>

                              {/* Markers List */}
                              {clip.markers.length > 0 && (
                                <div className="space-y-2 mt-4">
                                  {clip.markers.map((marker, index) => {
                                    const showNote = marker.content || showingNoteInput[marker.id];
                                    return (
                                      <div key={marker.id} className={`flex flex-col gap-2 py-3 ${index !== clip.markers.length - 1 ? 'border-b border-white/5' : ''}`}>
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
                                          {!marker.outTime && (
                                            <button onClick={() => markOutTime(clip.id, marker.id)} className="text-xs font-bold text-brand bg-brand/10 px-2 py-1 rounded-md hover:bg-brand/20">
                                              +OUT
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

                                          {!showNote && (
                                            <button onClick={() => setShowingNoteInput(prev => ({ ...prev, [marker.id]: true }))} className="text-white/40 hover:text-white/80 p-1 transition-colors" title="Add Note">
                                              <MessageSquarePlus className="w-4 h-4" />
                                            </button>
                                          )}

                                          <button onClick={() => deleteMarker(clip.id, marker.id)} className="text-white/20 hover:text-red-500 ml-1">✕</button>
                                        </div>
                                        
                                        {showNote && (
                                          <AutoGrowingTextarea
                                            autoFocus={showingNoteInput[marker.id] && !marker.content}
                                            placeholder="Add details..."
                                            className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-brand/50 transition-colors resize-none"
                                            value={marker.content}
                                            onChange={(e) => updateMarker(clip.id, marker.id, { content: e.target.value })}
                                            onBlur={() => {
                                              if (!marker.content) setShowingNoteInput(prev => ({ ...prev, [marker.id]: false }));
                                            }}
                                          />
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </SortableClipCard>
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>
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
