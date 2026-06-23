# Agent Rules for lmplog

## Version Bumping
When bumping the version of this application, you MUST update the version string in all of the following places:
1. `package.json`
2. `src/changelog.ts` (Add a new entry to the array)
3. `src/version.ts` (Update the exported `version` constant. This ensures the version is correctly displayed in the settings drawer and changelog modal.)
