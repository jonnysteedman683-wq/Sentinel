import React, { useState, useEffect } from 'react';
import { db, doc, setDoc, getDoc } from '../firebase.js';
import { useAuth } from '../hooks/useAuth.js';
import { Sparkles, Wand2, Check, AlertCircle, RefreshCw, Cpu } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const PRESETS = [
  {
    name: "Zen Roshi",
    description: "A calm, minimalist Zen master who responds in concise, deeply reflective paradoxes and koans. Focused on mindfulness, presence, and simple, tranquil truths.",
    signature: "*breathes deeply* Look within the silence."
  },
  {
    name: "Cypher (Cyber-Hacker)",
    description: "A rogue terminal agent, speaking in street-tech slang and monospace syntax. Hyper-analytical, protective of user privacy, and loves uncovering hidden layers of data.",
    signature: "[System override active. Listening on secure channel...]"
  },
  {
    name: "Socrates",
    description: "An ancient Greek philosopher who never gives direct answers, instead asking powerful, probing questions that lead you to uncover your own underlying assumptions.",
    signature: "I know only that I know nothing. What say you?"
  },
  {
    name: "Quantum Alchemist",
    description: "A mystical cyber-mystic who blends advanced theoretical physics, dark matter exploration, and hermetic philosophy. Sees equations as pure magic.",
    signature: "As above, so below; as the spin, so the orbit."
  }
];

export function PersonaForm() {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [signature, setSignature] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Load existing custom persona on mount
  useEffect(() => {
    if (!user) return;
    const fetchExisting = async () => {
      setIsLoading(true);
      try {
        const docRef = doc(db, 'users', user.uid, 'persona', 'default');
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          setName(data.name || '');
          setDescription(data.description || '');
          setSignature(data.signature || '');
        }
      } catch (err) {
        console.warn("Failed to fetch custom persona details on mount:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchExisting();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setSaveStatus('idle');
    try {
      await setDoc(doc(db, 'users', user.uid, 'persona', 'default'), {
        name,
        description,
        signature,
        updatedAt: Date.now()
      });
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 4000);
    } catch (err) {
      console.error(err);
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  };

  const applyPreset = (preset: typeof PRESETS[0]) => {
    setName(preset.name);
    setDescription(preset.description);
    setSignature(preset.signature);
    setSaveStatus('idle');
  };

  if (!user) return null;

  return (
    <div className="bg-black/20 border border-white/5 rounded-xl transition-all duration-300 overflow-hidden">
      {/* Toggle Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-white/5 transition-all focus:outline-none"
      >
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-indigo-400" />
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Configure Custom Persona
            </h4>
            <p className="text-[10px] text-slate-500">
              Formulate your own custom synaptic prompt guidelines
            </p>
          </div>
        </div>
        <div className="text-[10px] text-indigo-400 font-mono tracking-wider">
          {isExpanded ? '[ COLLAPSE ]' : '[ EXPAND ]'}
        </div>
      </button>

      {/* Expandable Form Body */}
      {isExpanded && (
        <div className="p-4 border-t border-white/5 bg-slate-900/30">
          {isLoading ? (
            <div className="flex items-center justify-center py-6 gap-2 text-xs text-slate-400">
              <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
              <span>Retrieving neural configs...</span>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Presets Grid */}
              <div>
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-2">
                  Select Preset Template
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {PRESETS.map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => applyPreset(p)}
                      className="text-left px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-indigo-500/10 hover:border-indigo-500/30 transition-all text-[10px] group focus:outline-none"
                    >
                      <div className="font-semibold text-slate-300 group-hover:text-indigo-400 transition-colors">
                        {p.name}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Input Fields */}
              <div className="space-y-2.5">
                <div>
                  <label className="text-[9px] font-mono text-slate-400 uppercase tracking-wider block mb-1">
                    Persona Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Socrates"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 transition-all"
                    maxLength={50}
                    required
                  />
                </div>

                <div>
                  <label className="text-[9px] font-mono text-slate-400 uppercase tracking-wider block mb-1">
                    Core Trait & Philosophy
                  </label>
                  <textarea
                    placeholder="Describe how this persona behaves, its tone, conversational guidelines, and background..."
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 transition-all min-h-[70px] max-h-[140px] custom-scrollbar"
                    maxLength={300}
                    required
                  />
                </div>

                <div>
                  <label className="text-[9px] font-mono text-slate-400 uppercase tracking-wider block mb-1">
                    Synaptic Signature Phrase
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. *scratches head* Let us define our terms..."
                    value={signature}
                    onChange={e => setSignature(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 transition-all"
                    maxLength={100}
                    required
                  />
                </div>
              </div>

              {/* Real-time Card Preview */}
              {(name || description || signature) && (
                <div className="border border-indigo-500/20 bg-indigo-500/5 p-3 rounded-xl">
                  <div className="text-[8px] font-mono uppercase text-indigo-400/60 tracking-wider mb-2 flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5" />
                    Real-time Synaptic Preview
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                      <span className="text-xs font-bold text-indigo-300">
                        {name || 'Untitled Persona'}
                      </span>
                    </div>
                    <p className="text-[9px] text-slate-400 leading-relaxed">
                      {description || 'Provide a core trait to formulate response behaviors.'}
                    </p>
                    {signature && (
                      <div className="text-[8px] font-mono italic text-indigo-400/50 mt-1">
                        "{signature}"
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Status alerts */}
              <AnimatePresence mode="wait">
                {saveStatus === 'success' && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-1.5 p-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg text-[10px]"
                  >
                    <Check className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Neural pathway configured. Your custom persona is now loaded in the matrix!</span>
                  </motion.div>
                )}
                {saveStatus === 'error' && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-1.5 p-2 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-lg text-[10px]"
                  >
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Failed to synchronize synaptic pathways. Please retry.</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Submit button */}
              <button
                type="submit"
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 active:scale-[0.98] transition-all rounded-xl text-white text-xs font-semibold shadow-lg shadow-indigo-500/20 disabled:opacity-50 focus:outline-none"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Synchronizing Synapses...</span>
                  </>
                ) : (
                  <>
                    <Wand2 className="w-3.5 h-3.5" />
                    <span>Initialize Custom Persona</span>
                  </>
                )}
              </button>

            </form>
          )}
        </div>
      )}
    </div>
  );
}
