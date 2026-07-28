import { readFileSync, writeFileSync } from 'fs';

let content = readFileSync('src/components/tabs/ChatTab.tsx', 'utf-8');

// The issue was: setMessages(prev => [...prev.filter(m => m.id !== msg.id), ...])
// Our regex setMessages\(prev => didn't catch the m => inside. Let's do a replace:
content = content.replace(/prev\.filter\(m =>/g, "prev.filter((m: any) =>");

writeFileSync('src/components/tabs/ChatTab.tsx', content);
