import { readFileSync, writeFileSync } from 'fs';

let content = readFileSync('src/components/tabs/ChatTab.tsx', 'utf-8');

content = content.replace(/prev\.map\(m =>/g, "prev.map((m: any) =>");

writeFileSync('src/components/tabs/ChatTab.tsx', content);
