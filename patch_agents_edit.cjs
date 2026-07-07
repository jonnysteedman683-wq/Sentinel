const fs = require('fs');
let content = fs.readFileSync('src/AgentsPanel.tsx', 'utf-8');

const importReplacement = `import { Users, UserPlus, Server, Activity, ShieldAlert, Cpu, Trash2, Edit2, CheckCircle2, Sparkles, Loader2, Save, X } from 'lucide-react';`;
content = content.replace("import { Users, UserPlus, Server, Activity, ShieldAlert, Cpu, Trash2, Edit2, CheckCircle2, Sparkles, Loader2 } from 'lucide-react';", importReplacement);

content = content.replace("const [isAdding, setIsAdding] = useState(false);", "const [isAdding, setIsAdding] = useState(false);\n  const [isEditing, setIsEditing] = useState(false);");

const breadcrumbUpdate = `  React.useEffect(() => {
    if (isAdding) {
      setBreadcrumbs([{ label: 'ADD NEW AGENT', onClick: () => setIsAdding(false) }]);
    } else if (isEditing && selectedAgent) {
      setBreadcrumbs([
        { label: selectedAgent.name, onClick: () => setIsEditing(false) },
        { label: 'EDIT', onClick: () => {} }
      ]);
    } else if (selectedAgent) {
      setBreadcrumbs([{ label: selectedAgent.name, onClick: () => setSelectedAgentId(null) }]);
    } else {
      setBreadcrumbs([]);
    }
  }, [isAdding, isEditing, selectedAgentId, selectedAgent?.name, setBreadcrumbs]);`;

content = content.replace(/React\.useEffect\(\(\) => \{[\s\S]*?\}, \[isAdding, selectedAgentId, selectedAgent\?\.name, setBreadcrumbs\]\);/, breadcrumbUpdate);

const editButtons = `<div className="flex items-center gap-3">
                  {!isEditing ? (
                    <button 
                      onClick={() => {
                        setNewAgent(selectedAgent);
                        setIsEditing(true);
                      }}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs tracking-widest border transition-colors bg-slate-950/30 text-slate-300 border-slate-700 hover:bg-slate-800"
                    >
                      <Edit2 size={14} />
                      EDIT
                    </button>
                  ) : (
                    <button 
                      onClick={async () => {
                        await db.agents.update(selectedAgent.id!, {
                          name: newAgent.name,
                          role: newAgent.role,
                          model: newAgent.model,
                          systemPrompt: newAgent.systemPrompt,
                          capabilities: newAgent.capabilities
                        });
                        setIsEditing(false);
                      }}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs tracking-widest border transition-colors bg-emerald-950/30 text-emerald-400 border-emerald-900/50 hover:bg-emerald-900/50"
                    >
                      <Save size={14} />
                      SAVE
                    </button>
                  )}
                  <button 
                    onClick={() => handleEvolveAgent(selectedAgent)}
                    disabled={isEvolving || isEditing}`;

content = content.replace(`<button \n                    onClick={() => handleEvolveAgent(selectedAgent)}\n                    disabled={isEvolving}`, editButtons);

