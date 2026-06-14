import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Plus,
  Mic,
  Square,
  Upload,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  FileAudio,
  Wand2,
  Trash2,
  Calendar,
  Clock,
  CheckCircle2,
  Sparkles,
  Edit2,
  Globe,
  Download,
  Zap,
  GripHorizontal,
  X,
  Folder,
  FolderPlus,
  FolderOpen,
  Share2,
  Copy,
  SlidersHorizontal,
  Settings,
  BookOpen,
  Music,
  Images,
  AlertTriangle,
  LinkIcon,
  AudioLines,
  Play,
  CloudUpload,
  CloudDownload
} from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { format } from 'date-fns';
import { db } from './lib/db';
import { Session, AudioEntry, Language, SessionGroup, SessionMedia, StrictSummary, ExpandedInsights, DanceGlossary } from './types';

import { LMPLOGIcon } from './components/LMPLOGIcon';
import { CustomSelect } from './components/CustomSelect';
import { CustomCheckbox } from './components/CustomCheckbox';
import { CustomSwitch } from './components/CustomSwitch';
import { AutoGrowingTextarea } from './components/AutoGrowingTextarea';
// Word export removed due to Google Docs converter compatibility issues


import {
  connectDriveAccount,
  uploadBackupToDrive,
  downloadBackupFromDrive,
  clearDriveAuth,
  getStoredDriveAccount,
  isDriveConnected,
  type DriveAccount,
} from './lib/drive';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { version } from './version';
import { changelog } from './changelog';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (reader.result) {
        const b64 = (reader.result as string).split(',')[1];
        resolve(b64);
      } else {
        reject(new Error("Failed to convert blob to base64"));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

// --- Toast & Spinner Components ---
function Toast({ message, isError, actionText, onAction, onClose, duration = 5000 }: { message: string, isError: boolean, actionText?: string, onAction?: () => void, onClose: () => void, duration?: number }) {
  const [offset, setOffset] = useState(0);
  const touchStart = useRef<number | null>(null);

  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStart.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStart.current === null) return;
    const currentX = e.touches[0].clientX;
    const diff = currentX - touchStart.current;
    setOffset(diff);
  };

  const handleTouchEnd = () => {
    if (Math.abs(offset) > 100) {
      onClose();
    } else {
      setOffset(0);
    }
    touchStart.current = null;
  };

  const isDragging = touchStart.current !== null;

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        transform: `translateX(calc(-50% + ${offset}px))`,
        opacity: 1 - Math.abs(offset) / 200,
        transition: isDragging ? 'none' : 'transform 0.2s ease-out, opacity 0.2s ease-out'
      }}
      className={`fixed bottom-6 left-1/2 w-[90%] md:w-auto max-w-md md:max-w-lg px-5 py-3.5 rounded-2xl text-white font-medium text-sm z-[60] shadow-lg flex items-center gap-3 animate-in slide-in-from-bottom-5 ${isError ? 'bg-red-600' : 'bg-green-600'}`}>
      <span className="flex-1">{message}</span>
      {actionText && onAction && (
        <button onClick={() => { onAction(); onClose(); }} className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors shrink-0">
          {actionText}
        </button>
      )}
    </div>
  );
}

function Spinner({ text }: { text: string }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-[60] text-white font-sans">
      <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
      <span className="mt-4 font-medium">{text}</span>
    </div>
  );
}

