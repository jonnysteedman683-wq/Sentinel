import React, { useState, useRef } from 'react';
import { Hammer, Terminal as TerminalIcon, Play, Code2, Cpu, Save, Wrench, Layers, Plus, ArrowDownAZ, ArrowUpZA, CheckCircle2, AlertCircle, Clock, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getGeminiClient } from './geminiClient';
import { autoRepair, runSandbox } from './forgeRepair';
import { db } from './db';

import Editor from 'react-simple-code-editor';
import Prism from 'prismjs';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/themes/prism-twilight.css'; // Or another theme

import { useLiveQuery } from 'dexie-react-hooks';
import { selectAgent, recordOutcome } from './banditService';
import { PromptLibrary } from './PromptLibrary';
import { Priority, usePrioritySort, PrioritySortToggle, PrioritySelect, PRIORITIES } from './forgePriority';

interface QueuedTask {
  id: string;
  prompt: string;
  priority?: Priority;
  status: 'pending' | 'processing' | 'done' | 'failed';
  resultCode?: string;
  score?: number;
  createdAt: number;
}

export function ForgePanel() {
  const activeAgents = useLiveQuery(() => db.agents.where('status').equals('active').toArray(), []) || [];
  
  const [prompt, setPrompt] = useState('');
  const [selectedPriority, setSelectedPriority] = useState<Priority>('medium');
  
  const [tasks, setTasks] = useState<QueuedTask[]>([]);
    
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);
  
  const INITIAL_CODE = `// Awaiting input to generate autonomous tool...
// Add tasks to the queue above and hit FORGE ALL`;
  const [code, setCode] = useState(INITIAL_CODE);
  const [logs, setLogs] = useState<string[]>([]);
  const scoreRef = useRef(1.0);

  const log = (level: 'log' | 'warn' | 'error' | 'success' | 'system', text: string) => {
    setLogs(prev => [...prev, `[${level.toUpperCase()}] ${text}`]);
  };

  const handleAddTask = () => {
    if (!prompt.trim()) return;
    const newTask: QueuedTask = {
      id: crypto.randomUUID(),
      prompt: prompt.trim(),
      priority: selectedPriority,
      status: 'pending',
      createdAt: Date.now()
    };
    setTasks(prev => [...prev, newTask]);
    setPrompt('');
  };

  const removeTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const { sorted: sortedTasks, toggle: priorityToggle } = usePrioritySort(tasks);

  const processSingleTask = async (taskPrompt: string, taskPriority: Priority | undefined, taskIndex: number, totalTasks: number) => {
    log('system', `\n--- Processing Task ${taskIndex}/${totalTasks} ---`);
    log('system', `Intent: ${taskPrompt.substring(0, 50)}...`);
    
    try {
      const ai = getGeminiClient();
      log('system', 'Selecting optimal agent via Multi-Armed Bandit...');
      let selectedAgentId = '';
      let decisionId = -1;
      let model = 'gemini-2.5-flash';
      let persona = 'the Sentinel Forge';
      
      if (activeAgents.length > 0) {
        let candidates = activeAgents.map(a => a.id);
        let strategy: 'thompson' | 'ucb1' = 'thompson';
        
        if (taskPriority === 'critical') {
          strategy = 'ucb1';
          const arms = await db.banditArms.where('taskType').equals('forge_codegen').toArray();
          const proven = arms.filter(a => a.pulls > 5).map(a => a.agentId);
          if (proven.length > 0) {
            candidates = candidates.filter(id => proven.includes(id));
          }
        } else if (taskPriority === 'low') {
          strategy = 'thompson';
        }
        
        const sel = await selectAgent('forge_codegen', candidates, strategy);
        selectedAgentId = sel.agentId;
        decisionId = sel.decisionId;
        const agent = activeAgents.find(a => a.id === selectedAgentId);
        if (agent) {
          model = agent.model || 'gemini-2.5-flash';
          persona = `${agent.name} (${agent.role}). ${agent.systemPrompt}`;
          log('system', `Routed task to agent: ${agent.name} (${agent.role}) - Expected Value: ${(sel.expectedValue * 100).toFixed(1)}%`);
        }
      }

      log('system', 'Synthesizing initial code draft...');
      const res = await ai.models.generateContent({
        model: model,
        contents: `You are ${persona}. The user requested: "${taskPrompt}".\nWrite a complete, self-contained JavaScript script that fulfills this request. It MUST run in a Web Worker (no DOM, no window). It must invoke the logic and console.log the result at the end. Wrap the code in \`\`\`javascript\n...\n\`\`\`. No other commentary.`
      });
      
      const rawText = res.text || '';
      const m = rawText.match(/```(?:javascript|js)?\s*([\s\S]*?)```/i);
      const initialCode = m ? m[1].trim() : rawText.trim();
      
      setCode(initialCode);
      scoreRef.current = 1.0;
      
      log('system', 'Initiating Sandbox Verification & Self-Correction...');
      const outcome = await autoRepair(taskPrompt, initialCode, log);
      
      setCode(outcome.code);
      scoreRef.current = outcome.successScore;
      
      if (decisionId !== -1) {
        log('system', `Recording bandit outcome: reward ${outcome.successScore.toFixed(3)}`);
        await recordOutcome(decisionId, outcome.successScore);
      }
      
      if (outcome.ok) {
        log('success', `Task ${taskIndex} repair successful. Final score: ${outcome.successScore}`);
        await db.skills.add({
          id: 'skill_' + Date.now() + '_' + taskIndex,
          name: taskPrompt.length > 30 ? taskPrompt.slice(0, 30) + '...' : taskPrompt,
          description: taskPrompt,
          code: outcome.code,
          successScore: outcome.successScore,
          triggerConditions: [],
          promptTemplate: '',
          toolSequence: [],
          heuristics: [],
          lastUpdated: Date.now(),
          editHistory: []
        });
        log('success', `Task ${taskIndex} saved to library.`);
      } else {
        log('error', `Task ${taskIndex} auto-repair failed to produce working code.`);
      }
      return { code: outcome.code, score: outcome.successScore, ok: outcome.ok };
    } catch (error: any) {
      log('error', `Task ${taskIndex} failed: ${error.message}`);
      return { code: '', score: 0, ok: false, error: error.message };
    }
  };

  const handleGenerateAll = async () => {
    const pendingTasks = sortedTasks.filter(t => t.status === 'pending');
    if (pendingTasks.length === 0) return;
    
    setIsGenerating(true);
    setLogs([]);
    
    log('system', `Initializing Forge Compiler for ${pendingTasks.length} queued tasks...`);
    
    try {
      let successCount = 0;
      for (let i = 0; i < pendingTasks.length; i++) {
        const task = pendingTasks[i];
        
        // Update task status
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'processing' } : t));
        
        const result = await processSingleTask(task.prompt, task.priority, i + 1, pendingTasks.length);
        
        if (result.ok) successCount++;
        
        // Update task result
        setTasks(prev => prev.map(t => t.id === task.id ? { 
          ...t, 
          status: result.ok ? 'done' : 'failed',
          resultCode: result.code,
          score: result.score
        } : t));
      }
      
      log('system', `\n=== BATCH PROCESSING COMPLETE ===`);
      log('system', `${successCount}/${pendingTasks.length} tasks succeeded.`);
    } catch (error: any) {
      log('error', error.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAutoRepair = async () => {
    if (!code.trim() || isRepairing || isGenerating || code === INITIAL_CODE) return;
    setIsRepairing(true);
    log('system', 'Initiating Sandbox Verification & Self-Correction...');
    
    try {
      const outcome = await autoRepair("Manual repair request", code, log);
      setCode(outcome.code);
      scoreRef.current = outcome.successScore;
      
      if (outcome.ok) {
        log('success', `Repair successful. Final score: ${outcome.successScore}`);
      } else {
        log('error', 'Auto-repair failed to produce working code.');
      }
    } catch (error: any) {
      log('error', error.message);
    } finally {
      setIsRepairing(false);
    }
  };

  const handleTest = () => {
    if (code === INITIAL_CODE) return;
    setLogs(prev => [...prev, '[SYSTEM] Running sandbox environment...']);
    runSandbox(code).then(res => {
      if (res.ok) {
        res.logs.forEach(l => log('log', l));
        log('success', 'Task execution successful.');
      } else {
        log('error', res.error || 'Unknown error');
      }
    });
  };

  const handleSave = async () => {
    if (code === INITIAL_CODE) return;
    try {
      await db.skills.add({
        id: 'skill_' + Date.now(),
        name: 'Untitled Tool',
        description: 'Manually saved skill',
        code: code,
        successScore: scoreRef.current,
        triggerConditions: [],
        promptTemplate: '',
        toolSequence: [],
        heuristics: [],
        lastUpdated: Date.now(),
        editHistory: []
      });
      log('success', 'Skill saved to library successfully.');
    } catch (err: any) {
      log('error', 'Failed to save skill: ' + err.message);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 font-sans text-slate-300">
      <div className="flex-none p-6 pb-0 max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-3 mb-4">
          <Hammer className="text-rose-400 w-6 h-6" />
          <h2 className="text-xl font-bold font-mono tracking-widest text-slate-100">THE FORGE</h2>
        </div>
        
        {/* Task Input */}
        <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 shadow-inner mb-4">
          <div className="flex gap-4">
            <input
              type="text"
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="Describe the autonomous tool or script you want the Sentinel to forge..."
              className="flex-1 bg-slate-950 text-slate-200 px-4 py-2 rounded-lg border border-slate-800 focus:border-rose-500/50 focus:ring-1 focus:ring-rose-500/50 outline-none font-mono text-sm transition-all"
              onKeyDown={e => { if (e.key === 'Enter') handleAddTask(); }}
            />
            <PrioritySelect value={selectedPriority} onChange={setSelectedPriority} />
            <button
              onClick={handleAddTask}
              disabled={!prompt.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider"
            >
              <Plus size={16} /> ADD TASK
            </button>
          </div>
        </div>

        {/* Task Queue */}
        {tasks.length > 0 && (
          <div className="mb-6 bg-slate-900/30 rounded-xl border border-slate-800 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Layers size={16} className="text-slate-400" />
                <span className="font-mono text-xs font-bold tracking-widest text-slate-300">TASK QUEUE ({tasks.length})</span>
              </div>
              <div className="flex gap-3">
                <PrioritySortToggle {...priorityToggle} />
                <button
                  onClick={handleGenerateAll}
                  disabled={isGenerating || sortedTasks.every(t => t.status !== 'pending')}
                  className="flex items-center gap-1.5 px-3 py-1 rounded text-xs font-bold tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Cpu size={14} />}
                  FORGE ALL PENDING
                </button>
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto p-2 flex flex-col gap-2">
              <AnimatePresence mode="popLayout">
                {sortedTasks.map(task => (
                  <motion.div
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    key={task.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-slate-950 border border-slate-800/50"
                  >
                    <div className="shrink-0">
                      {task.status === 'pending' && <Clock size={16} className="text-slate-500" />}
                      {task.status === 'processing' && <Loader2 size={16} className="text-indigo-400 animate-spin" />}
                      {task.status === 'done' && <CheckCircle2 size={16} className="text-emerald-400" />}
                      {task.status === 'failed' && <AlertCircle size={16} className="text-rose-400" />}
                    </div>
                    
                    <PrioritySelect 
                      value={task.priority} 
                      onChange={(p) => setTasks(prev => prev.map(t => t.id === task.id ? { ...t, priority: p } : t))} 
                    />
                    
                    <div className="flex-1 font-mono text-xs truncate text-slate-300">
                      {task.prompt}
                    </div>
                    
                    {task.score !== undefined && (
                      <div className="font-mono text-[10px] text-emerald-500 mr-2">
                        SCORE: {task.score.toFixed(2)}
                      </div>
                    )}
                    
                    {task.status === 'pending' && (
                      <button 
                        onClick={() => removeTask(task.id)}
                        className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded"
                      >
                        <AlertCircle size={14} className="rotate-45" /> {/* Use as X */}
                      </button>
                    )}
                    {(task.status === 'done' || task.status === 'failed') && task.resultCode && (
                      <button 
                        onClick={() => setCode(task.resultCode!)}
                        className="px-2 py-1 text-[10px] font-bold tracking-widest bg-slate-800 hover:bg-slate-700 text-slate-300 rounded"
                      >
                        VIEW
                      </button>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 flex gap-6 px-6 pb-6 max-w-7xl mx-auto w-full min-h-0">
        <div className="flex-1 flex flex-col bg-[#1E1E1E] rounded-xl border border-slate-800 shadow-2xl overflow-hidden relative group">
          <div className="bg-[#2D2D2D] px-4 py-2 border-b border-slate-800 flex items-center justify-between z-10">
            <div className="flex items-center gap-2 text-slate-400">
              <Code2 size={16} />
              <span className="text-xs font-mono font-bold tracking-widest">WORKER.JS</span>
            </div>
            
            <div className="flex items-center gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
              <button 
                onClick={handleAutoRepair}
                disabled={isRepairing || isGenerating || code === INITIAL_CODE}
                className="flex items-center gap-1.5 px-3 py-1 rounded bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/20 text-[10px] font-bold tracking-widest transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Wrench size={12} className={isRepairing ? "animate-spin" : ""} />
                {isRepairing ? 'REPAIRING...' : 'AUTO-REPAIR'}
              </button>
              <button 
                onClick={handleTest}
                disabled={isGenerating || code === INITIAL_CODE}
                className="flex items-center gap-1.5 px-3 py-1 rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/20 text-[10px] font-bold tracking-widest transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Play size={12} />
                TEST
              </button>
              <button 
                onClick={handleSave}
                disabled={isGenerating || code === INITIAL_CODE}
                className="flex items-center gap-1.5 px-3 py-1 rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 text-[10px] font-bold tracking-widest transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save size={12} />
                SAVE SKILL
              </button>
            </div>
          </div>
          <div className="flex-1 relative">
            <div className="absolute inset-0 w-full h-full overflow-y-auto overflow-x-hidden">
              <Editor
                value={code}
                onValueChange={code => setCode(code)}
                highlight={code => Prism.highlight(code, Prism.languages.typescript, 'typescript')}
                padding={16}
                style={{
                  fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                  fontSize: 13,
                  backgroundColor: 'transparent',
                  minHeight: '100%',
                }}
                textareaClassName="focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="w-80 flex flex-col bg-slate-900 rounded-xl border border-slate-800 shadow-2xl overflow-hidden shrink-0">
          <div className="bg-slate-950 px-4 py-2 border-b border-slate-800 flex items-center justify-between z-10 shrink-0">
            <div className="flex items-center gap-2 text-slate-400">
              <TerminalIcon size={16} />
              <span className="text-xs font-mono font-bold tracking-widest">EXECUTION LOGS</span>
            </div>
          </div>
          <div className="flex-1 p-4 font-mono text-[11px] leading-relaxed overflow-y-auto bg-slate-900 flex flex-col gap-1.5 h-full">
            <AnimatePresence initial={false}>
              {logs.map((l, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`break-words ${
                    l.includes('[ERROR]') ? 'text-red-400' :
                    l.includes('[WARN]') ? 'text-amber-400' :
                    l.includes('[SUCCESS]') ? 'text-emerald-400' :
                    l.includes('[SYSTEM]') ? 'text-slate-500' :
                    'text-slate-300'
                  }`}
                >
                  {l}
                </motion.div>
              ))}
            </AnimatePresence>
            {logs.length === 0 && (
              <div className="text-slate-600 italic mt-auto pb-4">
                Sandbox output will appear here...
              </div>
            )}
            <div className="shrink-0 h-4" /> 
          </div>
        </div>
      </div>
    </div>
  );
}
