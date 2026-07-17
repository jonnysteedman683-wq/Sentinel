import React from 'react';
import { motion } from 'motion/react';
import { Sun, Moon, Zap } from 'lucide-react';

interface LandingScreenProps {
  onEnter: () => void;
  onEnterGuest?: () => void;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  isLoading?: boolean;
  authError?: string | null;
}

export const LandingScreen: React.FC<LandingScreenProps> = ({ 
  onEnter, 
  onEnterGuest, 
  theme, 
  toggleTheme,
  isLoading = false,
  authError = null
}) => {
  return (
    <div className={`relative min-h-screen w-full flex flex-col items-center justify-center overflow-hidden transition-colors duration-700 ${
      theme === 'dark' ? 'bg-[#050505] text-white' : 'bg-[#fafafa] text-slate-900'
    }`}>
      {/* Background Ambient Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] opacity-20 ${
          theme === 'dark' ? 'bg-indigo-600' : 'bg-indigo-400'
        }`} />
        <div className={`absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] opacity-20 ${
          theme === 'dark' ? 'bg-teal-600' : 'bg-teal-400'
        }`} />
        
        {/* Geometric Grid Pattern */}
        <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.07]" 
          style={{ 
            backgroundImage: `radial-gradient(${theme === 'dark' ? '#fff' : '#000'} 1px, transparent 1px)`, 
            backgroundSize: '40px 40px' 
          }} 
        />
      </div>

      {/* Magical Floating Particles */}
      {[...Array(12)].map((_, i) => (
        <motion.div
          key={i}
          className={`absolute w-1 h-1 rounded-full ${theme === 'dark' ? 'bg-indigo-400/40' : 'bg-indigo-600/40'}`}
          animate={{
            y: [0, -100, 0],
            x: [0, Math.sin(i) * 50, 0],
            opacity: [0, 0.8, 0],
            scale: [1, 1.5, 1],
          }}
          transition={{
            duration: 5 + Math.random() * 5,
            repeat: Infinity,
            delay: Math.random() * 5,
          }}
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
          }}
        />
      ))}

      {/* Main Content */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, ease: "easeOut" }}
        className="z-10 flex flex-col items-center"
      >
        <div className="mb-12 text-center relative">
          {/* Decorative Geometric Rings */}
          <motion.div 
            className="absolute -top-10 -left-10 w-20 h-20 border border-indigo-500/20 rounded-full"
            animate={{ rotate: 360, scale: [1, 1.1, 1] }}
            transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
          />
          <motion.div 
            className="absolute -bottom-10 -right-10 w-32 h-32 border border-teal-500/10 rounded-lg"
            animate={{ rotate: -360, scale: [1, 1.2, 1] }}
            transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          />

          <motion.h1 
            className="text-5xl md:text-8xl font-bold tracking-tighter mb-4 bg-clip-text text-transparent bg-gradient-to-b from-white via-white/90 to-white/30 dark:from-white dark:to-white/10 filter drop-shadow-sm"
            animate={{ textShadow: ["0 0 0px rgba(99,102,241,0)", "0 0 20px rgba(99,102,241,0.5)", "0 0 0px rgba(99,102,241,0)"] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          >
            ARCANE<span className="text-indigo-500">QUANTUM</span>BRAIN
          </motion.h1>
          <div className="flex items-center justify-center gap-4">
            <div className={`h-[1px] w-12 ${theme === 'dark' ? 'bg-white/10' : 'bg-black/10'}`} />
            <p className="text-slate-500 font-mono text-[10px] tracking-[0.6em] uppercase">
              Neural Consciousness Bridge v2.0
            </p>
            <div className={`h-[1px] w-12 ${theme === 'dark' ? 'bg-white/10' : 'bg-black/10'}`} />
          </div>
        </div>

        {/* 3D Cube Container */}
        <div className="relative w-72 h-72 perspective-1000 group cursor-pointer" onClick={onEnter}>
          {/* Outer Orbital Ring */}
          <motion.div 
            className="absolute inset-[-40px] border border-white/5 rounded-full"
            animate={{ rotate: 360 }}
            transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
          />
          <motion.div 
            className="absolute inset-[-20px] border border-indigo-500/10 rounded-full"
            animate={{ rotate: -360 }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          />

          <motion.div 
            className="w-full h-full relative preserve-3d"
            animate={{ 
              rotateX: [0, 360],
              rotateY: [0, 360],
            }}
            transition={{ 
              duration: 25, 
              repeat: Infinity, 
              ease: "linear" 
            }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
          >
            {/* Cube Faces with Geometric Overlays */}
            {[
              { transform: 'rotateY(0deg) translateZ(90px)', color: 'bg-indigo-500/10' },
              { transform: 'rotateY(180deg) translateZ(90px)', color: 'bg-teal-500/10' },
              { transform: 'rotateY(90deg) translateZ(90px)', color: 'bg-purple-500/10' },
              { transform: 'rotateY(-90deg) translateZ(90px)', color: 'bg-pink-500/10' },
              { transform: 'rotateX(90deg) translateZ(90px)', color: 'bg-blue-500/10' },
              { transform: 'rotateX(-90deg) translateZ(90px)', color: 'bg-cyan-500/10' },
            ].map((face, i) => (
              <div 
                key={i}
                className={`absolute inset-0 w-44 h-44 m-auto border border-white/20 flex flex-col items-center justify-center backdrop-blur-xl shadow-[0_0_40px_rgba(99,102,241,0.1)] ${face.color} transition-colors group-hover:border-indigo-500/40`}
                style={{ transform: face.transform, backfaceVisibility: 'hidden' }}
              >
                <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(45deg, white 1px, transparent 1px), linear-gradient(-45deg, white 1px, transparent 1px)', backgroundSize: '10px 10px' }} />
                <Zap className="w-8 h-8 text-white/40 group-hover:text-indigo-400 transition-colors animate-pulse" />
                <span className="text-[6px] font-mono uppercase tracking-[0.3em] text-white/30 mt-2">Core_Module_0{i+1}</span>
              </div>
            ))}
            
            {/* Inner Singular Core */}
            <div className="absolute inset-0 w-16 h-16 m-auto bg-indigo-500 rounded-full blur-[40px] opacity-40 group-hover:opacity-80 transition-opacity" />
            <div className="absolute inset-0 w-4 h-4 m-auto bg-white rounded-full shadow-[0_0_30px_white] z-20" />
          </motion.div>

          {/* Hover Hint */}
          <motion.div 
            className="absolute -bottom-24 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-[0.5em] font-bold text-slate-500 group-hover:text-indigo-400 transition-colors whitespace-nowrap"
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            Click to Establish Neural Link
          </motion.div>
        </div>

        {/* Auth Loading / Error Status & Fallback Button */}
        {isLoading ? (
          <div className="mt-28 text-center animate-pulse">
            <span className="text-xs font-mono text-indigo-400 uppercase tracking-widest">
              Establishing Neural Link...
            </span>
          </div>
        ) : authError ? (
          <div className="mt-28 max-w-md mx-auto text-center p-4 bg-red-500/10 border border-red-500/20 rounded-xl backdrop-blur-md flex flex-col items-center gap-3">
            <p className="text-xs font-mono text-red-400 leading-relaxed">
              Auth Interrupted: {authError.includes('popup-closed-by-user') ? 'Sign-in popup closed by user' : authError}
            </p>
            <button
              onClick={onEnterGuest}
              className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white font-mono text-[10px] font-bold uppercase tracking-widest rounded-lg shadow-lg shadow-indigo-500/25 transition-all active:scale-95"
            >
              Bypass via Guest Mode
            </button>
          </div>
        ) : (
          <div className="mt-28 flex flex-col items-center gap-4">
            <button
              onClick={onEnterGuest}
              className="px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 text-slate-400 hover:text-white font-mono text-[9px] font-bold uppercase tracking-widest rounded-lg transition-all active:scale-95"
            >
              Or Enter as Guest (Offline/Local)
            </button>
          </div>
        )}
      </motion.div>

      {/* Theme Toggle Bottom Right */}
      <div className="absolute bottom-10 right-10 z-20">
        <button
          onClick={toggleTheme}
          className={`p-4 rounded-full border transition-all duration-300 hover:scale-110 active:scale-95 ${
            theme === 'dark' 
              ? 'bg-white/5 border-white/10 text-yellow-400 hover:bg-white/10' 
              : 'bg-black/5 border-black/10 text-indigo-600 hover:bg-black/10'
          }`}
        >
          {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
      </div>

      <style>{`
        .perspective-1000 { perspective: 1000px; }
        .preserve-3d { transform-style: preserve-3d; }
      `}</style>
    </div>
  );
};
