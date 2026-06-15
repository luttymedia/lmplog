export interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

export const changelog: ChangelogEntry[] = [
  {
    version: '1.3.7',
    date: new Date().toISOString().split('T')[0],
    changes: [
      'Added dynamic Splash Screen with seamless PWA handoff',
      'Implemented Invisible Pen SVG drawing animation for startup'
    ]
  },
  {
    version: '1.3.6',
    date: new Date().toISOString().split('T')[0],
    changes: [
      'Added General Notes functionality to Review Mode',
      'Added option to show Session Info notes in Review Mode'
    ]
  },
  {
    version: '1.3.5',
    date: '2026-06-15',
    changes: [
      'Added "Music" as a new marker type with a distinct pink badge in Review Mode'
    ]
  },
  {
    version: '1.3.4',
    date: '2026-06-15',
    changes: [
      'Removed auto-focus from the new session title field to prevent the mobile keyboard from popping up immediately',
      'Enabled the numeric keypad for timestamp editing on mobile devices for faster logging'
    ]
  },
  {
    version: '1.3.3',
    date: '2026-06-15',
    changes: [
      'Fixed marker time inputs to allow deferred typing and smart parsing (e.g., typing "1455" sets the time to "14:55")',
      'Fixed an issue where the +OUT button would not activate if the clip timer was never used',
      'Session title no longer pre-fills with the date, defaulting to empty',
      'Polished app header paddings for a tighter UI'
    ]
  },
  {
    version: '1.3.2',
    date: '2026-06-15',
    changes: [
      'Updated Backup & Restore to include video clips, markers, and recorded media',
      'Redesigned Clip layout to be flush and edge-to-edge on mobile with square corners',
      'Removed installation blocker screen on desktop browsers'
    ]
  },
  {
    version: '1.3.1',
    date: '2026-06-14',
    changes: [
      'Fixed individual clip Expand/Collapse toggle logic in Review Mode',
      'Removed deprecated Dance Style Glossary selector from Session Settings'
    ]
  },
  {
    version: '1.3.0',
    date: '2026-06-14',
    changes: [
      'Replaced header icon and text with horizontal LMPLOG logo, centered in the header bar',
      'Removed Export Session (PDF) button and modal',
      'Review Mode redesigned: no separate header, grouped by clip with collapsible sections',
      'Review Mode: compact single-line marker rows with dimmed/strikethrough resolved items',
      'Review Mode: added per-clip editor notes (NotebookPen icon, purple when note exists)',
      'Review Mode: added filter dropdown and Expand All / Collapse All controls',
      'Review Mode button moved inline with session action buttons; active state highlighted',
      'Review Mode button corners updated to match other UI buttons'
    ]
  },
  {
    version: '1.2.0',
    date: '2026-06-14',
    changes: [
      'Marker list is now always sorted chronologically by IN time, even after manual edits',
      'Markers can now be added at any time, even when the clip timer is stopped or has not started',
      '+OUT button is always visible on markers without an out time, enabling manual entry after recording',
      'Note input field on markers is now hidden by default and revealed via an icon button',
      'Note input auto-hides on blur if left empty',
      'Clip cards are now reorderable via drag-and-drop; order is persisted across sessions',
      'Added Expand All / Collapse All icon button for clip cards',
      'Review Mode button moved to the session header bar alongside other action buttons'
    ]
  },
  {
    version: '1.1.0',
    date: new Date().toISOString().split('T')[0],
    changes: [
      'Overhauled the Session details into a Video Logger for live marker logging',
      'Introduced Dark Mode UI with Glassmorphism for recording sessions',
      'Added a new Session Info Modal for creating and editing session details',
      'Replaced native select and confirm dialogs with custom UI components',
      'Added collapsible "Take" cards and editable timestamp fields'
    ]
  },
  {
    version: '1.0.1',
    date: new Date().toISOString().split('T')[0],
    changes: [
      'Removed AI processing functionality (Gemini API)',
      'Removed Session Sharing feature',
      'Removed Session Importing feature',
      'Cleaned up unused components and modals',
      'Converted application into a fully static SPA'
    ]
  },
  {
    version: '1.0.0',
    date: '2026-06-14',
    changes: [
      'Initial release of LMPLOG',
      'Rebranded application from Zoutty to LMPLOG, updating themes and styles',
      'Removed standard onboarding flow and Welcome Modal',
      'Hardcoded English translation and removed language selectors'
    ]
  }
];
