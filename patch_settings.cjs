const fs = require('fs');
let content = fs.readFileSync('src/SettingsPanel.tsx', 'utf-8');

const oldBlock = `              <div>
                <label className="block text-xs font-bold tracking-widest text-slate-500 mb-2 uppercase">Anthropic API Key</label>
                <div className="flex gap-3">
                  <input 
                    type={isEditingKey ? "text" : "password"}
                    defaultValue="************************"
                    disabled={!isEditingKey}
                    className="flex-1 bg-slate-950 border border-slate-700/80 rounded-lg px-4 py-3 focus:outline-none focus:border-emerald-500/70 focus:ring-1 focus:ring-emerald-500/50 text-slate-200 font-mono text-sm disabled:opacity-50 disabled:bg-slate-900/50 shadow-inner transition-all"
                  />
                  `;

const newBlock = `              <div>
                <label className="block text-xs font-bold tracking-widest text-slate-500 mb-2 uppercase">Anthropic API Key</label>
                <div className="flex gap-3">
                  <input 
                    type={isEditingKey ? "text" : "password"}
                    defaultValue="************************"
                    disabled={!isEditingKey}
                    className="flex-1 bg-slate-950 border border-slate-700/80 rounded-lg px-4 py-3 focus:outline-none focus:border-emerald-500/70 focus:ring-1 focus:ring-emerald-500/50 text-slate-200 font-mono text-sm disabled:opacity-50 disabled:bg-slate-900/50 shadow-inner transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold tracking-widest text-slate-500 mb-2 uppercase">OpenRouter API Key</label>
                <div className="flex gap-3">
                  <input 
                    type={isEditingKey ? "text" : "password"}
                    defaultValue="************************"
                    disabled={!isEditingKey}
                    className="flex-1 bg-slate-950 border border-slate-700/80 rounded-lg px-4 py-3 focus:outline-none focus:border-emerald-500/70 focus:ring-1 focus:ring-emerald-500/50 text-slate-200 font-mono text-sm disabled:opacity-50 disabled:bg-slate-900/50 shadow-inner transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold tracking-widest text-slate-500 mb-2 uppercase">Groq API Key</label>
                <div className="flex gap-3 flex-col sm:flex-row">
                  <input 
                    type={isEditingKey ? "text" : "password"}
                    defaultValue="************************"
                    disabled={!isEditingKey}
                    className="flex-1 bg-slate-950 border border-slate-700/80 rounded-lg px-4 py-3 focus:outline-none focus:border-emerald-500/70 focus:ring-1 focus:ring-emerald-500/50 text-slate-200 font-mono text-sm disabled:opacity-50 disabled:bg-slate-900/50 shadow-inner transition-all"
                  />
                  `;

content = content.replace(oldBlock, newBlock);
fs.writeFileSync('src/SettingsPanel.tsx', content);
