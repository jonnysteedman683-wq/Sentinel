const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf-8');

content = content.replace(/import \{ ChatPanel \} from '\.\/ChatPanel';/, `import { ChatPanel } from './ChatPanel';\nimport { SystemMetrics } from './SystemMetrics';`);

const oldOnline = `<div className="mt-auto px-6 py-4 border-t border-slate-800/80 w-full hidden md:block">
          <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono tracking-widest font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            SYSTEM ONLINE
          </div>
        </div>`;

const newOnline = `<div className="mt-auto px-4 py-4 border-t border-slate-800/80 w-full hidden md:block space-y-4">
          <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono tracking-widest font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
            SYSTEM ONLINE
          </div>
          <div className="pt-2 border-t border-slate-800/50">
            <SystemMetrics />
          </div>
        </div>`;

content = content.replace(oldOnline, newOnline);

fs.writeFileSync('src/App.tsx', content);
