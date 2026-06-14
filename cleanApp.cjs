const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Imports
code = code.replace(/import \{ callZoukAudioProcessor \} from '\.\/lib\/mcp';\n?/g, '');
code = code.replace(/import defaultGlossaries from '\.\/lib\/defaultGlossaries';\n?/g, '');
code = code.replace(/import ReactMarkdown from 'react-markdown';\n?/g, '');
code = code.replace(/StrictSummary,\s*/g, '');
code = code.replace(/ExpandedInsights,\s*/g, '');
code = code.replace(/DanceGlossary,\s*/g, '');

// Glossary methods
code = code.replace(/getGlossaries\(\)/g, '[]');
code = code.replace(/saveGlossary\([^)]+\)/g, 'Promise.resolve()');
code = code.replace(/deleteGlossary\([^)]+\)/g, 'Promise.resolve()');

// Final report methods
code = code.replace(/await db\.saveFinalReport\([^)]+\);?/g, '');
code = code.replace(/db\.getSessionFinalReport/g, 'null as any');
code = code.replace(/await db\.saveFinalReport/g, 'null');

// AudioEntry properties
code = code.replace(/strictSummary:\s*\[\],\s*/g, '');
code = code.replace(/expandedInsights:\s*\{[^}]+\},\s*/g, '');
code = code.replace(/bulletPoints:\s*\[\],\s*/g, '');
code = code.replace(/strictSummary:\s*[^,]+,\s*/g, '');
code = code.replace(/expandedInsights:\s*[^,]+,\s*/g, '');

// Types definition inline
code = code.replace(/type: "upload" \| "recording";/g, 'type?: "upload" | "recording";');

// `isDemo` in Session objects / type accesses
code = code.replace(/isDemo: true,?\s*/g, '');
code = code.replace(/isDemo: false,?\s*/g, '');
code = code.replace(/selectedSession\.isDemo \? showToast\([^)]+\) : /g, '');
code = code.replace(/session\.isDemo \? showToast\([^)]+\) : /g, '');
code = code.replace(/if\s*\(session\.isDemo\)\s*\{\s*showToast\([^)]+\);\s*\}\s*else\s*\{([\s\S]*?)\}/g, '$1');
code = code.replace(/if\s*\(session\.isDemo\)\s*\{\s*showToast\([^)]+\);\s*\}/g, '');
code = code.replace(/if\s*\(!session\.isDemo\)\s*/g, '');
code = code.replace(/else\s*if\s*\(session\.isDemo\)\s*\{\s*showToast\([^)]+\);\s*\}/g, '');

// Remove glossaryId, shareMethod, shareId, customGlossaryStyle from Session
code = code.replace(/glossaryId:\s*[^,]+,?\s*/g, '');
code = code.replace(/customGlossaryStyle:\s*[^,]+,?\s*/g, '');
code = code.replace(/shareMethod:\s*[^,]+,?\s*/g, '');
code = code.replace(/shareId:\s*[^,]+,?\s*/g, '');

fs.writeFileSync('src/App.tsx', code);
console.log('Done');
