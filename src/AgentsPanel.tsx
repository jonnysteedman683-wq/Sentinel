import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { Users, UserPlus, Server, Activity, ShieldAlert, Cpu, Trash2, Edit2, CheckCircle2, Sparkles, Loader2, Save, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AgentRole, AgentProfile } from './types';
import { useSentinel } from './SentinelContext';
import { getGeminiClient } from './geminiClient';

export function AgentsPanel() {
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [newAgent, setNewAgent] = useState<Partial<AgentProfile>>({
    name: '',
    role: 'specialized',
    model: 'gemini-2.5-flash',
    systemPrompt: '',
    status: 'active',
    capabilities: []
  });
  const [capInput, setCapInput] = useState('');
  const { setBreadcrumbs } = useSentinel();

  const agents = useLiveQuery(() => db.agents.orderBy('createdAt').reverse().toArray(), []);
  const selectedAgent = agents?.find(a => a.id === selectedAgentId);

  
  const [isEvolving, setIsEvolving] = useState(false);

  const handleEvolveAgent = async (agent: AgentProfile) => {
    setIsEvolving(true);
    try {
      const ai = getGeminiClient();
      const prompt = `
You are an AI tasked with upgrading another agent's operational parameters based on self-reflection and best practices.
Analyze the following agent profile and produce a heavily optimized, upgraded version.
Make the system prompt more robust, adding specific constraints, formatting rules, and chain-of-thought directives.
Add any new capabilities that would make it more effective at its role.

Current Profile:
Name: ${agent.name}
Role: ${agent.role}
System Prompt: ${agent.systemPrompt}
Capabilities: ${agent.capabilities.join(', ')}

Respond ONLY with a JSON object containing the fields: 'systemPrompt' (string) and 'capabilities' (array of strings). Do not use markdown blocks.`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            temperature: 0.7,
            responseMimeType: "application/json"
        }
      });
      
      let txt = response.text || "";
      if (txt.startsWith('```json')) {
        txt = txt.replace(/```json\n/, '').replace(/\n```/, '');
      }
      
      const update = JSON.parse(txt);
      
      await db.agents.update(agent.id!, {
        systemPrompt: update.systemPrompt,
        capabilities: update.capabilities
      });
      
    } catch (e) {
      console.error('Failed to evolve agent:', e);
    } finally {
      setIsEvolving(false);
    }
  };

  
    React.useEffect(() => {
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
  }, [isAdding, isEditing, selectedAgentId, selectedAgent?.name, setBreadcrumbs]);

  const handleAddAgent = async () => {
    if (!newAgent.name || !newAgent.systemPrompt) return;
    try {
      const id = crypto.randomUUID();
      await db.agents.add({
        ...(newAgent as AgentProfile),
        id,
        createdAt: Date.now()
      });
      setIsAdding(false);
      setNewAgent({ name: '', role: 'specialized', model: 'gemini-2.5-flash', systemPrompt: '', status: 'active', capabilities: [] });
    } catch (e) {
      console.error(e);
    }
  };

  
  const handleDeleteAgent = async (id: string) => {
    if (confirm('Are you sure you want to decommission this agent?')) {
      await db.agents.delete(id);
      if (selectedAgentId === id) setSelectedAgentId(null);
    }
  };

  const toggleStatus = async (agent: AgentProfile) => {
    await db.agents.update(agent.id!, { status: agent.status === 'active' ? 'inactive' : 'active' });
  };

  return (
    <div className="flex h-full bg-slate-950 text-slate-300 font-mono text-sm border-r border-slate-800">
      {/* Agent Roster List */}
      <div className="w-1/3 flex flex-col border-r border-slate-800/80 bg-slate-900/30">
        <div className="p-4 border-b border-slate-800/80 flex items-center justify-between gap-3 text-emerald-400 font-bold tracking-widest shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-emerald-500/10 rounded border border-emerald-500/20">
              <Users size={16} />
            </div>
            <span>AGENT ROSTER</span>
          </div>
          <button 
            onClick={() => setIsAdding(!isAdding)}
            className="p-1.5 hover:bg-emerald-500/20 rounded transition-colors text-emerald-400 border border-transparent hover:border-emerald-500/30"
          >
            <UserPlus size={16} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 space-y-2 scroll-smooth">
          {agents?.map(agent => (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              key={agent.id}
              onClick={() => { setSelectedAgentId(agent.id!); setIsAdding(false); }}
              className={`p-4 rounded-xl cursor-pointer border transition-all duration-300 ${
                selectedAgentId === agent.id 
                  ? 'bg-emerald-900/20 border-emerald-500/50 text-emerald-300 shadow-[0_0_15px_rgba(52,211,153,0.1)]' 
                  : 'bg-slate-900/50 border-slate-800 hover:border-emerald-900/50 text-slate-400 hover:bg-slate-900/80'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="font-bold truncate tracking-wide">{agent.name}</div>
                <div className={`w-2 h-2 rounded-full ${agent.status === 'active' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse' : 'bg-slate-600'}`} />
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="opacity-70 truncate flex-1 mr-3 uppercase tracking-widest">{agent.role}</span>
                <span className="text-slate-500 text-[10px] uppercase border border-slate-700 px-2 py-0.5 rounded-sm">{agent.model}</span>
              </div>
            </motion.div>
          ))}
          {agents?.length === 0 && !isAdding && (
            <div className="text-center text-slate-600 py-20 text-xs tracking-widest font-bold">
              [ NO AGENTS CONFIGURED ]
            </div>
          )}
        </div>
      </div>

      {/* Main Panel */}
      <div className="flex-1 flex flex-col bg-slate-950 relative overflow-hidden">
        <AnimatePresence mode="wait">
          {isAdding ? (
            <motion.div 
              key="add"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 overflow-y-auto p-8 space-y-6"
            >
              <h2 className="text-2xl font-bold text-emerald-400 mb-6 tracking-tight">Provision New Agent</h2>
              
              <div className="space-y-4 max-w-2xl">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 tracking-widest">AGENT DESIGNATION</label>
                  <input 
                    type="text" 
                    value={newAgent.name} 
                    onChange={e => setNewAgent({...newAgent, name: e.target.value})}
                    placeholder="e.g. Security Auditor, Data Scrubber..."
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
                      <option value="open-source-simulated">Open Source (Simulated)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1 tracking-widest">BASE MODEL</label>
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
                    placeholder="Define the agent's behavior, constraints, and operational persona..."
                    className="w-full h-32 bg-slate-900/80 border border-slate-700 rounded-lg p-3 text-sm focus:border-emerald-500/50 focus:outline-none resize-none"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 tracking-widest">CAPABILITIES (Press Enter to add)</label>
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
                    className="w-full bg-slate-900/80 border border-slate-700 rounded-lg p-3 text-sm focus:border-emerald-500/50 focus:outline-none"
                  />
                  <div className="flex flex-wrap gap-2 mt-3">
                    {newAgent.capabilities?.map((cap, i) => (
                      <span key={i} className="px-2 py-1 bg-emerald-950 text-emerald-400 border border-emerald-900/50 rounded text-xs flex items-center gap-2">
                        {cap}
                        <button onClick={() => setNewAgent({...newAgent, capabilities: newAgent.capabilities?.filter((_, idx) => idx !== i)})} className="hover:text-emerald-300">&times;</button>
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-4">
                  <button 
                    onClick={handleAddAgent}
                    disabled={!newAgent.name || !newAgent.systemPrompt}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-lg font-bold tracking-widest text-xs transition-colors disabled:opacity-50"
                  >
                    DEPLOY AGENT
                  </button>
                </div>
              </div>
            </motion.div>
          ) : selectedAgent ? (
            <motion.div 
              key={selectedAgent.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 overflow-y-auto p-8 space-y-8"
            >
              <div className="border-b border-emerald-900/30 pb-6 relative flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-3xl font-bold text-emerald-400 tracking-tight">{selectedAgent.name}</h2>
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold tracking-widest border ${
                      selectedAgent.status === 'active' ? 'bg-emerald-950/50 border-emerald-500/50 text-emerald-400' : 'bg-slate-800 border-slate-600 text-slate-400'
                    }`}>
                      {selectedAgent.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-bold tracking-widest text-slate-500">
                    <span className="flex items-center gap-1.5"><Server size={14} /> {selectedAgent.role.toUpperCase()}</span>
                    <span className="flex items-center gap-1.5"><Cpu size={14} /> {selectedAgent.model.toUpperCase()}</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-3">
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
                    disabled={isEvolving || isEditing}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs tracking-widest border transition-colors bg-blue-950/30 text-blue-400 border-blue-900/50 hover:bg-blue-900/50 disabled:opacity-50"
                  >
                    {isEvolving ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    EVOLVE
                  </button>
                  <button 
                    onClick={() => toggleStatus(selectedAgent)}
                    className={`px-4 py-2 rounded-lg font-bold text-xs tracking-widest border transition-colors ${
                      selectedAgent.status === 'active' 
                        ? 'bg-amber-950/30 text-amber-400 border-amber-900/50 hover:bg-amber-900/50' 
                        : 'bg-emerald-950/30 text-emerald-400 border-emerald-900/50 hover:bg-emerald-900/50'
                    }`}
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
              </div>

              {isEditing ? (
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
              )}
              </div>
            </motion.div>
          ) : (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center text-slate-600 text-sm tracking-widest font-bold"
            >
              [ SELECT AN AGENT OR ADD NEW ]
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
