const fs = require('fs');
let content = fs.readFileSync('src/ExperimentsPanel.tsx', 'utf-8');

const agentSwarmOld = `function AgentSwarm() {
  const [task, setTask] = useState('');
  const [agents, setAgents] = useState<any[]>([]);

  const handleDispatch = () => {
    if (!task) return;
    const newAgent = { id: crypto.randomUUID(), task, status: 'researching', progress: 10 };
    setAgents([newAgent, ...agents]);
    setTask('');
    
    // Simulate progress
    setTimeout(() => {
      setAgents(prev => prev.map(a => a.id === newAgent.id ? { ...a, status: 'synthesizing', progress: 50 } : a));
    }, 3000);
    setTimeout(() => {
      setAgents(prev => prev.map(a => a.id === newAgent.id ? { ...a, status: 'complete', progress: 100 } : a));
    }, 6000);
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
          placeholder="Dispatch task (e.g., 'Research ultralight laptops')"
          className="flex-1 bg-slate-900 border border-slate-700/80 rounded-lg px-4 py-3 focus:outline-none focus:border-emerald-500/70 focus:ring-1 focus:ring-emerald-500/50 shadow-inner"
        />
        <button onClick={handleDispatch} disabled={!task} className="bg-emerald-600/90 hover:bg-emerald-500 text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.2)] transition-all disabled:opacity-50">
          <Users size={18} /> DISPATCH
        </button>
      </div>
      <div className="flex-1 overflow-y-auto space-y-4 pr-2">
        <AnimatePresence>
          {agents.length === 0 && (
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full flex items-center justify-center text-slate-600 tracking-widest text-sm">
               [ SWARM IDLE ]
             </motion.div>
          )}
          {agents.map(a => (
            <motion.div 
              key={a.id} 
              initial={{ opacity: 0, x: -20, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              className="bg-slate-900/80 border border-emerald-900/30 p-5 rounded-xl shadow-lg relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-full bg-emerald-900/5 opacity-50"></div>
              <div className="relative z-10 flex justify-between items-center mb-3">
                <span className="font-bold text-emerald-400 truncate pr-4">{a.task}</span>
                <span className={\`text-[10px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-full border \${
                  a.status === 'complete' ? 'bg-emerald-950/50 text-emerald-400 border-emerald-800' : 
                  a.status === 'synthesizing' ? 'bg-amber-950/50 text-amber-400 border-amber-800 animate-pulse' : 
                  'bg-blue-950/50 text-blue-400 border-blue-800 animate-pulse'
                }\`}>
                  {a.status}
                </span>
              </div>
              <div className="relative z-10 w-full bg-slate-950 border border-slate-800 h-2.5 rounded-full overflow-hidden">
                <div 
                  className={\`h-full transition-all duration-1000 ease-out \${
                    a.status === 'complete' ? 'bg-emerald-500' : 'bg-emerald-500/70 relative'
                  }\`} 
                  style={{ width: \`\${a.progress}%\` }}
                >
                  {a.status !== 'complete' && (
                    <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]"></div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}`;

const agentSwarmNew = `interface SubTask {
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
        contents: \`Decompose this task into 2 to 4 distinct sequential sub-tasks: "\${currentTask}". Return JSON array of objects with "name" and "description". Do not wrap in markdown.\`,
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
          contents: \`You are executing step \${i+1} of a larger task: "\${currentTask}".\\n\\nStep \${i+1} Name: \${subTask.name}\\nStep \${i+1} Description: \${subTask.description}\\n\\nContext from previous steps:\\n\${context}\\n\\nPerform this step and provide a concise output.\`
        });

        const result = stepResponse.text || "No output generated.";
        context += \`\\n\\nOutput from Step \${i+1} (\${subTask.name}):\\n\${result}\`;

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
        contents: \`Original Task: "\${currentTask}"\\n\\nWe executed several sub-tasks to gather info:\\n\${context}\\n\\nPlease provide the final, cohesive result to the user based on these steps. Format nicely with markdown.\`
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
                <span className={\`text-[10px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-full border \${
                  job.status === 'complete' ? 'bg-emerald-950/50 text-emerald-400 border-emerald-800' : 
                  job.status === 'error' ? 'bg-rose-950/50 text-rose-400 border-rose-800' : 
                  'bg-blue-950/50 text-blue-400 border-blue-800 animate-pulse'
                }\`}>
                  {job.status}
                </span>
              </div>
              
              <div className="relative z-10 w-full bg-slate-950 border border-slate-800 h-1.5 rounded-full overflow-hidden">
                <div 
                  className={\`h-full transition-all duration-1000 ease-out \${
                    job.status === 'complete' ? 'bg-emerald-500' : 'bg-emerald-500/70 relative'
                  }\`} 
                  style={{ width: \`\${job.progress}%\` }}
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
                           <div className={\`w-2 h-2 rounded-full \${
                             st.status === 'complete' ? 'bg-emerald-500' : 
                             st.status === 'active' ? 'bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.8)]' : 
                             'bg-slate-700'
                           }\`} />
                           <span className={\`font-bold \${st.status === 'active' ? 'text-blue-400' : st.status === 'complete' ? 'text-emerald-400/80' : 'text-slate-500'}\`}>
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
}`;

content = content.replace(agentSwarmOld, agentSwarmNew);

fs.writeFileSync('src/ExperimentsPanel.tsx', content);
