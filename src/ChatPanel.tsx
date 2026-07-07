import React, { useState, useRef, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { useSentinel } from './SentinelContext';
import { Send, Cpu, Database, Loader2, Mic, MicOff } from 'lucide-react';
import Markdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import { useCognitiveMirror } from './hooks/useCognitiveMirror';
import { Sparkles, Brain, AlertTriangle } from 'lucide-react';

export function ChatPanel() {
  const { processUserMessage } = useSentinel();
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  
  const { analysis, isAnalyzing } = useCognitiveMirror(input);

  // Fetch only chat-tagged episodes to display in the UI
  const episodes = useLiveQuery(
    () => db.episodes.where('tags').equals('chat').sortBy('timestamp'),
    []
  );

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [episodes, isProcessing]);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = 0; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
        }
        setInput(transcript);
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      if (recognitionRef.current) {
        setInput('');
        recognitionRef.current.start();
        setIsListening(true);
      } else {
        alert("Speech Recognition API is not supported in this browser.");
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    }
    if (!input.trim() || isProcessing) return;
    
    const message = input.trim();
    setInput('');
    setIsProcessing(true);
    
    await processUserMessage(message);
    
    setIsProcessing(false);
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-300 font-mono text-sm">
      <div className="p-4 border-b border-slate-800/50 bg-slate-900/50 backdrop-blur flex justify-between items-center z-10 shadow-sm">
        <div className="flex items-center gap-3 text-emerald-500 font-bold tracking-widest">
          <div className="p-1.5 bg-emerald-500/10 rounded border border-emerald-500/20">
            <Cpu size={16} />
          </div>
          <span>TERMINAL // CHAT</span>
        </div>
        <div className="text-xs text-slate-500 flex items-center gap-1.5 bg-slate-900 px-2.5 py-1 rounded-full border border-slate-800">
          <Database size={12} className="text-blue-400" />
          <span>{episodes?.length || 0} EPISODES</span>
        </div>
      </div>
      
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scroll-smooth"
      >
        <AnimatePresence initial={false}>
          {episodes?.map(ep => (
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              key={ep.id} 
              className={`flex flex-col ${ep.type === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div className={`max-w-[85%] rounded-lg p-4 shadow-sm ${
                ep.type === 'user' 
                  ? 'bg-slate-800/80 text-slate-100 border border-slate-700/80 rounded-br-none' 
                  : 'bg-emerald-950/20 text-emerald-300 border border-emerald-900/40 rounded-bl-none shadow-[0_0_15px_rgba(16,185,129,0.03)]'
              }`}>
                <div className="text-xs opacity-50 mb-2 flex justify-between items-center font-bold tracking-wider">
                  <span className="flex items-center gap-1.5">
                    {ep.type === 'user' ? 'USER' : 'SENTINEL'}
                  </span>
                  <span className="ml-6 font-normal">{new Date(ep.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                </div>
                <div className="markdown-body prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-slate-900/80 prose-pre:border prose-pre:border-slate-800">
                  <Markdown>{ep.content}</Markdown>
                </div>
                
                {/* Transparency Metadata (Agent only) */}
                {ep.type === 'agent' && (
                   <div className="mt-4 pt-3 border-t border-emerald-900/30 text-[10px] text-emerald-600/70 flex gap-3 font-semibold tracking-widest">
                     <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> MEM: ACTIVE</span>
                     <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-fuchsia-500"></span> SKILLS: AUTO</span>
                   </div>
                )}
              </div>
            </motion.div>
          ))}
          {isProcessing && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start"
            >
              <div className="bg-emerald-950/20 text-emerald-400 border border-emerald-900/40 rounded-lg rounded-bl-none p-4 flex items-center gap-3">
                 <Loader2 size={16} className="animate-spin text-emerald-500" />
                 <span className="text-xs font-bold tracking-widest">PROCESSING SYNAPSE...</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="p-4 bg-slate-950 border-t border-slate-800/50 relative z-10">
        
        {/* Cognitive Mirror HUD */}
        <AnimatePresence>
          {(isAnalyzing || analysis) && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute bottom-full left-0 right-0 p-4 pb-2 z-20 pointer-events-none"
            >
              <div className="max-w-4xl mx-auto flex justify-end">
                <div className="bg-slate-900/90 backdrop-blur-md border border-fuchsia-500/30 rounded-lg p-4 shadow-xl shadow-fuchsia-900/10 max-w-sm pointer-events-auto">
                  {isAnalyzing ? (
                    <div className="flex items-center gap-3 text-fuchsia-400 text-xs font-bold tracking-widest">
                      <Sparkles size={14} className="animate-pulse" />
                      <span>ANALYZING COGNITIVE STATE...</span>
                    </div>
                  ) : analysis ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-4 border-b border-slate-800 pb-2">
                        <div className="flex items-center gap-2 text-fuchsia-400 font-bold tracking-widest text-[10px] uppercase">
                          <Brain size={14} /> EMPATHIC MIRROR
                        </div>
                        <div className="text-[10px] text-slate-400 italic">
                          {analysis.sentiment}
                        </div>
                      </div>
                      
                      {analysis.distortions.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {analysis.distortions.map((d, i) => (
                            <span key={i} className="flex items-center gap-1 text-[10px] bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
                              <AlertTriangle size={10} /> {d}
                            </span>
                          ))}
                        </div>
                      )}
                      
                      <div className="text-xs text-slate-300 leading-relaxed italic border-l-2 border-fuchsia-500/50 pl-3 py-1">
                        "{analysis.reframing}"
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleSubmit} className="flex gap-3 max-w-4xl mx-auto">
          <button
            type="button"
            onClick={toggleListening}
            className={`p-3 rounded-lg flex items-center justify-center transition-all ${
              isListening 
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/50 shadow-[0_0_15px_rgba(244,63,94,0.3)] animate-pulse' 
                : 'bg-slate-900 border border-slate-700/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            {isListening ? <Mic size={20} /> : <MicOff size={20} />}
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isProcessing}
            placeholder={isListening ? "Listening..." : "Initialize command or query sequence..."}
            className="flex-1 bg-slate-900 border border-slate-700/80 rounded-lg px-4 py-3 focus:outline-none focus:border-emerald-500/70 focus:ring-1 focus:ring-emerald-500/50 text-slate-200 placeholder-slate-600 disabled:opacity-50 transition-all shadow-inner"
          />
          <button 
            type="submit" 
            disabled={isProcessing || !input.trim()}
            className="bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500/50 rounded-lg px-5 py-3 flex items-center justify-center disabled:opacity-50 transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)] hover:shadow-[0_0_20px_rgba(16,185,129,0.4)]"
          >
            <Send size={18} className={isProcessing ? "opacity-50" : ""} />
          </button>
        </form>
      </div>
    </div>
  );
}
