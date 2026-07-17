const fs = require('fs');

let brains = fs.readFileSync('src/components/tabs/BrainsTab.tsx', 'utf8');
brains = brains.replace(/cognitiveMode: 'HRL' \| 'ActiveInference';\n  setCognitiveMode: \(mode: 'HRL' \| 'ActiveInference'\) => void;\n/, '');
brains = brains.replace(/policyConfidence: number;\n  efeScore: number;\n  depth: 'Fast' \| 'Balanced' \| 'Deep Reasoning';\n  setDepth: \(d: 'Fast' \| 'Balanced' \| 'Deep Reasoning'\) => void;\n  isDebateMode: boolean;\n  setIsDebateMode: \(val: boolean\) => void;\n/, '');
fs.writeFileSync('src/components/tabs/BrainsTab.tsx', brains);

let memory = fs.readFileSync('src/components/tabs/MemoryTab.tsx', 'utf8');
memory = memory.replace(/theme: 'dark' \| 'light';\n/, '');
fs.writeFileSync('src/components/tabs/MemoryTab.tsx', memory);
