import React, { useState, useEffect } from 'react';
import { Book, ChevronRight, Wand2, Plus, Sparkles, Check, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { PromptEntry } from './types';
import { getGeminiClient } from './geminiClient';

const DEFAULT_PROMPTS = [
  {
    title: 'Network Health Monitor',
    description: 'Automated network health checks (ping, port scan simulation) and aggregation.',
    prompt: 'Write a tool to automate network health checks (ping, port scan simulation) and aggregate the results.',
    tags: ['network', 'automation']
  },
  {
    title: 'Log Severity Classifier',
    description: 'Machine learning utility to classify text logs into security severity levels.',
    prompt: 'Write a machine learning utility to classify text logs into security severity levels (Low, Medium, High).',
    tags: ['ml', 'security']
  },
  {
    title: 'Data Anonymizer',
    description: 'Scrub PII (Personally Identifiable Information) from JSON datasets.',
    prompt: 'Write a tool that takes a JSON string containing user data and scrubs any PII (emails, phone numbers, SSNs), replacing them with [REDACTED].',
    tags: ['data', 'privacy']
  }
];

export function PromptLibrary({ onSelectPrompt }: { onSelectPrompt: (prompt: string) => void }) {
  const prompts = useLiveQuery(() => db.prompts.orderBy('createdAt').reverse().toArray(), []);
  const agents = useLiveQuery(() => db.agents.where('status').equals('active').toArray(), []);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('default');
  const [isRefining, setIsRefining] = useState<string | null>(null);

  useEffect(() => {
    // Seed default prompts if empty
    const seed = async () => {
      const count = await db.prompts.count();
      if (count === 0) {
        for (const p of DEFAULT_PROMPTS) {
          await db.prompts.add({
            ...p,
            id: crypto.randomUUID(),
            createdAt: Date.now()
          });
        }
      }
    };
    seed();
  }, []);

  const handleRefine = async (e: React.MouseEvent, promptId: string, currentText: string) => {
    e.stopPropagation();
    setIsRefining(promptId);
    try {
      const ai = getGeminiClient();
      const selectedAgent = agents?.find(a => a.id === selectedAgentId);
      
      let persona = "You are an expert prompt engineer.";
      let model = 'gemini-2.5-flash';
      
      if (selectedAgent) {
        persona = `You are playing the role of "${selectedAgent.name}". Your core persona is:\n${selectedAgent.systemPrompt}\n\nAdditionally, you are acting as an expert prompt engineer.`;
        model = selectedAgent.model || 'gemini-2.5-flash';
      }
      
      const res = await ai.models.generateContent({
        model: model,
        contents: `${persona} Refine the following prompt to be more precise, robust, and capable of generating production-ready autonomous code for our Sentinel framework. Keep it strictly as the prompt text, no commentary, no quotes around it.\n\nOriginal Prompt: "${currentText}"`
      });
      
      const refinedText = res.text?.trim() || currentText;
      
      await db.prompts.update(promptId, {
        prompt: refinedText,
        lastRefined: Date.now()
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsRefining(null);
    }
  };

  const handleAddCustom = async () => {
    await db.prompts.add({
      id: crypto.randomUUID(),
      title: 'New Custom Tool',
      description: 'Describe what the tool should do.',
      prompt: 'Write a tool to...',
      tags: ['custom'],
      createdAt: Date.now()
    });
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 shadow-xl relative overflow-hidden flex flex-col h-full">
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-blue-500/10 rounded-lg border border-blue-500/20">
              <Book size={16} className="text-blue-400" />
            </div>
            <h3 className="text-xs font-bold text-blue-400 tracking-widest uppercase">
              Prompt Library
            </h3>
          </div>
          <button 
            onClick={handleAddCustom}
            className="text-blue-400 hover:text-blue-300 transition-colors p-1"
            title="Add Custom Prompt"
          >
            <Plus size={16} />
          </button>
        </div>
        
        <div className="flex justify-between items-center bg-slate-950/50 p-2 rounded-lg border border-slate-800/50">
           <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold tracking-widest uppercase">
              <Users size={12} /> Refining Agent
           </div>
           <select 
             value={selectedAgentId}
             onChange={e => setSelectedAgentId(e.target.value)}
             className="bg-transparent text-xs text-blue-400 focus:outline-none max-w-[150px] truncate"
           >
             <option value="default">System Default</option>
             {agents?.map(a => (
               <option key={a.id} value={a.id}>{a.name}</option>
             ))}
           </select>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto space-y-3 pr-2 scroll-smooth">
        {prompts?.map((p, i) => (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            key={p.id}
            onClick={() => onSelectPrompt(p.prompt)}
            className="p-4 bg-slate-950/50 border border-slate-800/80 rounded-xl cursor-pointer hover:border-blue-500/50 hover:bg-slate-900/80 transition-all group relative"
          >
            <div className="flex justify-between items-start mb-2">
              <h4 className="font-bold text-sm text-slate-200 group-hover:text-blue-300 transition-colors pr-10">{p.title}</h4>
              <ChevronRight size={14} className="text-slate-600 group-hover:text-blue-400 transition-colors shrink-0 mt-0.5" />
            </div>
            <p className="text-xs text-slate-400 leading-relaxed mb-3">{p.description}</p>
            <div className="bg-black/40 p-3 rounded-lg border border-slate-800/50 text-[10px] font-mono text-slate-500 line-clamp-3 relative group/code">
              {p.prompt}
              
              <div className="absolute top-2 right-2 opacity-0 group-hover/code:opacity-100 transition-opacity">
                <button 
                  onClick={(e) => handleRefine(e, p.id!, p.prompt)}
                  disabled={isRefining === p.id}
                  className="bg-blue-900/50 hover:bg-blue-800 border border-blue-500/50 text-blue-300 px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1.5 shadow-md disabled:opacity-50"
                  title="Use AI to refine this prompt"
                >
                  {isRefining === p.id ? (
                    <><Sparkles size={10} className="animate-pulse" /> REFINING...</>
                  ) : p.lastRefined ? (
                    <><Check size={10} className="text-emerald-400" /> REFINED</>
                  ) : (
                    <><Wand2 size={10} /> AI REFINE</>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
