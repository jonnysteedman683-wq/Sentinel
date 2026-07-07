import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Moon, Sparkles, Loader2, Save, X } from 'lucide-react';
import { db } from './db';
import { recordEpisode } from './memory';
import { getGeminiClient } from './geminiClient';

interface DreamAnalysis {
  title: string;
  coreConcept: string;
  metaphor: string;
  actionable: string;
  svg: string;
}

export function DreamcatcherPanel() {
  const [isActive, setIsActive] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [analysis, setAnalysis] = useState<DreamAnalysis | null>(null);
  
  const recognitionRef = useRef<any>(null);
  const aiClientRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const [volume, setVolume] = useState(0);
  const requestRef = useRef<number>(0);

  useEffect(() => {
    aiClientRef.current = getGeminiClient();
  }, []);

  const updateVolume = () => {
    if (analyserRef.current && dataArrayRef.current) {
      analyserRef.current.getByteFrequencyData(dataArrayRef.current);
      let sum = 0;
      for (let i = 0; i < dataArrayRef.current.length; i++) {
        sum += dataArrayRef.current[i];
      }
      const avg = sum / dataArrayRef.current.length;
      setVolume(avg);
    }
    requestRef.current = requestAnimationFrame(updateVolume);
  };

  const startListening = async () => {
    try {
      // Audio visualization setup
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      analyserRef.current.fftSize = 256;
      dataArrayRef.current = new Uint8Array(analyserRef.current.frequencyBinCount);
      updateVolume();

      // Speech recognition setup
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        
        recognition.onresult = (event: any) => {
          let final = '';
          let interim = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              final += event.results[i][0].transcript + ' ';
            } else {
              interim += event.results[i][0].transcript;
            }
          }
          setTranscript(prev => prev + final + interim);
        };
        
        recognition.onerror = (e: any) => console.error("Speech error", e.error);
        recognition.start();
        recognitionRef.current = recognition;
        setIsActive(true);
        setTranscript('');
        setAnalysis(null);
      } else {
        alert("Speech Recognition API not supported.");
      }
    } catch (err) {
      console.error("Failed to access microphone", err);
    }
  };

  const stopListening = async () => {
    setIsActive(false);
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    setVolume(0);

    if (transcript.length > 20) {
      processDream(transcript);
    }
  };

  const processDream = async (text: string) => {
    setIsProcessing(true);
    try {
      const prompt = `You are the Dreamcatcher. The user has spoken a fragmented, stream-of-consciousness thought while in a hypnagogic (half-asleep) state.
Reconstruct this chaotic input into a structured concept note. Extract the brilliance hidden in the fragments.
Respond strictly in JSON format matching this structure exactly:
{
  "title": "A short, poetic title",
  "coreConcept": "A clear, 2-sentence explanation of the core idea",
  "metaphor": "A beautiful metaphor that grounds the concept",
  "actionable": "One tangible step to take when fully awake",
  "svg": "A raw SVG string (starts with <svg> and ends with </svg>) illustrating the concept. Use viewBox='0 0 100 100', sleek minimalist geometry, stroke='currentColor', fill='none', and subtle opacity. Do NOT include markdown blocks for the SVG, just the raw string inside the JSON value."
}

User's fragmented thought: "${text}"`;

      const response = await aiClientRef.current.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      });

      const match = response.text.match(/\{[\s\S]*\}/);
      if (match) {
        const result = JSON.parse(match[0]) as DreamAnalysis;
        setAnalysis(result);
        
        // Save to memory
        await recordEpisode('system', `Dreamcatcher Concept: ${result.title}\n\nConcept: ${result.coreConcept}\nMetaphor: ${result.metaphor}\nAction: ${result.actionable}`, ['dream', 'insight']);
      }
    } catch (err) {
      console.error("Dream processing failed:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-300 relative overflow-hidden font-mono">
      {/* Dynamic ambient background */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/50 via-slate-950 to-fuchsia-900/30"></div>
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20 mix-blend-overlay"></div>
      </div>

      <div className="p-6 border-b border-white/5 relative z-10 flex justify-between items-center">
        <div className="flex items-center gap-3 text-indigo-400 font-bold tracking-widest">
          <Moon size={18} />
          <span>DREAMCATCHER // HYPNAGOGIC CAPTURE</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6 relative z-10">
        
        {!analysis && !isProcessing && (
          <div className="flex flex-col items-center max-w-2xl text-center">
            <motion.div 
              animate={{ 
                scale: isActive ? [1, 1 + (volume / 100), 1] : 1,
                boxShadow: isActive 
                  ? [`0 0 20px rgba(99,102,241,0.2)`, `0 0 ${40 + volume}px rgba(99,102,241,0.6)`, `0 0 20px rgba(99,102,241,0.2)`]
                  : '0 0 0px rgba(0,0,0,0)'
              }}
              transition={{ duration: 0.1, ease: "linear" }}
              className="w-32 h-32 rounded-full border border-indigo-500/30 flex items-center justify-center cursor-pointer bg-slate-900 hover:bg-slate-800 transition-colors"
              onClick={isActive ? stopListening : startListening}
            >
              <Moon size={40} className={isActive ? "text-indigo-400" : "text-slate-600"} />
            </motion.div>
            
            <div className="mt-8">
              <h2 className="text-xl font-bold text-slate-200 tracking-widest mb-2 uppercase">
                {isActive ? "Listening to the void..." : "Enter Dream State"}
              </h2>
              <p className="text-sm text-slate-500 max-w-md leading-relaxed">
                Whisper your fragmented thoughts. The Dreamcatcher will weave them into a structured concept note when you awaken.
              </p>
            </div>

            {isActive && transcript && (
              <div className="mt-8 p-4 bg-slate-900/50 border border-indigo-500/20 rounded-xl max-w-xl w-full">
                <p className="text-xs text-indigo-300/70 italic leading-loose text-left">
                  {transcript}...
                </p>
              </div>
            )}
          </div>
        )}

        {isProcessing && (
          <div className="flex flex-col items-center gap-6">
            <Loader2 size={40} className="text-fuchsia-500 animate-spin" />
            <div className="text-fuchsia-400 font-bold tracking-widest uppercase animate-pulse text-sm">
              Weaving fragments into coherence...
            </div>
          </div>
        )}

        <AnimatePresence>
          {analysis && !isProcessing && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full max-w-4xl bg-slate-900/80 backdrop-blur-xl border border-indigo-500/30 rounded-2xl p-8 shadow-2xl flex gap-8"
            >
              <div className="flex-1 space-y-6">
                <div>
                  <div className="text-xs text-fuchsia-400 font-bold tracking-widest uppercase mb-1">Concept Note</div>
                  <h2 className="text-3xl font-bold text-slate-100">{analysis.title}</h2>
                </div>
                
                <div className="space-y-4">
                  <div className="bg-slate-950/50 p-4 rounded-lg border border-slate-800">
                    <h3 className="text-[10px] text-slate-500 font-bold tracking-widest uppercase mb-2">Core Concept</h3>
                    <p className="text-sm text-slate-300 leading-relaxed">{analysis.coreConcept}</p>
                  </div>
                  
                  <div className="bg-indigo-950/20 p-4 rounded-lg border border-indigo-500/20">
                    <h3 className="text-[10px] text-indigo-400 font-bold tracking-widest uppercase mb-2">Metaphor</h3>
                    <p className="text-sm text-indigo-200/80 leading-relaxed italic">"{analysis.metaphor}"</p>
                  </div>
                  
                  <div className="bg-emerald-950/20 p-4 rounded-lg border border-emerald-500/20">
                    <h3 className="text-[10px] text-emerald-400 font-bold tracking-widest uppercase mb-2">Actionable Step</h3>
                    <p className="text-sm text-emerald-300 leading-relaxed">{analysis.actionable}</p>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button onClick={() => setAnalysis(null)} className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold tracking-widest uppercase transition-colors">
                    Close
                  </button>
                </div>
              </div>

              <div className="w-1/3 flex flex-col items-center justify-center bg-slate-950 rounded-xl border border-slate-800 p-6 relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/10 to-fuchsia-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div 
                  className="w-full aspect-square text-indigo-400"
                  dangerouslySetInnerHTML={{ __html: analysis.svg }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
