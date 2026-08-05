import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf-8');

const indicator = `
              {/* SLM Indicator */}
              <div className="px-4 py-1 flex items-center justify-between text-xs text-slate-500 font-mono">
                {slmLoaded ? (
                  <span className="text-teal-500 flex items-center gap-2"><Zap className="w-3 h-3" /> System 1 (SLM) Active</span>
                ) : slmProgress ? (
                  <span className="text-amber-500 flex items-center gap-2">
                    <Loader2 className="w-3 h-3 animate-spin" /> Loading System 1 Model ({slmProgress.file} - {Math.round(slmProgress.progress || 0)}%)
                  </span>
                ) : (
                  <span className="flex items-center gap-2"><Cpu className="w-3 h-3" /> Initializing System 1...</span>
                )}
              </div>
`;

content = content.replace(
  "{/* Input Area */}",
  indicator + "\n              {/* Input Area */}"
);

fs.writeFileSync('src/App.tsx', content);
