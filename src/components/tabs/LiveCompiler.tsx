import React, { useState } from 'react';
import { Terminal, Play, Loader2, Code2 } from 'lucide-react';
import { fetchWithTracing } from '../../lib/fetchWithTracing.js';

export function LiveCompiler({ theme }: { theme: 'dark' | 'light' }) {
  const [code, setCode] = useState('// Write or paste Node.js code here\\nconsole.log("Hello Singularity");\\nreturn 42;');
  const [output, setOutput] = useState('');
  const [result, setResult] = useState<any>(null);
  const [isRunning, setIsRunning] = useState(false);

  const runCode = async () => {
    setIsRunning(true);
    setOutput('');
    setResult(null);
    try {
      const res = await fetchWithTracing('/api/execute-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      });
      const data = await res.json();
      if (data.success) {
        setOutput(data.output || 'No console output');
        setResult(data.result);
      } else {
        setOutput(`Error: ${data.error}`);
      }
    } catch (e: any) {
      setOutput(`Failed to execute: ${e.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 rounded-2xl border border-fuchsia-500/20 overflow-hidden shadow-2xl">
      <div className="flex items-center justify-between px-4 py-3 bg-black/40 border-b border-fuchsia-500/20">
        <div className="flex items-center gap-2 text-fuchsia-400">
          <Terminal size={16} />
          <h3 className="text-xs font-semibold uppercase tracking-widest">Dynamic Tool Forger (Sandbox)</h3>
        </div>
        <button 
          onClick={runCode}
          disabled={isRunning || !code.trim()}
          className={`px-3 py-1.5 rounded-lg flex items-center gap-2 text-xs font-bold transition-all ${
            isRunning 
              ? 'bg-fuchsia-500/20 text-fuchsia-500 cursor-not-allowed'
              : 'bg-fuchsia-500 text-white hover:bg-fuchsia-400 shadow-[0_0_15px_rgba(217,70,239,0.3)] hover:shadow-[0_0_20px_rgba(217,70,239,0.5)]'
          }`}
        >
          {isRunning ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
          {isRunning ? 'Executing...' : 'Run Code'}
        </button>
      </div>
      
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2">
        <div className="flex flex-col border-r border-slate-800">
          <div className="px-3 py-1.5 bg-slate-900 border-b border-slate-800 flex items-center gap-2">
             <Code2 size={12} className="text-slate-500" />
             <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">JavaScript (V8 VM)</span>
          </div>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="flex-1 w-full bg-transparent p-4 font-mono text-sm text-fuchsia-200 resize-none focus:outline-none focus:ring-1 focus:ring-fuchsia-500/30 selection:bg-fuchsia-500/30"
            spellCheck={false}
            placeholder="// Write code here..."
          />
        </div>
        
        <div className="flex flex-col bg-black/60 relative">
          <div className="px-3 py-1.5 bg-slate-900 border-b border-slate-800 flex items-center gap-2">
             <Terminal size={12} className="text-slate-500" />
             <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">Stdout / Result</span>
          </div>
          <div className="flex-1 p-4 font-mono text-xs overflow-y-auto flex flex-col gap-4">
            {output && (
              <div>
                <span className="text-slate-500 mb-1 block">Output:</span>
                <pre className="text-slate-300 whitespace-pre-wrap">{output}</pre>
              </div>
            )}
            {result !== null && (
              <div>
                <span className="text-slate-500 mb-1 block">Return Value:</span>
                <pre className="text-emerald-400 whitespace-pre-wrap bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20">{JSON.stringify(result, null, 2)}</pre>
              </div>
            )}
            {!output && result === null && (
              <div className="text-slate-600 italic mt-4 text-center">
                Sandbox is ready. Awaiting instructions...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