const renderForm = `{isEditing ? (
                <div className="space-y-4 mt-6">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1 tracking-widest">AGENT DESIGNATION</label>
                    <input 
                      type="text" 
                      value={newAgent.name} 
                      onChange={e => setNewAgent({...newAgent, name: e.target.value})}
                      className="w-full bg-slate-900/80 border border-slate-700 rounded-lg p-3 text-sm focus:border-emerald-500/50 focus:outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1 tracking-widest">ROLE</label>
                      <select 
                        value={newAgent.role}
                        onChange={e => setNewAgent({...newAgent, role: e.target.value as AgentRole})}
                        className="w-full bg-slate-900/80 border border-slate-700 rounded-lg p-3 text-sm focus:border-emerald-500/50 focus:outline-none"
                      >
                        <option value="core">Core Kernel</option>
                        <option value="specialized">Specialized</option>
                        <option value="observer">Observer</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1 tracking-widest">MODEL TIER</label>
                      <select 
                        value={newAgent.model}
                        onChange={e => setNewAgent({...newAgent, model: e.target.value})}
                        className="w-full bg-slate-900/80 border border-slate-700 rounded-lg p-3 text-sm focus:border-emerald-500/50 focus:outline-none appearance-none"
                      >
                        <optgroup label="Google (Gemini)">
                          <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                          <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                        </optgroup>
                        <optgroup label="OpenAI">
                          <option value="gpt-4o">GPT-4o</option>
                          <option value="gpt-4o-mini">GPT-4o Mini</option>
                        </optgroup>
                        <optgroup label="Anthropic">
                          <option value="claude-3-7-sonnet-20250219">Claude 3.7 Sonnet</option>
                          <option value="claude-3-5-haiku-20241022">Claude 3.5 Haiku</option>
                        </optgroup>
                        <optgroup label="OpenRouter (Free)">
                          <option value="openrouter/meta-llama/llama-3.1-8b-instruct:free">Llama 3.1 8B (Free)</option>
                          <option value="openrouter/deepseek/deepseek-r1:free">DeepSeek R1 (Free)</option>
                          <option value="openrouter/google/gemini-2.5-flash:free">Gemini 2.5 Flash (Free)</option>
                        </optgroup>
                        <optgroup label="OpenRouter (Premium)">
                          <option value="openrouter/anthropic/claude-3.5-sonnet">Claude 3.5 Sonnet</option>
                          <option value="openrouter/meta-llama/llama-3.1-70b-instruct">Llama 3.1 70B</option>
                        </optgroup>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1 tracking-widest">SYSTEM PROMPT / PERSONA</label>
                    <textarea 
                      value={newAgent.systemPrompt} 
                      onChange={e => setNewAgent({...newAgent, systemPrompt: e.target.value})}
                      className="w-full h-48 bg-slate-900/80 border border-slate-700 rounded-lg p-3 text-sm focus:border-emerald-500/50 focus:outline-none resize-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1 tracking-widest">CAPABILITIES</label>
                    <input 
                      type="text"
                      value={capInput}
                      onChange={e => setCapInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && capInput.trim()) {
                          setNewAgent({...newAgent, capabilities: [...(newAgent.capabilities || []), capInput.trim()]});
                          setCapInput('');
                        }
                      }}
                      placeholder="e.g. Code Review, Log Parsing"
                      className="w-full bg-slate-900/80 border border-slate-700 rounded-lg p-3 text-sm focus:border-emerald-500/50 focus:outline-none mb-3"
                    />
                    <div className="flex flex-wrap gap-2">
                      {newAgent.capabilities?.map((cap, i) => (
                        <span key={i} className="px-3 py-1 bg-emerald-950 text-emerald-400 border border-emerald-900/50 rounded-lg text-xs flex items-center gap-2 font-semibold">
                          {cap}
                          <button onClick={() => setNewAgent({...newAgent, capabilities: newAgent.capabilities?.filter((_, idx) => idx !== i)})} className="hover:text-emerald-300"><X size={12} /></button>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mt-6">
                  <div className="space-y-8">
                    <div className="bg-black/20 p-5 rounded-xl border border-slate-800/80 shadow-inner">
                      <h3 className="text-xs font-bold text-emerald-500/70 mb-4 tracking-widest flex items-center gap-2">
                        <Activity size={14} className="text-blue-400" /> SYSTEM PROMPT
                      </h3>
                      <pre className="text-slate-300 text-xs leading-relaxed font-mono whitespace-pre-wrap">
                        {selectedAgent.systemPrompt}
                      </pre>
                    </div>
                  </div>
                  
                  <div className="space-y-8">
                    <div className="bg-black/20 p-5 rounded-xl border border-slate-800/80 shadow-inner">
                      <h3 className="text-xs font-bold text-emerald-500/70 mb-4 tracking-widest flex items-center gap-2">
                        <ShieldAlert size={14} className="text-amber-400" /> CAPABILITIES
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {selectedAgent.capabilities.map((cap, i) => (
                          <span key={i} className="bg-slate-900 text-slate-300 px-3 py-1.5 rounded-lg text-xs border border-slate-700/80 font-semibold tracking-wider">
                            {cap}
                          </span>
                        ))}
                        {selectedAgent.capabilities.length === 0 && (
                          <span className="text-slate-600 text-xs italic">No specific capabilities listed.</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}`;

content = content.replace(/<div className="grid grid-cols-1 xl:grid-cols-2 gap-8">[\s\S]*?<\/div>(\s*<\/div>\s*<\/motion.div>)/, renderForm + "$1");

fs.writeFileSync('src/AgentsPanel.tsx', content);
