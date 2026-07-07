const fs = require('fs');
let content = fs.readFileSync('src/AgentsPanel.tsx', 'utf-8');

const oldSelected = `                <button 
                  onClick={() => toggleStatus(selectedAgent)}
                  className={\`px-4 py-2 rounded-lg font-bold text-xs tracking-widest border transition-colors \${
                    selectedAgent.status === 'active' 
                      ? 'bg-rose-950/30 text-rose-400 border-rose-900/50 hover:bg-rose-900/50' 
                      : 'bg-emerald-950/30 text-emerald-400 border-emerald-900/50 hover:bg-emerald-900/50'
                  }\`}
                >
                  {selectedAgent.status === 'active' ? 'SUSPEND AGENT' : 'ACTIVATE AGENT'}
                </button>
              </div>`;

const newSelected = `                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => handleEvolveAgent(selectedAgent)}
                    disabled={isEvolving}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs tracking-widest border transition-colors bg-blue-950/30 text-blue-400 border-blue-900/50 hover:bg-blue-900/50 disabled:opacity-50"
                  >
                    {isEvolving ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    EVOLVE
                  </button>
                  <button 
                    onClick={() => toggleStatus(selectedAgent)}
                    className={\`px-4 py-2 rounded-lg font-bold text-xs tracking-widest border transition-colors \${
                      selectedAgent.status === 'active' 
                        ? 'bg-amber-950/30 text-amber-400 border-amber-900/50 hover:bg-amber-900/50' 
                        : 'bg-emerald-950/30 text-emerald-400 border-emerald-900/50 hover:bg-emerald-900/50'
                    }\`}
                  >
                    {selectedAgent.status === 'active' ? 'SUSPEND' : 'ACTIVATE'}
                  </button>
                  <button 
                    onClick={() => handleDeleteAgent(selectedAgent.id!)}
                    className="px-4 py-2 rounded-lg font-bold text-xs tracking-widest border transition-colors bg-rose-950/30 text-rose-400 border-rose-900/50 hover:bg-rose-900/50"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>`;

content = content.replace(oldSelected, newSelected);
fs.writeFileSync('src/AgentsPanel.tsx', content);
