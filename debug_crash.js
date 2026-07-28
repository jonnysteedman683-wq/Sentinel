import { readFileSync } from 'fs';
let appContent = readFileSync('src/App.tsx', 'utf-8');

const lines = appContent.split('\n');
const isDreamingLines = lines.map((l, i) => ({l, i})).filter(({l}) => l.includes('isDreaming'));
console.log(isDreamingLines);
