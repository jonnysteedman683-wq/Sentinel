import { readFileSync, writeFileSync } from 'fs';

// 1. Fix src/components/tabs/ChatTab.tsx
let chatContent = readFileSync('src/components/tabs/ChatTab.tsx', 'utf-8');

// Button 1 (line 70)
chatContent = chatContent.replace(
  '<button\n                      onClick={() => handleBranchThread(msg.id)}',
  '<button\n                      type="button"\n                      onClick={() => handleBranchThread(msg.id)}'
);

// onContextMenu static element (line 83)
chatContent = chatContent.replace(
  '<div \n                          onContextMenu={(e) => {',
  '<div \n                          role="presentation"\n                          onContextMenu={(e) => {'
);

// Button 2 (line 371)
chatContent = chatContent.replace(
  '<button\n                          key={d}\n                          onClick={() => setDepth(d)}',
  '<button\n                          type="button"\n                          key={d}\n                          onClick={() => setDepth(d)}'
);

// Button 3 (line 428)
chatContent = chatContent.replace(
  '<button\n                      key={i}\n                      onClick={() => {',
  '<button\n                      type="button"\n                      key={i}\n                      onClick={() => {'
);

// Fix array index as key in suggestedShortcuts (line 429)
chatContent = chatContent.replace(
  '{messages[messages.length - 1].suggestedShortcuts?.map((shortcut: any, i: number) => (\n                    <button\n                      type="button"\n                      key={i}',
  '{messages[messages.length - 1].suggestedShortcuts?.map((shortcut: any) => (\n                    <button\n                      type="button"\n                      key={shortcut}'
);


writeFileSync('src/components/tabs/ChatTab.tsx', chatContent);


// 2. Fix src/App.tsx
let appContent = readFileSync('src/App.tsx', 'utf-8');

// userDocSnap any
appContent = appContent.replace(
  'let userDocSnap;',
  'let userDocSnap: any;'
);

// onClick on div
appContent = appContent.replace(
  '<div className="relative flex items-center justify-center w-10 h-10 cursor-pointer md:mb-4 hidden md:flex" onClick={() => setSidebarOpen(!isSidebarOpen)}>',
  '<div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === \'Enter\') setSidebarOpen(!isSidebarOpen); }} className="relative flex items-center justify-center w-10 h-10 cursor-pointer md:mb-4 hidden md:flex" onClick={() => setSidebarOpen(!isSidebarOpen)}>'
);

// SVG without title
appContent = appContent.replace(
  '<svg viewBox="0 0 24 24" className={`w-full h-full stroke-amber-400 ${theme === \'dark\' ? \'fill-amber-950/50\' : \'fill-amber-100/50\'}`} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">',
  '<svg aria-label="Toggle Sidebar" viewBox="0 0 24 24" className={`w-full h-full stroke-amber-400 ${theme === \'dark\' ? \'fill-amber-950/50\' : \'fill-amber-100/50\'}`} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">\n               <title>Toggle Sidebar</title>'
);

writeFileSync('src/App.tsx', appContent);

console.log('Applied static fixes.');
