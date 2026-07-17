import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Lightbulb, 
  Loader2, 
  Plus, 
  Brain, 
  Zap, 
  Check, 
  ArrowRight, 
  Shuffle, 
  Cpu, 
  BookOpen,
  ChevronRight
} from 'lucide-react';

interface BrainstormProps {
  memories: any[];
  onAddMemory: (text: string, tags?: string[]) => Promise<void> | void;
  addLog?: (message: string, level?: 'INFO' | 'WARN' | 'ERROR' | 'NEURAL' | 'CRITICAL', source?: string) => void;
}

export const Brainstorm: React.FC<BrainstormProps> = ({ 
  memories, 
  onAddMemory, 
  addLog
}) => {
  const [topic, setTopic] = useState('');
  const [context, setContext] = useState('');
  const [creativity, setCreativity] = useState('0.7');
  const [ideaCount, setIdeaCount] = useState('5');
  const [lens, setLens] = useState('general');
  const [ideas, setIdeas] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Interactive nodes state
  const [selectedNodeIndex, setSelectedNodeIndex] = useState<number | null>(null);
  const [savedNodeIndices, setSavedNodeIndices] = useState<Record<number, boolean>>({});
  const [promptSuggestions, setPromptSuggestions] = useState<string[]>([]);

  // Extra metadata about ideas (generate detailed substeps/elaborations locally to enrich clicking an idea)
  const [elaboratedIdeas, setElaboratedIdeas] = useState<Record<number, { details: string; steps: string[] }>>({});

  // 1. Generate interesting combinatorial prompts based on actual memory tags
  useEffect(() => {
    const allTags = new Set<string>();
    memories.forEach(m => {
      if (m.tags) m.tags.forEach((t: string) => allTags.add(t));
    });
    
    const tagsArray = Array.from(allTags);
    const templates = [
      "Synthesize a step-by-step experiment outline for {TAG1}",
      "Explore high-impact applications connecting {TAG1} with {TAG2}",
      "Design a robust production blueprint optimizing {TAG1}",
      "Analyze the primary bottlenecks and structural limitations of {TAG1}",
      "Establish a multidisciplinary study guide unifying {TAG1} and {TAG2}"
    ];

    const suggestions: string[] = [];
    if (tagsArray.length >= 2) {
      // Create specific combinatorial suggestions
      for (let i = 0; i < 3; i++) {
        const t1 = tagsArray[Math.floor(Math.random() * tagsArray.length)];
        let t2 = tagsArray[Math.floor(Math.random() * tagsArray.length)];
        while (t2 === t1) {
          t2 = tagsArray[Math.floor(Math.random() * tagsArray.length)];
        }
        const template = templates[1]; // cross-connection
        suggestions.push(template.replace('{TAG1}', t1).replace('{TAG2}', t2));
      }
      // Single tag templates
      const t1 = tagsArray[Math.floor(Math.random() * tagsArray.length)];
      suggestions.push(templates[0].replace('{TAG1}', t1));
    } else if (tagsArray.length === 1) {
      const t = tagsArray[0];
      suggestions.push(templates[0].replace('{TAG1}', t));
      suggestions.push(templates[2].replace('{TAG1}', t));
      suggestions.push(`How to combine ${t} with cognitive reinforcement protocols?`);
    } else {
      // Default high quality templates
      suggestions.push("Design a reinforcement neural interface to combat memory decay");
      suggestions.push("How to build an offline-first vector database using index cache?");
      suggestions.push("Unify reinforcement curiosity agents with k-NN contextual prediction");
    }
    setPromptSuggestions(suggestions);
  }, [memories]);

  // 2. Query server brainstorm API
  const handleBrainstorm = async (e?: React.FormEvent, selectedTopic?: string) => {
    if (e) e.preventDefault();
    const topicToUse = selectedTopic || topic;
    if (!topicToUse.trim()) return;

    setIsGenerating(true);
    setError(null);
    setIdeas([]);
    setSelectedNodeIndex(null);
    setSavedNodeIndices({});
    setElaboratedIdeas({});

    if (addLog) {
      addLog(`Initiating conceptual brainstorming on: "${topicToUse.substring(0, 40)}..."`, 'NEURAL', 'ENGINE');
    }

    try {
      const res = await fetch('/api/brainstorm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topicToUse, context, creativity, ideaCount, lens }),
      });

      if (!res.ok) {
        throw new Error('Failed to generate brainstorming schematic nodes.');
      }

      const data = await res.json();
      const fetchedIdeas = data.ideas || [];
      setIdeas(fetchedIdeas);
      
      if (fetchedIdeas.length > 0 && addLog) {
        addLog(`Successfully synthesized ${fetchedIdeas.length} idea nodes into topological space.`, 'NEURAL', 'ENGINE');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during brainstorming synthesis.');
      if (addLog) {
        addLog(`Synthesis failed: ${err.message || 'Unknown network error'}`, 'ERROR', 'ENGINE');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  // 3. Elaborate an idea node with actions / steps when clicked
  const handleSelectNode = (index: number) => {
    setSelectedNodeIndex(index);
    if (elaboratedIdeas[index]) return;

    // Build some elegant, contextual study questions and actionable steps based on the idea text
    const ideaText = ideas[index];
    const verbs = ["Deploy", "Calibrate", "Integrate", "Optimize", "Audit", "Model", "Synthesize"];
    const techWords = ["asynchronous telemetry", "vector weight layers", "dynamic threshold", "cognitive feedback loop", "localized partition cache"];
    
    const steps = [
      `${verbs[index % verbs.length]} the underlying state variables to ensure proper synchronization.`,
      `Establish a real-time log monitor tracking ${techWords[(index + 1) % techWords.length]} transitions.`,
      `Refine error handling protocols with high-precision Laplace smoothing prior fallbacks.`,
    ];

    setElaboratedIdeas(prev => ({
      ...prev,
      [index]: {
        details: `This proposal targets localized optimization of user cognitive workflows, specifically evaluating "${ideaText}" to establish high-retention structural bonds.`,
        steps
      }
    }));

    if (addLog) {
      addLog(`Inspecting conceptual node: "${ideaText.substring(0, 30)}..."`, 'INFO', 'CORE');
    }
  };

  // 4. Save a specific node back into the user's permanent memories
  const handleSaveToMemory = async (index: number) => {
    if (savedNodeIndices[index]) return;
    
    const textToSave = `[Brainstormed Idea - Focus: ${topic || 'Custom focus'}] ${ideas[index]}`;
    const cleanTags = ['brainstorm', ...(topic ? [topic.toLowerCase().split(' ').slice(0, 2).join('-').replace(/[^a-z0-9-]/g, '')] : [])];
    
    try {
      await onAddMemory(textToSave, cleanTags);
      setSavedNodeIndices(prev => ({ ...prev, [index]: true }));
      
      if (addLog) {
        addLog(`Successfully incorporated brainstorm node into the memory bank.`, 'NEURAL', 'CORE');
      }
    } catch (e) {
      console.error(e);
      if (addLog) {
        addLog(`Failed to incorporate node into database.`, 'ERROR', 'CORE');
      }
    }
  };

  // Radial positioning configurations
  const CX = 50;
  const CY = 48;
  const R_X = 36; // horizontal radius %
  const R_Y = 32; // vertical radius %

  return (
    <div className="flex flex-col lg:flex-row h-full w-full gap-5">
      {/* 1. Left Panel: Topics, Suggestions, and Configurations */}
      <div className="w-full lg:w-[38%] flex flex-col gap-4">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col gap-4 shadow-xl">
          <div className="flex items-center gap-2 border-b border-white/5 pb-3">
            <Lightbulb className="w-4 h-4 text-yellow-400" />
            <h3 className="text-yellow-400 text-xs font-bold uppercase tracking-widest">Brainstorm Configurator</h3>
          </div>

          <form onSubmit={(e) => handleBrainstorm(e)} className="flex flex-col gap-3.5">
            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Focus Area / Core Problem</label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Enter a focus area (e.g., reactive caching)..."
                className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-4 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/50 transition-all font-sans"
                disabled={isGenerating}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Optional Parameters</label>
              <textarea
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="Include constraints or sub-goals to specialize the concept schema (e.g. offline compatibility)..."
                rows={2}
                className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-4 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/50 transition-all resize-none font-sans"
                disabled={isGenerating}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Creativity</label>
                <select
                  value={creativity}
                  onChange={(e) => setCreativity(e.target.value)}
                  disabled={isGenerating}
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-2 px-3 text-xs text-slate-200 focus:outline-none focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/50 transition-all font-sans"
                >
                  <option value="0.3">Low (Logical)</option>
                  <option value="0.7">Medium (Balanced)</option>
                  <option value="1.2">High (Wild)</option>
                  <option value="1.8">Maximum (Chaotic)</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Node Count</label>
                <select
                  value={ideaCount}
                  onChange={(e) => setIdeaCount(e.target.value)}
                  disabled={isGenerating}
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-2 px-3 text-xs text-slate-200 focus:outline-none focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/50 transition-all font-sans"
                >
                  <option value="3">3 Nodes</option>
                  <option value="5">5 Nodes</option>
                  <option value="8">8 Nodes</option>
                  <option value="12">12 Nodes</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Cognitive Lens</label>
              <select
                value={lens}
                onChange={(e) => setLens(e.target.value)}
                disabled={isGenerating}
                className="w-full bg-black/40 border border-white/10 rounded-xl py-2 px-3 text-xs text-slate-200 focus:outline-none focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/50 transition-all font-sans"
              >
                <option value="general">General Synthesis</option>
                <option value="technical">Technical / Architecture</option>
                <option value="philosophical">Philosophical / Abstract</option>
                <option value="creative">Creative / Lateral Thinking</option>
                <option value="contrarian">Contrarian / Devil's Advocate</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={!topic.trim() || isGenerating}
              className="w-full py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg cursor-pointer bg-yellow-500 hover:bg-yellow-400 text-yellow-950 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Synthesizing Nodes...
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5" /> Synthesize Conceptual Space
                </>
              )}
            </button>
          </form>

          {/* Prompt Suggestions */}
          <div className="mt-2 space-y-2">
            <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold flex items-center gap-1.5">
              <Shuffle className="w-3 h-3 text-slate-500" /> Combinatorial Suggestions
            </span>
            <div className="flex flex-col gap-1.5 max-h-[170px] overflow-y-auto pr-1 custom-scrollbar">
              {promptSuggestions.map((suggestion, i) => (
                <button
                  key={i}
                  disabled={isGenerating}
                  onClick={() => {
                    setTopic(suggestion);
                    handleBrainstorm(undefined, suggestion);
                  }}
                  className="w-full text-left p-2.5 rounded-xl border border-white/5 bg-black/20 hover:border-yellow-500/20 hover:bg-yellow-500/5 transition-all text-[11px] text-slate-400 hover:text-slate-200 leading-relaxed flex items-start gap-2 group cursor-pointer"
                >
                  <ArrowRight className="w-3 h-3 text-slate-600 group-hover:text-yellow-400 transition-colors mt-0.5 flex-shrink-0" />
                  <span className="font-sans">{suggestion}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Selected Node Details Box */}
        <AnimatePresence mode="wait">
          {selectedNodeIndex !== null && ideas[selectedNodeIndex] && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="bg-black/40 border border-white/5 rounded-2xl p-4 flex flex-col gap-3 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-3 opacity-5">
                <Brain className="w-16 h-16 text-indigo-400" />
              </div>

              <div className="flex items-start justify-between gap-2">
                <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-indigo-400 border border-indigo-400/20 bg-indigo-400/5 px-2 py-0.5 rounded">
                  CONCEPTUAL NODE {selectedNodeIndex + 1}
                </span>
                
                <button
                  onClick={() => handleSaveToMemory(selectedNodeIndex)}
                  className={`flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest py-1 px-2.5 rounded-lg border transition-all cursor-pointer ${
                    savedNodeIndices[selectedNodeIndex]
                      ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                      : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20'
                  }`}
                >
                  {savedNodeIndices[selectedNodeIndex] ? (
                    <>
                      <Check className="w-3 h-3" /> Incorporated
                    </>
                  ) : (
                    <>
                      <Plus className="w-3 h-3" /> Save to Memory
                    </>
                  )}
                </button>
              </div>

              <p className="text-xs text-slate-200 leading-relaxed font-sans font-medium bg-white/5 p-3 rounded-xl border border-white/5">
                {ideas[selectedNodeIndex]}
              </p>

              {elaboratedIdeas[selectedNodeIndex] && (
                <div className="space-y-2">
                  <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold flex items-center gap-1.5">
                    <BookOpen className="w-3 h-3 text-indigo-400" /> Recommendation Steps
                  </span>
                  <div className="space-y-1.5">
                    {elaboratedIdeas[selectedNodeIndex].steps.map((step, sIdx) => (
                      <div key={sIdx} className="flex items-start gap-1.5 text-[10.5px] text-slate-400 leading-relaxed">
                        <ChevronRight className="w-3 h-3 text-indigo-400 mt-0.5 flex-shrink-0" />
                        <span className="font-sans">{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 2. Right Panel: Dynamic Topological Schematic Canvas */}
      <div className="flex-1 flex flex-col gap-4 min-h-[460px]">
        <div className="flex-1 bg-black/40 border border-white/5 rounded-3xl relative overflow-hidden flex flex-col items-center justify-center p-4 min-h-[420px]">
          {/* Subtle grid background */}
          <div className="absolute inset-0 opacity-[0.03]" 
               style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} 
          />

          {error && (
            <div className="absolute top-4 left-4 right-4 bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-xs z-10 font-sans">
              {error}
            </div>
          )}

          {isGenerating ? (
            <div className="flex flex-col items-center gap-3 relative z-10 text-center animate-pulse">
              <div className="p-4 bg-yellow-500/10 rounded-full border border-yellow-500/20">
                <Loader2 className="w-8 h-8 text-yellow-400 animate-spin" />
              </div>
              <h4 className="text-yellow-400 text-xs font-bold uppercase tracking-widest">Synthesizing Concept Space</h4>
              <p className="text-[10px] text-slate-500 font-mono">Calibrating synaptic nodes & edge parameters...</p>
            </div>
          ) : ideas.length > 0 ? (
            <div className="relative w-full h-full min-h-[380px] flex items-center justify-center">
              {/* Dynamic Connecting Vector Lines */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="rgba(234, 179, 8, 0.4)" />
                    <stop offset="100%" stopColor="rgba(99, 102, 241, 0.4)" />
                  </linearGradient>
                </defs>
                {ideas.map((_, index) => {
                  const angle = (index * 2 * Math.PI) / ideas.length - Math.PI / 2;
                  const targetX = CX + R_X * Math.cos(angle);
                  const targetY = CY + R_Y * Math.sin(angle);
                  return (
                    <g key={`edge-${index}`}>
                      <line
                        x1={`${CX}%`}
                        y1={`${CY}%`}
                        x2={`${targetX}%`}
                        y2={`${targetY}%`}
                        stroke="url(#lineGrad)"
                        strokeWidth="0.5"
                        strokeDasharray="1.5 2"
                        className="opacity-60"
                      />
                      {/* Pulse circle animating along line */}
                      <circle r="0.6" fill="#fbbf24">
                        <animateMotion
                          dur={`${2.5 + (index % 3)}s`}
                          repeatCount="indefinite"
                          path={`M ${CX} ${CY} L ${targetX} ${targetY}`}
                        />
                      </circle>
                    </g>
                  );
                })}
              </svg>

              {/* Central Topic Node */}
              <div 
                className="absolute z-20 flex flex-col items-center justify-center p-4 rounded-2xl bg-gradient-to-br from-yellow-500/20 to-indigo-500/20 border border-yellow-400/40 text-center shadow-[0_0_30px_rgba(234,179,8,0.15)] select-none"
                style={{
                  left: `${CX}%`,
                  top: `${CY}%`,
                  transform: 'translate(-50%, -50%)',
                  width: '110px',
                  height: '110px',
                }}
              >
                <Cpu className="w-5 h-5 text-yellow-400 animate-pulse mb-1.5" />
                <span className="text-[8px] font-mono text-yellow-500 font-bold uppercase tracking-widest">FOCUS TOPIC</span>
                <p className="text-[10px] text-slate-100 font-semibold font-sans truncate w-full px-1">
                  {topic || 'Conceptual Core'}
                </p>
              </div>

              {/* Orbital Satellite Nodes */}
              {ideas.map((idea, index) => {
                const angle = (index * 2 * Math.PI) / ideas.length - Math.PI / 2;
                const targetX = CX + R_X * Math.cos(angle);
                const targetY = CY + R_Y * Math.sin(angle);
                const isSelected = selectedNodeIndex === index;
                const isSaved = savedNodeIndices[index];

                return (
                  <motion.button
                    key={index}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: index * 0.08, type: "spring", stiffness: 100 }}
                    onClick={() => handleSelectNode(index)}
                    className={`absolute z-10 flex flex-col items-center justify-center p-2 rounded-xl border transition-all duration-300 cursor-pointer text-center group ${
                      isSelected 
                        ? 'bg-indigo-500/30 border-indigo-400 text-indigo-100 shadow-[0_0_20px_rgba(99,102,241,0.4)] scale-110 z-20' 
                        : isSaved
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                          : 'bg-black/50 border-white/10 hover:border-white/30 text-slate-300 hover:text-slate-100 hover:scale-105'
                    }`}
                    style={{
                      left: `${targetX}%`,
                      top: `${targetY}%`,
                      transform: 'translate(-50%, -50%)',
                      width: '95px',
                      height: '75px',
                    }}
                  >
                    <div className="absolute top-1 right-1">
                      {isSaved ? (
                        <Check className="w-2.5 h-2.5 text-emerald-400" />
                      ) : (
                        <span className="text-[8px] text-slate-600 font-mono group-hover:text-yellow-400/70 transition-colors">#{index + 1}</span>
                      )}
                    </div>
                    <Lightbulb className={`w-3.5 h-3.5 mb-1 ${
                      isSelected ? 'text-indigo-400 animate-pulse' : isSaved ? 'text-emerald-400' : 'text-yellow-500/70 group-hover:text-yellow-400'
                    }`} />
                    <p className="text-[8.5px] leading-tight font-sans font-semibold tracking-wide line-clamp-3 px-1 w-full text-center">
                      {idea}
                    </p>
                  </motion.button>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center text-center max-w-sm px-6">
              <div className="p-4 bg-white/5 rounded-full border border-white/5 mb-3">
                <Brain className="w-8 h-8 text-slate-500" />
              </div>
              <h4 className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1.5">No Synthesized Schematic</h4>
              <p className="text-xs text-slate-500 font-sans leading-relaxed">
                Provide a focus area or click one of the combinatorial suggestions on the configurator panel to map your thoughts into a synaptic idea web.
              </p>
            </div>
          )}
        </div>

        {/* Legend / Status bar */}
        <div className="bg-white/5 border border-white/10 p-3 rounded-2xl flex items-center justify-between text-[10px] font-mono text-slate-500">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500" /> Topic Core</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-500" /> Synaptic Nodes</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Saved Bounds</span>
          </div>
          <span>Active Threads: <span className="text-yellow-500">{ideas.length}</span></span>
        </div>
      </div>
    </div>
  );
};
