# LMPLOG

**Video production logging app for recording dance classes and promotional videos.**

A PWA (Progressive Web App) built for Android. Replaces paper notebooks during video shoots with a structured, timer-synced digital log.

## What it does

- Organizes shoots into **Folders** (person/subject) → **Sessions** (recording days) → **Clips** (individual camera recordings)
- Syncs a timer with the camera so every **Marker** has an accurate timecode
- Captures cut points, zoom cues, music markers, audio issues, and general notes with a single tap
- Produces a filterable **Editing Checklist** — work through markers by type (all cuts, all zooms) or chronologically
- Stores **reference photos** of lighting setups, camera positions, and equipment configurations
- Backs up to **Google Drive** (client-side, no server required)

## Tech stack

- React + TypeScript + Vite
- IndexedDB (local-first, works offline)
- PWA — installable on Android
- Static deployment — no backend server

## Development

```bash
npm install
npm run dev
```

## Deployment

Static site — build and deploy the `dist/` folder.

```bash
npm run build
```
