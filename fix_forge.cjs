const fs = require('fs');

let code = `
import React, { useState, useRef } from 'react';
import { Hammer, Terminal as TerminalIcon, Play, Code2, Cpu, Save, Wrench, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getGeminiClient } from './geminiClient';
import { autoRepair, runSandbox } from './forgeRepair';
import { db } from './db';
import { useLiveQuery } from 'dexie-react-hooks';
import { selectAgent, recordOutcome } from './banditService';
import { PromptLibrary } from './PromptLibrary';

interface BatchResult {
  prompt: string;
  code: string;
  successScore: number;
  ok: boolean;
  error?: string;
}

export function ForgePanel() {
  const activeAgents = useLiveQuery(() => db.agents.where('status').equals('active').toArray(), []) || [];
  
  const [prompt, setPrompt] = useState('Write a tool to automate network health checks (ping, port scan simulation) and aggregate the results, followed by a machine learning utility to classify text logs into security severity levels (Low, Medium, High).');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);
  const [isBatchMode, setIsBatchMode] = useState(false);
  const INITIAL_CODE = \`// Awaiting input to generate autonomous tool...
// Examples:
// "Write a tool to automate network health checks (ping, port scan simulation) and aggregate the results."
// "Write a machine learning utility to classify text logs into security severity levels (Low, Medium, High)."\`;
  const [code, setCode] = useState(INITIAL_CODE);
  const [logs, setLogs] = useState<string[]>([]);
  const scoreRef = useRef(1.0);

  const log = (level: 'log' | 'warn' | 'error' | 'success' | 'system', text: string) => {
    setLogs(prev => [...prev, \`[\${level.toUpperCase()}] \${text}\`]);
  };

  const processSingleTask = async (taskPrompt: string, taskIndex: number, totalTasks: number) => {
    log('system', \`\\n--- Processing Task \${taskIndex}/\${totalTasks} ---\`);
    log('system', \`Intent: \${taskPrompt.substring(0, 50)}...\`);
    
    try {
      const ai = getGeminiClient();
      log('system', 'Selecting optimal agent via Multi-Armed Bandit...');
      let selectedAgentId = '';
      let decisionId = -1;
      let model = 'gemini-2.5-flash';
      let persona = 'the Sentinel Forge';
      
      if (activeAgents.length > 0) {
        const sel = await selectAgent('forge_codegen', activeAgents.map(a => a.id));
        selectedAgentId = sel.agentId;
        decisionId = sel.decisionId;
        const agent = activeAgents.find(a => a.id === selectedAgentId);
        if (agent) {
          model = agent.model || 'gemini-2.5-flash';
          persona = \`\${agent.name} (\${agent.role}). \${agent.systemPrompt}\`;
          log('system', \`Routed task to agent: \${agent.name} (\${agent.role}) - Expected Value: \${(sel.expectedValue * 100).toFixed(1)}%\`);
        }
      }

      log('system', 'Synthesizing initial code draft...');
      const res = await ai.models.generateContent({
        model: model,
        contents: \`You are \${persona}. The user requested: "\${taskPrompt}".\\nWrite a complete, self-contained JavaScript script that fulfills this request. It MUST run in a Web Worker (no DOM, no window). It must invoke the logic and console.log the result at the end. Wrap the code in \\\`\\\`\\\`javascript\\n...\\n\\\`\\\`\\\`. No other commentary.\`
      });
      
      const rawText = res.text || '';
      const m = rawText.match(/\`\`\`(?:javascript|js)?\\s*([\\s\\S]*?)\`\`\`/i);
      const initialCode = m ? m[1].trim() : rawText.trim();
      
      setCode(initialCode);
      scoreRef.current = 1.0;
      
      log('system', 'Initiating Sandbox Verification & Self-Correction...');
      const outcome = await autoRepair(taskPrompt, initialCode, log);
      
      setCode(outcome.code);
      scoreRef.current = outcome.successScore;
      
      if (decisionId !== -1) {
        log('system', \`Recording bandit outcome: reward \${outcome.successScore.toFixed(3)}\`);
        await recordOutcome(decisionId, outcome.successScore);
      }
      
      if (outcome.ok) {
        log('success', \`Task \${taskIndex} repair successful. Final score: \${outcome.successScore}\`);
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
        log('success', \`Task \${taskIndex} saved to library.\`);
      } else {
        log('error', \`Task \${taskIndex} auto-repair failed to produce working code.\`);
      }
      return { prompt: taskPrompt, code: outcome.code, successScore: outcome.successScore, ok: outcome.ok };
    } catch (error: any) {
      log('error', \`Task \${taskIndex} failed: \${error.message}\`);
      return { prompt: taskPrompt, code: '', successScore: 0, ok: false, error: error.message };
    }
  };

  const handleGenerate = async () => {
    if (!prompt) return;
    setIsGenerating(true);
    setLogs([]);
    
    try {
      if (isBatchMode) {
        const tasks = prompt.split(/\\n\\n+/).map(t => t.trim()).filter(Boolean);
        log('system', \`Initializing BATCH Forge Compiler (\${tasks.length} tasks)...\`);
        
        const results: BatchResult[] = [];
        for (let i = 0; i < tasks.length; i++) {
          const result = await processSingleTask(tasks[i], i + 1, tasks.length);
          results.push(result);
        }
        
        log('system', \`\\n=== BATCH PROCESSING COMPLETE ===\`);
        log('system', \`\${results.filter(r => r.ok).length}/\${tasks.length} tasks succeeded.\`);
        
        setCode(\`/*\\nBATCH PROCESSING SUMMARY\\n\${results.filter(r => r.ok).length}/\${tasks.length} tasks succeeded.\\n\\n\` + 
          results.map((r, i) => \`Task \${i + 1}: \${r.ok ? 'SUCCESS' : 'FAILED'} (Score: \${r.successScore})\\nPrompt: \${r.prompt.substring(0, 50)}...\`).join('\\n') +
          \`\\n*/\`);
      } else {
        await processSingleTask(prompt, 1, 1);
      }
    } catch (error: any) {
      log('error', error.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAutoRepair = async () => {
    if (!code.trim() || isRepairing || isGenerating || isBatchMode) return;
    setIsRepairing(true);
    log('system', 'Initiating Sandbox Verification & Self-Correction...');
    
    try {
      const outcome = await autoRepair(prompt, code, log);
      setCode(outcome.code);
      scoreRef.current = outcome.successScore;
      
      if (outcome.ok) {
        log('success', \`Repair successful. Final score: \${outcome.successScore}\`);
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
    if (isBatchMode && code.includes('BATCH PROCESSING SUMMARY')) return;
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
    if (isBatchMode && code.includes('BATCH PROCESSING SUMMARY')) return;
    try {
      await db.skills.add({
        id: 'skill_' + Date.now(),
        name: prompt.length > 30 ? prompt.slice(0, 30) + '...' : prompt || 'Untitled Tool',
        description: prompt,
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
          <div className="flex items-center gap-2 ml-4">
            <button
              onClick={() => setIsBatchMode(false)}
              className={\`px-3 py-1 rounded text-xs font-bold tracking-widest transition-colors \${!isBatchMode ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-slate-900 text-slate-500 hover:text-slate-300 border border-slate-800'}\`}
            >
              SINGLE TASK
            </button>
            <button
              onClick={() => setIsBatchMode(true)}
              className={\`flex items-center gap-2 px-3 py-1 rounded text-xs font-bold tracking-widest transition-colors \${isBatchMode ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'bg-slate-900 text-slate-500 hover:text-slate-300 border border-slate-800'}\`}
            >
              <Layers size={14} />
              BATCH RUN
            </button>
          </div>
        </div>
        
        <div className="relative mb-6 group">
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder={isBatchMode 
              ? "Enter multiple tasks separated by double newlines.\\n\\nTask 1: Build a calculator...\\n\\nTask 2: Write a string parser..." 
              : "Describe the autonomous tool or script you want the Sentinel to forge..."}
            className="w-full h-32 bg-slate-900/50 text-slate-200 p-4 rounded-xl border border-slate-800 focus:border-rose-500/50 focus:ring-1 focus:ring-rose-500/50 outline-none resize-none font-mono text-sm leading-relaxed transition-all shadow-inner"
          />
          <div className="absolute right-3 bottom-3 flex gap-2">
            <button 
              onClick={() => setPrompt('')}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800/80 text-slate-400 hover:text-slate-200 transition-colors"
            >
              CLEAR
            </button>
            <button 
              onClick={handleGenerate}
              disabled={isGenerating || !prompt.trim()}
              className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider"
            >
              {isGenerating ? (
                <><Cpu size={14} className="animate-pulse" /> SYNTHESIZING...</>
              ) : (
                <><TerminalIcon size={14} /> {isBatchMode ? 'BATCH COMPILE' : 'FORGE'}</>
              )}
            </button>
          </div>
        </div>
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
                disabled={isRepairing || isGenerating || isBatchMode || code === INITIAL_CODE}
                className="flex items-center gap-1.5 px-3 py-1 rounded bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/20 text-[10px] font-bold tracking-widest transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Wrench size={12} className={isRepairing ? "animate-spin" : ""} />
                {isRepairing ? 'REPAIRING...' : 'AUTO-REPAIR'}
              </button>
              <button 
                onClick={handleTest}
                disabled={isGenerating || isBatchMode || code === INITIAL_CODE}
                className="flex items-center gap-1.5 px-3 py-1 rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/20 text-[10px] font-bold tracking-widest transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Play size={12} />
                TEST
              </button>
              <button 
                onClick={handleSave}
                disabled={isGenerating || isBatchMode || code === INITIAL_CODE}
                className="flex items-center gap-1.5 px-3 py-1 rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 text-[10px] font-bold tracking-widest transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save size={12} />
                SAVE SKILL
              </button>
            </div>
          </div>
          <div className="flex-1 relative">
            <textarea
              value={code}
              onChange={e => setCode(e.target.value)}
              spellCheck={false}
              className="absolute inset-0 w-full h-full bg-transparent text-[#D4D4D4] p-4 font-mono text-[13px] leading-relaxed resize-none outline-none overflow-y-auto"
              style={{ tabSize: 2 }}
            />
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
                  className={\`break-words \${
                    l.includes('[ERROR]') ? 'text-red-400' :
                    l.includes('[WARN]') ? 'text-amber-400' :
                    l.includes('[SUCCESS]') ? 'text-emerald-400' :
                    l.includes('[SYSTEM]') ? 'text-slate-500' :
                    'text-slate-300'
                  }\`}
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
`;

fs.writeFileSync('src/ForgePanel.tsx', code);
