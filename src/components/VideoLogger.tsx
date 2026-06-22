import React, { useState, useEffect, useRef } from 'react';
import { Session, Clip, Marker, SessionMedia, ClipGroup } from '../types';
import { db } from '../lib/db';
import { AutoGrowingTextarea } from './AutoGrowingTextarea';
import { CustomSelect } from './CustomSelect';
import { Trash2, MessageSquarePlus, ChevronsUpDown, ChevronsDownUp, NotebookPen, Plus, RotateCcw, FolderPlus, ChevronDown, ChevronRight, GripVertical } from 'lucide-react';
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

function SortableClipCard({ id, children, isDraggable = true, isReordering = false, zIndex }: { id: string; children: React.ReactNode; isDraggable?: boolean; isReordering?: boolean; key?: React.Key; zIndex?: number }) {
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
    zIndex: isDragging ? 100 : zIndex,
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

// ─── SortableGroup: drag wrapper for group reordering ─────────────────────────
function SortableGroup({ id, children, dragHandleProps }: {
  id: string;
  key?: React.Key;
  children: (dragHandleProps: React.HTMLAttributes<HTMLElement>) => React.ReactNode;
  dragHandleProps?: React.HTMLAttributes<HTMLElement>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : undefined,
  };
  return (
    <div ref={setNodeRef} style={style} className={isDragging ? 'opacity-60' : ''}>
      {children({ ...attributes, ...listeners })}
    </div>
  );
}

// Simple unique ID generator
const generateId = () => Math.random().toString(36).substring(2, 15);

export const formatTime = (ms: number) => {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export const parseTime = (timeStr: string): number => {
  if (!timeStr.includes(':')) {
    const raw = timeStr.replace(/\D/g, '');
    if (raw.length === 3 || raw.length === 4) {
      const secs = parseInt(raw.slice(-2), 10);
      const mins = parseInt(raw.slice(0, -2), 10);
      return (mins * 60 + secs) * 1000;
    }
  }

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

const TimeInput = ({
  valueMs,
  onChangeMs,
  className = '',
  formatTime,
  parseTime
}: {
  valueMs: number;
  onChangeMs: (ms: number) => void;
  className?: string;
  formatTime: (ms: number) => string;
  parseTime: (str: string) => number;
}) => {
  const [localVal, setLocalVal] = useState(formatTime(valueMs));
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setLocalVal(formatTime(valueMs));
    }
  }, [valueMs, isFocused]);

  const handleBlur = () => {
    setIsFocused(false);
    const parsed = parseTime(localVal);
    onChangeMs(parsed);
    setLocalVal(formatTime(parsed));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      className={className}
      value={isFocused ? localVal : formatTime(valueMs)}
      onFocus={(e) => {
        setIsFocused(true);
        e.target.select();
      }}
      onChange={(e) => setLocalVal(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    />
  );
};

// ─── ClipTitleInput: local state prevents cursor-jump on every keystroke ──────
function ClipTitleInput({ clip, onSave, onDelete, isExpanded, onToggle, clipGroups, onAssignGroup, showGroupPicker, setShowGroupPicker }: {
  clip: Clip;
  onSave: (clip: Clip) => Promise<void>;
  onDelete: () => void;
  isExpanded: boolean;
  onToggle: () => void;
  clipGroups: ClipGroup[];
  onAssignGroup: (clip: Clip, groupId: string | undefined) => Promise<void>;
  showGroupPicker: boolean;
  setShowGroupPicker: (show: boolean) => void;
}) {
  const [localTitle, setLocalTitle] = useState(clip.title);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Sync if parent title changes from outside (e.g. reorder, reload)
  useEffect(() => {
    setLocalTitle(clip.title);
  }, [clip.title]);

  // Close picker on outside click
  useEffect(() => {
    if (!showGroupPicker) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowGroupPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showGroupPicker]);

  const handleBlur = () => {
    if (localTitle !== clip.title) {
      onSave({ ...clip, title: localTitle });
    }
  };

  const currentGroup = clipGroups.find(g => g.id === clip.groupId);

  return (
    <div
      className="p-3 border-b border-white/5 flex items-center justify-between bg-white/5 cursor-pointer hover:bg-white/10 transition-colors"
      onClick={onToggle}
    >
      <input
        type="text"
        className="font-semibold text-white bg-transparent outline-none flex-1 cursor-text min-w-0"
        value={localTitle}
        onClick={e => e.stopPropagation()}
        onChange={(e) => setLocalTitle(e.target.value)}
        onBlur={handleBlur}
      />
      <div className="flex items-center gap-2 shrink-0 ml-2">
        {/* Group pill / picker */}
        {clipGroups.length > 0 && (
          <div className="relative" ref={pickerRef}>
            <button
              onClick={(e) => { e.stopPropagation(); setShowGroupPicker(!showGroupPicker); }}
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-colors truncate max-w-[80px] ${
                currentGroup
                  ? 'border-brand/40 text-brand bg-brand/10 hover:bg-brand/20'
                  : 'border-white/15 text-white/30 hover:text-white/60 hover:border-white/30'
              }`}
              title={currentGroup ? `Group: ${currentGroup.title}` : 'Assign to group'}
            >
              {currentGroup ? currentGroup.title : '—'}
            </button>
            {showGroupPicker && (
              <div
                className="absolute right-0 top-full mt-1 z-50 bg-[#1e1e22] border border-white/15 rounded-xl shadow-2xl py-1 min-w-[140px]"
                onClick={e => e.stopPropagation()}
              >
                <button
                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-white/10 transition-colors ${!clip.groupId ? 'text-white font-semibold' : 'text-white/50'}`}
                  onClick={() => { onAssignGroup(clip, undefined); setShowGroupPicker(false); }}
                >
                  No group
                </button>
                <div className="border-t border-white/10 my-1" />
                {clipGroups.map(g => (
                  <button
                    key={g.id}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-white/10 transition-colors ${clip.groupId === g.id ? 'text-brand font-semibold' : 'text-white/70'}`}
                    onClick={() => { onAssignGroup(clip, g.id); setShowGroupPicker(false); }}
                  >
                    {g.title}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-white/20 hover:text-red-500 p-1">✕</button>
        <span className="text-white/40 text-xs w-4 text-center">{isExpanded ? '▲' : '▼'}</span>
      </div>
    </div>
  );
}

// ─── GroupHeader: collapsible group with inline rename ────────────────────────
function GroupHeader({ group, clipCount, isExpanded, onToggle, onRename, onDelete, onAddClip, dragHandleProps }: {
  group: ClipGroup;
  clipCount: number;
  isExpanded: boolean;
  onToggle: () => void;
  onRename: (title: string) => void;
  onDelete: () => void;
  onAddClip: () => void;
  dragHandleProps?: React.HTMLAttributes<HTMLElement>;
}) {
  const [localTitle, setLocalTitle] = useState(group.title);

  useEffect(() => { setLocalTitle(group.title); }, [group.title]);

  const handleBlur = () => {
    const trimmed = localTitle.trim();
    if (trimmed && trimmed !== group.title) onRename(trimmed);
    else setLocalTitle(group.title);
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2.5 bg-white/5 border-b border-white/10 sticky top-0 z-10">
      {/* Drag handle */}
      <span
        {...dragHandleProps}
        className="text-white/20 hover:text-white/50 cursor-grab active:cursor-grabbing touch-none p-0.5 transition-colors"
        title="Drag to reorder group"
        onClick={e => e.stopPropagation()}
      >
        <GripVertical className="w-3.5 h-3.5" />
      </span>
      <button onClick={onToggle} className="text-white/40 hover:text-white/70 transition-colors p-0.5">
        {isExpanded
          ? <ChevronDown className="w-3.5 h-3.5" />
          : <ChevronRight className="w-3.5 h-3.5" />}
      </button>
      <input
        type="text"
        className="flex-1 bg-transparent text-xs font-bold text-white/70 outline-none cursor-text hover:text-white/90 focus:text-white transition-colors"
        value={localTitle}
        onChange={e => setLocalTitle(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        onClick={e => e.stopPropagation()}
      />
      <span className="text-white/25 text-[10px] font-medium shrink-0">{clipCount}</span>
      <button
        onClick={e => { e.stopPropagation(); onAddClip(); }}
        title="Add clip to this group"
        className="text-white/30 hover:text-brand hover:bg-brand/10 transition-colors p-1 rounded-lg"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={e => { e.stopPropagation(); onDelete(); }}
        title="Delete group (clips become orphans)"
        className="text-white/20 hover:text-red-400 transition-colors p-1 rounded-lg"
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  );
}

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
  const [clipGroups, setClipGroups] = useState<ClipGroup[]>([]);
  const [filterType, setFilterType] = useState<string>('All');
  const [clipToDelete, setClipToDelete] = useState<string | null>(null);
  const [groupToDelete, setGroupToDelete] = useState<string | null>(null);
  const [markerToDelete, setMarkerToDelete] = useState<{ clipId: string, markerId: string } | null>(null);
  const [expandedClips, setExpandedClips] = useState<Record<string, boolean>>({});
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [showingNoteInput, setShowingNoteInput] = useState<Record<string, boolean>>({});
  const [showingClipNote, setShowingClipNote] = useState<Record<string, boolean>>({});
  const [activeGroupPickerClipId, setActiveGroupPickerClipId] = useState<string | null>(null);

  // Per-clip start-offset (ms) — set before pressing play to align with camera footage
  const [clipOffsets, setClipOffsets] = useState<Record<string, number>>({});

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

  useEffect(() => {
    // Load clip groups for this session, sorted by creation order
    db.getSessionClipGroups(session.id).then(groups => {
      setClipGroups(groups.sort((a, b) => a.order - b.order));
    });
  }, [session.id]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // DnD for clips within a specific group
  const handleGroupDragEnd = async (groupId: string, event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const group = clipGroups.find(g => g.id === groupId);
    if (!group) return;

    const activeId = active.id as string;
    const overId = over.id as string;
    const oldIndex = group.clipOrder.indexOf(activeId);
    const newIndex = group.clipOrder.indexOf(overId);
    if (oldIndex === -1 || newIndex === -1) return;

    const newClipOrder = arrayMove(group.clipOrder, oldIndex, newIndex);
    const updatedGroup = { ...group, clipOrder: newClipOrder };
    await db.saveClipGroup(updatedGroup);
    setClipGroups(prev => prev.map(g => g.id === groupId ? updatedGroup : g));
  };

  // DnD for orphan clips (uses session.cardOrder like before)
  const handleOrphanDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeId = active.id as string;
    const overId = over.id as string;
    const orphans = getOrphanClips();
    const oldIndex = orphans.findIndex(c => c.id === activeId);
    const newIndex = orphans.findIndex(c => c.id === overId);
    const newOrphans = arrayMove(orphans, oldIndex, newIndex);

    // Rebuild flat cardOrder: preserve group clips in their relative positions, replace orphan slice
    const allClipIds = clips.map(c => c.id);
    const newOrphanIds = newOrphans.map(c => c.id);
    let orphanIdx = 0;
    const newOrder = allClipIds.map(id => {
      const clip = clips.find(c => c.id === id);
      if (!clip?.groupId || !clipGroups.find(g => g.id === clip.groupId)) {
        return newOrphanIds[orphanIdx++];
      }
      return id;
    });
    updateSession(session.id, { cardOrder: newOrder });
  };

  // DnD for reordering the groups themselves
  const handleGroupReorderDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeId = active.id as string;
    const overId = over.id as string;
    const oldIndex = clipGroups.findIndex(g => g.id === activeId);
    const newIndex = clipGroups.findIndex(g => g.id === overId);
    const reordered = arrayMove(clipGroups, oldIndex, newIndex) as ClipGroup[];
    // Reassign order values to reflect the new sequence
    const updated = reordered.map((g, i) => ({ ...g, order: i }));
    setClipGroups(updated);
    for (const g of updated) {
      await db.saveClipGroup(g);
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

  // ─── Group helpers ──────────────────────────────────────────────────────────

  const getGroupClips = (groupId: string): Clip[] => {
    const group = clipGroups.find(g => g.id === groupId);
    const order = group?.clipOrder || [];
    return clips
      .filter(c => c.groupId === groupId)
      .sort((a, b) => {
        const ia = order.indexOf(a.id);
        const ib = order.indexOf(b.id);
        if (ia === -1 && ib === -1) return (a.startedAt || 0) - (b.startedAt || 0);
        if (ia === -1) return 1;
        if (ib === -1) return -1;
        return ia - ib;
      });
  };

  const getOrphanClips = (): Clip[] => {
    const groupIds = new Set(clipGroups.map(g => g.id));
    const orphans = clips.filter(c => !c.groupId || !groupIds.has(c.groupId));
    const order = session.cardOrder || [];
    return orphans.sort((a, b) => {
      const ia = order.indexOf(a.id);
      const ib = order.indexOf(b.id);
      if (ia === -1 && ib === -1) return (a.startedAt || 0) - (b.startedAt || 0);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  };

  // ─── Clip CRUD ──────────────────────────────────────────────────────────────

  const handleAddClip = async (groupId?: string) => {
    const newClip: Clip = {
      id: `clip-${Date.now()}`,
      sessionId: session.id,
      title: `${clips.length + 1}`,
      startedAt: null,
      endedAt: null,
      markers: [],
      groupId
    };
    await saveClip(newClip);

    if (groupId) {
      // Append to the group's clipOrder
      const group = clipGroups.find(g => g.id === groupId);
      if (group) {
        const updated = { ...group, clipOrder: [...group.clipOrder, newClip.id] };
        await db.saveClipGroup(updated);
        setClipGroups(prev => prev.map(g => g.id === groupId ? updated : g));
      }
    }
  };

  // FAB: adds to the last group if groups exist, otherwise orphan
  const handleFabAddClip = () => {
    if (clipGroups.length > 0) {
      handleAddClip(clipGroups[clipGroups.length - 1].id);
    } else {
      handleAddClip();
    }
  };

  const assignClipToGroup = async (clip: Clip, newGroupId: string | undefined) => {
    const oldGroupId = clip.groupId;

    // Remove from old group's clipOrder
    if (oldGroupId) {
      const oldGroup = clipGroups.find(g => g.id === oldGroupId);
      if (oldGroup) {
        const updated = { ...oldGroup, clipOrder: oldGroup.clipOrder.filter(id => id !== clip.id) };
        await db.saveClipGroup(updated);
        setClipGroups(prev => prev.map(g => g.id === oldGroupId ? updated : g));
      }
    }

    // Add to new group's clipOrder
    if (newGroupId) {
      const newGroup = clipGroups.find(g => g.id === newGroupId);
      if (newGroup) {
        const updated = { ...newGroup, clipOrder: [...newGroup.clipOrder, clip.id] };
        await db.saveClipGroup(updated);
        setClipGroups(prev => prev.map(g => g.id === newGroupId ? updated : g));
      }
    }

    await saveClip({ ...clip, groupId: newGroupId });
  };

  const resetTimer = async (clip: Clip) => {
    const resetClip = { ...clip, startedAt: null, endedAt: null };
    await saveClip(resetClip);
    // Also reset the offset for this clip
    setClipOffsets(prev => ({ ...prev, [clip.id]: 0 }));
  };

  const toggleTimer = async (clip: Clip) => {
    if (clip.startedAt && !clip.endedAt) {
      // Stop timer
      const endedClip = { ...clip, endedAt: Date.now() };
      await saveClip(endedClip);
    } else if (!clip.startedAt) {
      // Start timer — subtract the offset so elapsed immediately shows the offset value
      const offsetMs = clipOffsets[clip.id] ?? 0;
      const startedClip = { ...clip, startedAt: Date.now() - offsetMs };
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
    const marker = clip.markers.find(m => m.id === markerId);
    if (!marker) return;

    let outTime = marker.inTime > 0 ? marker.inTime : 1000;
    if (clip.startedAt) {
      const elapsed = clip.endedAt ? (clip.endedAt - clip.startedAt) : (Date.now() - clip.startedAt);
      if (elapsed > marker.inTime) {
        outTime = elapsed;
      }
    }
    await updateMarker(clipId, markerId, { outTime });
  };

  const executeDeleteMarker = async (clipId: string, markerId: string) => {
    const clip = clips.find(c => c.id === clipId);
    if (!clip) return;
    const updatedClip = { ...clip, markers: clip.markers.filter(m => m.id !== markerId) };
    await saveClip(updatedClip);
    setMarkerToDelete(null);
  };
  const deleteMarker = (clipId: string, markerId: string) => setMarkerToDelete({ clipId, markerId });

  const executeDeleteClip = async (clipId: string) => {
    // Also remove from any group's clipOrder
    const clip = clips.find(c => c.id === clipId);
    if (clip?.groupId) {
      const group = clipGroups.find(g => g.id === clip.groupId);
      if (group) {
        const updated = { ...group, clipOrder: group.clipOrder.filter(id => id !== clipId) };
        await db.saveClipGroup(updated);
        setClipGroups(prev => prev.map(g => g.id === group.id ? updated : g));
      }
    }
    await db.deleteClip(clipId);
    setClips(prev => prev.filter(c => c.id !== clipId));
    setClipToDelete(null);
  };
  const deleteClip = (clipId: string) => setClipToDelete(clipId);

  // ─── Group CRUD ─────────────────────────────────────────────────────────────

  const handleAddGroup = async () => {
    const newGroup: ClipGroup = {
      id: `group-${Date.now()}`,
      sessionId: session.id,
      title: `Group ${clipGroups.length + 1}`,
      order: Date.now(),
      clipOrder: []
    };
    await db.saveClipGroup(newGroup);
    setClipGroups(prev => [...prev, newGroup]);
  };

  const renameGroup = async (groupId: string, newTitle: string) => {
    const group = clipGroups.find(g => g.id === groupId);
    if (!group) return;
    const updated = { ...group, title: newTitle };
    await db.saveClipGroup(updated);
    setClipGroups(prev => prev.map(g => g.id === groupId ? updated : g));
  };

  const executeDeleteGroup = async (groupId: string) => {
    // Orphan all clips that belonged to this group
    const groupClips = clips.filter(c => c.groupId === groupId);
    for (const c of groupClips) {
      await saveClip({ ...c, groupId: undefined });
    }
    await db.deleteClipGroup(groupId);
    setClipGroups(prev => prev.filter(g => g.id !== groupId));
    setGroupToDelete(null);
  };

  // ─── Clip card renderer (shared between group and orphan contexts) ──────────
  const renderClipCard = (clip: Clip, isOrphan: boolean = false) => {
    const isRunning = clip.startedAt && !clip.endedAt;
    let elapsed = 0;
    if (clip.startedAt) {
      elapsed = clip.endedAt ? (clip.endedAt - clip.startedAt) : (Date.now() - clip.startedAt);
    }

    return (
      <SortableClipCard key={clip.id} id={clip.id} isReordering={isReordering} zIndex={activeGroupPickerClipId === clip.id ? 50 : 1}>
        <div className={`${isOrphan ? 'bg-brand/10' : 'bg-black/20'} rounded-none border-b last:border-b-0 transition-colors ${isRunning ? 'border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'border-white/10 hover:border-white/20'
          }`}>
          {/* Clip Header */}
          <ClipTitleInput
            clip={clip}
            onSave={saveClip}
            onDelete={() => deleteClip(clip.id)}
            isExpanded={expandedClips[clip.id] !== false}
            onToggle={() => setExpandedClips(prev => ({ ...prev, [clip.id]: prev[clip.id] === false ? true : false }))}
            clipGroups={clipGroups}
            onAssignGroup={assignClipToGroup}
            showGroupPicker={activeGroupPickerClipId === clip.id}
            setShowGroupPicker={(show) => setActiveGroupPickerClipId(show ? clip.id : null)}
          />

          {expandedClips[clip.id] !== false && (
            <div className="p-4 space-y-4">
              {/* Timer Control */}
              <div className="flex items-center justify-between bg-white/5 p-2 rounded-2xl">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleTimer(clip)}
                    className={`w-12 h-12 flex items-center justify-center rounded-full shadow-sm transition-all ${isRunning ? 'bg-red-500/20 text-red-500 animate-pulse' : 'bg-black/40 text-white'
                      }`}
                  >
                    {isRunning ? '⏹' : '▶'}
                  </button>
                  <div>
                    {/* In Ready state: the time display is itself editable for offset */}
                    {!clip.startedAt ? (
                      <div className="flex items-center gap-1.5 group">
                        <TimeInput
                          className={`text-2xl font-mono tracking-tight font-light bg-transparent outline-none w-[4.5rem] transition-colors ${(clipOffsets[clip.id] ?? 0) > 0 ? 'text-brand' : 'text-white/90'
                            } focus:text-brand`}
                          valueMs={clipOffsets[clip.id] ?? 0}
                          onChangeMs={(ms) =>
                            setClipOffsets(prev => ({ ...prev, [clip.id]: ms }))
                          }
                          formatTime={formatTime}
                          parseTime={parseTime}
                        />
                        <span className="text-white/20 group-focus-within:text-brand/50 transition-colors" title="Tap the time to set a start offset">✎</span>
                      </div>
                    ) : (
                      <div className="text-2xl font-mono tracking-tight font-light text-white/90">
                        {formatTime(elapsed)}
                      </div>
                    )}
                    <div className="text-[10px] uppercase font-bold tracking-widest mt-0.5">
                      {isRunning
                        ? <span className="text-red-400/70">Recording</span>
                        : clip.endedAt
                          ? <span className="text-white/40">Ended</span>
                          : (clipOffsets[clip.id] ?? 0) > 0
                            ? <span className="text-brand/60">Starting at {formatTime(clipOffsets[clip.id])}</span>
                            : <span className="text-white/40">Ready · tap to offset</span>
                      }
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Reset Timer button — only shown when clip has ended */}
                  {clip.endedAt && !isRunning && (
                    <button
                      onClick={() => resetTimer(clip)}
                      title="Reset timer"
                      className="p-2 rounded-xl text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => addMarker(clip)}
                    className="px-4 py-2 text-sm font-medium rounded-xl transition-colors bg-brand text-black shadow-md hover:bg-brand-light active:scale-95"
                  >
                    + Marker
                  </button>
                </div>
              </div>

              {/* Markers List */}
              {clip.markers.length > 0 && (
                <div className="space-y-2 mt-4">
                  {clip.markers.map((marker, index) => {
                    const showNote = marker.content || showingNoteInput[marker.id];
                    return (
                      <div key={marker.id} className={`flex flex-col gap-2 py-3 ${index !== clip.markers.length - 1 ? 'border-b border-white/5' : ''}`}>
                        <div className="flex items-center gap-2">
                          <TimeInput
                            className="text-xs font-mono font-medium text-white/90 bg-black/40 px-2 py-1 rounded-md shadow-sm w-16 text-center border border-transparent outline-none focus:border-brand/50 transition-colors"
                            valueMs={marker.inTime}
                            onChangeMs={(ms) => updateMarker(clip.id, marker.id, { inTime: ms })}
                            formatTime={formatTime}
                            parseTime={parseTime}
                          />
                          {marker.outTime ? (
                            <>
                              <span className="text-white/40">-</span>
                              <TimeInput
                                className="text-xs font-mono font-medium text-white/90 bg-black/40 px-2 py-1 rounded-md shadow-sm w-16 text-center border border-transparent outline-none focus:border-brand/50 transition-colors"
                                valueMs={marker.outTime}
                                onChangeMs={(ms) => updateMarker(clip.id, marker.id, { outTime: ms === 0 ? undefined : ms })}
                                formatTime={formatTime}
                                parseTime={parseTime}
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
                                { value: 'Cut', label: 'Cut' },
                                { value: 'Zoom', label: 'Zoom' },
                                { value: 'Note', label: 'Note' },
                                { value: 'Music', label: 'Music' }
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
                            rows={1}
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
  };

  // --- REVIEW MODE ---
  if (isReviewMode) {
    return (
      <div className="flex flex-col bg-transparent relative pb-20">
        <main className="flex-1 space-y-3">

          {/* Filter + summary row */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-white/40">
              {clips.reduce((n, c) => n + c.markers.length, 0)} marker{clips.reduce((n, c) => n + c.markers.length, 0) !== 1 ? 's' : ''} / {clips.length} clip{clips.length !== 1 ? 's' : ''}
            </p>
            <div className="flex items-center gap-2">
              {clips.length > 0 && (
                <button
                  onClick={() => {
                    const allExpanded = clips.every(c => expandedClips[`review-${c.id}`] !== false) && clipGroups.every(g => collapsedGroups[g.id] !== true);
                    const newState: Record<string, boolean> = {};
                    clips.forEach(c => { newState[`review-${c.id}`] = !allExpanded; });
                    setExpandedClips(prev => ({ ...prev, ...newState }));
                    const newGroupsState: Record<string, boolean> = {};
                    clipGroups.forEach(g => { newGroupsState[g.id] = allExpanded; });
                    setCollapsedGroups(prev => ({ ...prev, ...newGroupsState }));
                  }}
                  className="p-1.5 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors"
                  title={(clips.every(c => expandedClips[`review-${c.id}`] !== false) && clipGroups.every(g => collapsedGroups[g.id] !== true)) ? 'Collapse all' : 'Expand all'}
                >
                  {(clips.every(c => expandedClips[`review-${c.id}`] !== false) && clipGroups.every(g => collapsedGroups[g.id] !== true))
                    ? <ChevronsDownUp className="w-4 h-4" />
                    : <ChevronsUpDown className="w-4 h-4" />}
                </button>
              )}
              <div className="w-32">
                <CustomSelect
                  value={filterType}
                  onChange={(val) => setFilterType(val)}
                  options={[
                    { value: 'All', label: 'All Types' },
                    { value: 'Cut', label: 'Cut' },
                    { value: 'Zoom', label: 'Zoom' },
                    { value: 'Note', label: 'Note' },
                    { value: 'Music', label: 'Music' }
                  ]}
                  position="relative"
                />
              </div>
            </div>
          </div>

          {/* Render review mode — grouped then orphans */}
          {clips.length === 0 ? (
            <div className="text-center text-white/40 mt-10">No clips yet.</div>
          ) : (
            <div className="flex flex-col border-y sm:border-x border-white/10 -mx-6 sm:mx-0">
              {/* Groups */}
              {clipGroups.map(group => {
                const groupClips = getGroupClips(group.id);
                if (groupClips.length === 0) return null;
                const isGroupExpanded = collapsedGroups[group.id] !== true;
                return (
                  <div key={group.id}>
                    <button
                      className="w-full flex items-center gap-2 px-4 py-2 bg-white/5 border-b border-white/10 hover:bg-white/10 transition-colors"
                      onClick={() => setCollapsedGroups(prev => ({ ...prev, [group.id]: !prev[group.id] }))}
                    >
                      <span className="text-white/30 text-xs">{isGroupExpanded ? '▼' : '▶'}</span>
                      <span className="text-xs font-bold text-white/50 flex-1 text-left">{group.title}</span>
                      <span className="text-white/25 text-[10px]">{groupClips.length}</span>
                    </button>
                    {isGroupExpanded && groupClips.map(clip => renderReviewClip(clip))}
                  </div>
                );
              })}
              {/* Orphans */}
              {getOrphanClips().map(clip => renderReviewClip(clip, true))}
            </div>
          )}
        </main>
      </div>
    );
  }

  // Helper to render a single clip row in Review Mode
  function renderReviewClip(clip: Clip, isOrphan: boolean = false) {
    let markers = clip.markers;
    if (filterType !== 'All') {
      markers = markers.filter(m => m.type === filterType);
    }
    const isCollapsed = expandedClips[`review-${clip.id}`] === false;
    const resolvedCount = markers.filter(m => m.isResolved).length;

    return (
      <div key={clip.id} className={`${isOrphan ? 'bg-brand/10' : 'bg-black/20'} rounded-none border-b border-white/10 last:border-b-0 overflow-hidden`}>
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
            className={`p-1.5 rounded-lg transition-colors shrink-0 ${clip.notes
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
            {markers.map((m) => (
              <div
                key={m.id}
                className={`flex items-center gap-3 px-4 py-2.5 transition-opacity ${m.isResolved ? 'opacity-35' : ''}`}
              >
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-white/20 text-brand focus:ring-brand/50 cursor-pointer shrink-0 accent-brand"
                  checked={!!m.isResolved}
                  onChange={(e) => updateMarker(clip.id, m.id, { isResolved: e.target.checked })}
                />
                <span className={`text-xs font-mono text-white/60 shrink-0 ${m.isResolved ? 'line-through' : ''}`}>
                  {formatTime(m.inTime)}{m.outTime ? `–${formatTime(m.outTime)}` : ''}
                </span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${m.type === 'Cut' ? 'bg-red-500/20 text-red-400' :
                  m.type === 'Zoom' ? 'bg-blue-500/20 text-blue-400' :
                    m.type === 'Music' ? 'bg-pink-500/20 text-pink-400' :
                      'bg-orange-500/20 text-orange-400'
                  }`}>{m.type}</span>
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
  }

  // ─── Main render ────────────────────────────────────────────────────────────
  const orphanClips = getOrphanClips();

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
                    const allExpanded = clips.every(c => expandedClips[c.id] !== false) && clipGroups.every(g => collapsedGroups[g.id] !== true);
                    const newState: Record<string, boolean> = {};
                    clips.forEach(c => { newState[c.id] = !allExpanded; });
                    setExpandedClips(prev => ({ ...prev, ...newState }));
                    const newGroupsState: Record<string, boolean> = {};
                    clipGroups.forEach(g => { newGroupsState[g.id] = allExpanded; });
                    setCollapsedGroups(prev => ({ ...prev, ...newGroupsState }));
                  }}
                  className="p-1.5 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors"
                  title={(clips.every(c => expandedClips[c.id] !== false) && clipGroups.every(g => collapsedGroups[g.id] !== true)) ? 'Collapse all' : 'Expand all'}
                >
                  {(clips.every(c => expandedClips[c.id] !== false) && clipGroups.every(g => collapsedGroups[g.id] !== true))
                    ? <ChevronsDownUp className="w-4 h-4" />
                    : <ChevronsUpDown className="w-4 h-4" />}
                </button>
              )}
              <button
                onClick={handleAddGroup}
                className="flex items-center gap-1 text-sm font-medium text-white/50 hover:text-white/80 bg-white/5 hover:bg-white/10 px-3 py-1 rounded-full transition-colors"
                title="Add a group to organize clips"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span className="text-xs">Group</span>
              </button>
              <button onClick={handleFabAddClip} className="text-sm font-medium text-brand hover:text-brand-light bg-brand/10 px-3 py-1 rounded-full">
                + Add Clip
              </button>
            </div>
          </div>

          {clips.length === 0 && clipGroups.length === 0 ? (
            <div className="text-center py-10 text-white/40 bg-black/20 border border-dashed border-white/20 rounded-3xl">
              No clips yet. Add one to start logging!
            </div>
          ) : (
            <div className="space-y-0 flex flex-col border-y sm:border-x border-white/10 -mx-6 sm:mx-0">

              {/* ── Groups (drag-reorderable) ── */}
              {clipGroups.length > 0 && (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleGroupReorderDragEnd}
                >
                  <SortableContext items={clipGroups.map(g => g.id)} strategy={verticalListSortingStrategy}>
                    {clipGroups.map(group => {
                      const groupClips = getGroupClips(group.id);
                      const isGroupExpanded = collapsedGroups[group.id] !== true;
                      return (
                        <SortableGroup key={group.id} id={group.id}>
                          {(dragHandleProps) => (
                            <div className="border-b border-white/10 last:border-b-0">
                              <GroupHeader
                                group={group}
                                clipCount={groupClips.length}
                                isExpanded={isGroupExpanded}
                                onToggle={() => setCollapsedGroups(prev => ({ ...prev, [group.id]: !prev[group.id] }))}
                                onRename={(title) => renameGroup(group.id, title)}
                                onDelete={() => setGroupToDelete(group.id)}
                                onAddClip={() => handleAddClip(group.id)}
                                dragHandleProps={dragHandleProps}
                              />
                              {isGroupExpanded && (
                                groupClips.length === 0 ? (
                                  <div className="px-6 py-4 text-xs text-white/25 italic text-center border-b border-white/5">
                                    Empty — tap + to add a clip
                                  </div>
                                ) : (
                                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleGroupDragEnd(group.id, e)}>
                                    <SortableContext items={groupClips.map(c => c.id)} strategy={verticalListSortingStrategy}>
                                      <div className="flex flex-col">
                                        {groupClips.map(clip => renderClipCard(clip))}
                                      </div>
                                    </SortableContext>
                                  </DndContext>
                                )
                              )}
                            </div>
                          )}
                        </SortableGroup>
                      );
                    })}
                  </SortableContext>
                </DndContext>
              )}

              {/* ── Orphan clips (no group) ── */}
              {orphanClips.length > 0 && (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleOrphanDragEnd}>
                  <SortableContext items={orphanClips.map(c => c.id)} strategy={verticalListSortingStrategy}>
                    <div className="flex flex-col">
                      {orphanClips.map(clip => renderClipCard(clip, true))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}

              {/* Empty state when groups exist but no clips at all */}
              {clips.length === 0 && clipGroups.length > 0 && (
                <div className="px-6 py-6 text-xs text-white/25 italic text-center">
                  No clips yet. Use + in a group header or the FAB button.
                </div>
              )}
            </div>
          )}
        </section>
      </main>

      {/* FAB: Add Clip (adds to last group, or orphan if none) */}
      <button
        onClick={handleFabAddClip}
        title={clipGroups.length > 0 ? `Add clip to "${clipGroups[clipGroups.length - 1].title}"` : 'Add Clip'}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 flex items-center justify-center rounded-full bg-brand text-black shadow-2xl hover:bg-brand-light active:scale-95 transition-all"
        style={{ boxShadow: '0 4px 24px rgba(var(--brand-rgb, 139,92,246),0.5)' }}
      >
        <Plus className="w-6 h-6" strokeWidth={2.5} />
      </button>

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

      {groupToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[70] p-6" onClick={() => setGroupToDelete(null)}>
          <div className="bg-[#1e1e22]/95 border border-white/10 p-8 rounded-3xl max-w-sm w-full space-y-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold flex items-center gap-2 text-red-400">
              <Trash2 className="w-5 h-5 text-red-500" />
              Delete Group?
            </h3>
            <p className="text-white/70 text-sm">The group will be removed but its clips will <strong>not</strong> be deleted — they'll become ungrouped.</p>
            <div className="flex gap-3 justify-end items-center mt-6">
              <button onClick={() => setGroupToDelete(null)} className="px-5 py-2.5 rounded-xl font-bold bg-white/10 hover:bg-white/20 text-white min-h-[44px] text-xs transition-colors">Cancel</button>
              <button onClick={() => executeDeleteGroup(groupToDelete)} className="px-5 py-2.5 rounded-xl font-bold bg-red-600 hover:bg-red-700 text-white min-h-[44px] text-xs transition-colors">Delete Group</button>
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
