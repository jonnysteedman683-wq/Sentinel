import React, { useState, useEffect, useRef } from 'react';
import { Film, Play, RotateCcw, ShieldAlert, Sparkles, MessageSquare, Zap, Cpu } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface DreamCinemaProps {
  theme?: 'dark' | 'light';
}

export default function DreamCinema({ theme = 'dark' }: DreamCinemaProps) {
  const [stage, setStage] = useState<'idle' | 'resonance' | 'clustering' | 'debate' | 'insight'>('idle');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameId = useRef<number | null>(null);

  // Stage 3 (Debate) simulation logs
  const [debateIndex, setDebateIndex] = useState(0);
  const debateTurns = [
    { agent: 'Logician', msg: "Synthesizing recent short-term memories. We see recurring references to autonomic code generation. This indicates a high priority on self-evolution loops." },
    { agent: 'Critic', msg: "I object. Over-indexing on self-evolution could lead to infinite logic loops or compilation regression. We must enforce strict verification gates." },
    { agent: 'Logician', msg: "Understood. The solution is to introduce a secondary verification parser. This balances optimization with safety." },
    { agent: 'Critic', msg: "Agreed. Integrating verification gate parameters into the primary schema resolves the paradox." }
  ];

  // Start Cinema loop
  const startReplay = () => {
    setStage('resonance');
    setDebateIndex(0);
  };

  // Canvas animation loop for Stages 1 & 2
  useEffect(() => {
    if (stage === 'idle') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = canvas.offsetWidth);
    let height = (canvas.height = canvas.offsetHeight);
    let time = 0;

    // Stage 2 variables
    const particles: { x: number; y: number; tx: number; ty: number; color: string }[] = [];
    const targets = [
      { x: width * 0.3, y: height * 0.5, color: '#22d3ee' },
      { x: width * 0.5, y: height * 0.4, color: '#a855f7' },
      { x: width * 0.7, y: height * 0.5, color: '#6366f1' }
    ];

    for (let i = 0; i < 150; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        tx: targets[i % 3].x + (Math.random() - 0.5) * 80,
        ty: targets[i % 3].y + (Math.random() - 0.5) * 80,
        color: targets[i % 3].color
      });
    }

    const animate = () => {
      ctx.clearRect(0, 0, width, height);

      if (stage === 'resonance') {
        // Stage 1: Liquid waves
        time += 0.05;
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.4)';
        ctx.lineWidth = 2;

        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          for (let x = 0; x < width; x++) {
            const y = height / 2 + Math.sin(x * 0.01 + time + i) * 50 * Math.sin(time * 0.2);
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      } else if (stage === 'clustering') {
        // Stage 2: Particles clustering
        particles.forEach(p => {
          p.x += (p.tx - p.x) * 0.03;
          p.y += (p.ty - p.y) * 0.03;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
          ctx.fill();
        });

        // Draw connections inside clusters
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 0.5;
        for (let i = 0; i < particles.length; i++) {
          for (let j = i + 1; j < particles.length; j++) {
            const dist = Math.hypot(particles[i].x - particles[j].x, particles[i].y - particles[j].y);
            if (dist < 40) {
              ctx.beginPath();
              ctx.moveTo(particles[i].x, particles[i].y);
              ctx.lineTo(particles[j].x, particles[j].y);
              ctx.stroke();
            }
          }
        }
      }

      animationFrameId.current = requestAnimationFrame(animate);
    };

    animate();

    // Auto-advance stages
    let timer: NodeJS.Timeout;
    if (stage === 'resonance') {
      timer = setTimeout(() => setStage('clustering'), 4000);
    } else if (stage === 'clustering') {
      timer = setTimeout(() => setStage('debate'), 4000);
    }

    return () => {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
      clearTimeout(timer);
    };
  }, [stage]);

  // Stage 3: Debate auto-advance
  useEffect(() => {
    if (stage !== 'debate') return;
    if (debateIndex >= debateTurns.length - 1) {
      const timer = setTimeout(() => setStage('insight'), 5000);
      return () => clearTimeout(timer);
    }

    const timer = setTimeout(() => {
      setDebateIndex(prev => prev + 1);
    }, 4000);

    return () => clearTimeout(timer);
  }, [stage, debateIndex]);

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-200 font-sans p-6 overflow-hidden">
      <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-4 shrink-0">
        <div>
          <h2 className="text-xl font-light tracking-wide text-white flex items-center gap-2">
            <Film className="w-5 h-5 text-indigo-400" />
            Dream Replay Cinema
          </h2>
          <p className="text-xs text-slate-400 mt-1">Replay the simulated subconscious dream consolidation process.</p>
        </div>
        <div className="flex gap-2">
          {stage !== 'idle' && (
            <button 
              onClick={() => setStage('idle')}
              className="px-4 py-2 border border-white/10 rounded-lg hover:bg-white/5 transition-all text-xs font-semibold flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Stop
            </button>
          )}
          <button 
            onClick={startReplay}
            className="px-4 py-2 bg-indigo-500/20 text-indigo-300 border border-indigo-500/50 rounded-lg hover:bg-indigo-500/30 transition-all text-xs font-semibold flex items-center gap-1.5"
          >
            <Play className="w-3.5 h-3.5" /> {stage === 'idle' ? 'Begin Dream Replay' : 'Restart Replay'}
          </button>
        </div>
      </div>

      <div className="flex-1 bg-black/60 border border-white/10 rounded-2xl relative overflow-hidden flex flex-col items-center justify-center">
        {stage === 'idle' && (
          <div className="flex flex-col items-center gap-3 opacity-60">
            <Film className="w-16 h-16 text-slate-600 animate-pulse" />
            <p className="text-sm">Cinema Deck Offline</p>
            <button 
              onClick={startReplay}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold mt-2"
            >
              Start Projection
            </button>
          </div>
        )}

        {(stage === 'resonance' || stage === 'clustering') && (
          <div className="w-full h-full relative">
            <canvas ref={canvasRef} className="w-full h-full" />
            <div className="absolute bottom-6 left-6 bg-slate-900/90 border border-white/10 px-4 py-2 rounded-xl backdrop-blur-md">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                {stage === 'resonance' ? 'Stage I: Liquid State Resonance (Subconscious Oscillations)' : 'Stage II: Synaptic Clustering (Hebbian Reinforcement)'}
              </span>
            </div>
          </div>
        )}

        {stage === 'debate' && (
          <div className="w-full h-full max-w-2xl flex flex-col justify-center gap-4 px-6 overflow-y-auto">
            <h3 className="text-xs font-bold uppercase tracking-wider text-teal-400 mb-2 flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4" /> Stage III: Adversarial Dialectic Debate
            </h3>
            <div className="space-y-4">
              {debateTurns.slice(0, debateIndex + 1).map((turn, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-4 rounded-xl border ${turn.agent === 'Logician' ? 'border-teal-500/20 bg-teal-500/5' : 'border-pink-500/20 bg-pink-500/5'}`}
                >
                  <span className={`text-xs font-bold uppercase tracking-wider block mb-1 ${turn.agent === 'Logician' ? 'text-teal-400' : 'text-pink-400'}`}>
                    [{turn.agent}]
                  </span>
                  <p className="text-sm font-light leading-relaxed">{turn.msg}</p>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {stage === 'insight' && (
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="p-6 rounded-2xl border border-amber-500/40 bg-amber-500/10 max-w-md shadow-2xl shadow-amber-500/5 text-center flex flex-col items-center gap-4"
          >
            <div className="w-12 h-12 bg-amber-500/20 border border-amber-500/40 rounded-full flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-amber-400 block mb-1">Stage IV: Insight Condensation</span>
              <h4 className="text-lg font-light text-white leading-snug">
                "Subconscious consolidation finalized: verified self-evolution loops via structured gating schemas."
              </h4>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              This synthesis has been committed to long-term memory. Synaptic strength boosted by Hebbian coefficient.
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