function AppSettingsCollapsible({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-white/10 rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
      >
        <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white/40">
          {icon}
          {label}
        </span>
        <ChevronDown className={`w-4 h-4 text-white/30 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-4 pb-4 pt-2 space-y-4 border-t border-white/5 animate-in fade-in duration-150">
          {children}
        </div>
      )}
    </div>
  );
}

const getSessionDefaultTitle = (date: Date | number) => {
  const d = new Date(date);
  return format(d, "EEE dd/MM/yy");
};

export default function App() {
  

  const [view, setView] = useState<'list' | 'detail'>('list');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [audioEntries, setAudioEntries] = useState<Record<string, AudioEntry>>({});
  const [sessionMedia, setSessionMedia] = useState<SessionMedia[]>([]);

  const [toastMessage, setToastMessage] = useState<{ text: string, isError: boolean, actionText?: string, onAction?: () => void, duration?: number } | null>(null);
  const [spinnerText, setSpinnerText] = useState<string | null>(null);

  const [deleteModal, setDeleteModal] = useState<{ id: string, type: 'session' | 'audio', title: string } | null>(null);
  const [reprocessModal, setReprocessModal] = useState<string | null>(null);
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [showBackupReminderModal, setShowBackupReminderModal] = useState(false);
  const [showAppSettings, setShowAppSettings] = useState(false);
  const [restoreBackupFile, setRestoreBackupFile] = useState<File | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Google Drive state
  const [driveAccount, setDriveAccount] = useState<DriveAccount | null>(
    () => getStoredDriveAccount()
  );
  const [driveConnected, setDriveConnected] = useState<boolean>(() => isDriveConnected());
  const [showDriveInfo, setShowDriveInfo] = useState(false);
  const [showDriveDisconnectConfirm, setShowDriveDisconnectConfirm] = useState(false);

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  // New features state
  const [groups, setGroups] = useState<SessionGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [glossaries, setGlossaries] = useState<DanceGlossary[]>([]);

  const [folderModal, setFolderModal] = useState<{ type: 'create' | 'rename', id?: string, name: string } | null>(null);
  const [deleteFolderModal, setDeleteFolderModal] = useState<{ id: string, name: string } | null>(null);
  const [deleteFolderAlsoSessions, setDeleteFolderAlsoSessions] = useState(false);
  const [showExportConfirm, setShowExportConfirm] = useState(false);
  const [exportIncludeAudioTranscripts, setExportIncludeAudioTranscripts] = useState(true);

  const [shareModal, setShareModal] = useState<{
    sessionId: string;
    shareReport: boolean;
    shareNotes: boolean;
    shareTranscripts: boolean;
    shareStrictSummary: boolean;
    shareDrills: boolean;
    shareHomework: boolean;
    shareTechnical: boolean;
    shareEmotional: boolean;
    shareMedia: boolean;
    generatedLink?: string;
    shareCode?: string;
    shareTimestamp?: number;
    availableReport: boolean;
    availableNotes: boolean;
    availableTranscripts: boolean;
    availableStrictSummary: boolean;
    availableDrills: boolean;
    availableHomework: boolean;
    availableTechnical: boolean;
    availableEmotional: boolean;
    availableMedia: boolean;
  } | null>(null);
  const [moveSessionModal, setMoveSessionModal] = useState<{ sessionId: string, currentGroupId?: string } | null>(null);
  const [sessionSortBy, setSessionSortBy] = useState<'date' | 'name' | 'created'>(
    (localStorage.getItem('lmplog_session_sort_by') as any) || 'date'
  );
  const [sessionSortOrder, setSessionSortOrder] = useState<'asc' | 'desc'>(
    (localStorage.getItem('lmplog_session_sort_order') as any) || 'desc'
  );
  const [folderSortBy, setFolderSortBy] = useState<'date' | 'name' | 'created'>(
    (localStorage.getItem('lmplog_folder_sort_by') as any) || 'date'
  );
  const [folderSortOrder, setFolderSortOrder] = useState<'asc' | 'desc'>(
    (localStorage.getItem('lmplog_folder_sort_order') as any) || 'desc'
  );
  const [importPreview, setImportPreview] = useState<any | null>(null);
  const [showImportCodeModal, setShowImportCodeModal] = useState(false);
  const [importCodeValue, setImportCodeValue] = useState('');

  // Browser History Navigation Sync
  const navigateTo = (newView: 'list' | 'detail', newSessionId: string | null, newGroupId: string | null, historyAction: 'push' | 'replace' | 'none' = 'push') => {
    setView(newView);
    setSelectedSessionId(newSessionId);
    setSelectedGroupId(newGroupId);

    if (historyAction === 'push') {
      window.history.pushState({
        view: newView,
        selectedSessionId: newSessionId,
        selectedGroupId: newGroupId
      }, '');
    } else if (historyAction === 'replace') {
      window.history.replaceState({
        view: newView,
        selectedSessionId: newSessionId,
        selectedGroupId: newGroupId
      }, '');
    }
  };

  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      const state = e.state;
      if (state) {
        setView(state.view || 'list');
        setSelectedSessionId(state.selectedSessionId || null);
        setSelectedGroupId(state.selectedGroupId || null);
      } else {
        setView('list');
        setSelectedSessionId(null);
        setSelectedGroupId(null);
      }
    };

    window.addEventListener('popstate', handlePopState);

    // Initialize root history state if we are launching on standard home view
    window.history.replaceState({
      view: 'list',
      selectedSessionId: null,
      selectedGroupId: null
    }, '');

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const getSessionLastActivity = (session: Session) => {
    const sessionAudios = (Object.values(audioEntries) as AudioEntry[]).filter(e => e.sessionId === session.id);
    if (sessionAudios.length === 0) return session.date;
    return Math.max(...sessionAudios.map(a => a.timestamp));
  };

  const getFolderLastActivity = (group: SessionGroup) => {
    const folderSessions = sessions.filter(s => s.groupId === group.id);
    if (folderSessions.length === 0) return group.dateCreated;
    return Math.max(...folderSessions.map(s => getSessionLastActivity(s)));
  };

  const sortFolders = (foldersList: SessionGroup[]) => {
    return [...foldersList].sort((a, b) => {
      let valA: any;
      let valB: any;
      if (folderSortBy === 'name') {
        valA = a.name.toLowerCase();
        valB = b.name.toLowerCase();
        return folderSortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      } else if (folderSortBy === 'created') {
        valA = a.dateCreated;
        valB = b.dateCreated;
      } else {
        valA = getFolderLastActivity(a);
        valB = getFolderLastActivity(b);
      }
      return folderSortOrder === 'asc' ? valA - valB : valB - valA;
    });
  };

  const sortSessions = (sessionsList: Session[]) => {
    return [...sessionsList].sort((a, b) => {
      let valA: any;
      let valB: any;
      if (sessionSortBy === 'name') {
        valA = a.title.toLowerCase();
        valB = b.title.toLowerCase();
        return sessionSortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      } else if (sessionSortBy === 'created') {
        valA = a.date;
        valB = b.date;
      } else {
        valA = getSessionLastActivity(a);
        valB = getSessionLastActivity(b);
      }
      return sessionSortOrder === 'asc' ? valA - valB : valB - valA;
    });
  };

  const handleSessionSortClick = (field: 'date' | 'name' | 'created') => {
    let nextOrder: 'asc' | 'desc';
    let nextField = sessionSortBy;
    if (sessionSortBy === field) {
      nextOrder = sessionSortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      nextField = field;
      nextOrder = field === 'name' ? 'asc' : 'desc';
    }
    setSessionSortBy(nextField);
    setSessionSortOrder(nextOrder);
    localStorage.setItem('lmplog_session_sort_by', nextField);
    localStorage.setItem('lmplog_session_sort_order', nextOrder);
  };

  const handleFolderSortClick = (field: 'date' | 'name' | 'created') => {
    let nextOrder: 'asc' | 'desc';
    let nextField = folderSortBy;
    if (folderSortBy === field) {
      nextOrder = folderSortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      nextField = field;
      nextOrder = field === 'name' ? 'asc' : 'desc';
    }
    setFolderSortBy(nextField);
    setFolderSortOrder(nextOrder);
    localStorage.setItem('lmplog_folder_sort_by', nextField);
    localStorage.setItem('lmplog_folder_sort_order', nextOrder);
  };


  // Listen for beforeinstallprompt for PWA install button
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      console.log('beforeinstallprompt event fired');
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  // Load from IndexedDB on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const loadedSessions = await db.getSessions();
        const loadedAudios = await db.getAudioEntries();
        const loadedGroups = await db.getGroups();

        // Sort sessions by date descending
        loadedSessions.sort((a, b) => b.date - a.date);
        setSessions(loadedSessions);
        setGroups(loadedGroups);

        // Convert audio entries array to record for easy lookup
        const audioRecord: Record<string, AudioEntry> = {};
        loadedAudios.forEach(a => audioRecord[a.id] = a);
        setAudioEntries(audioRecord);
      } catch (err) {
        console.error("Failed to load IndexedDB", err);
        showToast("Failed to load app data", true);
      }
    };
    loadData();
  }, []);

  const showToast = (text: string, isError = false, actionText?: string, onAction?: () => void, duration?: number) => setToastMessage({ text, isError, actionText, onAction, duration });
  const showSpinner = (text: string) => setSpinnerText(text);
  const hideSpinner = () => setSpinnerText(null);

  const handleExportBackup = async () => {
    showSpinner('Creating backup...');
    try {
      const backup = await db.exportDatabase();
      const json = JSON.stringify(backup);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lmplog-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast("Backup downloaded successfully!");
    } catch (e) {
      console.error("Backup failed", e);
      showToast("Failed to create backup", true);
    } finally {
      hideSpinner();
    }
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoreBackupFile(file);
    e.target.value = '';
  };

  const executeImportBackup = async (file: File) => {
    setRestoreBackupFile(null);
    showSpinner('Restoring database...');
    try {
      const text = await file.text();
      const backup = JSON.parse(text);
      await db.importDatabase(backup);
      showToast("Restore successful! Reloading application...");
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err) {
      console.error("Restore failed", err);
      showToast("Failed to restore backup (invalid file format)", true);
    } finally {
      hideSpinner();
    }
  };

  const handleResetApp = async () => {
    setShowResetConfirm(false);
    showSpinner('Resetting LMPLOG data...');
    try {
      await db.clearDatabase();
      showToast("App reset successfully! Reloading...");
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err) {
      console.error("Reset failed", err);
      showToast("Failed to reset LMPLOG data", true);
    } finally {
      hideSpinner();
    }
  };

  // ─── Google Drive Handlers ───────────────────────────────────────────────────

  const handleConnectDrive = async () => {
    showSpinner('Connecting Google Drive...');
    try {
      await connectDriveAccount();
      const account = getStoredDriveAccount();
      setDriveAccount(account);
      setDriveConnected(true);
      showToast("Google Drive connected!");
    } catch (err: any) {
      console.error('Drive connect failed:', err);
      showToast("Failed to connect Google Drive. Please try again.", true);
    } finally {
      hideSpinner();
    }
  };

  const handleDisconnectDrive = () => {
    setShowDriveDisconnectConfirm(true);
  };

  const confirmDisconnectDrive = () => {
    clearDriveAuth();
    setDriveAccount(null);
    setDriveConnected(false);
    setShowDriveDisconnectConfirm(false);
    showToast("Google Drive disconnected.");
  };

  const handleDriveBackup = async () => {
    showSpinner('Backing up to Google Drive...');
    try {
      const backup = await db.exportDatabase();
      await uploadBackupToDrive(JSON.stringify(backup));
      showToast("Backup saved to Google Drive!");
    } catch (err: any) {
      console.error('Drive backup failed:', err);
      // Token may have expired — reset connection
      if (err.message?.includes('401')) {
        handleDisconnectDrive();
      }
      showToast("Failed to back up to Google Drive.", true);
    } finally {
      hideSpinner();
    }
  };

  const handleDriveRestore = async () => {
    showSpinner('Restoring from Google Drive...');
    try {
      const backup = await downloadBackupFromDrive();
      if (!backup) {
        showToast("No backup found in your Google Drive.", true);
        return;
      }
      await db.importDatabase(backup);
      showToast("Restore from Google Drive successful! Reloading...");
      setTimeout(() => window.location.reload(), 1500);
    } catch (err: any) {
      console.error('Drive restore failed:', err);
      if (err.message?.includes('401')) {
        handleDisconnectDrive();
      }
      showToast("Failed to restore from Google Drive.", true);
    } finally {
      hideSpinner();
    }
  };

  // Migration: Update old session titles to new format
  useEffect(() => {
    const migrateTitles = async () => {
      // Matches "Fri, Feb 27, 2026"
      const oldFormatRegex = /^[A-Z][a-z]{2}, [A-Z][a-z]{2} \d{1,2}, \d{4}$/;
      const needsMigration = sessions.filter(s => oldFormatRegex.test(s.title));

      if (needsMigration.length > 0) {
        console.log(`[Migration] Updating ${needsMigration.length} session titles to new format`);
        const updatedSessions = [...sessions];
        let changed = false;

        for (const session of needsMigration) {
          const newTitle = getSessionDefaultTitle(session.date);
          const idx = updatedSessions.findIndex(s => s.id === session.id);
          if (idx !== -1) {
            updatedSessions[idx] = { ...updatedSessions[idx], title: newTitle };
            await db.saveSession(updatedSessions[idx]);
            changed = true;
          }
        }

        if (changed) {
          setSessions(updatedSessions);
        }
      }
    };
    if (sessions.length > 0) {
      migrateTitles();
    }
  }, [sessions.length > 0]); // Run once when sessions are loaded

  // Migration 2: Retroactively clean up old technical summaries from audio clips
  // Now that consolidation handles all summaries, we want old individual clips to just show transcripts
  useEffect(() => {
    const cleanOldAudioEntries = async () => {
      const keys = Object.keys(audioEntries);
      if (keys.length === 0) return;

      let changedCount = 0;
      const updatedEntries = { ...audioEntries };

      for (const id of keys) {
        const entry: any = updatedEntries[id];
        let needsSave = false;

        // Remove old shape keys if present
        if (entry.strictSummary) { delete entry.strictSummary; needsSave = true; }
        if (entry.expandedInsights) { delete entry.expandedInsights; needsSave = true; }
        if (entry.processedData) { delete entry.processedData; needsSave = true; }
        if (entry.bulletPoints) { delete entry.bulletPoints; needsSave = true; }

        if (needsSave) {
          await db.saveAudioEntry(entry);
          changedCount++;
        }
      }

      if (changedCount > 0) {
        console.log(`[Migration] Cleaned up legacy summary data from ${changedCount} audio entries`);
        setAudioEntries(updatedEntries);
      }
    };

    cleanOldAudioEntries();
  }, [Object.keys(audioEntries).length > 0]); // Trigger once entries load


  const selectedSession = sessions.find(s => s.id === selectedSessionId);

  // Load media for the selected session whenever it changes
  useEffect(() => {
    if (!selectedSessionId) {
      setSessionMedia([]);
      return;
    }
    db.getSessionMedia(selectedSessionId).then(items => setSessionMedia(items)).catch(console.error);
  }, [selectedSessionId]);

  // --- Actions ---

  const createSession = async () => {
    const newSession: Session = {
      id: crypto.randomUUID(),
      title: getSessionDefaultTitle(Date.now()),
      subtitle: '',
      date: Date.now(),
      groupId: selectedGroupId || undefined,
      glossaryId: 'auto' // default to auto-detect
    };

    await db.saveSession(newSession);

    setSessions(prev => {
      const next = [newSession, ...prev];
      if (next.length >= 5 && !localStorage.getItem('hasShownBackupHint') && !isDriveConnected()) {
        localStorage.setItem('hasShownBackupHint', 'true');
        setTimeout(() => setShowBackupReminderModal(true), 1000);
      }
      return next;
    });
    navigateTo('detail', newSession.id, selectedGroupId);
  };

  const updateSession = async (id: string, changes: Partial<Session>) => {
    const session = sessions.find(s => s.id === id);
    if (!session) return;
    const updated = { ...session, ...changes };
    await db.saveSession(updated);
    setSessions(prev => prev.map(s => s.id === id ? updated : s));
  };

  const updateAudioEntry = async (id: string, changes: Partial<AudioEntry>) => {
    const entry = audioEntries[id];
    if (!entry) return;
    const updated = { ...entry, ...changes };
    await db.saveAudioEntry(updated);
    setAudioEntries(prev => ({ ...prev, [id]: updated }));
  };

  const handleUndo = (id: string, type: 'session' | 'audio', data: any, extraData: any, timeoutId: NodeJS.Timeout) => {
    clearTimeout(timeoutId);
    if (type === 'session') {
      setSessions(prev => [data, ...prev].sort((a, b) => b.date - a.date));
      const audios = extraData as AudioEntry[];
      if (audios) {
        setAudioEntries(prev => {
          const copy = { ...prev };
          audios.forEach(a => copy[a.id] = a);
          return copy;
        });
      }
    } else {
      setAudioEntries(prev => ({ ...prev, [id]: data }));
    }
    showToast("Action undone");
  };

  const confirmDelete = async () => {
    if (!deleteModal) return;
    const { id, type, title } = deleteModal;
    setDeleteModal(null);

    if (type === 'session') {
      const sessionToDelete = sessions.find(s => s.id === id);
      if (!sessionToDelete) return;

      const sessionAudios = await db.getSessionAudios(id);
      const sessionMediaItems = await db.getSessionMedia(id);

      setSessions(prev => prev.filter(s => s.id !== id));
      const newEntries = { ...audioEntries };
      sessionAudios.forEach(a => delete newEntries[a.id]);
      setAudioEntries(newEntries);
      if (selectedSessionId === id) {
        setSessionMedia([]);
      }

      if (selectedSessionId === id) {
        navigateTo('list', null, sessionToDelete.groupId || null, 'replace');
      }

      const timeoutId = setTimeout(async () => {
        for (const audio of sessionAudios) await db.deleteAudioEntry(audio.id);
        for (const media of sessionMediaItems) await db.deleteMediaItem(media.id);
        await db.deleteSession(id);
      }, 5000);

      showToast("Session deleted", false, "Undo", () => handleUndo(id, type, sessionToDelete, sessionAudios, timeoutId));

    } else {
      const audioToDelete = audioEntries[id];
      if (!audioToDelete) return;

      setAudioEntries(prev => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });

      const timeoutId = setTimeout(async () => {
        await db.deleteAudioEntry(id);
      }, 5000);

      showToast("Audio deleted", false, "Undo", () => handleUndo(id, type, audioToDelete, null, timeoutId));
    }
  };

  const requestDeleteSession = (id: string, title: string) => setDeleteModal({ id, type: 'session', title });
  const requestDeleteAudio = (id: string, title: string) => setDeleteModal({ id, type: 'audio', title });



  // Folder Actions
  const handleCreateOrRenameFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderModal || !folderModal.name.trim()) return;

    if (folderModal.type === 'create') {
      const newGroup: SessionGroup = {
        id: crypto.randomUUID(),
        name: folderModal.name.trim(),
        dateCreated: Date.now()
      };
      await db.saveGroup(newGroup);
      setGroups(prev => [...prev, newGroup]);
      showToast(`Folder "${newGroup.name}" created!`);
    } else if (folderModal.type === 'rename' && folderModal.id) {
      const group = groups.find(g => g.id === folderModal.id);
      if (group) {
        const updated = { ...group, name: folderModal.name.trim() };
        await db.saveGroup(updated);
        setGroups(prev => prev.map(g => g.id === folderModal.id ? updated : g));
        showToast(`Folder renamed to "${updated.name}"`);
      }
    }
    setFolderModal(null);
  };

  const confirmDeleteFolder = async (deleteSessions: boolean) => {
    if (!deleteFolderModal) return;
    const { id, name } = deleteFolderModal;
    setDeleteFolderModal(null);

    await db.deleteGroup(id);
    setGroups(prev => prev.filter(g => g.id !== id));

    const allSessions = await db.getSessions();
    const updatedSessions = [...sessions];

    for (const session of allSessions) {
      if (session.groupId === id) {
        if (deleteSessions) {
          await db.deleteSession(session.id);
          const audios = await db.getSessionAudios(session.id);
          for (const a of audios) {
            await db.deleteAudioEntry(a.id);
          }
          // Remove from local sessions state
          const idx = updatedSessions.findIndex(s => s.id === session.id);
          if (idx !== -1) updatedSessions.splice(idx, 1);
        } else {
          // Ungroup session
          const updated = { ...session, groupId: undefined };
          await db.saveSession(updated);
          const idx = updatedSessions.findIndex(s => s.id === session.id);
          if (idx !== -1) updatedSessions[idx] = updated;
        }
      }
    }
    setSessions(updatedSessions);
    if (selectedGroupId === id) {
      navigateTo('list', null, null, 'replace');
    }
    showToast(deleteSessions ? `Folder "${name}" and its sessions deleted` : `Folder "${name}" deleted (sessions preserved)`);
  };


  const handleGenerateShareLink = async () => {
    if (!shareModal || !selectedSession) return;
    showSpinner("Generating document...");
    try {
      const payload: any = {
        title: selectedSession.title,
        subtitle: selectedSession.subtitle,
        date: selectedSession.date,
      };
      if (shareModal.shareReport) {
        const report = await db.getSessionFinalReport(selectedSession.id);
        if (report && report.report) {
          const reportData: any = {};
          if (shareModal.shareStrictSummary && report.report.strictSummary) {
            reportData.strictSummary = report.report.strictSummary;
          }
          if (report.report.expandedInsights) {
            const insights: any = {};
            if (shareModal.shareDrills && report.report.expandedInsights.drills) {
              insights.drills = report.report.expandedInsights.drills;
            }
            if (shareModal.shareHomework && report.report.expandedInsights.homework) {
              insights.homework = report.report.expandedInsights.homework;
            }
            if (shareModal.shareTechnical && report.report.expandedInsights.technicalExpansion) {
              insights.technicalExpansion = report.report.expandedInsights.technicalExpansion;
            }
            if (shareModal.shareEmotional && report.report.expandedInsights.emotionalNotes) {
              insights.emotionalNotes = report.report.expandedInsights.emotionalNotes;
            }
            if (Object.keys(insights).length > 0) {
              reportData.expandedInsights = insights;
            }
          }
          if (Object.keys(reportData).length > 0) {
            payload.report = reportData;
            if (report.timestamp) {
              payload.reportTimestamp = report.timestamp;
            }
          }
        }
      }
      if (shareModal.shareNotes) {
        payload.notes = selectedSession.notes;
      }
      const audios = await db.getSessionAudios(selectedSession.id);
      audios.sort((a, b) => b.timestamp - a.timestamp);
      const audiosWithNames = audios.map((a, index) => {
        const defaultName = `Audio Entry ${audios.length - index}.webm`;
        return { ...a, exportFilename: a.filename || defaultName };
      });

      if (shareModal.shareTranscripts) {
        payload.transcripts = audiosWithNames.map(a => ({
          filename: a.exportFilename,
          timestamp: a.timestamp,
          transcript: a.transcript,
          strictSummary: a.strictSummary,
          expandedInsights: a.expandedInsights
        }));
      }

      if (shareModal.shareMedia) {
        const sessionMediaItems = await db.getSessionMedia(selectedSession.id);
        
        payload.mediaItems = sessionMediaItems.map(m => ({
          filename: m.filename,
          mimeType: m.mimeType,
          timestamp: m.timestamp
        }));

        const zip = new JSZip();
        zip.file('session.json', JSON.stringify(payload, null, 2));
        
        for (const a of audiosWithNames) {
          if (a.audioBlob) {
            zip.file(`media/${a.exportFilename}`, a.audioBlob);
          }
        }
        for (const m of sessionMediaItems) {
          if (m.blob) {
            zip.file(`media/${m.filename}`, m.blob);
          } else if (m.fileHandle) {
            try {
              const perm = await m.fileHandle.queryPermission({ mode: 'read' });
              if (perm !== 'granted') {
                await m.fileHandle.requestPermission({ mode: 'read' });
              }
              const file = await m.fileHandle.getFile();
              zip.file(`media/${m.filename}`, file);
            } catch (e) {
              console.error("Failed to read fileHandle for export", m.filename, e);
            }
          }
        }
        
        const content = await zip.generateAsync({ type: 'blob' });
        const fileName = `lmplog-session-${selectedSession.id.substring(0, 8)}.lmplog.zip`;
        let sharedViaApi = false;

        if (navigator.canShare) {
          const file = new File([content], fileName, { type: 'application/zip' });
          if (navigator.canShare({ files: [file] })) {
            try {
              await navigator.share({
                files: [file]
              });
              sharedViaApi = true;
            } catch (error: any) {
              console.log('Share failed or cancelled', error);
              if (error.name === 'AbortError') {
                setShareModal(null);
                hideSpinner();
                return;
              }
            }
          }
        }

        if (!sharedViaApi) {
          saveAs(content, fileName);
          showToast("Session exported as file");
        } else {
          showToast("Session shared successfully!");
        }
        
        const timestamp = Date.now();
        const updatedContent = {
          report: shareModal.shareReport,
          notes: shareModal.shareNotes,
          transcripts: shareModal.shareTranscripts,
          media: shareModal.shareMedia
        };
        await updateSession(selectedSession.id, { 
          shareMethod: 'file', 
          shareTimestamp: timestamp,
          sharedContent: updatedContent
        });

        setShareModal({
          ...shareModal,
          shareMethod: 'file',
          sharedContent: updatedContent,
          shareTimestamp: timestamp,
          viewState: 'active_file'
        });
        return;
      }

      const isUpdating = !!selectedSession.shareId;

      const res = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shareId: selectedSession.shareId,
          sessionData: payload
        })
      });
      if (!res.ok) throw new Error('Share request failed');
      const { shareId } = await res.json();
      const shareTimestamp = Date.now();

      const updatedContent = {
        report: shareModal.shareReport,
        notes: shareModal.shareNotes,
        transcripts: shareModal.shareTranscripts,
        media: shareModal.shareMedia
      };

      if (shareId !== selectedSession.shareId || selectedSession.shareTimestamp !== shareTimestamp || selectedSession.shareMethod !== 'code') {
        await updateSession(selectedSession.id, { 
          shareId, 
          shareTimestamp, 
          shareMethod: 'code',
          sharedContent: updatedContent
        });
      }

      setShareModal(prev => prev ? { 
        ...prev, 
        generatedLink: shareId, 
        shareCode: shareId, 
        shareTimestamp,
        shareMethod: 'code',
        sharedContent: updatedContent,
        viewState: 'active_code' 
      } : null);
      showToast(isUpdating ? "Shared copy updated successfully!" : "Share code generated!");
    } catch (e) {
      console.error(e);
      showToast("Failed to generate share code", true);
    } finally {
      hideSpinner();
    }
  };
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    showSpinner("Importing session...");
    try {
      const zip = await JSZip.loadAsync(file);
      const sessionJsonStr = await zip.file('session.json')?.async('string');
      if (!sessionJsonStr) throw new Error('Invalid .lmplog file: missing session.json');
      
      const sessionData = JSON.parse(sessionJsonStr);
      const parsedMediaFiles: any[] = [];
      
      if (sessionData.transcripts) {
        for (const t of sessionData.transcripts) {
          const fname = t.filename || 'undefined';
          const fileData = zip.file(`media/${fname}`);
          if (fileData) {
            const rawBlob = await fileData.async('blob');
            let mimeType = 'audio/webm';
            if (fname.endsWith('.m4a')) mimeType = 'audio/mp4';
            else if (fname.endsWith('.mp3')) mimeType = 'audio/mpeg';
            else if (fname.endsWith('.wav')) mimeType = 'audio/wav';
            else if (fname.endsWith('.caf')) mimeType = 'audio/x-caf';
            const blob = new Blob([rawBlob], { type: mimeType });
            parsedMediaFiles.push({ filename: fname, blob, isAudioEntry: true });
            if (!t.filename) {
              t.filename = fname;
            }
          }
        }
      }
      
      if (sessionData.mediaItems) {
        for (const m of sessionData.mediaItems) {
          const fileData = zip.file(`media/${m.filename}`);
          if (fileData) {
            const rawBlob = await fileData.async('blob');
            const blob = new Blob([rawBlob], { type: m.mimeType || 'image/jpeg' });
            parsedMediaFiles.push({ filename: m.filename, blob, isAudioEntry: false, mimeType: m.mimeType, timestamp: m.timestamp });
          }
        }
      }
      
      sessionData.parsedMediaFiles = parsedMediaFiles;
      setShowImportCodeModal(false);
      setImportCodeValue('');
      setImportPreview(sessionData);
    } catch (err: any) {
      console.error(err);
      showToast("Failed to retrieve shared session details", true);
    } finally {
      hideSpinner();
      e.target.value = '';
    }
  };

  const handleImportSession = async () => {
    if (!importPreview) return;
    showSpinner("Importing session...");
    try {
      const newSessionId = crypto.randomUUID();
      const newSession: Session = {
        id: newSessionId,
        title: importPreview.title + " (Imported)",
        subtitle: importPreview.subtitle || '',
        date: importPreview.date || Date.now(),
        notes: importPreview.notes || '',
        groupId: selectedGroupId || undefined,
        glossaryId: 'auto'
      };

      await db.saveSession(newSession);

      if (importPreview.report) {
        await db.saveFinalReport({
          id: crypto.randomUUID(),
          sessionId: newSessionId,
          report: importPreview.report,
          timestamp: importPreview.reportTimestamp || importPreview.date || Date.now()
        });
      }

      if (importPreview.transcripts && Array.isArray(importPreview.transcripts)) {
        for (const t of importPreview.transcripts) {
          const mediaFile = importPreview.parsedMediaFiles?.find((f: any) => f.isAudioEntry && f.filename === t.filename);
          const audioBlob = mediaFile ? mediaFile.blob : new Blob([], { type: 'audio/webm' });
          
          const newAudio: AudioEntry = {
            id: crypto.randomUUID(),
            sessionId: newSessionId,
            timestamp: t.timestamp || Date.now(),
            language: 'auto',
            transcript: t.transcript,
            strictSummary: t.strictSummary,
            expandedInsights: t.expandedInsights,
            type: 'recording',
            filename: t.filename,
            audioBlob
          };
          await db.saveAudioEntry(newAudio);
        }
      }

      if (importPreview.parsedMediaFiles) {
        for (const m of importPreview.parsedMediaFiles) {
          if (!m.isAudioEntry) {
            await db.saveMediaItem({
              id: crypto.randomUUID(),
              sessionId: newSessionId,
              timestamp: m.timestamp || Date.now(),
              mimeType: m.mimeType || 'image/jpeg',
              filename: m.filename,
              blob: m.blob,
              size: m.blob.size,
              storageMode: 'blob'
            });
          }
        }
      }

      // Refresh state
      const loadedSessions = await db.getSessions();
      loadedSessions.sort((a, b) => b.date - a.date);
      setSessions(loadedSessions);

      const loadedAudios = await db.getAudioEntries();
      const audioRecord: Record<string, AudioEntry> = {};
      loadedAudios.forEach(a => audioRecord[a.id] = a);
      setAudioEntries(audioRecord);

      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
      setImportPreview(null);
      showToast("Session imported successfully!");
    } catch (e) {
      console.error(e);
      showToast("Failed to import session", true);
    } finally {
      hideSpinner();
    }
  };

  const addAudioEntry = async (sessionId: string, blob: Blob, language: Language, type: 'recording' | 'upload', filename?: string) => {
    const entryId = crypto.randomUUID();

    const newEntry: AudioEntry = {
      id: entryId,
      sessionId,
      timestamp: Date.now(),
      language,
      type,
      filename,
      audioBlob: blob,
    };

    // Save to IndexedDB and update UI
    await db.saveAudioEntry(newEntry);
    setAudioEntries(prev => ({ ...prev, [entryId]: newEntry }));
    const sessionEntries = (Object.values(audioEntries) as AudioEntry[]).filter(e => e.sessionId === sessionId);
    if (sessionEntries.length === 1 && !localStorage.getItem('hasShownConsolidationHint')) {
      localStorage.setItem('hasShownConsolidationHint', 'true');
      // Show the hint instead of the default toast
      showToast("💡 LMPLOG is ready! Tap the 'Generate Report' (🪄) button at the end of your session to consolidate your recordings.", false, undefined, undefined, 10000);
    } else {
      showToast(filename ? `[${filename}] added!` : "Audio added!");
    }
  };



  // `deleteAudioEntry` has moved to `requestDeleteAudio` & `confirmDelete`.

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, language: Language) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !selectedSession) return;

    for (const file of files) {
      await addAudioEntry(selectedSession.id, file, language, 'upload', file.name);
    }
    // reset input
    e.target.value = '';
  };






  const folders = groups.filter(g => g.id !== 'root');
  const hasFolders = folders.length > 0;
  const hasOrphanSessions = sessions.some(s => !s.groupId);
  const showSessionsSection = selectedGroupId ? true : (!hasFolders || hasOrphanSessions);



  // --- Renderers ---
  return (
    <div className="min-h-screen font-sans selection:bg-brand/30">
      {spinnerText && <Spinner text={spinnerText} />}
      {toastMessage && <Toast message={toastMessage.text} isError={toastMessage.isError} actionText={toastMessage.actionText} onAction={toastMessage.onAction} duration={toastMessage.duration} onClose={() => setToastMessage(null)} />}

      {/* Delete Modal */}
      {deleteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-[60] p-6">
          <div className="glass p-8 max-w-sm w-full space-y-6 animate-in zoom-in-95">
            <h3 className="text-xl font-bold">{"Confirm Deletion"}</h3>
            <p className="text-white/70">
              {deleteModal.type === 'session' ? `Are you sure you want to delete the session: ${deleteModal.title}?` : `Are you sure you want to delete this audio: ${deleteModal.title}?`}
            </p>
            <div className="flex gap-3 justify-end items-center mt-6">
              <button onClick={() => setDeleteModal(null)} className="px-5 py-2.5 rounded-xl font-bold bg-white/10 hover:bg-white/20 transition-colors min-h-[44px]">{"Cancel"}</button>
              <button onClick={confirmDelete} className="px-5 py-2.5 rounded-xl font-bold bg-red-600 hover:bg-red-700 transition-colors shadow-lg shadow-red-600/30 text-white min-h-[44px]">{"Delete"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Export Session Modal */}
      {showExportConfirm && selectedSession && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-[60] p-6" onClick={() => setShowExportConfirm(false)}>
          <div className="glass p-8 max-w-sm w-full space-y-6 animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold flex items-center gap-2">
              <Download className="w-5 h-5 text-brand" />
              {"Export Session"}
            </h3>
            <p className="text-white/70 text-sm">
              {"You are about to download this session (including all transcriptions, summary reports, and homework)."}
            </p>

            <div className="space-y-3">
              <label className="text-xs font-bold text-white/40 uppercase tracking-wider">{"Include Data"}</label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={exportIncludeAudioTranscripts}
                  onClick={() => setExportIncludeAudioTranscripts(!exportIncludeAudioTranscripts)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${exportIncludeAudioTranscripts ? 'bg-brand' : 'bg-white/20'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${exportIncludeAudioTranscripts ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
                <span className="text-sm text-white/80 font-medium">
                  {"Include Audio Transcripts"}
                </span>
              </div>
            </div>

            <div className="bg-brand/10 border border-brand/20 p-3 rounded-xl flex items-start gap-3 mt-4">
              <AlertTriangle className="w-5 h-5 text-brand shrink-0 mt-0.5" />
              <p className="text-xs text-brand/90 leading-relaxed">
                {"After clicking Download, your browser's Print dialog will open. Select 'Save as PDF' as the destination to save the file."}
              </p>
            </div>

            <div className="flex gap-3 justify-end items-center mt-6">
              <button
                onClick={() => setShowExportConfirm(false)}
                className="px-5 py-2.5 rounded-xl font-bold bg-white/10 hover:bg-white/20 transition-colors min-h-[44px] cursor-pointer text-xs"
              >
                {"Cancel"}
              </button>
              <button
                onClick={async () => {
                  setShowExportConfirm(false);
                  if (!exportIncludeAudioTranscripts) {
                    document.body.classList.add('no-print-transcripts');
                  } else {
                    document.body.classList.remove('no-print-transcripts');
                  }
                  const dateStr = format(new Date(selectedSession.date), "yyyy-MM-dd");
                  let fileName = `LMPLOG_${dateStr}`;
                  if (selectedSession.title) {
                    const safeTitle = selectedSession.title.replace(/[<>:"/\\|?*]/g, '_').trim();
                    fileName = `LMPLOG_${safeTitle}`;
                  }
                  const originalTitle = document.title;
                  document.title = fileName;
                  setTimeout(() => {
                    const handleCleanup = () => {
                      document.title = originalTitle;
                      window.removeEventListener('afterprint', handleCleanup);
                      window.removeEventListener('focus', handleCleanup);
                    };
                    window.addEventListener('afterprint', handleCleanup);
                    window.addEventListener('focus', handleCleanup);
                    window.print();
                    setTimeout(() => { document.title = originalTitle; }, 10000);
                  }, 100);
                }}
                className="px-5 py-2.5 rounded-xl font-bold bg-brand hover:bg-brand-light text-black transition-colors shadow-lg shadow-brand/20 min-h-[44px] cursor-pointer text-xs"
              >
                {"Download"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Backup Reminder Modal */}
      {showBackupReminderModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-50 p-6">
          <div className="glass p-8 max-w-sm w-full space-y-6 animate-in zoom-in-95 text-center">
            <div className="w-16 h-16 bg-brand/20 rounded-full flex items-center justify-center mx-auto mb-2">
              <svg className="w-8 h-8 text-brand" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29" /><polyline points="8 13 12 17 16 13" /><line x1="12" y1="17" x2="12" y2="9" /></svg>
            </div>
            <h3 className="text-xl font-bold">
              {"Keep your data safe!"}
            </h3>
            <p className="text-white/70 leading-relaxed">
              {"Your LMPLOG data lives only on this device. Connect Google Drive in Settings for automatic cloud backups - or download a manual backup as a fallback."}
            </p>
            <div className="flex gap-3 justify-end items-center mt-6">
              <button
                onClick={() => setShowBackupReminderModal(false)}
                className="flex-1 px-5 py-2.5 rounded-xl font-bold bg-white/10 hover:bg-white/20 transition-colors min-h-[44px] text-sm text-white"
              >
                {"Got it!"}
              </button>
              <button
                onClick={() => { setShowBackupReminderModal(false); setShowAppSettings(true); }}
                className="flex-1 px-5 py-2.5 rounded-xl font-bold bg-brand hover:bg-brand/90 transition-colors shadow-lg shadow-brand/20 text-black min-h-[44px] text-sm"
              >
                {"Open Settings"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* App Settings Drawer */}
      {showAppSettings && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 animate-in fade-in duration-200"
            onClick={() => setShowAppSettings(false)}
          />
          {/* Drawer Panel */}
          <div
            className="fixed top-0 bottom-0 right-0 w-full sm:w-96 bg-[#1e1e22]/95 border-l border-white/10 backdrop-blur-md pt-6 pb-6 pl-6 pr-0 z-50 flex flex-col gap-6 shadow-2xl animate-in slide-in-from-right duration-300"
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-white/5 pb-3 pr-6">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-brand" />
                {"LMPLOG Settings"}
              </h3>
              <button
                onClick={() => setShowAppSettings(false)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/80 transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto space-y-8 pr-6">

              {/* Cloud Sync (Google Drive) — PRIMARY */}
              <div className="space-y-4">
                {/* Header row */}
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  <h4 className="text-xs font-bold text-white/40 uppercase tracking-wider flex-1">
                    {"Cloud Sync"}
                  </h4>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand/20 text-brand border border-brand/30">
                    {"Recommended"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowDriveInfo(o => !o)}
                    className="ml-1 w-5 h-5 rounded-full border border-white/20 text-white/40 hover:text-white hover:border-white/40 text-[10px] font-bold flex items-center justify-center shrink-0 transition-colors"
                    title="Why use Google Drive?"
                    aria-label="Learn about Google Drive sync"
                  >
                    ?
                  </button>
                </div>

                {/* Info panel — why Drive */}
                {showDriveInfo && (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3.5 space-y-2 animate-in fade-in duration-150">
                    <p className="text-xs font-bold text-white/70">{"Why back up to Google Drive?"}</p>
                    <ul className="space-y-1.5">
                      {[
                        { emoji: '🔒', text: "Your data stays 100% yours - LMPLOG has no server." },
                        { emoji: '⚠️', text: "Mobile browsers can wipe local storage when your phone runs low on space." },
                        { emoji: '🔄', text: "Restore your sessions, folders, and glossaries on any device instantly." },
                        { emoji: '🛡️', text: "We only request access to a private app folder - we cannot see any other file in your Google Drive." },
                        { emoji: '✨', text: "Auto-backs up silently every time you consolidate a session." },
                      ].map(({ emoji, text }, i) => (
                        <li key={i} className="text-[11px] leading-snug flex gap-1.5 items-start">
                          <span className="shrink-0 mt-px">{emoji}</span>
                          <span className="text-white/60">{text}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* NOT connected — big connect CTA */}
                {!driveConnected && (
                  <button
                    id="driveConnectBtn"
                    onClick={handleConnectDrive}
                    className="w-full flex items-center justify-center gap-2.5 p-4 rounded-xl border border-brand/30 bg-brand/10 text-white hover:bg-brand/20 hover:border-brand/50 transition-all text-sm font-bold shadow-sm shadow-brand/10"
                  >
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84z" />
                    </svg>
                    {"Connect Google Drive"}
                  </button>
                )}

                {/* CONNECTED — account row + actions */}
                {driveConnected && (
                  <div className="space-y-3">
                    {/* Account pill */}
                    <div className="flex items-center gap-3 p-3 rounded-xl border border-green-500/20 bg-green-500/5">
                      {driveAccount?.picture ? (
                        <img src={driveAccount.picture} alt="" className="w-8 h-8 rounded-full shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-brand/20 flex items-center justify-center shrink-0">
                          <span className="text-brand text-xs font-bold">
                            {driveAccount?.email?.[0]?.toUpperCase() ?? 'G'}
                          </span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-white/40 uppercase tracking-wider">{"Connected as"}</p>
                        <p className="text-xs font-semibold text-white truncate">{driveAccount?.email ?? 'Google Account'}</p>
                      </div>
                      <button
                        id="driveDisconnectBtn"
                        onClick={handleDisconnectDrive}
                        className="text-[10px] text-white/30 hover:text-red-400 transition-colors shrink-0 font-semibold"
                      >
                        {"Disconnect"}
                      </button>
                    </div>

                    {/* Backup + Restore buttons */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        id="driveBackupBtn"
                        onClick={handleDriveBackup}
                        className="flex flex-col items-center justify-center gap-1.5 p-3.5 rounded-xl border border-white/10 bg-white/5 hover:bg-green-500/10 hover:border-green-500/30 transition-all"
                      >
                        <CloudUpload className="w-5 h-5 text-green-400" />
                        <span className="text-[11px] font-bold text-white/80">{"Backup Now"}</span>
                      </button>
                      <button
                        id="driveRestoreBtn"
                        onClick={handleDriveRestore}
                        className="flex flex-col items-center justify-center gap-1.5 p-3.5 rounded-xl border border-white/10 bg-white/5 hover:bg-violet-500/10 hover:border-violet-500/30 transition-all"
                      >
                        <CloudDownload className="w-5 h-5 text-violet-400" />
                        <span className="text-[11px] font-bold text-white/80">{"Restore from Drive"}</span>
                      </button>
                    </div>
                    <p className="text-[10px] text-white/30 text-center leading-snug">{"You can also back up manually at any time by clicking the button above."}</p>
                  </div>
                )}
              </div>

              {/* Backup & Restore (local) — SECONDARY */}
              <AppSettingsCollapsible
                label={"Backup & Restore"}
                icon={<Download className="w-4 h-4 text-brand" />}
              >
                {/* Backup Section */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-white/40 uppercase tracking-wider flex items-center gap-2">
                    <Download className="w-3.5 h-3.5 text-brand" />
                    {"Backup Database"}
                  </h4>
                  <p className="text-xs text-white/60 leading-relaxed">
                    {"Download a full backup of all your sessions, folder structures, vocabulary glossaries, and recorded audio files to your local device."}
                  </p>
                  <button
                    onClick={handleExportBackup}
                    className="w-full flex items-center justify-center gap-2 p-3.5 rounded-xl border border-white/10 bg-white/5 text-white hover:bg-white/10 hover:border-brand/40 transition-all text-xs font-bold shadow-sm"
                  >
                    <Download className="w-4 h-4 text-brand" />
                    {"Export JSON Backup"}
                  </button>
                </div>

                {/* Restore Section */}
                <div className="space-y-3 pt-4 border-t border-white/5 mt-4">
                  <h4 className="text-xs font-bold text-white/40 uppercase tracking-wider flex items-center gap-2">
                    <Upload className="w-3.5 h-3.5 text-brand" />
                    {"Restore Database"}
                  </h4>
                  <p className="text-xs text-white/60 leading-relaxed text-red-300/80">
                    {"Restore your application from a previously downloaded JSON backup file."} <strong>{"Warning: This will overwrite and delete all your current local sessions and data."}</strong>
                  </p>
                  <label className="cursor-pointer w-full flex items-center justify-center gap-2 p-3.5 rounded-xl border border-dashed border-white/20 bg-white/5 hover:bg-white/10 text-white hover:border-brand/45 transition-all text-xs font-bold shadow-sm">
                    <Upload className="w-4 h-4 text-brand" />
                    <span>{"Import JSON Backup"}</span>
                    <input
                      type="file"
                      accept=".json"
                      className="hidden"
                      onChange={handleImportBackup}
                    />
                  </label>
                </div>
              </AppSettingsCollapsible>



              {/* Reset Section */}
              <div className="space-y-3 border-t border-white/5 pt-6">
                <h4 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-wider text-xs text-white/40">
                  <Trash2 className="w-4 h-4 text-red-400" />
                  {"Reset Application"}
                </h4>
                <p className="text-xs text-white/60 leading-relaxed text-red-300/80">
                  {"Wipe all folders, sessions, settings, and audio recordings from this device."} <strong>{"Warning: This action is permanent and cannot be undone."}</strong>
                </p>
                <button
                  onClick={() => setShowResetConfirm(true)}
                  className="w-full flex items-center justify-center gap-2 p-3.5 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 hover:bg-red-500/10 hover:text-white transition-all text-xs font-bold shadow-sm"
                >
                  <Trash2 className="w-4 h-4" />
                  {"Reset App Data"}
                </button>
              </div>
            </div>

            {/* Drawer Footer / Version Info */}
            <div className="border-t border-white/5 pt-4 text-center mt-auto pr-6">
              <button
                onClick={() => setShowVersionModal(true)}
                className="text-[10px] text-white/30 tracking-widest font-mono hover:text-white/60 transition-colors cursor-pointer"
              >
                LMPLOG v{version}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Version & Changelog Modal */}
      {showVersionModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-[60] p-6" onClick={() => setShowVersionModal(false)}>
          <div className="glass p-8 max-w-md w-full animate-in zoom-in-95 relative max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="text-center shrink-0">
              <LMPLOGIcon className="w-16 h-16 text-brand mx-auto" />
              <h3 className="text-xs uppercase tracking-[0.2em] text-brand font-bold mt-2">LMPLOG</h3>
              <p className="inline-block mt-2 px-4 py-1 bg-white/10 text-white/70 font-mono font-medium rounded-full border border-white/20 text-sm tracking-widest">
                v{version}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-6 mt-8 custom-scrollbar">
              <h4 className="text-sm font-bold text-white/50 uppercase tracking-wider mb-4 border-b border-white/10 pb-2">
                Changelog
              </h4>
              {changelog.map((entry, idx) => (
                <div key={idx} className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-brand font-mono font-bold text-sm">v{entry.version}</span>
                    <span className="text-white/40 text-xs">{entry.date}</span>
                  </div>
                  <ul className="list-disc list-inside text-white/70 text-sm space-y-1">
                    {entry.changes.map((change, cIdx) => (
                      <li key={cIdx}>{change}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="flex justify-center mt-8 shrink-0 pt-6 border-t border-white/10">
              <button
                onClick={() => setShowVersionModal(false)}
                className="px-8 py-2.5 rounded-xl font-bold bg-white/10 hover:bg-white/20 transition-colors min-h-[44px]"
              >
                {"Close"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Restore Modal */}
      {restoreBackupFile && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-[60] p-6">
          <div className="glass p-8 max-w-sm w-full space-y-6 animate-in zoom-in-95">
            <h3 className="text-xl font-bold flex items-center gap-2 text-white">
              <Upload className="w-6 h-6 text-brand" />
              {"Confirm Restore"}
            </h3>
            <p className="text-white/70 text-sm leading-relaxed">
              {`Are you sure you want to restore the backup file "${restoreBackupFile.name}"?`}
              <br /><br />
              {"This will overwrite and delete all your current local sessions, folders, settings, and audio recordings. This action cannot be undone."}
            </p>
            <div className="flex gap-3 justify-end items-center mt-6">
              <button onClick={() => setRestoreBackupFile(null)} className="px-5 py-2.5 rounded-xl font-bold bg-white/10 hover:bg-white/20 transition-colors min-h-[44px] text-sm">{"Cancel"}</button>
              <button onClick={() => executeImportBackup(restoreBackupFile)} className="px-5 py-2.5 rounded-xl font-bold bg-brand hover:bg-brand/90 transition-colors shadow-lg shadow-brand/30 text-black min-h-[44px] text-sm">{"Restore"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Reset Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-[60] p-6">
          <div className="glass p-8 max-w-sm w-full space-y-6 animate-in zoom-in-95">
            <h3 className="text-xl font-bold flex items-center gap-2 text-red-400">
              <Trash2 className="w-6 h-6 text-red-500" />
              {"Confirm Reset"}
            </h3>
            <p className="text-white/70 text-sm leading-relaxed">
              {"Are you sure you want to reset the app?"}
              <br /><br />
              {"This will permanently delete all folders, sessions, settings, and audio clips from this device. This action cannot be undone."}
            </p>
            <div className="flex gap-3 justify-end items-center mt-6">
              <button onClick={() => setShowResetConfirm(false)} className="px-5 py-2.5 rounded-xl font-bold bg-white/10 hover:bg-white/20 transition-colors min-h-[44px] text-sm">{"Cancel"}</button>
              <button onClick={handleResetApp} className="px-5 py-2.5 rounded-xl font-bold bg-red-600 hover:bg-red-700 transition-colors shadow-lg shadow-red-600/30 text-white min-h-[44px] text-sm">{"Reset Everything"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Drive Disconnect Confirmation Modal */}
      {showDriveDisconnectConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-[60] p-6">
          <div className="glass p-8 max-w-sm w-full space-y-5 animate-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white">{"Disconnect Google Drive?"}</h3>
            </div>
            <p className="text-white/60 text-sm leading-relaxed">
              {"Your backup file will remain safely stored in your Google Drive. You can reconnect at any time."}
            </p>
            <div className="flex gap-3 justify-end items-center pt-1">
              <button
                onClick={() => setShowDriveDisconnectConfirm(false)}
                className="px-5 py-2.5 rounded-xl font-bold bg-white/10 hover:bg-white/20 transition-colors min-h-[44px] text-sm"
              >
                {"Cancel"}
              </button>
              <button
                id="driveDisconnectConfirmBtn"
                onClick={confirmDisconnectDrive}
                className="px-5 py-2.5 rounded-xl font-bold bg-white/15 hover:bg-white/25 transition-colors min-h-[44px] text-sm text-white"
              >
                {"Disconnect"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Folder Create/Rename Modal */}
      {folderModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-50 p-6">
          <form onSubmit={handleCreateOrRenameFolder} className="glass p-8 max-w-sm w-full space-y-6 animate-in zoom-in-95">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <Folder className="w-6 h-6 text-brand" />
              {folderModal.type === 'create' ? "Create Folder" : "Rename Folder"}
            </h3>
            <div className="space-y-2">
              <label className="text-xs text-white/50 font-bold uppercase tracking-wider">{"Folder Name"}</label>
              <input
                autoFocus
                type="text"
                placeholder={"Enter folder name..."}
                value={folderModal.name}
                onChange={(e) => setFolderModal({ ...folderModal, name: e.target.value })}
                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-brand/50 transition-colors"
                required
              />
            </div>
            <div className="flex gap-3 justify-end items-center">
              <button type="button" onClick={() => setFolderModal(null)} className="px-5 py-2.5 rounded-xl font-bold bg-white/10 hover:bg-white/20 transition-colors min-h-[44px]">{"Cancel"}</button>
              <button type="submit" className="px-5 py-2.5 rounded-xl font-bold bg-brand hover:bg-brand/90 text-bg-dark transition-colors shadow-lg shadow-brand/20 min-h-[44px]">{"Save"}</button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Folder Modal */}
      {deleteFolderModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-50 p-6">
          <div className="glass p-8 max-w-md w-full space-y-6 animate-in zoom-in-95">
            <h3 className="text-xl font-bold text-red-400 flex items-center gap-2">
              <Trash2 className="w-6 h-6 shrink-0" />
              {"Delete Folder"}
            </h3>
            <p className="text-white/80">
              {`Are you sure you want to delete the folder "${deleteFolderModal.name}"?`}
            </p>

            {/* Custom confirm option checkbox */}
            <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl">
              <CustomCheckbox
                id="deleteSessionsCheckbox"
                checked={deleteFolderAlsoSessions}
                onChange={setDeleteFolderAlsoSessions}
                label={
                  <div className="text-sm text-red-300 font-semibold cursor-pointer select-none">
                    {"Also delete all sessions inside this folder"}
                    <span className="block text-xs font-normal text-white/50 mt-1 font-sans">
                      {"(If left unchecked, these sessions will be preserved and moved to the root level)"}
                    </span>
                  </div>
                }
              />
            </div>

            <div className="flex gap-3 justify-end items-center mt-6">
              <button
                onClick={() => {
                  setDeleteFolderModal(null);
                  setDeleteFolderAlsoSessions(false);
                }}
                className="px-5 py-2.5 rounded-xl font-bold bg-white/10 hover:bg-white/20 transition-colors min-h-[44px]"
              >
                {"Cancel"}
              </button>
              <button
                onClick={() => {
                  confirmDeleteFolder(deleteFolderAlsoSessions);
                  setDeleteFolderAlsoSessions(false);
                }}
                className="px-5 py-2.5 rounded-xl font-bold bg-red-600 hover:bg-red-700 transition-colors shadow-lg shadow-red-600/30 text-white min-h-[44px]"
              >
                {"Delete Folder"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move Session Modal */}
      {moveSessionModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-50 p-6">
          <div className="glass p-6 max-w-sm w-full space-y-6 animate-in zoom-in-95">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-brand" />
                {"Move Session to Folder"}
              </h3>
              <button
                onClick={() => setMoveSessionModal(null)}
                className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors text-white/60"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-white/60 font-sans">
              {"Choose a folder destination for this session:"}
            </p>

            <div className="space-y-2.5 max-h-[40vh] overflow-y-auto pr-1">
              {/* Root (Ungrouped) Option */}
              <button
                onClick={async () => {
                  await updateSession(moveSessionModal.sessionId, { groupId: undefined });
                  showToast("Session moved to Root");
                  setMoveSessionModal(null);
                }}
                className={`w-full p-3.5 rounded-xl border flex items-center gap-3 transition-all text-left ${!moveSessionModal.currentGroupId
                  ? 'bg-brand/20 border-brand text-brand font-semibold'
                  : 'bg-white/5 border-white/10 hover:bg-white/10 text-white/80'
                  }`}
              >
                <Folder className="w-5 h-5 opacity-60 text-brand" />
                <div className="flex-1 text-sm">{"Root (Ungrouped)"}</div>
                {!moveSessionModal.currentGroupId && <CheckCircle2 className="w-4 h-4 text-brand" />}
              </button>

              {/* Folders List */}
              {groups.filter(g => g.id !== 'root').map(group => (
                <button
                  key={group.id}
                  onClick={async () => {
                    await updateSession(moveSessionModal.sessionId, { groupId: group.id });
                    showToast(`Session moved to "${group.name}"`);
                    setMoveSessionModal(null);
                  }}
                  className={`w-full p-3.5 rounded-xl border flex items-center gap-3 transition-all text-left ${moveSessionModal.currentGroupId === group.id
                    ? 'bg-violet-500/20 border-violet-500 text-violet-400 font-semibold'
                    : 'bg-white/5 border-white/10 hover:bg-white/10 text-white/80'
                    }`}
                >
                  <Folder className="w-5 h-5 opacity-60 text-violet-400" />
                  <div className="flex-1 text-sm truncate">{group.name}</div>
                  {moveSessionModal.currentGroupId === group.id && <CheckCircle2 className="w-4 h-4 text-violet-400" />}
                </button>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setMoveSessionModal(null)}
                className="px-5 py-2.5 rounded-xl font-bold bg-white/10 hover:bg-white/20 transition-colors text-sm min-h-[38px]"
              >
                {"Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Session Modal */}
      {shareModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-50 p-6">
          <div className="glass p-8 max-w-md w-full space-y-6 animate-in zoom-in-95">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <Share2 className="w-6 h-6 text-brand" />
              {"Share Session"}
            </h3>

            {shareModal.viewState === 'checklist' ? (
              <>
                <p className="text-white/70 text-sm">
                  {"Select what information you want to share with other users:"}
                </p>
                <div className="space-y-4 bg-black/20 p-5 rounded-2xl border border-white/5 max-h-[45vh] overflow-y-auto pr-1">
                  <div className="space-y-2">
                    <CustomSwitch
                      disabled={!shareModal.availableReport}
                      checked={shareModal.shareReport}
                      onChange={(checked) => {
                        setShareModal({
                          ...shareModal,
                          shareReport: checked,
                          shareStrictSummary: checked ? shareModal.availableStrictSummary : false,
                          shareDrills: checked ? shareModal.availableDrills : false,
                          shareHomework: checked ? shareModal.availableHomework : false,
                          shareTechnical: checked ? shareModal.availableTechnical : false,
                          shareEmotional: checked ? shareModal.availableEmotional : false,
                        });
                      }}
                      label={
                        <span className={`text-sm font-semibold ${!shareModal.availableReport ? 'text-white/40' : 'text-white'}`}>
                          {"Consolidated Session Report"} {!shareModal.availableReport && "(Locked/Not Consolidated)"}
                        </span>
                      }
                      className="px-2 py-1.5"
                    />
                    {/* Hierarchical sub-options */}
                    <div className={`space-y-2.5 mt-2.5 transition-all ${(!shareModal.availableReport || !shareModal.shareReport) ? 'opacity-40' : ''}`}>
                      {/* Select all / Deselect all toggle */}
                      {shareModal.availableReport && shareModal.shareReport && (
                        <div className="flex gap-2 mb-1.5 animate-in fade-in duration-200">
                          <button
                            type="button"
                            onClick={() => setShareModal({
                              ...shareModal,
                              shareStrictSummary: shareModal.availableStrictSummary,
                              shareDrills: shareModal.availableDrills,
                              shareHomework: shareModal.availableHomework,
                              shareTechnical: shareModal.availableTechnical,
                              shareEmotional: shareModal.availableEmotional
                            })}
                            className="text-[10px] bg-white/5 hover:bg-white/10 text-white/60 px-2 py-1 rounded transition-colors font-bold uppercase"
                          >
                            {"Select All"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setShareModal({
                              ...shareModal,
                              shareStrictSummary: false,
                              shareDrills: false,
                              shareHomework: false,
                              shareTechnical: false,
                              shareEmotional: false
                            })}
                            className="text-[10px] bg-white/5 hover:bg-white/10 text-white/60 px-2 py-1 rounded transition-colors font-bold uppercase"
                          >
                            {"Deselect All"}
                          </button>
                        </div>
                      )}

                      <CustomCheckbox
                        disabled={!shareModal.availableReport || !shareModal.shareReport || !shareModal.availableStrictSummary}
                        checked={shareModal.shareStrictSummary}
                        onChange={(checked) => setShareModal({ ...shareModal, shareStrictSummary: checked })}
                        label={"Strict Summary" + (!shareModal.availableStrictSummary && shareModal.availableReport ? ' ' + "(Not available)" : '')}
                        className="py-0.5"
                      />
                      <CustomCheckbox
                        disabled={!shareModal.availableReport || !shareModal.shareReport || !shareModal.availableDrills}
                        checked={shareModal.shareDrills}
                        onChange={(checked) => setShareModal({ ...shareModal, shareDrills: checked })}
                        label={"Drills" + (!shareModal.availableDrills && shareModal.availableReport ? ' ' + "(Not available)" : '')}
                        className="py-0.5"
                      />
                      <CustomCheckbox
                        disabled={!shareModal.availableReport || !shareModal.shareReport || !shareModal.availableHomework}
                        checked={shareModal.shareHomework}
                        onChange={(checked) => setShareModal({ ...shareModal, shareHomework: checked })}
                        label={"Homework" + (!shareModal.availableHomework && shareModal.availableReport ? ' ' + "(Not available)" : '')}
                        className="py-0.5"
                      />
                      <CustomCheckbox
                        disabled={!shareModal.availableReport || !shareModal.shareReport || !shareModal.availableTechnical}
                        checked={shareModal.shareTechnical}
                        onChange={(checked) => setShareModal({ ...shareModal, shareTechnical: checked })}
                        label={"Technical Expansion" + (!shareModal.availableTechnical && shareModal.availableReport ? ' ' + "(Not available)" : '')}
                        className="py-0.5"
                      />
                      <CustomCheckbox
                        disabled={!shareModal.availableReport || !shareModal.shareReport || !shareModal.availableEmotional}
                        checked={shareModal.shareEmotional}
                        onChange={(checked) => setShareModal({ ...shareModal, shareEmotional: checked })}
                        label={"Emotional Notes" + (!shareModal.availableEmotional && shareModal.availableReport ? ' ' + "(Not available)" : '')}
                        className="py-0.5"
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-white/5">
                    <CustomSwitch
                      disabled={!shareModal.availableNotes}
                      checked={shareModal.shareNotes}
                      onChange={(checked) => setShareModal({ ...shareModal, shareNotes: checked })}
                      label={
                        <span className={`text-sm font-semibold ${!shareModal.availableNotes ? 'text-white/40' : 'text-white'}`}>
                          {"Custom Session Notes"} {!shareModal.availableNotes && "(No notes written)"}
                        </span>
                      }
                      className="px-2 py-1.5"
                    />
                  </div>

                  <div className="pt-2 border-t border-white/5">
                    <CustomSwitch
                      disabled={!shareModal.availableTranscripts}
                      checked={shareModal.shareTranscripts}
                      onChange={(checked) => setShareModal({ ...shareModal, shareTranscripts: checked })}
                      label={
                        <span className={`text-sm font-semibold ${!shareModal.availableTranscripts ? 'text-white/40' : 'text-white'}`}>
                          {"Individual Clip Transcripts"} {!shareModal.availableTranscripts && "(No audio clips transcribed)"}
                        </span>
                      }
                      className="px-2 py-1.5"
                    />
                  </div>
                  <div className="pt-2 border-t border-white/5">
                    <CustomSwitch
                      disabled={!shareModal.availableMedia}
                      checked={shareModal.shareMedia}
                      onChange={(checked) => setShareModal({ ...shareModal, shareMedia: checked })}
                      label={
                        <span className={`text-sm font-semibold ${!shareModal.availableMedia ? 'text-white/40' : 'text-white'}`}>
                          {"Include Media"} {!shareModal.availableMedia && <span className="font-normal text-xs opacity-70">({"(No media found)"})</span>}
                        </span>
                      }
                      className="px-2 py-1.5"
                    />
                    {shareModal.shareMedia && (
                      <p className="px-2 mt-1 text-xs text-brand font-medium flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {"Heavy media selected. This session will be exported as a local file."}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-3 justify-end items-center">
                  <button onClick={() => setShareModal(null)} className="px-5 py-2.5 rounded-xl font-bold bg-white/10 hover:bg-white/20 transition-colors min-h-[44px]">{"Cancel"}</button>
                  <button
                    onClick={handleGenerateShareLink}
                    disabled={!shareModal.shareReport && !shareModal.shareNotes && !shareModal.shareTranscripts && !shareModal.shareMedia}
                    className="px-5 py-2.5 rounded-xl font-bold bg-brand hover:bg-brand/90 disabled:opacity-20 text-bg-dark transition-colors shadow-lg shadow-brand/20 min-h-[44px]"
                  >
                    {shareModal.shareMedia ? "Export File" : (selectedSession.shareId ? "Update Copy" : "Generate Code")}
                  </button>
                </div>
              </>
            ) : shareModal.viewState === 'active_code' ? (
              <>
                <div className="space-y-4 font-sans">
                  <div className="text-white/70 text-sm leading-relaxed bg-black/20 p-4 rounded-xl border border-white/5">
                    <p className="mb-3">
                      {`This session was already shared on ${shareModal.shareTimestamp ? new Date(shareModal.shareTimestamp).toLocaleDateString() : ''} with the following code and included:`}
                    </p>
                    
                    <ul className="list-disc pl-5 space-y-1.5 text-xs text-white/90 font-medium mb-5">
                      {shareModal.sharedContent?.report && <li>{"Consolidated Session Report"}</li>}
                      {shareModal.sharedContent?.notes && <li>{"Custom Session Notes"}</li>}
                      {shareModal.sharedContent?.transcripts && <li>{"Individual Clip Transcripts"}</li>}
                      {shareModal.sharedContent?.media && <li>{"Include Media"}</li>}
                      {(!shareModal.sharedContent?.report && !shareModal.sharedContent?.notes && !shareModal.sharedContent?.transcripts && !shareModal.sharedContent?.media) && (
                        <li className="text-white/40 italic">No specific items recorded.</li>
                      )}
                    </ul>

                    <div className="flex flex-col items-center justify-center bg-black/40 border border-white/10 rounded-2xl p-4 space-y-2 relative">
                      <span className="text-white/40 text-[10px] font-bold uppercase tracking-widest">{"Share Code"}</span>
                      <div className="flex items-center gap-4">
                        <span className="text-brand text-3xl font-mono font-black tracking-widest select-all">{shareModal.shareCode}</span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(shareModal.shareCode || '');
                            showToast("Share code copied to clipboard!");
                          }}
                          className="p-2.5 bg-white/5 hover:bg-white/10 active:scale-95 rounded-xl text-white/60 transition-all shadow-sm"
                          title="Copy code"
                        >
                          <Copy className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <p className="text-white/40 text-[10px] italic">
                    {shareModal.shareTimestamp
                      ? `This link will automatically expire in ${Math.max(1, 30 - Math.floor((Date.now() - shareModal.shareTimestamp) / (1000 * 60 * 60 * 24)))} days`
                      : "This link will automatically expire in 30 days"}
                  </p>

                  <button
                    onClick={async () => {
                      const shareCode = shareModal.shareCode || '';
                      const shareMessage = `Import my session in LMPLOG using the code: ${shareCode}`;

                      if (navigator.share) {
                        try {
                          await navigator.share({
                            title: "Share Session",
                            text: shareMessage,
                          });
                          showToast("Session shared successfully!");
                        } catch (err) {
                          console.log('Share sheet dismissed or failed, falling back to copy:', err);
                          navigator.clipboard.writeText(shareMessage);
                          showToast("Share code copied to clipboard!");
                        }
                      } else {
                        navigator.clipboard.writeText(shareMessage);
                        showToast("Share code copied to clipboard!");
                      }
                    }}
                    className="w-full py-3 bg-brand text-bg-dark rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-brand/90 transition-all active:scale-[0.98] shadow-lg shadow-brand/20 min-h-[44px]"
                  >
                    <Share2 className="w-5 h-5" />
                    <span>{"Share Code"}</span>
                  </button>
                </div>
                <div className="flex justify-end gap-3 items-center">
                  <button
                    onClick={() => setShareModal({ ...shareModal, viewState: 'checklist' })}
                    className="px-5 py-2.5 rounded-xl font-bold border border-white/10 text-white/60 hover:bg-white/5 hover:text-white/80 transition-colors min-h-[44px]"
                  >
                    {"Update Settings"}
                  </button>
                  <button onClick={() => setShareModal(null)} className="px-6 py-2.5 rounded-xl font-bold bg-white/10 hover:bg-white/20 transition-colors min-h-[44px]">{"Close"}</button>
                </div>
              </>
            ) : shareModal.viewState === 'active_file' ? (
              <>
                <div className="space-y-4 font-sans">
                  <div className="text-white/70 text-sm leading-relaxed bg-black/20 p-5 rounded-xl border border-white/5">
                    <p className="mb-3">
                      {`This session was exported as a file on ${shareModal.shareTimestamp ? new Date(shareModal.shareTimestamp).toLocaleDateString() : ''} and included:`}
                    </p>
                    <ul className="list-disc pl-5 space-y-1.5 text-xs text-white/90 font-medium">
                      {shareModal.sharedContent?.report && <li>{"Consolidated Session Report"}</li>}
                      {shareModal.sharedContent?.notes && <li>{"Custom Session Notes"}</li>}
                      {shareModal.sharedContent?.transcripts && <li>{"Individual Clip Transcripts"}</li>}
                      {shareModal.sharedContent?.media && <li>{"Include Media"}</li>}
                      {(!shareModal.sharedContent?.report && !shareModal.sharedContent?.notes && !shareModal.sharedContent?.transcripts && !shareModal.sharedContent?.media) && (
                        <li className="text-white/40 italic">No specific items recorded.</li>
                      )}
                    </ul>
                  </div>

                  <button
                    onClick={handleGenerateShareLink}
                    className="w-full py-3 bg-brand text-bg-dark rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-brand/90 transition-all active:scale-[0.98] shadow-lg shadow-brand/20 min-h-[44px]"
                  >
                    <Download className="w-5 h-5" />
                    <span>{"Export File Again"}</span>
                  </button>
                </div>
                <div className="flex justify-end gap-3 items-center mt-6">
                  <button
                    onClick={() => setShareModal({ ...shareModal, viewState: 'checklist' })}
                    className="px-5 py-2.5 rounded-xl font-bold border border-white/10 text-white/60 hover:bg-white/5 hover:text-white/80 transition-colors min-h-[44px]"
                  >
                    {"Update Settings"}
                  </button>
                  <button onClick={() => setShareModal(null)} className="px-6 py-2.5 rounded-xl font-bold bg-white/10 hover:bg-white/20 transition-colors min-h-[44px]">{"Close"}</button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}



      {/* Import Code Modal */}
      {showImportCodeModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-50 p-6">
          <div className="glass p-8 max-w-sm w-full space-y-6 animate-in zoom-in-95">
            <h3 className="text-xl font-bold text-brand flex items-center gap-2">
              <Download className="w-6 h-6 shrink-0 text-brand" />
              {"Import Session"}
            </h3>
            <p className="text-white/80 text-sm font-sans">{"Enter the 6-character code shared with you to preview and import the session."}</p>

            <div className="space-y-4">
              <input
                type="text"
                maxLength={6}
                value={importCodeValue}
                onChange={(e) => setImportCodeValue(e.target.value.toUpperCase().trim())}
                placeholder={"E.g., A1B2C3"}
                className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-center text-lg font-mono font-bold tracking-widest text-white outline-none focus:border-brand transition-colors"
                autoFocus
              />
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex gap-3 justify-end items-center">
                <button
                  onClick={() => {
                    setShowImportCodeModal(false);
                    setImportCodeValue('');
                  }}
                  className="px-5 py-2.5 rounded-xl font-bold bg-white/10 hover:bg-white/20 transition-colors min-h-[44px]"
                >
                  {"Cancel"}
                </button>
                <button
                  onClick={async () => {
                    if (importCodeValue.length !== 6) {
                      showToast("Code must be exactly 6 characters.", true);
                      return;
                    }
                    const codeToFetch = importCodeValue;
                    setShowImportCodeModal(false);
                    setImportCodeValue('');
                    showSpinner("Retrieving shared session...");
                    try {
                      const res = await fetch(`/api/share/${codeToFetch}`);
                      if (!res.ok) throw new Error('Shared session not found');
                      const data = await res.json();
                      setImportPreview(data);
                    } catch (e: any) {
                      console.error(e);
                      showToast("Failed to retrieve shared session details", true);
                    } finally {
                      hideSpinner();
                    }
                  }}
                  disabled={importCodeValue.length !== 6}
                  className="px-5 py-2.5 rounded-xl font-bold bg-brand hover:bg-brand/90 disabled:opacity-20 text-bg-dark transition-colors shadow-lg shadow-brand/30 min-h-[44px]"
                >
                  {"Import Session"}
                </button>
              </div>

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-white/10"></div>
                <span className="flex-shrink-0 mx-4 text-white/40 text-xs uppercase tracking-widest">{"or"}</span>
                <div className="flex-grow border-t border-white/10"></div>
              </div>

              <input type="file" id="lmplog-import-file" accept=".lmplog,.lmplog.zip,.zip,application/zip" className="hidden" onChange={handleImportFile} />
              <label htmlFor="lmplog-import-file" className="w-full text-center px-5 py-3 rounded-xl font-bold border border-white/10 text-white/80 hover:bg-white/5 transition-colors cursor-pointer">
                {"Import from file"}
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Import Preview Modal */}
      {importPreview && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-50 p-6">
          <div className="glass p-8 max-w-md w-full space-y-6 animate-in zoom-in-95 max-h-[85vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-brand flex items-center gap-2">
              <Share2 className="w-6 h-6 shrink-0" />
              {"Shared Session"}
            </h3>
            <p className="text-white/80 text-sm font-sans">{"Someone shared a dance lesson session with you:"}</p>

            <div className="bg-black/30 p-5 rounded-2xl border border-white/10 space-y-3.5">
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-brand block">{"Title"}</span>
                <span className="text-sm font-semibold text-white">{importPreview.title}</span>
              </div>
              {importPreview.subtitle && (
                <div>
                  <span className="text-xs font-bold uppercase tracking-widest text-brand block">{"Subtitle"}</span>
                  <span className="text-sm text-white/80">{importPreview.subtitle}</span>
                </div>
              )}
              {importPreview.notes && (
                <div>
                  <span className="text-xs font-bold uppercase tracking-widest text-brand block">{"Notes Shared"}</span>
                  <span className="text-xs text-green-400 font-semibold block mt-1 font-sans">{"✓ NOTES SHARED"}</span>
                </div>
              )}
              {importPreview.report && (
                <div>
                  <span className="text-xs font-bold uppercase tracking-widest text-brand block">{"Report Shared"}</span>
                  <span className="text-xs text-green-400 font-semibold block mt-1 font-sans">{"✓ Consolidated Session Report Included"}</span>
                </div>
              )}
              {importPreview.transcripts && (
                <div>
                  <span className="text-xs font-bold uppercase tracking-widest text-brand block">{"Clips Shared"}</span>
                  <span className="text-xs text-violet-400 font-semibold block mt-1 font-sans">{`✓ ${importPreview.transcripts.length} Audio Clip Transcripts Included`}</span>
                </div>
              )}
              {importPreview.parsedMediaFiles && importPreview.parsedMediaFiles.filter((f: any) => !f.isAudioEntry).length > 0 && (
                <div>
                  <span className="text-xs font-bold uppercase tracking-widest text-brand block">{"Media Shared"}</span>
                  <span className="text-xs text-purple-400 font-semibold block mt-1 font-sans">
                    {`✓ ${importPreview.parsedMediaFiles.filter((f: any) => !f.isAudioEntry).length} Media Item(s) Included`}
                  </span>
                </div>
              )}
            </div>

            <div className="flex gap-3 justify-end items-center">
              <button
                onClick={() => {
                  window.history.replaceState({}, document.title, window.location.pathname);
                  setImportPreview(null);
                }}
                className="px-5 py-2.5 rounded-xl font-bold bg-white/10 hover:bg-white/20 transition-colors min-h-[44px]"
              >
                {"Reject"}
              </button>
              <button
                onClick={handleImportSession}
                className="px-5 py-2.5 rounded-xl font-bold bg-brand hover:bg-brand/90 text-bg-dark transition-colors shadow-lg shadow-brand/30 min-h-[44px]"
              >
                {"Import Session"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Bar */}
      <header className="max-w-2xl mx-auto w-full px-6 py-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {(view === 'detail' || (view === 'list' && selectedGroupId !== null)) && (
            <button
              onClick={() => {
                window.history.back();
              }}
              className="w-10 h-10 flex items-center justify-center glass rounded-full hover:bg-white/10 transition-colors"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}
          <button
            onClick={() => navigateTo('list', null, null)}
            className="hover:opacity-80 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded-xl"
            title={"Go to Home"}
          >
            <LMPLOGIcon className="w-10 h-10 text-brand shrink-0" />
          </button>
          <div className="flex flex-col justify-center">
            <h1 className="text-lg uppercase tracking-[0.2em] text-brand font-bold leading-none">
              {"LMPLOG"}
            </h1>
            <p className="text-xs font-bold tracking-tight text-white/90 mt-1 leading-none">
              {"Session Notes"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {view === 'list' && (
            <button
              onClick={() => setShowAppSettings(true)}
              className="w-10 h-10 flex items-center justify-center glass rounded-full hover:bg-white/10 text-white/40 hover:text-brand transition-colors"
              title="LMPLOG Settings"
            >
              <Settings className="w-5 h-5 text-brand" />
            </button>
          )}
          {view === 'detail' && selectedSession && (
            <>
              <button
                onClick={() => {
                  if (selectedSession.isDemo) {
                    showToast("💡 You can export this session to a PDF document.", false);
                  } else {
                    setShowExportConfirm(true);
                  }
                }}
                className="w-10 h-10 flex items-center justify-center glass rounded-full hover:bg-brand/20 text-brand transition-colors"
                title={"Export to PDF"}
              >
                <Download className="w-5 h-5" />
              </button>
            </>
          )}
          {deferredPrompt && (
            <button
              onClick={async () => {
                if (!deferredPrompt) return;
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                console.log(`User response to the install prompt: ${outcome}`);
                if (outcome === 'accepted') {
                  setDeferredPrompt(null);
                }
              }}
              className="flex items-center gap-2 px-4 py-2 bg-brand/10 hover:bg-brand/20 text-brand font-bold rounded-xl border border-brand/20 transition-all font-sans text-sm shadow-sm"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">{"Install App"}</span>
            </button>
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 pb-32">
        {view === 'list' ? (
          <div className="space-y-8">
            {selectedGroupId && (
              <div className="flex items-center gap-2 text-sm font-bold text-white/40 uppercase tracking-widest">
                <FolderOpen className="w-4 h-4 text-violet-400" />
                <span>{`Folder: ${groups.find(g => g.id === selectedGroupId)?.name || ''}`}</span>
              </div>
            )}

            {/* Action buttons - Compact same-line layout */}
            <div className="flex gap-4">
              <button
                onClick={createSession}
                className={`py-3.5 glass bg-brand/10 border-brand/20 text-brand font-bold text-sm flex items-center justify-center gap-2 hover:bg-brand/20 transition-all rounded-2xl shadow-lg glow-brand flex-1 min-h-[52px] ${selectedGroupId ? 'py-4 text-base' : ''}`}
              >
                <Plus className="w-4 h-4" />
                {"Session"}
              </button>
              {!selectedGroupId && (
                <>
                  <button
                    onClick={() => setFolderModal({ type: 'create', name: '' })}
                    className="py-3.5 glass bg-violet-500/10 border-violet-500/20 text-violet-400 font-bold text-sm flex items-center justify-center gap-2 hover:bg-violet-500/20 transition-all rounded-2xl shadow-lg shadow-violet-500/10 flex-1 min-h-[52px]"
                  >
                    <FolderPlus className="w-4 h-4" />
                    {"Folder"}
                  </button>

                </>
              )}
            </div>

            {/* Folders List - Shown in Root */}
            {!selectedGroupId && groups.filter(g => g.id !== 'root').length > 0 && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-2">
                  <h2 className="text-sm font-bold uppercase tracking-widest text-white/30">{"Folders"}</h2>

                  {/* Folder Sorting controls bar */}
                  <div className="flex items-center gap-4 text-xs text-white/40 font-sans font-semibold">
                    <span className="hidden sm:inline">{"Sort by:"}</span>
                    <div className="flex gap-3.5">
                      <button
                        onClick={() => handleFolderSortClick('date')}
                        className={`hover:text-white transition-colors flex items-center gap-1 ${folderSortBy === 'date' ? 'text-brand font-bold' : ''}`}
                      >
                        {"Recent"}
                        {folderSortBy === 'date' && (folderSortOrder === 'asc' ? ' ↑' : ' ↓')}
                      </button>
                      <button
                        onClick={() => handleFolderSortClick('name')}
                        className={`hover:text-white transition-colors flex items-center gap-1 ${folderSortBy === 'name' ? 'text-brand font-bold' : ''}`}
                      >
                        {"Name"}
                        {folderSortBy === 'name' && (folderSortOrder === 'asc' ? ' ↑' : ' ↓')}
                      </button>
                      <button
                        onClick={() => handleFolderSortClick('created')}
                        className={`hover:text-white transition-colors flex items-center gap-1 ${folderSortBy === 'created' ? 'text-brand font-bold' : ''}`}
                      >
                        {"Created"}
                        {folderSortBy === 'created' && (folderSortOrder === 'asc' ? ' ↑' : ' ↓')}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {sortFolders(groups.filter(g => g.id !== 'root')).map(group => (
                    <div
                      key={group.id}
                      onClick={() => navigateTo('list', null, group.id)}
                      className="glass p-4.5 flex items-center gap-4 hover:bg-white/5 transition-all cursor-pointer border border-violet-500/10 rounded-2xl"
                    >
                      <div className="w-11 h-11 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0">
                        <Folder className="w-5 h-5 text-violet-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold truncate text-white">{group.name}</h3>
                        <p className="text-xs text-white/40 mt-0.5 font-medium font-sans">
                          {`${sessions.filter(s => s.groupId === group.id).length} sessions`}
                        </p>
                      </div>
                      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setFolderModal({ type: 'rename', id: group.id, name: group.name })}
                          className="p-2 bg-white/5 hover:bg-white/10 text-white/60 rounded-xl transition-colors min-h-[38px] min-w-[38px] flex items-center justify-center"
                          title="Rename folder"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteFolderModal({ id: group.id, name: group.name })}
                          className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl transition-colors min-h-[38px] min-w-[38px] flex items-center justify-center"
                          title="Delete folder"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {showSessionsSection && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-2">
                  <h2 className="text-sm font-bold uppercase tracking-widest text-white/30">
                    {selectedGroupId ? "Sessions in Folder" : "Sessions"}
                  </h2>

                  {/* Sorting controls bar */}
                  <div className="flex items-center gap-4 text-xs text-white/40 font-sans font-semibold">
                    <span className="hidden sm:inline">{"Sort by:"}</span>
                    <div className="flex gap-3.5">
                      <button
                        onClick={() => handleSessionSortClick('date')}
                        className={`hover:text-white transition-colors flex items-center gap-1 ${sessionSortBy === 'date' ? 'text-brand font-bold' : ''}`}
                      >
                        {"Recent"}
                        {sessionSortBy === 'date' && (sessionSortOrder === 'asc' ? ' ↑' : ' ↓')}
                      </button>
                      <button
                        onClick={() => handleSessionSortClick('name')}
                        className={`hover:text-white transition-colors flex items-center gap-1 ${sessionSortBy === 'name' ? 'text-brand font-bold' : ''}`}
                      >
                        {"Name"}
                        {sessionSortBy === 'name' && (sessionSortOrder === 'asc' ? ' ↑' : ' ↓')}
                      </button>
                      <button
                        onClick={() => handleSessionSortClick('created')}
                        className={`hover:text-white transition-colors flex items-center gap-1 ${sessionSortBy === 'created' ? 'text-brand font-bold' : ''}`}
                      >
                        {"Created"}
                        {sessionSortBy === 'created' && (sessionSortOrder === 'asc' ? ' ↑' : ' ↓')}
                      </button>
                    </div>
                  </div>
                </div>

                {sessions.filter(s => selectedGroupId ? s.groupId === selectedGroupId : !s.groupId).length === 0 ? (
                  !selectedGroupId ? (
                    <div className="flex flex-col items-center justify-center p-12 sm:p-20 text-center animate-in fade-in zoom-in duration-500">
                      <div className="relative w-24 h-24 sm:w-32 sm:h-32 mb-6">
                        <div className="absolute inset-0 bg-brand/20 blur-3xl rounded-full animate-pulse" />
                        <Sparkles className="w-full h-full text-brand/60 drop-shadow-[0_0_15px_rgba(45,212,191,0.5)] animate-pulse" style={{ animationDuration: '3s' }} />
                      </div>
                      <h3 className="text-xl sm:text-2xl font-bold text-white mb-3 tracking-tight">{"Ready for the next lesson?"}</h3>
                      <p className="text-sm sm:text-base text-white/50 max-w-sm leading-relaxed">{"Tap the '+ Session' button to set up a new session."}</p>
                    </div>
                  ) : (
                    <div className="glass p-12 text-center text-white/20">
                      <Folder className="w-12 h-12 mx-auto mb-3 opacity-20" />
                      <p>{"No sessions in this folder."}</p>
                    </div>
                  )
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {sortSessions(
                      sessions.filter(s => selectedGroupId ? s.groupId === selectedGroupId : !s.groupId)
                    ).map(session => (
                      <div
                        key={session.id}
                        onClick={() => {
                          navigateTo('detail', session.id, selectedGroupId);
                        }}
                        className={`glass p-5 flex items-center gap-4 hover:bg-white/5 transition-all cursor-pointer rounded-2xl border ${session.isDemo && sessions.length === 1 ? 'border-brand/50 shadow-[0_0_20px_rgba(45,212,191,0.2)] animate-pulse hover:border-brand/70' : 'border-white/5 hover:border-brand/25'}`}
                      >
                        <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center shrink-0">
                          <FileAudio className="w-6 h-6 text-brand" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold truncate text-white">{session.title}</h3>
                          <p className="text-xs text-white/40 mt-1 truncate">{session.subtitle || "Lesson"}</p>
                        </div>
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setMoveSessionModal({ sessionId: session.id, currentGroupId: session.groupId });
                            }}
                            className="p-3 bg-white/5 text-white/60 hover:text-brand hover:bg-white/10 rounded-xl transition-colors flex items-center justify-center min-h-[44px] min-w-[44px]"
                            title={"Move to folder"}
                          >
                            <Folder className="w-5 h-5 shrink-0" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              requestDeleteSession(session.id, session.title);
                            }}
                            className="p-3 bg-red-500/10 text-red-400 rounded-xl hover:bg-red-500/20 transition-colors flex items-center justify-center min-h-[44px] min-w-[44px]"
                            title={"Delete"}
                          >
                            <Trash2 className="w-5 h-5 shrink-0" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : selectedSession && (
          <SessionDetail
            session={selectedSession}
            entries={(Object.values(audioEntries) as AudioEntry[]).filter(e => e.sessionId === selectedSession.id).sort((a, b) => b.timestamp - a.timestamp)}
            processingIds={processingIds}
            onRecording={(blob, lang) => selectedSession.isDemo ? showToast("💡 Tap here to record a live audio. We recommend keeping clips under 90 seconds.", false) : addAudioEntry(selectedSession.id, blob, lang, 'recording')}
            onUpload={(e, lang) => selectedSession.isDemo ? showToast("💡 Tap here to upload an audio file.", false) : handleFileUpload(e, lang)}
            onUpdateSession={(changes) => updateSession(selectedSession.id, changes)}
            onUpdateEntry={(id, changes) => selectedSession.isDemo ? showToast("💡 You can edit this text directly.", false) : updateAudioEntry(id, changes)}
            onDeleteEntry={(id) => selectedSession.isDemo ? showToast("💡 This deletes the item.", false) : requestDeleteAudio(id, 'Audio Entry')}
            showToast={showToast}
            groups={groups}
            glossaries={glossaries}
            onDeleteSession={() => requestDeleteSession(selectedSession.id, selectedSession.title)}
            mediaItems={sessionMedia}
            onMediaChange={setSessionMedia}
          />
        )}
      </main>
    </div>
  );
}

// --- Sub-Components ---

function SessionDetail({
  session,
  entries,
  processingIds,
  onRecording,
  onUpload,
  onUpdateSession,
  onUpdateEntry,
  onDeleteEntry,
  showToast,
  groups,
  glossaries,
  onDeleteSession,
  mediaItems,
  onMediaChange
}: {
  session: Session;
  entries: AudioEntry[];
  processingIds: Set<string>;
  onRecording: (blob: Blob, lang: Language) => void;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>, lang: Language) => void;
  onUpdateSession: (changes: Partial<Session>) => void;
  onUpdateEntry: (id: string, changes: Partial<AudioEntry>) => void;
  onDeleteEntry: (entryId: string) => void;
  showToast: (msg: string, isError?: boolean) => void;
  groups: SessionGroup[];
  glossaries: DanceGlossary[];
  onDeleteSession: () => void;
  mediaItems: SessionMedia[];
  onMediaChange: (items: SessionMedia[]) => void;
}) {
  
  const [isRecording, setIsRecording] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const timerRef = useRef<any>(null);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [isAddingMedia, setIsAddingMedia] = useState(false);
  const [mediaObjectUrls, setMediaObjectUrls] = useState<Record<string, string>>({});
  const [brokenMediaIds, setBrokenMediaIds] = useState<Set<string>>(new Set());
  const [lightboxItem, setLightboxItem] = useState<SessionMedia | null>(null);
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [mediaToDelete, setMediaToDelete] = useState<SessionMedia | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const isFileAccessSupported = false;

  // Revoke object URLs on cleanup
  useEffect(() => {
    return () => {
      (Object.values(mediaObjectUrls) as string[]).forEach(url => URL.revokeObjectURL(url));
    };
  }, []);

  // Resolve object URLs for media items when drawer opens
  useEffect(() => {
    if (!isGalleryOpen) return;
    const resolveUrls = async () => {
      const newUrls: Record<string, string> = {};
      const newBroken = new Set<string>();
      for (const item of mediaItems) {
        if (mediaObjectUrls[item.id]) continue; // already resolved
        try {
          let file: File | Blob | null = null;
          if (item.storageMode === 'reference' && item.fileHandle) {
            // Request read permission if needed
            const perm = await item.fileHandle.queryPermission({ mode: 'read' });
            if (perm !== 'granted') {
              await item.fileHandle.requestPermission({ mode: 'read' });
            }
            file = await item.fileHandle.getFile();
          } else if (item.storageMode === 'blob' && item.blob) {
            file = item.blob;
          }
          if (file) {
            newUrls[item.id] = URL.createObjectURL(file);
          } else {
            newBroken.add(item.id);
          }
        } catch {
          newBroken.add(item.id);
        }
      }
      setMediaObjectUrls(prev => ({ ...prev, ...newUrls }));
      setBrokenMediaIds(prev => {
        const next = new Set(prev);
        newBroken.forEach(id => next.add(id));
        return next;
      });
    };
    resolveUrls();
  }, [isGalleryOpen, mediaItems]);

  const formatBytes = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleAddMedia = async () => {
    if (isFileAccessSupported) {
      // Reference Mode: use File System Access API
      try {
        const handles = await (window as any).showOpenFilePicker({
          multiple: true,
          types: [
            { description: 'Images & Videos', accept: { 'image/*': [], 'video/*': [] } }
          ]
        });
        setIsAddingMedia(true);
        const newItems: SessionMedia[] = [];
        for (const handle of handles) {
          const file: File = await handle.getFile();
          const item: SessionMedia = {
            id: crypto.randomUUID(),
            sessionId: session.id,
            timestamp: Date.now(),
            filename: file.name,
            mimeType: file.type,
            size: file.size,
            storageMode: 'reference',
            fileHandle: handle
          };
          await db.saveMediaItem(item);
          newItems.push(item);
        }
        onMediaChange([...mediaItems, ...newItems]);
        setIsAddingMedia(false);
      } catch (err: any) {
        setIsAddingMedia(false);
        if (err?.name !== 'AbortError') showToast("Failed to attach media.", true);
      }
    } else {
      // Blob Mode: standard file input for Safari/iOS/Firefox
      mediaInputRef.current?.click();
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (!files.length) return;
    setIsAddingMedia(true);
    const MAX_BLOB_SIZE = 500 * 1024 * 1024; // 500 MB hard cap
    const LOW_STORAGE_THRESHOLD = 100 * 1024 * 1024; // warn below 100MB free

    try {
      // Check available storage
      let availableBytes: number | null = null;
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const { quota = 0, usage = 0 } = await navigator.storage.estimate();
        availableBytes = quota - usage;
      }

      const newItems: SessionMedia[] = [];
      for (const file of files) {
        // Validate type
        if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
          showToast("This file type is not supported. Please choose an image or video.", true);
          continue;
        }
        // Hard cap
        if (file.size > MAX_BLOB_SIZE) {
          showToast(`This file is too large to attach (${formatBytes(file.size)}). Please choose a smaller file.`, true);
          continue;
        }
        // Storage warning
        if (availableBytes !== null && availableBytes < LOW_STORAGE_THRESHOLD) {
          showToast(`Low storage available (${formatBytes(availableBytes)} free). This file (${formatBytes(file.size)}) may not save reliably. Consider freeing up space.`, true);
        }

        let blobToStore: Blob = file;
        // Compress images (not videos)
        if (file.type.startsWith('image/')) {
          try {
            blobToStore = await imageCompression(file, {
              maxWidthOrHeight: 1920,
              useWebWorker: true
            });
          } catch {
            blobToStore = file; // fallback to original on compression failure
          }
        }

        const item: SessionMedia = {
          id: crypto.randomUUID(),
          sessionId: session.id,
          timestamp: Date.now(),
          filename: file.name,
          mimeType: file.type,
          size: blobToStore.size,
          storageMode: 'blob',
          blob: blobToStore
        };
        await db.saveMediaItem(item);
        newItems.push(item);
      }
      if (newItems.length > 0) onMediaChange([...mediaItems, ...newItems]);
    } catch (err) {
      console.error('[Gallery] Failed to attach media:', err);
      showToast("Failed to attach media.", true);
    } finally {
      setIsAddingMedia(false);
      e.target.value = '';
    }
  };

  const handleDeleteMediaItem = async (item: SessionMedia) => {
    // Revoke object URL if any
    if (mediaObjectUrls[item.id]) {
      URL.revokeObjectURL(mediaObjectUrls[item.id]);
      setMediaObjectUrls(prev => { const c = { ...prev }; delete c[item.id]; return c; });
    }
    setBrokenMediaIds(prev => { const n = new Set(prev); n.delete(item.id); return n; });
    await db.deleteMediaItem(item.id);
    onMediaChange(mediaItems.filter(m => m.id !== item.id));
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const formatDuration = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  const language = 'auto';
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(session.title);
  const [isEditingSubtitle, setIsEditingSubtitle] = useState(false);
  const [tempSubtitle, setTempSubtitle] = useState(session.subtitle ?? '');
  const [isReordering, setIsReordering] = useState(false);
  const [isNoteVisible, setIsNoteVisible] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const parentGroup = groups.find(g => g.id === session.groupId);

  // Buffered settings states
  const [tempGroupId, setTempGroupId] = useState('');
  const [tempGlossaryId, setTempGlossaryId] = useState('auto');
  const [tempCustomGlossaryStyle, setTempCustomGlossaryStyle] = useState('');

  const handleConfirmSettings = () => {
    onUpdateSession({
      groupId: tempGroupId || undefined,
      glossaryId: tempGlossaryId,
      customGlossaryStyle: tempCustomGlossaryStyle || undefined
    });
    setIsSettingsOpen(false);
  };

  const handleCancelSettings = () => {
    setIsSettingsOpen(false);
  };

  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const isCancelledRef = useRef(false);

  const startRecording = async () => {
    if (session.isDemo) {
      showToast("💡 Tap here to record a live audio. We recommend keeping clips under 90 seconds.", false);
      return;
    }
    try {
      isCancelledRef.current = false;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 48000 }
      });

      // Live mic level meter via AudioContext analyser
      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateLevel = () => {
        analyser.getByteTimeDomainData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const v = (dataArray[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / dataArray.length);
        setMicLevel(Math.min(1, rms * 6)); // scale so normal speech hits 0.4–0.8
        animFrameRef.current = requestAnimationFrame(updateLevel);
      };
      animFrameRef.current = requestAnimationFrame(updateLevel);

      // Pick the best supported MIME type so the Blob type is accurate
      const preferredMime = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4'
      ].find(t => MediaRecorder.isTypeSupported(t)) || '';
      console.log('[MediaRecorder] Preferred mimeType:', preferredMime || '(browser default)');

      mediaRecorder.current = new MediaRecorder(stream, preferredMime ? { mimeType: preferredMime } : {});
      audioChunks.current = [];

      mediaRecorder.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.current.push(event.data);
          console.log('[MediaRecorder] chunk received, size:', event.data.size, 'total chunks:', audioChunks.current.length);
        }
      };

      mediaRecorder.current.onstop = () => {
        const actualMime = mediaRecorder.current?.mimeType || preferredMime || 'audio/webm';
        // Use plain audio/webm for blob type — codec specifier can confuse some browsers during playback
        const blobType = actualMime.split(';')[0] || 'audio/webm';
        console.log('[MediaRecorder] Actual mimeType after stop:', actualMime);
        console.log('[MediaRecorder] Total chunks:', audioChunks.current.length);
        const audioBlob = new Blob(audioChunks.current, { type: blobType });
        console.log('[MediaRecorder] Blob size:', audioBlob.size, 'type:', audioBlob.type);

        if (isCancelledRef.current) {
          console.log('[MediaRecorder] Recording cancelled, discarding chunks.');
        } else {
          onRecording(audioBlob, language);
        }

        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.current.start(250); // 250ms timeslice — guarantees chunks are written regularly
      setIsRecording(true);
      setRecordingDuration(0);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      showToast("Microphone access denied or not available.", true);
    }
  };

  const stopRecording = () => {
    if (animFrameRef.current !== null) cancelAnimationFrame(animFrameRef.current);
    if (audioCtxRef.current) { audioCtxRef.current.close(); audioCtxRef.current = null; }
    setMicLevel(0);
    mediaRecorder.current?.stop();
    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const cancelRecording = () => {
    isCancelledRef.current = true;
    stopRecording();
  };

  const handleSubtitleSubmit = () => {
    onUpdateSession({ subtitle: tempSubtitle.trim() });
    setIsEditingSubtitle(false);
  };

  const handleTitleSubmit = () => {
    if (tempTitle.trim() && tempTitle.trim() !== session.title) {
      onUpdateSession({ title: tempTitle.trim() });
    } else {
      setTempTitle(session.title);
    }
    setIsEditingTitle(false);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Print-only Logo */}
      <div className="hidden print:block text-center pb-4 border-b border-gray-200">
        <img src="/lmplogLogoHoriz.png" alt="LMPLOG" className="h-10 mx-auto" />
      </div>
      {/* Session Header: date (white) + optional editable subtitle */}
      <div>
        <div className="flex items-center justify-between flex-wrap gap-2 mb-2.5">
          {parentGroup ? (
            <div className="flex items-center gap-1.5 text-xs text-white/40">
              <Folder className="w-3.5 h-3.5 text-brand" />
              <span className="font-semibold text-white/60">{parentGroup.name}</span>
              <span className="text-white/20">/</span>
            </div>
          ) : (
            <div />
          )}

          {/* Active Dance Style / Glossary Badge */}
          <button
            onClick={() => {
              if (session.isDemo) {
                showToast("💡 This detects the dance style automatically and applies the correct terminology (glossary) to the AI report.", false);
              } else {
                setTempGroupId(session.groupId || '');
                setTempGlossaryId(session.glossaryId || 'auto');
                setTempCustomGlossaryStyle(session.customGlossaryStyle || '');
                setIsSettingsOpen(true);
              }
            }}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-brand/10 border border-brand/20 hover:bg-brand/20 transition-all text-brand font-medium cursor-pointer"
            title={"Session Settings"}
          >
            <Music className="w-3 h-3 shrink-0" />
            <span>
              {session.glossaryId === 'auto'
                ? "Auto-Detect (AI)"
                : (session.glossaryId === 'other' ? (session.customGlossaryStyle || "Other (Specify...)") : (glossaries.find(g => g.id === session.glossaryId)?.name || 'Brazilian Zouk'))
              }
            </span>
          </button>
        </div>
        {/* Date line — always shown, white, bold */}
        {isEditingTitle ? (
          <input
            autoFocus
            value={tempTitle}
            onChange={(e) => setTempTitle(e.target.value)}
            onBlur={handleTitleSubmit}
            onKeyDown={(e) => { if (e.key === 'Enter') handleTitleSubmit(); if (e.key === 'Escape') { setTempTitle(session.title); setIsEditingTitle(false); } }}
            className="bg-transparent text-xl font-bold text-white outline-none w-full py-0.5"
          />
        ) : (
          <p
            className="text-xl font-bold text-white cursor-text hover:text-white/80 transition-colors flex items-center gap-2 group w-max"
            onClick={() => {
              if (session.isDemo) {
                showToast("💡 You can edit this text directly.", false);
              } else {
                setTempTitle(session.title);
                setIsEditingTitle(true);
              }
            }}
            title={"Edit title"}
          >
            {session.title}
            <Edit2 className="w-4 h-4 text-brand opacity-0 group-hover:opacity-80 transition-opacity shrink-0 cursor-pointer print-hide-icon" />
          </p>
        )}

        {/* Subtitle line — editable, optional */}
        {isEditingSubtitle ? (
          <div className="flex items-center gap-2 mt-2">
            <input
              autoFocus
              placeholder={"Add a subtitle…"}
              value={tempSubtitle}
              onChange={(e) => setTempSubtitle(e.target.value)}
              onBlur={handleSubtitleSubmit}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubtitleSubmit(); if (e.key === 'Escape') setIsEditingSubtitle(false); }}
              className="bg-transparent text-sm text-white/40 outline-none border-b border-brand/50 w-full py-0.5 placeholder:text-white/20"
            />
          </div>
        ) : (
          <div className="flex items-center justify-between mt-1.5">
            <button
              onClick={() => {
                if (session.isDemo) {
                  showToast("💡 You can edit this text directly.", false);
                } else {
                  setIsEditingSubtitle(true);
                }
              }}
              className="text-sm text-white/40 hover:text-white/60 transition-colors text-left flex items-center gap-2 group print-show-flex"
            >
              {session.subtitle ? (
                <span>{session.subtitle}</span>
              ) : (
                <span className="italic text-white/20 group-hover:text-white/40">{"Lesson"}</span>
              )}
              <Edit2 className="w-3.5 h-3.5 text-brand opacity-0 group-hover:opacity-80 transition-opacity shrink-0 print-hide-icon" />
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (session.isDemo) {
                    showToast("💡 You can reorder the items in this session.", false);
                  } else {
                    setIsReordering(!isReordering);
                  }
                }}
                className={`p-2 rounded-xl border transition-colors flex items-center justify-center ${isReordering ? 'bg-brand/20 border-brand text-brand shadow-sm shadow-brand/20' : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:text-white/80'} min-h-[38px] min-w-[38px]`}
                title={isReordering ? "Disable reorder mode" : "Enable reorder mode"}
              >
                <GripHorizontal className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  if (session.isDemo) {
                    showToast("💡 You can attach videos and photos to the session here.", false);
                  } else {
                    setIsGalleryOpen(true);
                  }
                }}
                className={`p-2 rounded-xl border transition-colors flex items-center justify-center min-h-[38px] min-w-[38px] ${mediaItems.length > 0
                  ? 'bg-purple-500/20 border-purple-500/40 text-purple-300 shadow-sm'
                  : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:text-white/80'
                  }`}
                title={"Open media gallery"}
              >
                <Images className={`w-4 h-4 ${mediaItems.length > 0 ? '' : 'text-brand'}`} />
              </button>
              <button
                onClick={() => {
                  if (session.isDemo) {
                    showToast("💡 You can configure the dance style and language here.", false);
                  } else {
                    setTempGroupId(session.groupId || '');
                    setTempGlossaryId(session.glossaryId || 'auto');
                    setTempCustomGlossaryStyle(session.customGlossaryStyle || '');
                    setIsSettingsOpen(true);
                  }
                }}
                className="p-2 rounded-xl border bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:text-white/80 transition-colors flex items-center justify-center min-h-[38px] min-w-[38px]"
                title={"Session Settings"}
              >
                <SlidersHorizontal className="w-4 h-4 text-brand" />
              </button>
            </div>
          </div>
        )}


      </div>

      <div id="sessionDetailContent" className="mt-8">
        <SessionStructuredData
          sessionId={session.id}
          entries={entries}
          processingIds={processingIds}
          isReordering={isReordering}
          onToggleReordering={() => setIsReordering(false)}
          onUpdateEntry={onUpdateEntry}
          onDeleteEntry={onDeleteEntry}

          cardOrder={session.cardOrder}
          onUpdateOrder={(newOrder) => onUpdateSession({ cardOrder: newOrder })}
          sessionNotes={session.notes}
          onUpdateNotes={(newNotes) => onUpdateSession({ notes: newNotes })}
          showToast={showToast}
        />
      </div>

      {/* Spacer to ensure scrolling past the floating bottom controls */}
      <div className="h-32 shrink-0 w-full" />

      {/* Controls - Floating at bottom */}
      <div className="fixed bottom-4 sm:bottom-8 left-1/2 -translate-x-1/2 glass p-4 rounded-full flex items-center justify-center gap-4 sm:gap-6 shadow-2xl z-40 border border-white/10 bg-black/60 backdrop-blur-md print-hide">

        {isRecording && (
          <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-red-600/90 text-white text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1.5 shadow-lg border border-red-500/30 backdrop-blur-md animate-in slide-in-from-bottom-2 duration-300">
            <span className="w-2 h-2 rounded-full bg-white animate-ping shrink-0" />
            <span className="font-mono">{formatDuration(recordingDuration)}</span>
          </div>
        )}

        <label
          onClick={(e) => {
            if (session.isDemo) {
              e.preventDefault();
              showToast("💡 Tap here to upload an audio file.", false);
            }
          }}
          className="cursor-pointer flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 rounded-full transition-colors shadow-sm"
        >
          <Upload className="w-5 h-5 sm:w-6 sm:h-6" />
          <input id="uploadBtn" type="file" accept="audio/*,video/*" multiple className="hidden" onChange={(e) => {
            if (!session.isDemo) onUpload(e, language);
          }} />
        </label>

        {isRecording && (
          <button
            onClick={cancelRecording}
            className="flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-full transition-colors shadow-sm animate-in fade-in zoom-in duration-200"
            title={"Cancel recording"}
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        )}

        <button
          id="recordBtn"
          onClick={isRecording ? stopRecording : startRecording}
          style={isRecording ? {
            boxShadow: `0 0 0 ${4 + micLevel * 16}px rgba(239,68,68,${0.3 + micLevel * 0.6})`
          } : {}}
          className={`flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full font-bold transition-all shadow-lg ${isRecording
            ? 'bg-red-500 text-white hover:bg-red-600 scale-95 animate-pulse'
            : 'bg-brand text-black hover:bg-brand-light hover:scale-105'
            } min-h-[64px] min-w-[64px]`}
          title={isRecording ? "Stop recording and save" : "Start recording"}
        >
          {isRecording ? <Square className="w-6 h-6 sm:w-8 sm:h-8" /> : <Mic className="w-6 h-6 sm:w-8 sm:h-8" />}
        </button>


      </div>

      {/* Settings Drawer */}
      {isSettingsOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 animate-in fade-in duration-200"
            onClick={handleCancelSettings}
          />
          {/* Drawer Panel */}
          <div
            className="fixed bottom-0 left-0 right-0 rounded-t-3xl border-t border-white/10 p-6 pb-8 bg-[#1e1e22]/95 backdrop-blur-md z-50 flex flex-col gap-6 shadow-2xl animate-in slide-in-from-bottom duration-300 sm:top-0 sm:bottom-0 sm:right-0 sm:left-auto sm:w-96 sm:rounded-l-3xl sm:rounded-tr-none sm:border-l sm:border-t-0 sm:slide-in-from-right"
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-brand" />
                {"Session Settings"}
              </h3>
              <button
                onClick={handleCancelSettings}
                className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/80 transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto space-y-6 pr-1">
              {/* Folder Selector */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-white/40 flex items-center gap-1.5">
                  <Folder className="w-3.5 h-3.5 text-brand" />
                  {"Folder"}
                </label>
                <CustomSelect
                  value={tempGroupId || ''}
                  onChange={setTempGroupId}
                  position="relative"
                  options={[
                    { value: '', label: "None (Root)" },
                    ...groups.map(g => ({ value: g.id, label: g.name }))
                  ]}
                />
              </div>

              {/* Glossary Selector */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-white/40 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-brand" />
                  {"Dance Style Glossary"}
                </label>
                <CustomSelect
                  value={tempGlossaryId}
                  onChange={setTempGlossaryId}
                  position="relative"
                  options={[
                    { value: 'auto', label: "Auto-Detect (AI)" },
                    ...glossaries.map(g => ({ value: g.id, label: g.name })),
                    { value: 'other', label: "Other (Specify...)" }
                  ]}
                />
              </div>

              {/* Specify Custom Dance Style */}
              {tempGlossaryId === 'other' && (
                <div className="flex flex-col gap-1.5 animate-in slide-in-from-top-1 duration-200">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-brand font-semibold">{"Specify Dance Style"}</label>
                  <input
                    type="text"
                    placeholder={"e.g. Samba de Gafieira, West Coast Swing..."}
                    value={tempCustomGlossaryStyle}
                    onChange={(e) => setTempCustomGlossaryStyle(e.target.value)}
                    className="bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-brand/50 transition-colors w-full placeholder:text-white/20"
                  />
                </div>
              )}


            </div>

            {/* Drawer Footer / Confirm, Cancel, and Delete Actions */}
            <div className="border-t border-white/5 pt-4 mt-auto flex flex-col gap-3">
              <div className="flex gap-3">
                <button
                  onClick={handleCancelSettings}
                  className="flex-1 px-4 py-2.5 rounded-xl font-bold bg-white/10 hover:bg-white/20 transition-colors text-white text-xs min-h-[40px]"
                >
                  {"Cancel"}
                </button>
                <button
                  onClick={handleConfirmSettings}
                  className="flex-1 px-4 py-2.5 rounded-xl font-bold bg-brand hover:bg-brand-light text-black transition-colors text-xs min-h-[40px]"
                >
                  {"Confirm"}
                </button>
              </div>
              <button
                onClick={() => {
                  onDeleteSession();
                }}
                className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 hover:bg-red-500/10 hover:text-white transition-all text-[11px] font-bold shadow-sm"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {"Delete Session"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Hidden file input for blob mode (Safari/iOS) */}
      <input
        ref={mediaInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* Gallery Drawer */}
      {isGalleryOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 animate-in fade-in duration-200"
            onClick={() => {
              setIsGalleryOpen(false);
              setIsDeleteMode(false);
            }}
          />
          {/* Drawer Panel */}
          <div className="fixed bottom-0 left-0 right-0 rounded-t-3xl border-t border-white/10 p-6 pb-8 bg-[#1e1e22]/95 backdrop-blur-md z-50 flex flex-col gap-5 shadow-2xl animate-in slide-in-from-bottom duration-300 sm:top-0 sm:bottom-0 sm:right-0 sm:left-auto sm:w-[480px] sm:rounded-l-3xl sm:rounded-tr-none sm:border-l sm:border-t-0 sm:slide-in-from-right max-h-[90vh] sm:max-h-full">
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-white/5 pb-3 shrink-0">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Images className="w-5 h-5 text-purple-400" />
                {"Media Gallery"}
                {mediaItems.length > 0 && (
                  <span className="text-xs font-normal text-white/40 ml-1">{`${mediaItems.length} item(s)`}</span>
                )}
              </h3>
              <div className="flex items-center gap-2">
                {mediaItems.length > 0 && (
                  <button
                    onClick={() => setIsDeleteMode(!isDeleteMode)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${isDeleteMode
                      ? 'bg-red-500/20 border-red-500/40 text-red-300'
                      : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                      }`}
                  >
                    {isDeleteMode ? "Done" : "Edit"}
                  </button>
                )}
                <button
                  onClick={() => {
                    setIsGalleryOpen(false);
                    setIsDeleteMode(false);
                  }}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/80 transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Storage info note */}
            <div className="shrink-0 text-[11px] text-white/40 bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 leading-relaxed flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-yellow-400/70 mt-0.5 shrink-0" />
              <span>{isFileAccessSupported ? "Photos and videos are stored only on your device. Backups include a link to your files - if you move or delete them locally, the links will break." : "Photos and videos are saved directly in your browser storage. Backups will include the files, which may increase the backup size significantly."}</span>
            </div>

            {/* Content */}
            <div
              className="flex-1 overflow-y-auto space-y-3 pr-1"
              onClick={() => {
                if (isDeleteMode) setIsDeleteMode(false);
              }}
            >
              {mediaItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-white/30 gap-3">
                  <Images className="w-10 h-10 opacity-30" />
                  <p className="text-sm">{"No media attached to this session yet."}</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {mediaItems.map(item => {
                    const url = mediaObjectUrls[item.id];
                    const broken = brokenMediaIds.has(item.id);
                    const isVideo = item.mimeType.startsWith('video/');
                    return (
                      <div
                        key={item.id}
                        className={`relative group rounded-xl overflow-hidden border bg-black/30 aspect-square transition-all ${isDeleteMode
                          ? 'animate-wiggle border-red-500/40 shadow-lg shadow-red-500/10'
                          : 'border-white/10'
                          }`}
                      >
                        {broken ? (
                          <button
                            className="w-full h-full flex flex-col items-center justify-center gap-1.5 p-2 text-center cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isDeleteMode) {
                                setMediaToDelete(item);
                              }
                            }}
                          >
                            <LinkIcon className="w-6 h-6 text-red-400/60" />
                            <p className="text-[9px] text-white/40 leading-tight">{"File not found - it may have been moved or deleted."}</p>
                          </button>
                        ) : url ? (
                          <button
                            className="w-full h-full cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isDeleteMode) {
                                setMediaToDelete(item);
                              } else {
                                setLightboxItem(item);
                              }
                            }}
                          >
                            {isVideo ? (
                              <video src={url} className="w-full h-full object-cover" muted playsInline preload="metadata" />
                            ) : (
                              <img src={url} alt={item.filename} className="w-full h-full object-cover" />
                            )}
                            {isVideo && (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-8 h-8 rounded-full bg-black/60 flex items-center justify-center">
                                  <span className="text-white text-xs ml-0.5">▶</span>
                                </div>
                              </div>
                            )}
                          </button>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <div className="w-5 h-5 border-2 border-white/20 border-t-purple-400 rounded-full animate-spin" />
                          </div>
                        )}
                        {/* Delete button (visible when in delete mode) */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setMediaToDelete(item);
                          }}
                          className={`absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-red-600 border border-red-500 text-white transition-all flex items-center justify-center z-10 ${isDeleteMode ? 'scale-100 opacity-100' : 'scale-0 opacity-0 pointer-events-none'
                            }`}
                          title={"Remove this media item"}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        {/* Filename tooltip */}
                        <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none ${isDeleteMode ? 'hidden' : ''}`}>
                          <p className="text-[9px] text-white/80 truncate">{item.filename}</p>
                          <p className="text-[8px] text-white/40">{formatBytes(item.size)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Add Media Button */}
            <div className="shrink-0 border-t border-white/5 pt-4">
              <button
                onClick={handleAddMedia}
                disabled={isAddingMedia}
                className="w-full flex items-center justify-center gap-2 p-3.5 rounded-xl border border-dashed border-purple-500/40 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 hover:border-purple-400/60 transition-all text-xs font-bold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAddingMedia ? (
                  <><div className="w-4 h-4 border-2 border-purple-400/40 border-t-purple-400 rounded-full animate-spin" />{"Optimizing image..."}</>
                ) : (
                  <><Images className="w-4 h-4" />{"Add Photo or Video"}</>
                )}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Lightbox */}
      {lightboxItem && (() => {
        const url = mediaObjectUrls[lightboxItem.id];
        const isVideo = lightboxItem.mimeType.startsWith('video/');
        return (
          <div
            className="fixed inset-0 bg-black/95 z-[60] flex flex-col items-center justify-center animate-in fade-in duration-200"
            onClick={() => setLightboxItem(null)}
          >
            {/* Delete button (Top Left) */}
            <button
              className="absolute top-4 left-4 p-2.5 rounded-full bg-red-600/80 hover:bg-red-600 text-white transition-colors z-30 flex items-center justify-center min-h-[40px] min-w-[40px]"
              onClick={(e) => {
                e.stopPropagation();
                setMediaToDelete(lightboxItem);
              }}
              title={"Remove this media item"}
            >
              <Trash2 className="w-4 h-4" />
            </button>
            {/* Close button (Top Right) */}
            <button
              className="absolute top-4 right-4 p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-30 flex items-center justify-center min-h-[40px] min-w-[40px]"
              onClick={() => setLightboxItem(null)}
            >
              <X className="w-5 h-5" />
            </button>
            {url && (
              isVideo ? (
                <div
                  className="relative w-full h-full max-w-4xl max-h-[80vh] flex items-center justify-center"
                  onClick={e => e.stopPropagation()}
                >
                  <video
                    ref={videoRef}
                    src={url}
                    controls
                    preload="metadata"
                    className="w-full h-full max-w-full max-h-full object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-200 cursor-pointer"
                  />
                  {/* Invisible click handler overlay for play/pause (leaves space at bottom for native controls) */}
                  <div
                    className="absolute top-0 left-0 right-0 bottom-16 z-10 cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (videoRef.current) {
                        if (videoRef.current.paused) {
                          videoRef.current.play();
                        } else {
                          videoRef.current.pause();
                        }
                      }
                    }}
                  />
                </div>
              ) : (
                <img
                  src={url}
                  alt={lightboxItem.filename}
                  className="max-w-full max-h-full object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-200"
                  onClick={e => e.stopPropagation()}
                />
              )
            )}
          </div>
        );
      })()}

      {/* Custom App Delete Modal */}
      {mediaToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-[70] p-6" onClick={() => setMediaToDelete(null)}>
          <div className="glass p-8 max-w-sm w-full space-y-6 animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold flex items-center gap-2 text-red-400">
              <Trash2 className="w-5 h-5 text-red-500" />
              {"Confirm Deletion"}
            </h3>
            <p className="text-white/70 text-sm">
              {"Remove this item from the session?"}
            </p>
            <div className="flex gap-3 justify-end items-center mt-6">
              <button
                onClick={() => setMediaToDelete(null)}
                className="px-5 py-2.5 rounded-xl font-bold bg-white/10 hover:bg-white/20 transition-colors min-h-[44px] cursor-pointer text-xs"
              >
                {"Cancel"}
              </button>
              <button
                onClick={async () => {
                  const toDelete = mediaToDelete;
                  setMediaToDelete(null);
                  await handleDeleteMediaItem(toDelete);
                  if (lightboxItem?.id === toDelete.id) {
                    setLightboxItem(null);
                  }
                }}
                className="px-5 py-2.5 rounded-xl font-bold bg-red-600 hover:bg-red-700 transition-colors shadow-lg shadow-red-600/30 text-white min-h-[44px] cursor-pointer text-xs"
              >
                {"Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── New display helpers ───────────────────────────────────────────────────

function EditableText({ value, onChange, className, multiline = false, onIntercept }: { value: string, onChange: (v: string) => void, className?: string, multiline?: boolean, onIntercept?: () => void }) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value);

  const handleSubmit = () => {
    if (tempValue.trim() !== value.trim()) {
      onChange(tempValue);
    }
    setIsEditing(false);
  };

  if (isEditing) {
    if (multiline) {
      return (
        <AutoGrowingTextarea
          autoFocus
          value={tempValue}
          onChange={(e) => setTempValue(e.target.value)}
          onBlur={handleSubmit}
          className={`w-full bg-black/40 text-white/90 p-3 rounded-xl border border-brand/50 outline-none focus:border-brand transition-colors resize-none overflow-hidden text-sm ${className || ''}`}
        />
      );
    }
    return (
      <input
        autoFocus
        value={tempValue}
        onChange={(e) => setTempValue(e.target.value)}
        onBlur={handleSubmit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSubmit();
          if (e.key === 'Escape') { setTempValue(value); setIsEditing(false); }
        }}
        className={`w-full bg-black/40 text-white/90 p-2 rounded-lg border border-brand/50 outline-none focus:border-brand transition-colors text-sm ${className || ''}`}
      />
    );
  }

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        if (onIntercept) {
          onIntercept();
        } else {
          setTempValue(value);
          setIsEditing(true);
        }
      }}
      className={`cursor-text hover:bg-white/5 rounded px-1 -mx-1 transition-colors group relative w-full ${className || ''}`}
      title="Click to edit"
    >
      <div className="whitespace-pre-wrap w-full">{value}</div>
      <Edit2 className="w-3.5 h-3.5 text-brand opacity-0 group-hover:opacity-60 absolute top-1 right-1 print-hide-icon" />
    </div>
  );
}

