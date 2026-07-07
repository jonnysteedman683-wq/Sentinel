import React, { useState, useEffect } from 'react';
import { FlaskConical, LayoutTemplate, Network, Users, Mic, HeartHandshake, Play, Loader2, Box, Camera, Wind } from 'lucide-react';
import { db } from './db';
import { useLiveQuery } from 'dexie-react-hooks';
import { getGeminiClient } from './geminiClient';
import { Type } from '@google/genai';
import { useSentinel } from './SentinelContext';
import Markdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';

function Morphogenesis() {
  const [prompt, setPrompt] = useState('');
  const [uiSchema, setUiSchema] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (!prompt) return;
    setLoading(true);
    try {
      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Generate a dynamic UI layout for the following request: "${prompt}". 
        Return a JSON array of components. Each component should have a "type" (header, card, list, stats), "title", "content" (string or array of strings), and "color" (slate, blue, emerald, purple, rose, amber).`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING },
                title: { type: Type.STRING },
                content: { type: Type.STRING },
                color: { type: Type.STRING }
              },
              required: ['type', 'title', 'content', 'color']
            }
          }
        }
      });
      if (response.text) {
        setUiSchema(JSON.parse(response.text));
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const getColorClasses = (color: string) => {
    const map: Record<string, string> = {
      blue: 'border-blue-500/30 bg-blue-950/20 text-blue-300 shadow-[0_0_15px_rgba(59,130,246,0.1)]',
      emerald: 'border-emerald-500/30 bg-emerald-950/20 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.1)]',
      purple: 'border-purple-500/30 bg-purple-950/20 text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.1)]',
      rose: 'border-rose-500/30 bg-rose-950/20 text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.1)]',
      amber: 'border-amber-500/30 bg-amber-950/20 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.1)]',
      slate: 'border-slate-700/50 bg-slate-900/50 text-slate-300 shadow-sm'
    };
    return map[color] || map.slate;
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="text-xs text-slate-500 mb-2 font-bold tracking-widest flex items-center gap-2">
        <LayoutTemplate size={14} className="text-fuchsia-500" /> LIVING UI MORPHOGENESIS
      </div>
      <div className="flex gap-3">
        <input 
          type="text" 
          value={prompt} 
          onChange={e => setPrompt(e.target.value)}
          placeholder="Describe an interface (e.g., 'A travel itinerary tracker')"
          className="flex-1 bg-slate-900 border border-slate-700/80 rounded-lg px-4 py-3 focus:outline-none focus:border-fuchsia-500/70 focus:ring-1 focus:ring-fuchsia-500/50 shadow-inner"
        />
        <button onClick={handleGenerate} disabled={loading || !prompt} className="bg-fuchsia-600/90 hover:bg-fuchsia-500 text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2 shadow-[0_0_15px_rgba(192,38,211,0.2)] transition-all disabled:opacity-50">
          {loading ? <Loader2 className="animate-spin" size={18} /> : <Play size={18} />} GENERATE
        </button>
      </div>
      <div className="flex-1 overflow-y-auto bg-slate-950/50 border border-slate-800/80 p-6 rounded-xl space-y-4 shadow-inner relative">
        <AnimatePresence>
          {uiSchema.length === 0 && !loading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex items-center justify-center text-slate-600 tracking-widest text-sm">
              [ WAITING FOR GENERATIVE SCHEMA ]
            </motion.div>
          )}
          {uiSchema.map((comp, i) => (
            <motion.div 
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: i * 0.1 }}
              key={i} 
              className={`p-5 rounded-xl border backdrop-blur-sm ${getColorClasses(comp.color)}`}
            >
              {comp.type === 'header' && <h1 className="text-2xl font-bold mb-2 tracking-tight">{comp.title}</h1>}
              {comp.type === 'card' && (
                <>
                  <h3 className="font-bold text-lg mb-2 opacity-90">{comp.title}</h3>
                  <p className="opacity-80 leading-relaxed">{comp.content}</p>
                </>
              )}
              {comp.type === 'stats' && (
                <div className="flex flex-col items-center justify-center py-6 bg-black/20 rounded-lg border border-white/5">
                  <div className="text-4xl font-bold mb-2">{comp.content}</div>
                  <div className="text-xs tracking-widest opacity-70 uppercase font-semibold">{comp.title}</div>
                </div>
              )}
              {comp.type !== 'header' && comp.type !== 'card' && comp.type !== 'stats' && (
                <div>
                  <h4 className="font-bold mb-2 tracking-wide opacity-90">{comp.title}</h4>
                  <div className="text-sm opacity-80 leading-relaxed">{comp.content}</div>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function InfiniteContext() {
  const [topic, setTopic] = useState('');
  const [insight, setInsight] = useState('');
  const [loading, setLoading] = useState(false);

  const handleWeave = async () => {
    if (!topic) return;
    setLoading(true);
    try {
      const episodes = await db.episodes.toArray();
      const ai = getGeminiClient();
      
      const prompt = `You are the Infinite Context Memory Weaver. Review the user's episodic history and extract a deep, insightful synthesis regarding the topic: "${topic}". Format with nice markdown headers and bullet points.\n\nHistory:\n${episodes.slice(-50).map(e => e.content).join('\n')}`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
      });
      if (response.text) setInsight(response.text);
    } catch(err) {
      console.error(err);
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="text-xs text-slate-500 mb-2 font-bold tracking-widest flex items-center gap-2">
        <Network size={14} className="text-blue-500" /> INFINITE CONTEXT MEMORY WEAVING
      </div>
      <div className="flex gap-3">
        <input 
          type="text" 
          value={topic} 
          onChange={e => setTopic(e.target.value)}
          placeholder="Topic to weave (e.g., 'My recurring frustrations')"
          className="flex-1 bg-slate-900 border border-slate-700/80 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500/70 focus:ring-1 focus:ring-blue-500/50 shadow-inner"
        />
        <button onClick={handleWeave} disabled={loading || !topic} className="bg-blue-600/90 hover:bg-blue-500 text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2 shadow-[0_0_15px_rgba(59,130,246,0.2)] transition-all disabled:opacity-50">
          {loading ? <Loader2 className="animate-spin" size={18} /> : <Network size={18} />} WEAVE
        </button>
      </div>
      <div className="flex-1 overflow-y-auto bg-slate-900/40 border border-slate-800/80 p-6 rounded-xl shadow-inner relative">
        <AnimatePresence>
           {loading ? (
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex flex-col items-center justify-center text-blue-500/70 tracking-widest text-sm gap-4">
               <Loader2 size={32} className="animate-spin" />
               <span>WEAVING MEMORY FRAGMENTS...</span>
             </motion.div>
           ) : insight ? (
             <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="markdown-body prose prose-invert prose-blue max-w-none prose-headings:text-blue-400 prose-a:text-blue-300">
               <Markdown>{insight}</Markdown>
             </motion.div>
           ) : (
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 flex items-center justify-center text-slate-600 tracking-widest text-sm">
               [ AWAITING SYNTHESIS PARAMETERS ]
             </motion.div>
           )}
        </AnimatePresence>
      </div>
    </div>
  );
}

