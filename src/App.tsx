import React, { useState, useEffect } from 'react';
import { auth } from './firebase';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';

import { SentinelProvider, useSentinel } from './SentinelContext';
import { db } from './db';
import { ChatPanel } from './ChatPanel';
import { SystemMetrics } from './SystemMetrics';
import { MemoryPanel } from './MemoryPanel';
import { SkillsPanel } from './SkillsPanel';
import { IdentityPanel } from './IdentityPanel';
import { AutonomyPanel } from './AutonomyPanel';
import { ExperimentsPanel } from './ExperimentsPanel';
import { NexusPanel } from './NexusPanel';
import { SettingsPanel } from './SettingsPanel';
import { ForgePanel } from './ForgePanel';
import { DebatePanel } from './DebatePanel';
import { OverwatchPanel } from './OverwatchPanel';
import { CampaignPanel } from './CampaignPanel';
import { DreamcatcherPanel } from './DreamcatcherPanel';
import { CommandPalette } from './CommandPalette';
import { Loader2, Cpu, Database, Brain, Terminal, Fingerprint, Activity, FlaskConical, Globe, Settings, Hammer, Users, Eye, Map, Zap, Archive, Trash2, X, CheckCircle2, AlertCircle, Info, Moon, Network, ChevronRight } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

import { ContextWeaverPanel } from './ContextWeaverPanel';import { AgentsPanel } from './AgentsPanel';
import BanditPanel from './BanditPanel';

type Tab = 'nexus' | 'chat' | 'bandit' | 'overwatch' | 'memory' | 'identity' | 'autonomy' | 'campaign' | 'forge' | 'debate' | 'skills' | 'experiments' | 'dreamcatcher' | 'settings' | 'weaver' | 'agents';