function CollapsiblePanel({ title, children, defaultOpen = true, accent = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean; accent?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`rounded-xl border overflow-hidden ${accent ? 'border-brand/30 print:border-brand/30' : 'border-white/10 print:border-black/10'}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${accent ? 'bg-brand/10 hover:bg-brand/15 print:bg-brand/5' : 'bg-white/5 hover:bg-white/10 print:bg-black/5'} print-show-flex`}
      >
        <span className={`text-xs font-bold uppercase tracking-widest ${accent ? 'text-brand' : 'text-white/50'}`}>{title}</span>
        <ChevronDown className={`w-4 h-4 text-white/30 transition-transform ${open ? '' : '-rotate-90'} print-hide-icon`} />
      </button>
      <div className={`px-4 pb-4 pt-2 ${open ? 'block' : 'hidden'} print-expand`}>{children}</div>
    </div>
  );
}

function BulletList({ items, onChange, onIntercept }: { items: string[], onChange?: (newItems: string[]) => void, onIntercept?: () => void }) {
  if (!items || items.length === 0) return null;
  return (
    <ul className="space-y-2 mt-1">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-white/80">
          <div className="w-4 h-4 rounded-full bg-brand/20 flex items-center justify-center shrink-0 mt-0.5">
            <CheckCircle2 className="w-3 h-3 text-brand" />
          </div>
          <div className="flex-1 w-full min-w-0 pr-2">
            {onChange ? (
              <EditableText
                value={item}
                multiline={true}
                onIntercept={onIntercept}
                onChange={(newVal) => {
                  const copy = [...items];
                  if (!newVal.trim()) {
                    copy.splice(i, 1);
                  } else {
                    copy[i] = newVal;
                  }
                  onChange(copy);
                }}
              />
            ) : (
              <span>{item}</span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function StrictSummaryBlock({ data, onChange, onIntercept }: { data: string[], onChange?: (newItems: string[]) => void, onIntercept?: () => void }) {
  if (!data || data.length === 0) return <p className="text-white/30 italic text-sm">No strict summary content extracted.</p>;
  return <BulletList items={data} onChange={onChange} onIntercept={onIntercept} />;
}

function ExpandedInsightsBlock({ data, onChange, onIntercept }: { data: ExpandedInsights, onChange?: (newData: ExpandedInsights) => void, onIntercept?: () => void }) {
  
  const allEmpty =
    (data.drills?.length ?? 0) === 0 &&
    (data.homework?.length ?? 0) === 0 &&
    (data.technicalExpansion?.length ?? 0) === 0 &&
    (data.emotionalNotes?.length ?? 0) === 0;
  if (allEmpty) return null;

  const handleChange = (key: keyof ExpandedInsights, newItems: string[]) => {
    if (onChange) onChange({ ...data, [key]: newItems });
  };

  const [open, setOpen] = useState(false);

  return (
    <div className="border border-purple-500/20 rounded-2xl overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full px-5 py-3 cursor-pointer flex items-center gap-3 bg-purple-500/10 hover:bg-purple-500/15 transition-colors text-left print-show-flex">
        <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
        <span className="font-bold text-purple-300 text-sm">{"Expanded Insights (AI Enhanced)"}</span>
        <ChevronDown className={`w-4 h-4 text-purple-400/50 ml-auto transition-transform ${open ? 'rotate-180' : ''} print-hide-icon`} />
      </button>
      <div className={`p-4 space-y-3 bg-black/20 print:bg-transparent ${open ? 'block' : 'hidden'} print-expand`}>
        {(data.drills?.length ?? 0) > 0 && <CollapsiblePanel title={"Drills"} defaultOpen={false}><BulletList items={data.drills} onChange={onChange ? (arr) => handleChange('drills', arr) : undefined} onIntercept={onIntercept} /></CollapsiblePanel>}
        {(data.homework?.length ?? 0) > 0 && <CollapsiblePanel title={"Homework"} defaultOpen={false}><BulletList items={data.homework} onChange={onChange ? (arr) => handleChange('homework', arr) : undefined} onIntercept={onIntercept} /></CollapsiblePanel>}
        {(data.technicalExpansion?.length ?? 0) > 0 && <CollapsiblePanel title={"Technical Expansion"} defaultOpen={false}><BulletList items={data.technicalExpansion} onChange={onChange ? (arr) => handleChange('technicalExpansion', arr) : undefined} onIntercept={onIntercept} /></CollapsiblePanel>}
        {(data.emotionalNotes?.length ?? 0) > 0 && <CollapsiblePanel title={"Emotional Notes"} defaultOpen={false}><BulletList items={data.emotionalNotes} onChange={onChange ? (arr) => handleChange('emotionalNotes', arr) : undefined} onIntercept={onIntercept} /></CollapsiblePanel>}
      </div>
    </div>
  );
}

function TranscriptBlock({ text, onChange, onIntercept }: { text: string, onChange?: (newText: string) => void, onIntercept?: () => void }) {
  
  const [open, setOpen] = useState(false);
  if (!text) return null;
  return (
    <div className="border border-white/10 rounded-2xl overflow-hidden print-transcript">
      <button onClick={() => setOpen(!open)} className="w-full px-5 py-3 cursor-pointer flex items-center gap-3 bg-white/5 hover:bg-white/8 transition-colors text-left print-show-flex">
        <FileAudio className="w-4 h-4 text-white/40 shrink-0" />
        <span className="font-bold text-white/50 text-sm">{"View Transcript"}</span>
        <ChevronDown className={`w-4 h-4 text-white/20 ml-auto transition-transform ${open ? 'rotate-180' : ''} print-hide-icon`} />
      </button>
      <div className={`p-4 bg-black/20 print:bg-transparent text-white/50 print:text-black/60 text-sm italic leading-relaxed ${open ? 'block' : 'hidden'} print-expand`}>
        {onChange ? (
          <EditableText value={text} onChange={onChange} multiline={true} className="whitespace-pre-wrap block" onIntercept={onIntercept} />
        ) : (
          <span className="whitespace-pre-wrap">{text}</span>
        )}
      </div>
    </div>
  );
}

function SortableCard({ id, children, isDraggable = true, isReordering = false }: { id: string; children: React.ReactNode; isDraggable?: boolean; isReordering?: boolean; key?: string | number }) {
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
    zIndex: isDragging ? 50 : 1,
    opacity: isDragging ? 0.9 : 1,
    position: 'relative' as const,
    ...(isReordering ? { touchAction: 'none' } : {})
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(isDraggable && isReordering ? attributes : {})}
      {...(isDraggable && isReordering ? listeners : {})}
      className={isDragging ? 'shadow-2xl scale-[1.02] cursor-grabbing ring-2 ring-brand rounded-2xl bg-[#141414]' : (isDraggable && isReordering ? 'cursor-grab touch-none active:scale-[0.99] transition-all ring-2 ring-brand/40 bg-brand/5 rounded-2xl' : 'transition-all')}
    >
      <div className={isDraggable && isReordering && !isDragging ? 'opacity-80 pointer-events-none' : ''}>
        {children}
      </div>
    </div>
  );
}

// ─── Session Structured Data ────────────────────────────────────────────────

function SessionStructuredData({ sessionId, entries, processingIds, isReordering, onToggleReordering, onUpdateEntry, onDeleteEntry, cardOrder, onUpdateOrder, sessionNotes, onUpdateNotes, showToast }: { sessionId: string; entries: AudioEntry[]; processingIds: Set<string>; isReordering: boolean; onToggleReordering?: () => void; onUpdateEntry: (id: string, changes: Partial<AudioEntry>) => void; onDeleteEntry: (id: string) => void; cardOrder?: string[]; onUpdateOrder: (newOrder: string[]) => void; sessionNotes?: string; onUpdateNotes: (newNotes: string) => void; showToast?: (msg: string, isError?: boolean) => void }) {
  const [report, setReport] = useState<any | null>(null);

  

  const handleIntercept = () => {
    if (sessionId === 'demo-session' && showToast) {
      showToast("💡 You can edit this text directly.", false);
    }
  };
  const interceptProp = sessionId === 'demo-session' ? handleIntercept : undefined;

  const formatClipDate = (timestamp: number) => {
    const d = new Date(timestamp);
    const day = String(d.getDate()).padStart(2, '0');
    const monthsEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthsEs = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const month = monthsEn[d.getMonth()];
    const year = String(d.getFullYear()).slice(-2);
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}-${month}-${year} ${hours}:${minutes}`;
  };
  const [openStates, setOpenStates] = useState<Record<string, boolean>>({});
  const [isConsolidatedOpen, setIsConsolidatedOpen] = useState(false);
  const [isNoteVisible, setIsNoteVisible] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const dbReport = await db.getSessionFinalReport(sessionId);
        setReport(dbReport || null);
      } catch (err) {
        console.error('Failed to load generic content for session', err);
      }
    };
    load();
    const intervalId = setInterval(load, 2000);
    return () => clearInterval(intervalId);
  }, [sessionId]);

  const isEntryOpen = (id: string) => openStates[id] ?? false;
  const toggleEntry = (id: string) => setOpenStates(prev => ({ ...prev, [id]: !prev[id] }));

  // Parse consolidated report — new shape takes priority, falls back to legacy
  let consolidatedStrictSummary: string[] | null = null;
  let consolidatedExpanded: ExpandedInsights | null = null;
  let consolidatedTranscripts: string | null = null;
  let legacyReportContent: any = null;

  if (report?.report) {
    let r = report.report;
    if (typeof r === 'string') {
      try { r = JSON.parse(r); } catch (e) { r = { RawSummary: r }; }
    }
    if (typeof r === 'object' && r !== null) {
      if (Array.isArray(r.strictSummary)) {
        consolidatedStrictSummary = r.strictSummary as string[];
        consolidatedExpanded = (r.expandedInsights ?? { drills: [], homework: [], technicalExpansion: [], emotionalNotes: [] }) as ExpandedInsights;
        if (r.transcripts && Array.isArray(r.transcripts)) {
          consolidatedTranscripts = r.transcripts.map((t: any) => t.text || '').join('\n\n---\n\n');
        }
      } else {
        // Legacy shape
        const legacyKeys = ['summary', 'homework', 'drills', 'coreConcepts', 'emotionalThemes', 'crossSessionPatterns', 'prioritiesNextLesson'];
        const contentToRender: any = {};
        if (r.transcripts) consolidatedTranscripts = r.transcripts.map((t: any) => t.text || '').join('\n\n---\n\n');
        legacyKeys.forEach(k => {
          if (r[k]) {
            if (Array.isArray(r[k]) && r[k].length > 0 && r[k][0]?.bullet) {
              contentToRender[k] = r[k].map((item: any) => item.bullet);
            } else {
              contentToRender[k] = r[k];
            }
          }
        });
        if (Object.keys(contentToRender).length === 0 && !r.transcripts) Object.assign(contentToRender, r);
        if (Object.keys(contentToRender).length > 0) legacyReportContent = contentToRender;
      }
    }
  }

  const hasConsolidated = consolidatedStrictSummary || legacyReportContent;

  const handleUpdateConsolidated = async (key: string, newValue: any) => {
    if (!report || !report.report || typeof report.report !== 'object') return;
    const newReportData = { ...report.report, [key]: newValue };
    const newDbReport = { ...report, report: newReportData };
    setReport(newDbReport);
    try { await db.saveFinalReport(newDbReport); } catch (e) { console.error(e); }
  };

  const handleUpdateConsolidatedTranscripts = async (newText: string) => {
    if (!report || !report.report || typeof report.report !== 'object') return;
    const newReportData = { ...report.report, transcripts: [{ text: newText }] };
    const newDbReport = { ...report, report: newReportData };
    setReport(newDbReport);
    try { await db.saveFinalReport(newDbReport); } catch (e) { console.error(e); }
  };

  const handleUpdateLegacyConsolidated = async (newObj: any) => {
    if (!report || !report.report || typeof report.report !== 'object') return;
    const newReportData = { ...report.report, ...newObj };
    const newDbReport = { ...report, report: newReportData };
    setReport(newDbReport);
    try { await db.saveFinalReport(newDbReport); } catch (e) { console.error(e); }
  };

  // Determine items to render in sortable list
  const reportId = `report-${sessionId}`;

  // Create an array to map sortable block components
  const availableItems = new Map<string, React.ReactNode>();

  if (hasConsolidated) {
    availableItems.set(reportId, (
      <div className={`border rounded-2xl overflow-hidden shadow-sm ${consolidatedStrictSummary ? 'border-brand/40 bg-brand/5 print:bg-transparent print:border-black/10' : 'border-white/10 glass'}`}>
        <div
          className="px-5 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 bg-brand/10 print:bg-black/5 cursor-pointer select-none transition-colors hover:bg-brand/20"
          onClick={() => setIsConsolidatedOpen(o => !o)}
        >
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-brand" />
            <span className="font-bold text-base">{"Consolidated Session Report"}</span>
          </div>
          {report?.timestamp && (
            <span className="text-[10px] font-sans text-white/40 font-semibold sm:self-center">
              {`Consolidated: ${formatClipDate(report.timestamp)}`}
            </span>
          )}
        </div>
        <div className={`p-4 space-y-4 bg-black/20 print:bg-transparent border-t border-brand/20 print:border-black/10 ${isConsolidatedOpen ? 'block' : 'hidden'} print-expand`}>
          {consolidatedStrictSummary && (
            <>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-brand mb-3">{"Strict Summary"}</p>
                <StrictSummaryBlock data={consolidatedStrictSummary} onChange={(s) => handleUpdateConsolidated('strictSummary', s)} onIntercept={interceptProp} />
              </div>
              {consolidatedExpanded && <ExpandedInsightsBlock data={consolidatedExpanded} onChange={(ei) => handleUpdateConsolidated('expandedInsights', ei)} onIntercept={interceptProp} />}
            </>
          )}
          {legacyReportContent && (
            <>
              <StructuredBullets contentObj={legacyReportContent} isReport={true} onChange={handleUpdateLegacyConsolidated} onIntercept={interceptProp} />
            </>
          )}
        </div>
      </div>
    ));
  }

  // Build audio card maps
  entries.forEach((audio, index) => {
    const time = formatClipDate(audio.timestamp);
    const displayTitleRaw = audio.filename || `Audio Entry ${entries.length - index}`;
    const displayTitle = displayTitleRaw.replace(/\.(webm|mp4|mp3|wav|caf)$/i, '');
    const isOpen = isEntryOpen(audio.id);
    const isProcessing = processingIds.has(audio.id);

    const hasNewShape = Array.isArray(audio.strictSummary);
    const legacyContent: any = {};
    if (!hasNewShape) {
      const keys = ['concepts', 'drills', 'homework', 'mechanics', 'emotionalNotes'];
      const src = (audio as any).processedData || audio;
      keys.forEach(k => { if ((src as any)[k]) legacyContent[k] = (src as any)[k]; });
      if (Object.keys(legacyContent).length === 0 && audio.transcript) {
        try {
          const pd = JSON.parse(audio.transcript);
          keys.forEach(k => { if (pd[k]) legacyContent[k] = pd[k]; });
        } catch (_) { }
      }
      if (Object.keys(legacyContent).length === 0 && audio.bulletPoints?.length) {
        legacyContent.bulletPoints = audio.bulletPoints;
      }
    }

    const cardId = `audio-${audio.id}`;
    availableItems.set(cardId, (
      <AudioEntryCard
        key={audio.id}
        displayTitle={displayTitle}
        time={time}
        audio={audio}
        isOpen={isOpen}
        isProcessing={isProcessing}
        hasNewShape={hasNewShape}
        legacyContent={legacyContent}
        onToggle={() => toggleEntry(audio.id)}
        onUpdateTitle={(newTitle) => onUpdateEntry(audio.id, { filename: newTitle })}
        onDelete={() => onDeleteEntry(audio.id)}
        onUpdateContent={(changes) => onUpdateEntry(audio.id, changes)}
        showToast={showToast}
      />
    ));
  });

  // Add the Notes Card (always render so it is visible even on empty/new sessions)
  const notesId = `notes-${sessionId}`;
  const notesList = sessionNotes ? sessionNotes.split('\n').filter(n => n.trim().length > 0) : [];

  availableItems.set(notesId, (
    <div className="bg-white/5 print:bg-transparent backdrop-blur-md border border-white/10 print:border-transparent p-6 rounded-2xl shadow-sm print:shadow-none relative w-full box-border mt-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold uppercase tracking-widest text-white/30">{"Notes"}</h3>
        {!isNoteVisible && (
          <button
            onClick={() => {
              if (sessionId === 'demo-session' && showToast) {
                showToast("💡 You can add personal written notes to your session here.", false);
              } else {
                setIsNoteVisible(true);
              }
            }}
            className="text-brand hover:text-brand/80 font-bold text-sm transition-colors"
          >
            {"+ Add note"}
          </button>
        )}
      </div>

      {notesList.length > 0 && (
        <div className="mb-4">
          <BulletList 
            items={notesList} 
            onChange={(newList) => onUpdateNotes(newList.join('\n'))}
            onIntercept={interceptProp} 
          />
        </div>
      )}

      {isNoteVisible && (
        <div className="flex flex-col gap-3 mt-4">
          <AutoGrowingTextarea
            autoFocus
            placeholder={"Add your session notes here..."}
            value={newNoteText}
            onClick={(e) => {
              if (sessionId === 'demo-session' && showToast) {
                e.preventDefault();
                showToast("💡 You can add personal written notes to your session here.", false);
              }
            }}
            readOnly={sessionId === 'demo-session'}
            onChange={(e) => setNewNoteText(e.target.value)}
            className="w-full min-h-[100px] bg-black/20 print:bg-black/5 text-white/80 print:text-black/80 p-4 rounded-xl border border-white/5 print:border-black/10 outline-none focus:border-brand/50 transition-colors resize-none overflow-hidden box-border"
          />
          <div className="flex justify-end gap-3">
             <button 
               onClick={() => {
                 setNewNoteText('');
                 setIsNoteVisible(false);
               }}
               className="px-4 py-2 text-white/50 hover:text-white/80 text-sm font-bold transition-colors"
             >
               {"Cancel"}
             </button>
             <button 
               onClick={() => {
                 if (newNoteText.trim()) {
                   const updatedNotes = [...notesList, newNoteText.trim()];
                   onUpdateNotes(updatedNotes.join('\n'));
                   setNewNoteText('');
                   setIsNoteVisible(false);
                 }
               }}
               className="px-4 py-2 bg-brand/20 text-brand hover:bg-brand/30 rounded-lg text-sm font-bold transition-colors"
             >
               {"Confirm"}
             </button>
          </div>
        </div>
      )}
    </div>
  ));

  // Calculate sorted order 
  const currentKeys = Array.from(availableItems.keys());
  let sortedKeys = cardOrder || [];

  // Add new items that aren't in the saved order yet
  const missingKeys = currentKeys.filter(k => !sortedKeys.includes(k));
  if (missingKeys.length > 0) {
    if (!cardOrder) {
      // Original default logic: Report first, then entries backwards, then notes
      sortedKeys = [];
      if (hasConsolidated) sortedKeys.push(reportId);
      entries.forEach(e => sortedKeys.push(`audio-${e.id}`));
      // Show notes at the bottom by default if visible or if entries > 0 (old behavior logic)
      if (availableItems.has(notesId)) sortedKeys.push(notesId);
    } else {
      // Appended new items
      sortedKeys = [...sortedKeys, ...missingKeys];
    }
  }

  // Filter out items that no longer exist (deleted audios)
  sortedKeys = sortedKeys.filter(k => availableItems.has(k));

  // --- DndKit setup ---
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8
      }
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,      // "Tap and hold" on mobile
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active.id !== over?.id && over) {
      const oldIndex = sortedKeys.indexOf(active.id as string);
      const newIndex = sortedKeys.indexOf(over.id as string);
      const newOrder = arrayMove(sortedKeys, oldIndex, newIndex);
      onUpdateOrder(newOrder); // pass bubbling up
    }
  };

  return (
    <div className="space-y-4 relative mt-2">
      {isReordering && (
        <div className="flex items-center justify-center mb-6">
          <button
            onClick={() => onToggleReordering?.()}
            className="bg-brand/10 text-brand border border-brand/20 hover:bg-brand/20 text-xs uppercase font-bold tracking-widest px-4 py-2 rounded-full shadow-sm flex items-center gap-2 transition-colors cursor-pointer"
            title={"Disable reorder mode"}
          >
            <GripHorizontal className="w-4 h-4" /> {"Reorder Mode Active"}
          </button>
        </div>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sortedKeys} strategy={verticalListSortingStrategy}>
          {sortedKeys.map((key) => (
            <SortableCard key={key} id={key} isReordering={isReordering}>
              {availableItems.get(key)}
            </SortableCard>
          ))}
        </SortableContext>
      </DndContext>

      {!hasConsolidated && entries.length === 0 && !sessionNotes && (
        <div className="flex flex-col items-center justify-center pt-2 pb-16 sm:pb-24 text-center px-4 animate-in fade-in duration-500">
          <div className="relative w-20 h-20 sm:w-24 sm:h-24 mb-6">
            <div className="absolute inset-0 bg-brand/10 blur-xl rounded-full animate-pulse" style={{ animationDuration: '3s' }} />
            <div className="absolute inset-0 rounded-full border-2 border-dashed border-brand/30 animate-[spin_8s_linear_infinite]" />
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-brand/80 animate-spin" style={{ animationDuration: '3s' }} />
            <AudioLines className="w-full h-full p-5 text-brand/60 drop-shadow-[0_0_10px_rgba(45,212,191,0.5)] relative z-10" />
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-white mb-2">{"This session is empty"}</h3>
          <p className="text-sm text-white/40 max-w-md leading-relaxed">{"Tap the microphone to capture key concepts, combinations, or feedback from today's lesson."}</p>
        </div>
      )}
    </div>
  );
}

function AudioEntryCard({ displayTitle, time, audio, isOpen, isProcessing, hasNewShape, legacyContent, onToggle, onUpdateTitle, onDelete, onUpdateContent, showToast }: {
  displayTitle: string;
  time: string;
  audio: AudioEntry;
  isOpen: boolean;
  isProcessing: boolean;
  hasNewShape: boolean;
  legacyContent: any;
  onToggle: () => void;
  onUpdateTitle: (newTitle: string) => void;
  onDelete: () => void;
  onUpdateContent: (changes: Partial<AudioEntry>) => void;
  showToast?: (msg: string, isError?: boolean) => void;
  key?: string | number;
}) {
  
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(displayTitle);

  const handleIntercept = () => {
    if (audio.sessionId === 'demo-session' && showToast) {
      showToast("💡 You can edit this text directly.", false);
    }
  };
  const interceptProp = audio.sessionId === 'demo-session' ? handleIntercept : undefined;

  const handleTitleSubmit = () => {
    if (tempTitle.trim() && tempTitle.trim() !== displayTitle) {
      onUpdateTitle(tempTitle.trim());
    } else {
      setTempTitle(displayTitle);
    }
    setIsEditingTitle(false);
  };

  useEffect(() => {
    if (audio.audioBlob) {
      const url = URL.createObjectURL(audio.audioBlob);
      setAudioUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [audio.audioBlob]);

  return (
    <div className="border border-white/10 glass rounded-2xl overflow-hidden shadow-sm">
      <div
        onClick={(e) => {
          if (!isEditingTitle) onToggle();
        }}
        className="p-4 sm:p-5 cursor-pointer flex justify-between items-center hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            {isEditingTitle ? (
              <input
                autoFocus
                value={tempTitle}
                onChange={(e) => setTempTitle(e.target.value)}
                onBlur={handleTitleSubmit}
                onKeyDown={(e) => { if (e.key === 'Enter') handleTitleSubmit(); if (e.key === 'Escape') { setTempTitle(displayTitle); setIsEditingTitle(false); } }}
                className="bg-transparent font-bold text-sm text-white outline-none w-full"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span
                className={`font-bold text-sm text-white flex items-center gap-2 group w-max ${isOpen ? 'cursor-text hover:text-white/80' : ''}`}
                onClick={(e) => {
                  if (isOpen) {
                    e.stopPropagation();
                    if (audio.sessionId === 'demo-session' && showToast) {
                      showToast("💡 You can edit this text directly.", false);
                    } else {
                      setTempTitle(displayTitle);
                      setIsEditingTitle(true);
                    }
                  }
                }}
                title={isOpen ? "Edit clip name" : undefined}
              >
                {displayTitle}
                {isOpen && (
                  <Edit2 className="w-3 h-3 text-brand opacity-0 group-hover:opacity-80 transition-opacity shrink-0 cursor-pointer" />
                )}
              </span>
            )}
            <span className="text-xs text-white/40">{time} - {audio.type === 'recording' ? "Live" : "Clip"}</span>
          </div>
          {isProcessing && (
            <span className="hidden sm:flex items-center gap-1.5 text-xs font-bold text-brand animate-pulse bg-brand/10 px-3 py-1.5 rounded-lg border border-brand/20">{"PROCESSING..."}</span>
          )}
        </div>
        <div className="flex items-center gap-3">

          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-3 bg-red-500/10 text-red-400 rounded-xl hover:bg-red-500/20 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <Trash2 className="w-5 h-5 shrink-0" />
          </button>
          <ChevronUp className={`w-5 h-5 text-white/40 transition-transform ${isOpen ? '' : 'rotate-180'} print-hide-icon`} />
        </div>
      </div>

      <div className={`p-4 sm:p-5 bg-black/20 print:bg-transparent border-t border-white/5 print:border-black/10 space-y-4 ${isOpen ? 'block' : 'hidden'} print-expand`}>
        {audioUrl ? (
          <audio controls src={audioUrl} className="w-full h-10 opacity-90 rounded-xl bg-black/20 print-hide" />
        ) : audio.sessionId === 'demo-session' ? (
          <div className="w-full h-10 flex items-center gap-3 bg-black/20 rounded-xl px-4 overflow-hidden relative cursor-not-allowed print-hide">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-pulse-slow"></div>
            <div className="w-6 h-6 rounded-full bg-brand flex items-center justify-center shrink-0 shadow-lg shadow-brand/20">
              <Play className="w-3 h-3 text-black fill-black ml-[1.5px]" />
            </div>
            <div className="flex-1 flex items-center justify-between gap-[3px] opacity-50 overflow-hidden px-2">
              {[12, 24, 18, 10, 14, 22, 20, 12, 10, 16, 24, 18, 12, 14, 20, 24, 16, 10, 14, 22, 18, 12, 14, 20, 16, 10, 12, 22, 18, 14].map((h, i) => (
                <div key={i} className="w-1.5 rounded-full bg-brand/60" style={{ height: `${h}px` }}></div>
              ))}
            </div>
            <span className="text-[10px] text-brand/50 font-mono tracking-widest">00:45</span>
          </div>
        ) : null}

        {hasNewShape ? (
          <>
            {audio.strictSummary && (audio.strictSummary as string[]).length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-brand mb-3">{"Strict Summary"}</p>
                <StrictSummaryBlock data={audio.strictSummary as string[]} onChange={(s) => onUpdateContent({ strictSummary: s })} onIntercept={interceptProp} />
              </div>
            )}
            {audio.expandedInsights && <ExpandedInsightsBlock data={audio.expandedInsights} onChange={(ei) => onUpdateContent({ expandedInsights: ei })} onIntercept={interceptProp} />}
            <TranscriptBlock text={audio.transcript ?? ''} onChange={(t) => onUpdateContent({ transcript: t })} onIntercept={interceptProp} />
          </>
        ) : (
          <>
            {Object.keys(legacyContent).length > 0 ? (
              <div className="print-transcript">
                <StructuredBullets contentObj={legacyContent} onIntercept={interceptProp} onChange={(newObj) => {
                  if ((audio as any).processedData) {
                    onUpdateContent({ processedData: { ...(audio as any).processedData, ...newObj } } as any);
                  } else if (audio.transcript && typeof legacyContent === 'object') {
                    try {
                      onUpdateContent({ transcript: JSON.stringify({ ...JSON.parse(audio.transcript), ...newObj }) });
                    } catch (e) { }
                  } else {
                    onUpdateContent(newObj as any);
                  }
                }} />
              </div>
            ) : isProcessing ? (
              <p className="text-white/40 italic text-sm">{"Waiting for content to be extracted..."}</p>
            ) : null}
            {audio.transcript && !hasNewShape && (
              <div className="mt-4 pt-4 border-t border-white/5 text-sm print-transcript">
                <span className="text-xs font-bold uppercase tracking-widest text-white/30 mb-2 block">{"Raw Transcript"}</span>
                <EditableText value={audio.transcript} onChange={(t) => onUpdateContent({ transcript: t })} multiline className="text-white/60 italic leading-relaxed whitespace-pre-wrap block" onIntercept={interceptProp} />
              </div>
            )}
          </>
        )}


      </div>
    </div>
  );
}

function CollapsibleSection({ title, contentObj, isReport = false, isOpen, onToggle, audioData, onDelete }: any) {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  useEffect(() => {
    if (audioData?.audioBlob) {
      const url = URL.createObjectURL(audioData.audioBlob);
      setAudioUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [audioData?.audioBlob]);

  if (!contentObj || (Object.keys(contentObj).length === 0 && !audioData)) return null;

  return (
    <div className={`mb-4 border rounded-2xl overflow-hidden shadow-sm transition-all ${isReport ? 'border-brand/40 bg-brand/5' : 'border-white/10 glass'}`}>
      <div
        onClick={onToggle}
        className={`p-4 sm:p-5 cursor-pointer flex justify-between items-center transition-colors ${isReport ? 'bg-brand/10 hover:bg-brand/20' : 'hover:bg-white/5'}`}
      >
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isReport ? 'bg-brand/20 text-brand' : 'bg-white/10 text-white/60'}`}>
            {isReport ? <Sparkles className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
          </div>
          <span className="font-bold text-base sm:text-lg">{title}</span>
        </div>

        <div className="flex items-center gap-4">
          {audioData && !audioData.transcript && Object.keys(contentObj).length === 0 && (
            <div className="hidden sm:flex items-center gap-1.5 text-xs font-bold text-brand animate-pulse bg-brand/10 px-3 py-1.5 rounded-lg border border-brand/20">
              PROCESSING...
            </div>
          )}
          {audioData && onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="p-3 bg-red-500/10 text-red-400 rounded-xl hover:bg-red-500/20 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <Trash2 className="w-5 h-5 shrink-0" />
            </button>
          )}
          <ChevronUp className={`w-5 h-5 text-white/40 transition-transform ${isOpen ? '' : 'rotate-180'} print-hide-icon`} />
        </div>
      </div>

      {isOpen && (
        <div className="p-4 sm:p-5 bg-black/20 border-t border-white/5">
          {audioUrl && (
            <audio controls src={audioUrl} className="w-full h-10 mb-5 opacity-90 transition-opacity rounded-xl bg-black/20 print-hide" />
          )}

          {Object.keys(contentObj).length > 0 ? (
            <StructuredBullets contentObj={contentObj} isReport={isReport} />
          ) : (
            <p className="text-white/40 italic text-sm">Waiting for content generation...</p>
          )}

          {audioData?.transcript && (
            <div className="mt-6 pt-4 border-t border-white/5 text-sm">
              <span className="text-xs font-bold uppercase tracking-widest text-white/30 mb-2 block">Raw Transcript</span>
              <p className="text-white/60 italic leading-relaxed">"{audioData.transcript}"</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StructuredBullets({ contentObj, isReport, onChange, onIntercept }: { contentObj: any, isReport?: boolean, onChange?: (newObj: any) => void, onIntercept?: () => void }) {
  if (!contentObj || typeof contentObj !== 'object') return null;

  const processBulletItem = (origItem: any, key: React.Key, path?: (string | number)[]) => {
    const text = typeof origItem === 'string' ? origItem : JSON.stringify(origItem);
    const lowerText = text.toLowerCase();
    const isHighlight = lowerText.includes('homework') ||
      lowerText.includes('priorit') ||
      lowerText.includes('tarefa') ||
      lowerText.includes('tarea');

    return (
      <li
        key={key}
        className={`flex gap-3 text-sm sm:text-base leading-relaxed mb-3 ${isHighlight ? 'font-bold text-red-300 bg-red-500/10 px-4 py-3 rounded-xl border border-red-500/20 shadow-inner' : 'text-white/80'
          }`}
      >
        <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 shadow-sm ${isHighlight ? 'bg-red-500/20' : 'bg-brand/20'}`}>
          <CheckCircle2 className={`w-3.5 h-3.5 ${isHighlight ? 'text-red-400' : 'text-brand'}`} />
        </div>
        <div className="flex-1 w-full min-w-0 pr-2">
          {onChange && path ? (
            <EditableText
              value={text}
              multiline={true}
              onIntercept={onIntercept}
              onChange={(newVal) => {
                const copy = JSON.parse(JSON.stringify(contentObj));
                let curr = copy;
                for (let i = 0; i < path.length - 1; i++) curr = curr[path[i]];
                const last = path[path.length - 1];

                if (!newVal.trim()) {
                  if (typeof last === 'number' && Array.isArray(curr)) {
                    curr.splice(last, 1);
                  } else {
                    delete curr[last];
                  }
                } else {
                  if (typeof origItem === 'string') {
                    curr[last] = newVal;
                  } else {
                    try { curr[last] = JSON.parse(newVal); } catch (e) { curr[last] = newVal; }
                  }
                }
                onChange(copy);
              }}
            />
          ) : (
            <span>{text}</span>
          )}
        </div>
      </li>
    );
  };

  const listItems: React.ReactNode[] = [];
  let keyIdx = 0;

  for (const [key, value] of Object.entries(contentObj)) {
    if (!value || (Array.isArray(value) && value.length === 0)) continue;
    if (typeof value === 'object' && Object.keys(value).length === 0) continue;

    const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());

    listItems.push(
      <li key={`header-${keyIdx++}`} className={`font-bold mt-6 mb-3 uppercase text-xs tracking-widest ${isReport ? 'text-brand' : 'text-white/50'}`}>
        {formattedKey}
      </li>
    );

    if (Array.isArray(value)) {
      value.forEach((item, i) => listItems.push(processBulletItem(item, `arr-${keyIdx}-${i}`, [key, i])));
    } else if (typeof value === 'object') {
      for (const [subKey, subValue] of Object.entries(value)) {
        if (Array.isArray(subValue)) {
          subValue.forEach((item, i) => {
            listItems.push(processBulletItem(`${subKey}: ${item}`, `obj-arr-${keyIdx}-${i}`));
          });
        } else {
          listItems.push(processBulletItem(`${subKey}: ${subValue}`, `obj-${keyIdx}`));
        }
        keyIdx++;
      }
    } else {
      listItems.push(processBulletItem(value, `val-${keyIdx}`, [key]));
    }
    keyIdx++;
  }

  if (listItems.length === 0) return null;
  return <ul className="m-0 p-0 list-none">{listItems}</ul>;
}