interface SubTask {
  name: string;
  description: string;
  result?: string;
  status: 'pending' | 'active' | 'complete' | 'error';
}

interface SwarmJob {
  id: string;
  originalTask: string;
  status: 'planning' | 'executing' | 'complete' | 'error';
  progress: number;
  subtasks: SubTask[];
  finalResult?: string;
}

function AgentSwarm() {
  const [task, setTask] = useState('');
  const [jobs, setJobs] = useState<SwarmJob[]>([]);

  const updateJob = (id: string, updater: (job: SwarmJob) => SwarmJob) => {
    setJobs(prev => prev.map(j => j.id === id ? updater(j) : j));
  };

  const handleDispatch = async () => {
    if (!task) return;
    const jobId = crypto.randomUUID();
    const newJob: SwarmJob = { 
      id: jobId, 
      originalTask: task, 
      status: 'planning', 
      progress: 5, 
      subtasks: [] 
    };
    setJobs(prev => [newJob, ...prev]);
    const currentTask = task;
    setTask('');

    try {
      const ai = getGeminiClient();
      
      // Phase 1: Planning
      const planResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Decompose this task into 2 to 4 distinct sequential sub-tasks: "${currentTask}". Return JSON array of objects with "name" and "description". Do not wrap in markdown.`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                description: { type: Type.STRING }
              },
              required: ['name', 'description']
            }
          }
        }
      });
      
      let parsedPlan: any[] = [];
      try {
        parsedPlan = JSON.parse(planResponse.text || "[]");
      } catch (e) {
        parsedPlan = [{ name: "Execution", description: "Process the full task" }];
      }

      const initialSubtasks = parsedPlan.map(p => ({ ...p, status: 'pending' as const }));
      updateJob(jobId, j => ({ ...j, status: 'executing', subtasks: initialSubtasks, progress: 15 }));

      // Phase 2: Execution
      let context = "";
      for (let i = 0; i < initialSubtasks.length; i++) {
        updateJob(jobId, j => {
          const updatedSub = [...j.subtasks];
          updatedSub[i].status = 'active';
          return { ...j, subtasks: updatedSub, progress: 15 + Math.round((i / initialSubtasks.length) * 75) };
        });

        const subTask = initialSubtasks[i];
        const stepResponse = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: `You are executing step ${i+1} of a larger task: "${currentTask}".\n\nStep ${i+1} Name: ${subTask.name}\nStep ${i+1} Description: ${subTask.description}\n\nContext from previous steps:\n${context}\n\nPerform this step and provide a concise output.`
        });

        const result = stepResponse.text || "No output generated.";
        context += `\n\nOutput from Step ${i+1} (${subTask.name}):\n${result}`;

        updateJob(jobId, j => {
          const updatedSub = [...j.subtasks];
          updatedSub[i].status = 'complete';
          updatedSub[i].result = result;
          return { ...j, subtasks: updatedSub };
        });
      }

      // Phase 3: Final Synthesis
      updateJob(jobId, j => ({ ...j, progress: 95 }));
      const finalResponse = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: `Original Task: "${currentTask}"\n\nWe executed several sub-tasks to gather info:\n${context}\n\nPlease provide the final, cohesive result to the user based on these steps. Format nicely with markdown.`
      });

      updateJob(jobId, j => ({ 
        ...j, 
        status: 'complete', 
        progress: 100, 
        finalResult: finalResponse.text 
      }));

    } catch (err) {
      console.error(err);
      updateJob(jobId, j => ({ ...j, status: 'error' }));
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="text-xs text-slate-500 mb-2 font-bold tracking-widest flex items-center gap-2">
        <Users size={14} className="text-emerald-500" /> CO-INTELLIGENCE AGENT SWARM
      </div>
      <div className="flex gap-3">
        <input 
          type="text" 
          value={task} 
          onChange={e => setTask(e.target.value)}
          placeholder="Dispatch task (e.g., 'Research ultralight laptops and summarize')"
          className="flex-1 bg-slate-900 border border-slate-700/80 rounded-lg px-4 py-3 focus:outline-none focus:border-emerald-500/70 focus:ring-1 focus:ring-emerald-500/50 shadow-inner"
        />
        <button onClick={handleDispatch} disabled={!task} className="bg-emerald-600/90 hover:bg-emerald-500 text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.2)] transition-all disabled:opacity-50">
          <Users size={18} /> DISPATCH
        </button>
      </div>
      <div className="flex-1 overflow-y-auto space-y-6 pr-2">
        <AnimatePresence>
          {jobs.length === 0 && (
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full flex items-center justify-center text-slate-600 tracking-widest text-sm">
               [ SWARM IDLE ]
             </motion.div>
          )}
          {jobs.map(job => (
            <motion.div 
              key={job.id} 
              initial={{ opacity: 0, x: -20, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              className="bg-slate-900/80 border border-emerald-900/30 p-5 rounded-xl shadow-lg relative overflow-hidden flex flex-col gap-4"
            >
              <div className="absolute top-0 left-0 w-full h-full bg-emerald-900/5 opacity-50 pointer-events-none"></div>
              
              <div className="relative z-10 flex justify-between items-start">
                <div>
                  <div className="text-xs text-emerald-500 font-bold tracking-widest mb-1">MISSION</div>
                  <div className="font-bold text-slate-200">{job.originalTask}</div>
                </div>
                <span className={`text-[10px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-full border ${
                  job.status === 'complete' ? 'bg-emerald-950/50 text-emerald-400 border-emerald-800' : 
                  job.status === 'error' ? 'bg-rose-950/50 text-rose-400 border-rose-800' : 
                  'bg-blue-950/50 text-blue-400 border-blue-800 animate-pulse'
                }`}>
                  {job.status}
                </span>
              </div>
              
              <div className="relative z-10 w-full bg-slate-950 border border-slate-800 h-1.5 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-1000 ease-out ${
                    job.status === 'complete' ? 'bg-emerald-500' : 'bg-emerald-500/70 relative'
                  }`} 
                  style={{ width: `${job.progress}%` }}
                >
                  {job.status !== 'complete' && job.status !== 'error' && (
                    <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]"></div>
                  )}
                </div>
              </div>

              {job.subtasks.length > 0 && (
                <div className="relative z-10 flex flex-col gap-2 mt-2 bg-black/20 p-3 rounded-lg border border-slate-800/50">
                  <div className="text-[10px] text-slate-500 font-bold tracking-widest mb-1">AGENT PIPELINE</div>
                  {job.subtasks.map((st, i) => (
                    <div key={i} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                           <div className={`w-2 h-2 rounded-full ${
                             st.status === 'complete' ? 'bg-emerald-500' : 
                             st.status === 'active' ? 'bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.8)]' : 
                             'bg-slate-700'
                           }`} />
                           <span className={`font-bold ${st.status === 'active' ? 'text-blue-400' : st.status === 'complete' ? 'text-emerald-400/80' : 'text-slate-500'}`}>
                             {st.name}
                           </span>
                        </div>
                        <span className="text-slate-600 text-[10px]">{st.status}</span>
                      </div>
                      {st.result && st.status === 'complete' && (
                        <div className="pl-4 ml-1 border-l border-emerald-900/50 text-[10px] text-slate-400 line-clamp-2 mt-1 italic">
                           {st.result}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {job.finalResult && (
                <div className="relative z-10 mt-2 bg-slate-950 border border-emerald-900/30 p-4 rounded-xl text-sm prose prose-invert prose-emerald max-w-none prose-p:leading-relaxed prose-pre:bg-slate-900">
                  <div className="text-[10px] text-emerald-500 font-bold tracking-widest mb-3 flex items-center gap-2">
                    <Users size={12} /> FINAL SYNTHESIS
                  </div>
                  <Markdown>{job.finalResult}</Markdown>
                </div>
              )}

            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Dreamcatcher() {
  const [idea, setIdea] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleCapture = async () => {
    if (!idea) return;
    setLoading(true);
    try {
      const ai = getGeminiClient();
      const prompt = `Transform this fragmented, hypnagogic murmur into a fully fleshed-out concept note with visual mnemonic imagery.\nMurmur: "${idea}"`;
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              concept: { type: Type.STRING },
              visualMnemonic: { type: Type.STRING }
            },
            required: ['title', 'concept', 'visualMnemonic']
          }
        }
      });
      if (response.text) setResult(JSON.parse(response.text));
    } catch(err) {
      console.error(err);
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="text-xs text-slate-500 mb-2 font-bold tracking-widest flex items-center gap-2">
        <Mic size={14} className="text-amber-500" /> DREAMCATCHER - HYPNAGOGIC CAPTURE
      </div>
      <div className="flex gap-2">
        <textarea 
          value={idea} 
          onChange={e => setIdea(e.target.value)}
          placeholder="Fragmented thoughts... (e.g., 'blue tree... merging sky... blockchain for oxygen')"
          className="flex-1 bg-slate-900 border border-slate-700/80 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-amber-500/70 focus:ring-1 focus:ring-amber-500/50 shadow-inner min-h-[100px] resize-none"
        />
      </div>
      <button onClick={handleCapture} disabled={loading || !idea} className="bg-amber-600/90 hover:bg-amber-500 text-white px-4 py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(245,158,11,0.2)] transition-all disabled:opacity-50">
        {loading ? <Loader2 className="animate-spin" size={18} /> : <Mic size={18} />} SYNTHESIZE DREAM
      </button>
      
      <div className="flex-1 relative border border-amber-900/30 rounded-xl overflow-hidden bg-slate-950">
        <AnimatePresence>
          {loading ? (
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex flex-col items-center justify-center text-amber-500/70 tracking-widest text-sm gap-4 bg-slate-900/50 backdrop-blur-sm z-10">
               <Loader2 size={32} className="animate-spin" />
               <span>CAPTURING FRAGMENTS...</span>
             </motion.div>
          ) : result ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 bg-amber-950/20 p-6 space-y-6 overflow-y-auto"
            >
              <h2 className="text-2xl font-bold text-amber-400 tracking-tight">{result.title}</h2>
              <div className="bg-black/20 p-5 rounded-lg border border-amber-900/30">
                <h3 className="text-xs font-bold text-amber-500/70 mb-2 tracking-widest">CONCEPT</h3>
                <p className="text-amber-100/90 leading-relaxed">{result.concept}</p>
              </div>
              <div className="bg-black/20 p-5 rounded-lg border border-amber-900/30">
                <h3 className="text-xs font-bold text-amber-500/70 mb-2 tracking-widest">VISUAL MNEMONIC</h3>
                <p className="text-amber-300 italic leading-relaxed">"{result.visualMnemonic}"</p>
              </div>
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 flex items-center justify-center text-slate-600 tracking-widest text-sm">
               [ NO FREQUENCIES DETECTED ]
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function EmpathicMirror() {
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const analyze = async () => {
    setLoading(true);
    try {
      const episodes = await db.episodes.where('type').equals('user').toArray();
      const recent = episodes.slice(-20).map(e => e.content).join('\n');
      
      const ai = getGeminiClient();
      const prompt = `Analyze the following recent journal entries/messages from the user. Provide cognitive reframing suggestions, identifying any cognitive distortions (like 'always', 'never'). Provide a compassionate response.\n\nEntries:\n${recent}`;
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              sentiment: { type: Type.STRING, description: 'Overall emotional tone' },
              distortions: { type: Type.ARRAY, items: { type: Type.STRING } },
              reframing: { type: Type.STRING },
              actionableAdvice: { type: Type.STRING }
            },
            required: ['sentiment', 'distortions', 'reframing', 'actionableAdvice']
          }
        }
      });
      if (response.text) setAnalysis(JSON.parse(response.text));
    } catch(err) {
      console.error(err);
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="text-xs text-slate-500 mb-2 font-bold tracking-widest flex items-center gap-2">
        <HeartHandshake size={14} className="text-rose-500" /> EMPATHIC MIRROR FOR COGNITIVE REFRAMING
      </div>
      <button onClick={analyze} disabled={loading} className="bg-rose-600/90 hover:bg-rose-500 text-white px-4 py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(244,63,94,0.2)] transition-all disabled:opacity-50">
        {loading ? <Loader2 className="animate-spin" size={18} /> : <HeartHandshake size={18} />} ANALYZE RECENT MINDSET
      </button>

      <div className="flex-1 relative border border-rose-900/30 rounded-xl overflow-hidden bg-slate-950">
        <AnimatePresence>
          {loading ? (
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex flex-col items-center justify-center text-rose-500/70 tracking-widest text-sm gap-4 bg-slate-900/50 backdrop-blur-sm z-10">
               <Loader2 size={32} className="animate-spin" />
               <span>ANALYZING COGNITIVE PATTERNS...</span>
             </motion.div>
          ) : analysis ? (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute inset-0 bg-rose-950/20 p-6 space-y-6 overflow-y-auto"
            >
              <div className="flex items-center gap-4 border-b border-rose-900/30 pb-4">
                <div className="p-3 bg-rose-900/50 rounded-full text-rose-400">
                  <HeartHandshake size={24} />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-rose-500/70 mb-1 tracking-widest">CURRENT SENTIMENT</h3>
                  <p className="text-rose-300 font-bold text-xl uppercase tracking-wider">{analysis.sentiment}</p>
                </div>
              </div>
              <div className="bg-black/20 p-5 rounded-lg border border-rose-900/30">
                <h3 className="text-xs font-bold text-rose-500/70 mb-3 tracking-widest flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> DETECTED DISTORTIONS
                </h3>
                <ul className="list-none space-y-2 text-rose-200">
                  {analysis.distortions.map((d: string, i: number) => (
                    <li key={i} className="flex gap-3 text-sm">
                      <span className="text-rose-500/50 mt-1">▹</span> {d}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-rose-900/20 p-5 rounded-lg border border-rose-500/30 shadow-inner">
                <h3 className="text-xs font-bold text-rose-500/70 mb-2 tracking-widest">SOCRATIC REFRAMING</h3>
                <p className="text-rose-100/90 italic text-lg leading-relaxed">"{analysis.reframing}"</p>
              </div>
              <div className="bg-black/20 p-5 rounded-lg border border-rose-900/30">
                <h3 className="text-xs font-bold text-rose-500/70 mb-2 tracking-widest">ACTIONABLE ADVICE</h3>
                <p className="text-rose-200/90 leading-relaxed text-sm">{analysis.actionableAdvice}</p>
              </div>
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 flex items-center justify-center text-slate-600 tracking-widest text-sm">
               [ AWAITING REFLECTION DATA ]
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function DigitalTwin() {
  const [phase, setPhase] = useState<'idle' | 'uploading' | 'reconstructing' | 'simulating' | 'complete'>('idle');
  const [progress, setProgress] = useState(0);
  const [scenario, setScenario] = useState('extreme_weather');
  const [logs, setLogs] = useState<string[]>([]);

  const startPipeline = () => {
    setPhase('uploading');
    setProgress(0);
    setLogs(['[SYS] Ingesting 2D source images (44 items)...']);
    
    setTimeout(() => {
      setPhase('reconstructing');
      setLogs(prev => [...prev, '[AI] Extracting depth maps and point clouds...', '[AI] Generating Neural Radiance Field (NeRF)...']);
      
      let p = 0;
      const interval = setInterval(() => {
        p += 5;
        setProgress(p);
        if (p >= 100) {
          clearInterval(interval);
          setPhase('simulating');
          setProgress(0);
          setLogs(prev => [...prev, '[TWIN] 3D Digital Twin successfully generated.', `[SIM] Applying physics-informed scenario: ${scenario}...`, '[SIM] Generating photorealistic synthetic training frames...']);
          
          let p2 = 0;
          const simInterval = setInterval(() => {
            p2 += 10;
            setProgress(p2);
            if (p2 >= 100) {
              clearInterval(simInterval);
              setPhase('complete');
              setLogs(prev => [...prev, '[SYS] Infinite synthetic data generation pipeline active.']);
            }
          }, 300);
        }
      }, 150);
    }, 1000);
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="text-xs text-slate-500 mb-2 font-bold tracking-widest flex items-center gap-2">
        <Box size={14} className="text-cyan-500" /> DIGITAL TWIN & SYNTHETIC DATA PIPELINE
      </div>
      <div className="flex gap-3">
        <select 
          value={scenario} 
          onChange={e => setScenario(e.target.value)}
          disabled={phase !== 'idle' && phase !== 'complete'}
          className="bg-slate-900 border border-slate-700/80 rounded-lg px-4 py-3 focus:outline-none focus:border-cyan-500/70 focus:ring-1 focus:ring-cyan-500/50 shadow-inner text-slate-300"
        >
          <option value="extreme_weather">Extreme Weather (Hurricane/Flood)</option>
          <option value="structural_failure">Structural Micro-fractures</option>
          <option value="lighting_conditions">Low-light / Glare Variations</option>
        </select>
        <button 
          onClick={startPipeline} 
          disabled={phase !== 'idle' && phase !== 'complete'} 
          className="bg-cyan-600/90 hover:bg-cyan-500 text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2 shadow-[0_0_15px_rgba(6,182,212,0.2)] transition-all disabled:opacity-50"
        >
          {phase === 'idle' || phase === 'complete' ? <Camera size={18} /> : <Loader2 className="animate-spin" size={18} />} 
          {phase === 'idle' || phase === 'complete' ? 'START PIPELINE' : 'PROCESSING'}
        </button>
      </div>

      <div className="flex-1 relative border border-cyan-900/30 rounded-xl overflow-hidden bg-slate-950 flex flex-col p-6 space-y-6">
        <div className="grid grid-cols-3 gap-6">
          {/* 2D Input */}
          <div className="flex flex-col items-center gap-3">
            <div className={`w-full aspect-square rounded-xl border-2 flex items-center justify-center transition-colors ${phase !== 'idle' ? 'border-cyan-500/50 bg-cyan-950/20 shadow-[0_0_15px_rgba(6,182,212,0.1)]' : 'border-slate-800 bg-slate-900/50'}`}>
              <Camera size={32} className={phase !== 'idle' ? 'text-cyan-400' : 'text-slate-600'} />
            </div>
            <div className="text-[10px] font-bold tracking-widest text-slate-500 uppercase">1. 2D Source Images</div>
          </div>
          {/* Digital Twin */}
          <div className="flex flex-col items-center gap-3">
            <div className={`w-full aspect-square rounded-xl border-2 flex items-center justify-center relative overflow-hidden transition-colors ${phase === 'reconstructing' || phase === 'simulating' || phase === 'complete' ? 'border-indigo-500/50 bg-indigo-950/20 shadow-[0_0_15px_rgba(99,102,241,0.1)]' : 'border-slate-800 bg-slate-900/50'}`}>
              <Box size={32} className={`relative z-10 ${phase === 'reconstructing' || phase === 'simulating' || phase === 'complete' ? 'text-indigo-400' : 'text-slate-600'} ${phase === 'reconstructing' ? 'animate-pulse' : ''}`} />
              {phase === 'reconstructing' && (
                <div className="absolute bottom-0 w-full bg-indigo-500/20 transition-all duration-150" style={{ height: `${progress}%` }}></div>
              )}
            </div>
            <div className="text-[10px] font-bold tracking-widest text-slate-500 uppercase">2. 3D Digital Twin</div>
          </div>
          {/* Simulation */}
          <div className="flex flex-col items-center gap-3">
            <div className={`w-full aspect-square rounded-xl border-2 flex items-center justify-center relative overflow-hidden transition-colors ${phase === 'simulating' || phase === 'complete' ? 'border-emerald-500/50 bg-emerald-950/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]' : 'border-slate-800 bg-slate-900/50'}`}>
              <Wind size={32} className={`relative z-10 ${phase === 'simulating' || phase === 'complete' ? 'text-emerald-400' : 'text-slate-600'} ${phase === 'simulating' ? 'animate-pulse' : ''}`} />
              {phase === 'simulating' && (
                <div className="absolute bottom-0 w-full bg-emerald-500/20 transition-all duration-300" style={{ height: `${progress}%` }}></div>
              )}
            </div>
            <div className="text-[10px] font-bold tracking-widest text-slate-500 uppercase">3. Physics Simulation</div>
          </div>
        </div>

        <div className="flex-1 bg-black/40 border border-slate-800/80 rounded-lg p-4 font-mono text-[10px] overflow-y-auto space-y-2 shadow-inner">
           {logs.length === 0 && (
             <div className="text-slate-600 text-center mt-4 tracking-widest uppercase">PIPELINE STANDBY</div>
           )}
           {logs.map((log, i) => (
             <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className={`${log.includes('[ERROR]') ? 'text-rose-400' : log.includes('[SIM]') ? 'text-emerald-400' : log.includes('[TWIN]') ? 'text-indigo-400' : 'text-cyan-400/80'}`}>
               {log}
             </motion.div>
           ))}
        </div>
      </div>
    </div>
  );
}

export function ExperimentsPanel() {
  const [activeTab, setActiveTab] = useState('morph');

  const { setBreadcrumbs } = useSentinel();
  React.useEffect(() => {
    const activeInfo = tabs.find(t => t.id === activeTab);
    if (activeInfo) {
      setBreadcrumbs([{ label: activeInfo.label }]);
    }
  }, [activeTab, setBreadcrumbs]);


  const tabs = [
    { id: 'morph', label: 'LIVING UI', icon: LayoutTemplate, color: 'text-fuchsia-400' },
    { id: 'weave', label: 'INFINITE CONTEXT', icon: Network, color: 'text-blue-400' },
    { id: 'swarm', label: 'AGENT SWARM', icon: Users, color: 'text-emerald-400' },
    { id: 'dream', label: 'DREAMCATCHER', icon: Mic, color: 'text-amber-400' },
    { id: 'mirror', label: 'EMPATHIC MIRROR', icon: HeartHandshake, color: 'text-rose-400' },
    { id: 'twin', label: 'DIGITAL TWIN', icon: Box, color: 'text-cyan-400' }
  ];

  return (
    <div className="flex h-full bg-slate-950 text-slate-300 font-mono text-sm">
      <div className="w-64 border-r border-slate-800/80 bg-slate-900/30 flex flex-col shrink-0 shadow-[4px_0_24px_rgba(0,0,0,0.3)] z-10 backdrop-blur-md">
        <div className="p-5 border-b border-slate-800/80 flex items-center gap-3 text-indigo-400 font-bold tracking-widest">
          <div className="p-1.5 bg-indigo-500/10 rounded border border-indigo-500/20">
            <FlaskConical size={16} />
          </div>
          <span>EXPERIMENTS</span>
        </div>
        <div className="flex-1 p-3 space-y-2 overflow-y-auto">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all duration-300 relative ${
                activeTab === t.id 
                  ? 'bg-slate-800 text-white shadow-inner border border-slate-700/50' 
                  : 'text-slate-500 hover:bg-slate-800/50 hover:text-slate-300 border border-transparent'
              }`}
            >
              {activeTab === t.id && (
                <motion.div 
                  layoutId="exp-tab-indicator"
                  className="absolute left-0 w-1 h-full bg-current rounded-r"
                  style={{ color: 'var(--tw-colors-' + t.color.split('-')[1] + '-500)' }}
                />
              )}
              <t.icon size={18} className={activeTab === t.id ? t.color : ''} />
              <span className="tracking-widest text-xs font-bold z-10">{t.label}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 p-8 overflow-hidden relative">
        <AnimatePresence mode="wait">
          <motion.div 
            key={activeTab}
            initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
            transition={{ duration: 0.2 }}
            className="h-full w-full absolute inset-0 p-8"
          >
            {activeTab === 'morph' && <Morphogenesis />}
            {activeTab === 'weave' && <InfiniteContext />}
            {activeTab === 'swarm' && <AgentSwarm />}
            {activeTab === 'dream' && <Dreamcatcher />}
            {activeTab === 'mirror' && <EmpathicMirror />}
            {activeTab === 'twin' && <DigitalTwin />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
