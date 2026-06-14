export interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

export const changelog: ChangelogEntry[] = [
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
