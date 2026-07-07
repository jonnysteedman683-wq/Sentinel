import React, { useState } from 'react';
import { Settings, Key, PaintBucket, HardDrive, Shield, AlertCircle, Save } from 'lucide-react';
import { motion } from 'motion/react';

export function SettingsPanel() {
  const [geminiKey, setGeminiKey] = useState('************************');
  const [isEditingKey, setIsEditingKey] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    setIsEditingKey(false);
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-300 font-sans relative overflow-hidden">
      <div className="p-4 md:p-6 border-b border-slate-800/50 bg-slate-900/50 backdrop-blur flex justify-between items-center z-10 shadow-sm relative">
        <div className="flex items-center gap-3 text-slate-400 font-bold tracking-[0.2em] uppercase">
          <div className="p-1.5 bg-slate-800 rounded-lg border border-slate-700 shadow-sm">
            <Settings size={18} />
          </div>
          <span className="font-display text-lg">System Configuration</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 scroll-smooth">
        <div className="max-w-4xl mx-auto space-y-8">
          
          <motion.section 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 md:p-8 shadow-inner"
          >
            <h3 className="text-sm font-bold text-slate-400 mb-6 tracking-widest flex items-center gap-2 uppercase border-b border-slate-800/50 pb-4">
              <Key size={16} className="text-amber-500" /> API Credentials
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold tracking-widest text-slate-500 mb-2 uppercase">Gemini API Key</label>
                <div className="flex gap-3">
                  <input 
                    type={isEditingKey ? "text" : "password"}
                    value={geminiKey}
                    onChange={(e) => setGeminiKey(e.target.value)}
                    disabled={!isEditingKey}
                    className="flex-1 bg-slate-950 border border-slate-700/80 rounded-lg px-4 py-3 focus:outline-none focus:border-emerald-500/70 focus:ring-1 focus:ring-emerald-500/50 text-slate-200 font-mono text-sm disabled:opacity-50 disabled:bg-slate-900/50 shadow-inner transition-all"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-bold tracking-widest text-slate-500 mb-2 uppercase">OpenAI API Key</label>
                <div className="flex gap-3">
                  <input 
                    type={isEditingKey ? "text" : "password"}
                    defaultValue="************************"
                    disabled={!isEditingKey}
                    className="flex-1 bg-slate-950 border border-slate-700/80 rounded-lg px-4 py-3 focus:outline-none focus:border-emerald-500/70 focus:ring-1 focus:ring-emerald-500/50 text-slate-200 font-mono text-sm disabled:opacity-50 disabled:bg-slate-900/50 shadow-inner transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold tracking-widest text-slate-500 mb-2 uppercase">Anthropic API Key</label>
                <div className="flex gap-3">
                  <input 
                    type={isEditingKey ? "text" : "password"}
                    defaultValue="************************"
                    disabled={!isEditingKey}
                    className="flex-1 bg-slate-950 border border-slate-700/80 rounded-lg px-4 py-3 focus:outline-none focus:border-emerald-500/70 focus:ring-1 focus:ring-emerald-500/50 text-slate-200 font-mono text-sm disabled:opacity-50 disabled:bg-slate-900/50 shadow-inner transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold tracking-widest text-slate-500 mb-2 uppercase">OpenRouter API Key</label>
                <div className="flex gap-3">
                  <input 
                    type={isEditingKey ? "text" : "password"}
                    defaultValue="************************"
                    disabled={!isEditingKey}
                    className="flex-1 bg-slate-950 border border-slate-700/80 rounded-lg px-4 py-3 focus:outline-none focus:border-emerald-500/70 focus:ring-1 focus:ring-emerald-500/50 text-slate-200 font-mono text-sm disabled:opacity-50 disabled:bg-slate-900/50 shadow-inner transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold tracking-widest text-slate-500 mb-2 uppercase">Groq API Key</label>
                <div className="flex gap-3 flex-col sm:flex-row">
                  <input 
                    type={isEditingKey ? "text" : "password"}
                    defaultValue="************************"
                    disabled={!isEditingKey}
                    className="flex-1 bg-slate-950 border border-slate-700/80 rounded-lg px-4 py-3 focus:outline-none focus:border-emerald-500/70 focus:ring-1 focus:ring-emerald-500/50 text-slate-200 font-mono text-sm disabled:opacity-50 disabled:bg-slate-900/50 shadow-inner transition-all"
                  />
                  
                  {isEditingKey ? (
                    <button 
                      onClick={handleSave}
                      className="bg-emerald-600/90 hover:bg-emerald-500 text-white px-6 py-3 rounded-lg font-bold tracking-widest text-xs flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.2)] transition-all"
                    >
                      <Save size={16} /> SAVE
                    </button>
                  ) : (
                    <button 
                      onClick={() => setIsEditingKey(true)}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-6 py-3 rounded-lg font-bold tracking-widest text-xs transition-all"
                    >
                      EDIT
                    </button>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-2 flex items-center gap-1.5">
                  <AlertCircle size={12} /> Stored securely in server environment variables.
                </p>
              </div>
            </div>
          </motion.section>

          <motion.section 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 md:p-8 shadow-inner"
          >
            <h3 className="text-sm font-bold text-slate-400 mb-6 tracking-widest flex items-center gap-2 uppercase border-b border-slate-800/50 pb-4">
              <HardDrive size={16} className="text-blue-400" /> Database & Storage
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-5">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-xs font-bold tracking-widest text-slate-300">LOCAL STORAGE</span>
                  <span className="text-[10px] font-bold tracking-widest bg-emerald-950/50 text-emerald-500 border border-emerald-900/50 px-2 py-1 rounded">HEALTHY</span>
                </div>
                <div className="text-2xl font-display font-bold text-white mb-1">IndexedDB</div>
                <div className="text-xs text-slate-500">Storing Episodes, Semantics, Skills</div>
                <div className="mt-4 flex gap-2">
                  <button className="bg-slate-800 hover:bg-rose-900/50 text-slate-400 hover:text-rose-400 hover:border-rose-900/50 border border-slate-700 px-4 py-2 rounded-lg text-xs font-bold tracking-widest transition-all">CLEAR CACHE</button>
                </div>
              </div>
              <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-5 opacity-50 cursor-not-allowed relative">
                <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 backdrop-blur-[1px] z-10 rounded-xl">
                  <span className="text-xs font-bold tracking-widest text-slate-500 border border-slate-700 bg-slate-900 px-3 py-1.5 rounded-lg flex items-center gap-2">
                    <Shield size={14} /> CLOUD SYNC DISABLED
                  </span>
                </div>
                <div className="flex justify-between items-center mb-4">
                  <span className="text-xs font-bold tracking-widest text-slate-300">CLOUD SYNC</span>
                </div>
                <div className="text-2xl font-display font-bold text-white mb-1">Firestore</div>
                <div className="text-xs text-slate-500">Remote persistence layer</div>
              </div>
            </div>
          </motion.section>

          <motion.section 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 md:p-8 shadow-inner"
          >
            <h3 className="text-sm font-bold text-slate-400 mb-6 tracking-widest flex items-center gap-2 uppercase border-b border-slate-800/50 pb-4">
              <PaintBucket size={16} className="text-fuchsia-400" /> Interface Preferences
            </h3>
            
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-slate-300 mb-1">Neon Styling</div>
                  <div className="text-xs text-slate-500">Toggle intensive glow effects and ambient backgrounds</div>
                </div>
                <div className="w-12 h-6 bg-emerald-500/20 border border-emerald-500/50 rounded-full relative cursor-pointer">
                  <div className="absolute right-1 top-1 bottom-1 w-4 bg-emerald-400 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.8)]"></div>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-slate-300 mb-1">Motion Reduction</div>
                  <div className="text-xs text-slate-500">Minimize animations and transitions</div>
                </div>
                <div className="w-12 h-6 bg-slate-800 border border-slate-700 rounded-full relative cursor-pointer">
                  <div className="absolute left-1 top-1 bottom-1 w-4 bg-slate-500 rounded-full"></div>
                </div>
              </div>
            </div>
          </motion.section>

        </div>
      </div>
      
      {/* Toast Notification */}
      <motion.div 
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: saved ? 1 : 0, y: saved ? 0 : 50 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-emerald-950/80 border border-emerald-500/50 text-emerald-400 px-6 py-3 rounded-full text-sm font-bold tracking-widest shadow-[0_0_20px_rgba(16,185,129,0.2)] backdrop-blur-md flex items-center gap-2"
      >
        <Save size={16} /> SETTINGS SAVED
      </motion.div>
    </div>
  );
}
