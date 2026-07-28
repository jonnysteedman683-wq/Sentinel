import { readFileSync, writeFileSync } from 'fs';

let content = readFileSync('src/components/tabs/ChatTab.tsx', 'utf-8');

// Add missing imports
content = content.replace(
  "import { doc, addDoc, collection, deleteDoc } from '../../firebase.js';",
  `import { doc, addDoc, collection, deleteDoc } from '../../firebase.js';\nimport { ReasoningTree } from '../ReasoningTree.js';\n\ntype CognitionDepth = 'Fast' | 'Balanced' | 'Deep Reasoning';`
);

// Fix implicitly any parameters
content = content.replace(/messages.map\(m =>/g, "messages.map((m: any) =>");
content = content.replace(/messages.map\(\(msg\) =>/g, "messages.map((msg: any) =>");
content = content.replace(/setMessages\(prev =>/g, "setMessages((prev: any) =>");
content = content.replace(/prev.filter\(m =>/g, "prev.filter((m: any) =>");
content = content.replace(/suggestedShortcuts\?\.map\(\(shortcut, i\) =>/g, "suggestedShortcuts?.map((shortcut: any, i: number) =>");
content = content.replace(/const lastUserMsg = \[\.\.\.messages\].reverse\(\).find\(m => m.role === 'user'\);/g, "const lastUserMsg = [...messages].reverse().find((m: any) => m.role === 'user');");

writeFileSync('src/components/tabs/ChatTab.tsx', content);
console.log('Fixed types in src/components/tabs/ChatTab.tsx');
