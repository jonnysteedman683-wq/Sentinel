import React, { useState } from 'react';
import { Users, Gavel, Lightbulb, ShieldAlert, Cpu, MessagesSquare, Repeat, Flame } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getGeminiClient } from './geminiClient';

type AgentRole = 'pragmatist' | 'visionary' | 'critic' | 'judge' | 'devil';

interface DebateMessage {
  agent: string;
  text: string;
  type: AgentRole;
}

export function DebatePanel() {
  const [topic, setTopic] = useState('');
  const [rounds, setRounds] = useState(1);
  const [isDebating, setIsDebating] = useState(false);
  const [messages, setMessages] = useState<DebateMessage[]>([]);

  const handleStartDebate = async () => {
    if (!topic) return;
    setIsDebating(true);
    setMessages([]);
    const ai = getGeminiClient();
    try {
      let debateContext = `The topic is: "${topic}".\n`;
      let lastVisionary = '';
      let lastCritic = '';

      for (let r = 0; r < rounds; r++) {
        // 1. The Visionary
        const visPrompt = r === 0 
          ? `You are the Visionary sub-agent. ${debateContext} Give a 2-3 sentence argument focusing on massive exponential upside and new paradigms. Be bold.`
          : `You are the Visionary sub-agent. The Critic previously said: "${lastCritic}". Give a 2-3 sentence rebuttal reinforcing the massive exponential upside and dismissing the fears. Be bold.`;
          
        const visResponse = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: visPrompt
        });
        const visText = visResponse.text;
        lastVisionary = visText;
        setMessages(prev => [...prev, { agent: 'The Visionary', type: 'visionary', text: visText }]);
        debateContext += `\nVisionary: ${visText}`;

        // 2. The Critic
        const criticPrompt = r === 0
          ? `You are the Critic sub-agent. The Visionary just said: "${visText}". Give a 2-3 sentence counter-argument focusing on severe risks and missing guardrails. Be extremely skeptical.`
          : `You are the Critic sub-agent. The Visionary just said: "${visText}". Escalate your concerns. Give a 2-3 sentence counter-argument focusing on catastrophic risks. Be extremely skeptical.`;

        const criticResponse = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: criticPrompt
        });
        const criticText = criticResponse.text;
        lastCritic = criticText;
        setMessages(prev => [...prev, { agent: 'The Critic', type: 'critic', text: criticText }]);
        debateContext += `\nCritic: ${criticText}`;

        // 3. The Devil's Advocate (Only on round 2+)
        if (r > 0) {
          const devilResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `You are the Devil's Advocate sub-agent. Look at this debate:\n${debateContext}\nGive a chaotic 2-sentence perspective that completely subverts both the Visionary and Critic. Introduce a wild third option.`
          });
          const devilText = devilResponse.text;
          setMessages(prev => [...prev, { agent: 'Devil\'s Advocate', type: 'devil', text: devilText }]);
          debateContext += `\nDevil's Advocate: ${devilText}`;
        }
      }

      // 4. The Pragmatist
      const pragResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `You are the Pragmatist sub-agent. Review this debate:\n${debateContext}\nGive a 2-3 sentence argument finding a middle ground. Suggest a practical testing approach.`
      });
      const pragText = pragResponse.text;
      setMessages(prev => [...prev, { agent: 'The Pragmatist', type: 'pragmatist', text: pragText }]);
      debateContext += `\nPragmatist: ${pragText}`;

      // 5. The Judge
      const judgeResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `You are the Judge sub-agent. Review this debate:\n${debateContext}\nSynthesize these inputs and deliver a final 2 sentence verdict on how to proceed. Start with "Synthesis complete."`
      });
      const judgeText = judgeResponse.text;
      setMessages(prev => [...prev, { agent: 'The Judge', type: 'judge', text: judgeText }]);
    } catch (error) {
      console.error("Debate failed:", error);
      setMessages(prev => [...prev, { agent: 'System', type: 'critic', text: 'Error: Failed to connect to swarm. Check your API configuration.' }]);
    } finally {
      setIsDebating(false);
    }
  };

  const getAgentStyles = (type: string) => {
    switch (type) {
      case 'visionary': return 'border-pink-500/30 bg-pink-500/5 text-pink-300';
      case 'critic': return 'border-rose-500/30 bg-rose-500/5 text-rose-300';
      case 'devil': return 'border-orange-500/30 bg-orange-500/5 text-orange-300';
      case 'pragmatist': return 'border-blue-500/30 bg-blue-500/5 text-blue-300';
      case 'judge': return 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.1)]';
      default: return 'border-slate-700 bg-slate-800 text-slate-300';
    }
  };

  const getAgentIcon = (type: string) => {
    switch (type) {
      case 'visionary': return <Lightbulb size={16} className="text-pink-400" />;
      case 'critic': return <ShieldAlert size={16} className="text-rose-400" />;
      case 'devil': return <Flame size={16} className="text-orange-400" />;
      case 'pragmatist': return <Cpu size={16} className="text-blue-400" />;
      case 'judge': return <Gavel size={18} className="text-emerald-400" />;
      default: return null;
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-300 font-sans relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-pink-900/5 via-slate-950 to-slate-950 pointer-events-none z-0"></div>
      
      <div className="p-4 md:p-6 border-b border-slate-800/50 bg-slate-900/50 backdrop-blur flex justify-between items-center z-10 shadow-sm relative">
        <div className="flex items-center gap-3 text-pink-400 font-bold tracking-[0.2em] uppercase">
          <div className="p-1.5 bg-pink-500/10 rounded-lg border border-pink-500/20 shadow-[0_0_15px_rgba(244,114,182,0.15)]">
            <Users size={18} />
          </div>
          <span className="font-display text-lg">Sub-Agent Debate Chamber</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 md:p-8 relative z-10 flex flex-col">
        <div className="max-w-4xl mx-auto w-full flex flex-col h-full gap-8">
          
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 shadow-xl shrink-0"
          >
            <h3 className="text-xs font-bold text-slate-400 mb-4 tracking-widest uppercase flex items-center gap-2">
              <MessagesSquare size={14} /> Subject of Debate
            </h3>
            <div className="flex flex-col md:flex-row gap-4">
              <input 
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Should we refactor the core memory engine?"
                className="flex-1 bg-slate-950/80 border border-slate-700/80 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-pink-500/50 shadow-inner transition-all"
                disabled={isDebating}
              />
              <div className="flex items-center gap-3 bg-slate-950/50 border border-slate-700/50 rounded-xl px-4 py-2 shrink-0">
                <Repeat size={14} className="text-slate-400" />
                <span className="text-xs font-bold text-slate-400 tracking-wider">ROUNDS:</span>
                <select 
                  value={rounds}
                  onChange={(e) => setRounds(Number(e.target.value))}
                  disabled={isDebating}
                  className="bg-transparent text-pink-400 font-bold outline-none cursor-pointer text-sm"
                >
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                </select>
              </div>
              <button 
                onClick={handleStartDebate}
                disabled={isDebating || !topic}
                className="bg-pink-950/80 hover:bg-pink-900 border border-pink-900/80 text-pink-400 px-8 py-3 rounded-xl font-bold tracking-widest text-xs shadow-[0_0_15px_rgba(244,114,182,0.15)] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isDebating ? <><Cpu className="animate-spin" size={16} /> DEBATING...</> : 'CONVENE'}
              </button>
            </div>
          </motion.div>

          <div className="flex-1 bg-slate-900/30 border border-slate-800/50 rounded-2xl p-6 overflow-y-auto space-y-6 shadow-inner relative">
            {messages.length === 0 && !isDebating ? (
               <div className="h-full flex items-center justify-center text-slate-600 text-sm font-bold tracking-widest">
                 [ WAITING FOR TOPIC ]
               </div>
            ) : null}
            
            <AnimatePresence>
              {messages.map((msg, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className={`p-5 rounded-2xl border ${getAgentStyles(msg.type)}`}
                >
                  <div className="flex items-center gap-3 mb-3 border-b border-current/10 pb-3">
                    <div className="p-1.5 bg-black/20 rounded-lg">
                      {getAgentIcon(msg.type)}
                    </div>
                    <span className="font-bold tracking-widest text-xs uppercase">{msg.agent}</span>
                  </div>
                  <div className="leading-relaxed text-sm opacity-90">{msg.text}</div>
                </motion.div>
              ))}
            </AnimatePresence>
            
            {isDebating && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-3 p-4 text-slate-500"
              >
                <div className="flex gap-1">
                  <span className="w-2 h-2 rounded-full bg-slate-600 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                  <span className="w-2 h-2 rounded-full bg-slate-600 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                  <span className="w-2 h-2 rounded-full bg-slate-600 animate-bounce" style={{ animationDelay: '300ms' }}></span>
                </div>
                <span className="text-xs font-bold tracking-widest">SUB-AGENTS ARE FORMULATING ARGUMENTS...</span>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
