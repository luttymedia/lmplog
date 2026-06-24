export type Language = 'pt-BR' | 'es' | 'en' | 'auto';

export interface AudioEntry {
  id: string;
  sessionId: string;
  timestamp: number;
  language: Language;
  transcript?: string;
  audioBlob?: Blob; // The recorded or uploaded audio blob
  type: 'recording' | 'upload';
  filename?: string; // Original filename if uploaded
  strictSummary?: any;
  bulletPoints?: any;
  expandedInsights?: any;
}

export type StrictSummary = any;
export type ExpandedInsights = any;
export type DanceGlossary = any;

export interface Session {
  id: string;
  title: string;
  subtitle?: string; // Optional subtitle (editable by user)
  date: number;
  summary?: string;
  notes?: string; // Optional user notes
  cardOrder?: string[]; // IDs of cards in preferred order
  groupId?: string; // Optional group folder ID
  isDemo?: boolean;
  glossaryId?: string;
  customGlossaryStyle?: string;
  shareId?: string;
  shareMethod?: string;
  shareTimestamp?: number;
  sharedContent?: any;

  location?: string;
  equipment?: string;
  cameraSettings?: string;
  generalNotes?: string;
  reviewNotes?: string; // Notes added directly in Review Mode
  showGeneralNotesInReview?: boolean; // Toggle to show generalNotes in Review Mode
}

export interface SessionGroup {
  id: string;
  name: string;
  dateCreated: number;
  sessionOrder?: string[]; // IDs of sessions in preferred order in this folder
  folderOrder?: string[]; // IDs of folders in preferred order
}

export interface SessionMedia {
  id: string;
  sessionId: string;
  timestamp: number;
  filename: string;
  mimeType: string;
  size: number; // in bytes
  storageMode: 'reference' | 'blob';
  fileHandle?: any; // FileSystemFileHandle — Reference mode (Chrome/Edge desktop)
  blob?: Blob;      // Blob mode — Safari/Firefox/iOS fallback
}

export interface Marker {
  id: string;
  inTime: number;
  outTime?: number;
  type: 'Cut' | 'Zoom' | 'Note' | 'Music';
  content: string;
  isResolved?: boolean;
}

export interface Clip {
  id: string;
  sessionId: string;
  title: string;
  startedAt: number | null;
  endedAt: number | null;
  markers: Marker[];
  notes?: string; // Editor notes for this clip (used in Review Mode)
  groupId?: string; // Optional clip group ID — undefined means orphan
  isResolved?: boolean;
}

export interface ClipGroup {
  id: string;
  sessionId: string;
  title: string;
  order: number;       // creation timestamp, used for display order
  clipOrder: string[]; // ordered clip IDs within this group
}