function SentinelDashboard() {
  const { isReady, toasts, removeToast, breadcrumbs, setBreadcrumbs } = useSentinel();
  const [activeTab, setActiveTab] = useState<Tab>('nexus');
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);



  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(open => !open);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!isReady) {
    return (
      <div className="min-h-screen bg-slate-950 text-emerald-500 flex items-center justify-center font-mono">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ repeat: Infinity, duration: 1, repeatType: 'reverse' }}
          className="flex items-center gap-3 tracking-widest font-bold"
        >
          <Cpu size={24} />
          <span>[ INITIALIZING SENTINEL KERNEL... ]</span>
        </motion.div>
      </div>
    );
  }

  const tabGroups = [
    {
      name: 'CORE',
      tabs: [
        { id: 'nexus', label: 'NEXUS', icon: Globe, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
        { id: 'chat', label: 'CHAT', icon: Cpu, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
        { id: 'overwatch', label: 'OVERWATCH', icon: Eye, color: 'text-cyan-400', bg: 'bg-cyan-400/10' },
      ]
    },
    {
      name: 'COGNITION',
      tabs: [
        { id: 'memory', label: 'MEMORY', icon: Database, color: 'text-blue-500', bg: 'bg-blue-500/10' },
        { id: 'identity', label: 'IDENTITY', icon: Fingerprint, color: 'text-purple-400', bg: 'bg-purple-400/10' },
        { id: 'weaver', label: 'WEAVER', icon: Network, color: 'text-cyan-400', bg: 'bg-cyan-400/10' },
      ]
    },
    {
      name: 'AGENCY',
      tabs: [
        { id: 'autonomy', label: 'AUTONOMY', icon: Activity, color: 'text-amber-500', bg: 'bg-amber-500/10' },
        { id: 'campaign', label: 'CAMPAIGN', icon: Map, color: 'text-orange-400', bg: 'bg-orange-400/10' },
        { id: 'bandit', label: 'ROUTING CORTEX', icon: Brain, color: 'text-amber-400', bg: 'bg-amber-400/10' },
        { id: 'forge', label: 'THE FORGE', icon: Hammer, color: 'text-rose-400', bg: 'bg-rose-400/10' },
        { id: 'debate', label: 'DEBATE', icon: Users, color: 'text-pink-400', bg: 'bg-pink-400/10' },
        { id: 'skills', label: 'SKILLS', icon: Terminal, color: 'text-fuchsia-400', bg: 'bg-fuchsia-400/10' },
      ]
    },
    {
      name: 'SYSTEM',
      tabs: [
        { id: 'dreamcatcher', label: 'DREAMCATCHER', icon: Moon, color: 'text-fuchsia-400', bg: 'bg-fuchsia-400/10' },
        { id: 'experiments', label: 'EXPERIMENTS', icon: FlaskConical, color: 'text-indigo-400', bg: 'bg-indigo-400/10' },
        { id: 'agents', label: 'AGENTS', icon: Users, color: 'text-emerald-400', bg: 'bg-emerald-400/10' }, { id: 'settings', label: 'SETTINGS', icon: Settings, color: 'text-slate-400', bg: 'bg-slate-400/10' }
      ]
    }
  ] as const;

  const commandActions = [
    // Navigation Commands
    ...tabGroups.flatMap(group => group.tabs.map(t => ({
      id: `nav-${t.id}`,
      title: `Navigate to ${t.label}`,
      subtitle: `Switch to the ${t.label} panel`,
      section: 'Navigation',
      icon: <t.icon size={16} />,
      onSelect: () => { setActiveTab(t.id as Tab); setBreadcrumbs([]); }
    }))),
    
    // System Commands
    {
      id: 'cmd-clear-memory',
      title: 'Clear Episodic Memory',
      subtitle: 'Permanently deletes all episodic logs',
      section: 'System Tasks',
      icon: <Trash2 size={16} className="text-red-400" />,
      onSelect: () => {
        if (confirm('Are you sure you want to clear episodic memory?')) {
          db.episodes.clear();
        }
      }
    },
    {
      id: 'cmd-consolidate',
      title: 'Force Memory Consolidation',
      subtitle: 'Run background job to form semantic facts',
      section: 'System Tasks',
      icon: <Archive size={16} className="text-amber-400" />,
      onSelect: () => {
        alert('Consolidation job dispatched.');
      }
    },
    {
      id: 'cmd-reboot',
      title: 'Reboot Sentinel Kernel',
      subtitle: 'Restart core agent processes',
      section: 'System Tasks',
      icon: <Zap size={16} className="text-emerald-400" />,
      onSelect: () => {
        window.location.reload();
      }
    }
  ];

  return (
    <div className="flex h-screen w-screen bg-slate-950 text-slate-300 font-sans overflow-hidden">
      <CommandPalette 
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        actions={commandActions}
      />
      
      {/* Toast Notifications */}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              className={`p-4 rounded-lg shadow-xl border flex items-start gap-3 max-w-sm ${
                toast.type === 'error' ? 'bg-red-950/80 border-red-900/50 text-red-200' :
                toast.type === 'warning' ? 'bg-amber-950/80 border-amber-900/50 text-amber-200' :
                toast.type === 'success' ? 'bg-emerald-950/80 border-emerald-900/50 text-emerald-200' :
                'bg-slate-900/90 border-slate-700 text-slate-200'
              } backdrop-blur`}
            >
              <div className="shrink-0 mt-0.5">
                {toast.type === 'success' && <CheckCircle2 size={18} className="text-emerald-400" />}
                {toast.type === 'error' && <AlertCircle size={18} className="text-red-400" />}
                {toast.type === 'warning' && <AlertCircle size={18} className="text-amber-400" />}
                {(!toast.type || toast.type === 'info') && <Info size={18} className="text-blue-400" />}
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-bold">{toast.title}</h4>
                <p className="text-xs mt-1 opacity-80">{toast.message}</p>
              </div>
              <button 
                onClick={() => removeToast(toast.id)}
                className="shrink-0 p-1 opacity-50 hover:opacity-100 transition-opacity"
              >
                <X size={14} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Left Rail */}
      <div className="w-20 md:w-64 border-r border-slate-800/80 bg-slate-900/40 flex flex-col items-center md:items-stretch py-6 shrink-0 shadow-[4px_0_24px_rgba(0,0,0,0.3)] z-20 backdrop-blur-xl">
        <div className="mb-10 px-6 flex items-center justify-center md:justify-start gap-4">
          <div className="p-2 bg-slate-800 border border-slate-700 rounded-lg shadow-inner">
            <Cpu size={24} className="text-white" />
          </div>
          <span className="hidden md:inline font-bold tracking-[0.2em] text-white font-display text-xl uppercase">Sentinel</span>
        </div>
        
        <div className="flex flex-col gap-6 px-4 w-full flex-1 overflow-y-auto pb-6">
          {tabGroups.map((group) => (
            <div key={group.name} className="flex flex-col gap-2">
              <div className="hidden md:block text-[10px] font-bold tracking-widest text-slate-600 mb-1 px-4 uppercase">{group.name}</div>
              {group.tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => { setActiveTab(t.id as Tab); setBreadcrumbs([]); }}
                  className={`flex items-center justify-center md:justify-start gap-3 p-3 rounded-xl transition-all duration-300 relative group overflow-hidden ${
                    activeTab === t.id 
                      ? `bg-slate-800 border border-slate-700/50 shadow-md ${t.color}` 
                      : 'text-slate-500 hover:text-slate-300 border border-transparent hover:bg-slate-800/30'
                  }`}
                >
                  {activeTab === t.id && (
                    <motion.div 
                      layoutId="active-tab-indicator"
                      className={`absolute inset-0 opacity-20 ${t.bg}`}
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                  {activeTab === t.id && (
                     <div className={`absolute left-0 top-1/4 bottom-1/4 w-1 rounded-r-full bg-current`} />
                  )}
                  
                  <div className="relative z-10">
                    <t.icon size={20} className={`transition-colors ${activeTab === t.id ? '' : 'group-hover:text-slate-400'}`} />
                    {/* Mobile status indicator */}
                    <div className={`md:hidden absolute -bottom-1 -right-1 w-2 h-2 rounded-full border-2 border-slate-900 ${activeTab === t.id ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse' : 'bg-emerald-500/50'}`} />
                  </div>
                  
                  <span className={`hidden md:inline text-xs font-bold tracking-widest z-10 flex-1 text-left ${activeTab === t.id ? '' : 'group-hover:text-slate-300'}`}>{t.label}</span>
                  
                  {/* Desktop Status Indicator */}
                  <div className={`hidden md:block w-2 h-2 rounded-full relative z-10 shrink-0 ${activeTab === t.id ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse' : 'bg-emerald-500/50'}`} />
                </button>
              ))}
            </div>
          ))}
        </div>
        
        <div className="mt-auto px-4 py-4 border-t border-slate-800/80 w-full hidden md:block space-y-4">
          <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono tracking-widest font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
            SYSTEM ONLINE
          </div>
          <div className="pt-2 border-t border-slate-800/50">
            <SystemMetrics />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden relative bg-slate-950 font-sans">
        
        {/* Breadcrumb Navigation Bar */}
        <div className="px-6 py-4 border-b border-slate-800/50 bg-slate-900/40 flex items-center gap-2 text-xs font-bold tracking-widest text-slate-500 z-30 shadow-sm shrink-0">
          <span className="text-slate-400">
            {tabGroups.find(g => g.tabs.some(t => t.id === activeTab))?.name || 'CORE'}
          </span>
          <ChevronRight size={14} className="opacity-50" />
          <span className={breadcrumbs.length > 0 ? "text-slate-400" : "text-emerald-400"}>
            {tabGroups.map(g => g.tabs).flat().find((t: any) => t.id === activeTab)?.label || 'NEXUS'}
          </span>
          
          {breadcrumbs.map((b, i) => (
            <React.Fragment key={i}>
              <ChevronRight size={14} className="opacity-50" />
              <button 
                onClick={b.onClick} 
                className={`transition-colors ${b.onClick ? 'hover:text-emerald-300' : 'cursor-default'} ${i === breadcrumbs.length - 1 ? 'text-emerald-400' : 'text-slate-400'}`}
                disabled={!b.onClick}
              >
                {b.label}
              </button>
            </React.Fragment>
          ))}
        </div>

        <div className="flex-1 relative">
          <AnimatePresence mode="wait">
            <motion.div 
              key={activeTab}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="h-full w-full absolute inset-0"
            >
            {activeTab === 'nexus' && <NexusPanel />}
            {activeTab === 'chat' && <ChatPanel />}
            {activeTab === 'overwatch' && <OverwatchPanel />}
            {activeTab === 'memory' && <MemoryPanel />}
            {activeTab === 'identity' && <IdentityPanel />}
            {activeTab === 'autonomy' && <AutonomyPanel />}
            {activeTab === 'campaign' && <CampaignPanel />}
            {activeTab === 'bandit' && <BanditPanel />}
            {activeTab === 'forge' && <ForgePanel />}
            {activeTab === 'debate' && <DebatePanel />}
            {activeTab === 'skills' && <SkillsPanel />}
            {activeTab === 'weaver' && <ContextWeaverPanel />}
            {activeTab === 'experiments' && <ExperimentsPanel />}
            {activeTab === 'dreamcatcher' && <DreamcatcherPanel />}
            {activeTab === 'settings' && <SettingsPanel />}
            {activeTab === 'agents' && <AgentsPanel />}
          </motion.div>
        </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-slate-950 items-center justify-center text-emerald-400 font-mono tracking-widest text-xs font-bold flex-col gap-4">
        <Loader2 size={32} className="animate-spin text-emerald-500" />
        INITIALIZING SECURE UPLINK...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-screen bg-slate-950 items-center justify-center text-slate-300 font-mono">
        <div className="w-full max-w-md p-8 bg-slate-900/50 border border-slate-800 rounded-2xl shadow-2xl backdrop-blur-md relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-emerald-900/20 via-slate-900/0 to-slate-900/0 pointer-events-none"></div>
          <div className="relative z-10 flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl border border-emerald-500/30 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(52,211,153,0.15)]">
              <Fingerprint size={32} className="text-emerald-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2 tracking-tight">Access Required</h1>
            <p className="text-sm text-slate-400 mb-8 max-w-[280px]">Authenticate to access the Sentinel command node.</p>
            
            <button 
              onClick={handleLogin}
              className="w-full py-4 px-6 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold tracking-widest text-xs transition-all duration-300 shadow-[0_0_20px_rgba(52,211,153,0.2)] hover:shadow-[0_0_30px_rgba(52,211,153,0.4)] flex items-center justify-center gap-3 group"
            >
              <Zap size={16} className="text-emerald-200 group-hover:scale-110 transition-transform" />
              AUTHORIZE ACCESS
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <SentinelProvider>
      <SentinelDashboard />
    </SentinelProvider>
  );
}
