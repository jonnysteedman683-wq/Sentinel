import { readFileSync, writeFileSync } from 'fs';

// Remove double type="button" from App.tsx
let appContent = readFileSync('src/App.tsx', 'utf-8');
appContent = appContent.replace(/type="button"\n *type="button"/g, 'type="button"');

writeFileSync('src/App.tsx', appContent);
