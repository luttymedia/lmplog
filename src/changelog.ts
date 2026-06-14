export interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

export const changelog: ChangelogEntry[] = [
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
