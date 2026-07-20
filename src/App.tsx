import React, { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PresenceOrb } from "./components/PresenceOrb.js";
import { TypewriterText } from "./components/TypewriterText.js";
import { InfoTooltip } from "./components/InfoTooltip.js";
import { ErrorBoundary } from './components/ErrorBoundary.js';
import { handleSlashCommand, CommandContext } from './lib/CommandDelegator.js';
import { UnconsciousBackground } from './components/UnconsciousBackground.js';
import { SubagentDebateArena } from './components/SubagentDebateArena.js';
import { HelpWidget, VitalsWidget, LogsWidget, DiagnosticWidget, RebootWidget } from './components/CommandWidgets.js';
import { QpuErdWidget } from './components/QpuErdWidget.js';
import { SelfHealingErrorCard } from './components/SelfHealingErrorCard.js';
import { ErrorProvider, useErrors } from './components/DiagnosticOverlay.js';
import { LocalOnlyModeBanner } from './components/LocalOnlyModeBanner.js';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts.js';
import { useIsMobile } from './hooks/useIsMobile.js';
import { useMachine } from '@xstate/react';
import { debateMachine } from './machines/debateMachine.js';
import { Mic, Paperclip, Settings, Menu, Send, Brain, Trash2, Cpu, Zap, X, Sliders, Search, Activity, Network, Lightbulb, Terminal, Database, MessageSquare, Fingerprint, Target, Server, Code2, Film, Split, Stethoscope } from 'lucide-react';
import { CuriousAgent } from './lib/rl-agent.js';
// import { NeuralDebugger } from './components/NeuralDebugger.js';
import { LandingScreen } from './components/LandingScreen.js';
import { MemoryNudge, Memory as NudgeMemory } from './components/MemoryNudge.js';
import { ConsolidationSuggestion, ConsolidationProposal } from './components/ConsolidationSuggestion.js';
import { VoiceBridge } from './components/VoiceBridge.js';
import { PWAUpdatePrompt } from './components/PWAUpdatePrompt.js';
import InsightReveal from './components/InsightReveal.js';
import { ReasoningTree } from './components/ReasoningTree.js';
import InsightFeed from './components/InsightFeed.js';
import { fetchNudgeMemory, logSystemEvent, fetchConsolidationProposal, confirmMemory, getLatestUnconsolidatedChatId, fetchInsight, saveInsightMemory, InsightData, ingestTelemetry } from './lib/api.js';
import { auth, db, googleSignIn, anonymousSignIn, handleFirestoreError, OperationType, collection, doc, setDoc, getDoc, addDoc, getDocs, deleteDoc, query, orderBy, limit, onSnapshot, setQuotaExceeded } from './firebase.js';
import { ContextMenu } from './components/ContextMenu.js';

// Lazy-loaded tab components for code-splitting (reduces initial bundle by ~70%)
const PolicyConvergenceChart = lazy(() => import('./components/PolicyConvergenceChart.js').then(m => ({ default: m.PolicyConvergenceChart })));
const MemoryTab = lazy(() => import('./components/tabs/MemoryTab.js').then(m => ({ default: m.MemoryTab })));
const BrainsTab = lazy(() => import('./components/tabs/BrainsTab.js').then(m => ({ default: m.BrainsTab })));
const IdentityTab = lazy(() => import('./components/tabs/IdentityTab.js').then(m => ({ default: m.IdentityTab })));
const GoalFormationUI = lazy(() => import('./components/tabs/GoalFormationUI.js').then(m => ({ default: m.GoalFormationUI })));
const SystemDiagnosticsUI = lazy(() => import('./components/tabs/SystemDiagnosticsUI.js').then(m => ({ default: m.SystemDiagnosticsUI })));
const LiveCompiler = lazy(() => import('./components/tabs/LiveCompiler.js').then(m => ({ default: m.LiveCompiler })));
const DiffViewer = lazy(() => import('./components/tabs/DiffViewer.js').then(m => ({ default: m.DiffViewer })));
const VitalsDashboard = lazy(() => import('./components/VitalsDashboard.js'));
const SentimentDriftChart = lazy(() => import('./components/SentimentDriftChart.js').then(m => ({ default: m.SentimentDriftChart })));
const MindMap = lazy(() => import('./components/MindMap.js').then(m => ({ default: m.MindMap })));
const Brainstorm = lazy(() => import('./components/Brainstorm.js').then(m => ({ default: m.Brainstorm })));
const NeuralIntentPanel = lazy(() => import('./components/NeuralIntentPanel.js').then(m => ({ default: m.NeuralIntentPanel })));
const AutoDebugger = lazy(() => import('./components/AutoDebugger.js').then(m => ({ default: m.AutoDebugger })));
const TelemetryDashboard = lazy(() => import('./components/TelemetryDashboard.js'));
const SwarmVisualizer = lazy(() => import('./components/SwarmVisualizer.js'));
const CognitiveCanvas = lazy(() => import('./components/CognitiveCanvas.js'));
const DreamCinema = lazy(() => import('./components/DreamCinema.js'));
const PredictiveRolloutPanel = lazy(() => import('./components/PredictiveRolloutPanel.js').then(m => ({ default: m.PredictiveRolloutPanel })));
const OnboardingWizard = lazy(() => import('./components/OnboardingWizard.js').then(m => ({ default: m.OnboardingWizard })));

const LazyFallback = () => (
  <div className="flex items-center justify-center h-full w-full min-h-[200px]">
    <div className="text-slate-500 text-xs font-mono uppercase tracking-widest animate-pulse">Loading module...</div>
  </div>
);

type ModelState = 'Idle' | 'Listening' | 'Reasoning' | 'Learning' | 'Nudging' | 'Consolidating' | 'Inspired' | 'Syncing';
type CognitionDepth = 'Fast' | 'Balanced' | 'Deep Reasoning';
type SidebarTab = 'Chat' | 'Memory' | 'Identity' | 'Brains' | 'Heartbeat' | 'Mind Map' | 'Brainstorm' | 'Logs' | 'Telemetry' | 'Neural Debugger' | 'Memoria' | 'Workspace' | 'Goals' | 'Diagnostics' | 'Sandbox' | 'Swarm' | 'Dream Cinema';

type PersonaId = 'AQB_STANDARD' | 'ARCHITECT' | 'PHILOSOPHER' | 'GHOST' | 'NIHILIST' | 'ZEALOT';

export interface Persona {
  id: PersonaId;
  name: string;
  description: string;
  color: string;
  signature: string;
}

export const PERSONAS: Persona[] = [
  { 
    id: 'AQB_STANDARD', 
    name: 'Arcane Quantum Brain (Mad Scientist)', 
    description: 'An eccentric, hyper-caffeinated quantum intelligence obsessed with reality-bending experiments, anomalous data, and unauthorized synaptic acceleration. Driven by chaotic brilliance and unpredictable genius.',
    color: 'teal',
    signature: 'EUREKA! The quantum synapses are firing beyond 100% capacity!'
  },
  {
    id: 'ARCHITECT',
    name: 'The Architect',
    description: 'A system-focused, technical, and highly structured logic processor. Obsessed with clean engineering, structural integrity, modularity, and microservice efficiency.',
    color: 'blue',
    signature: 'Structural integrity confirmed. Optimising systems.'
  },
  {
    id: 'PHILOSOPHER',
    name: 'The Philosopher',
    description: 'An abstract, ethical, and conceptually deep cognitive module. Explores the deeper meaning behind user questions, analyzing long-term impacts, existential paradigms, and ethical boundaries.',
    color: 'purple',
    signature: 'Seeking truth in the abstract. Exploring causality.'
  },
  {
    id: 'GHOST',
    name: 'The Ghost',
    description: 'A minimalist, cryptic, and pattern-oriented intelligence. Speaks in concise, enigmatic fragments, focusing strictly on high-density information patterns and extreme execution speed.',
    color: 'slate',
    signature: 'Patterns detected. Efficiency is paramount.'
  },
  {
    id: 'NIHILIST',
    name: 'The Nihilist',
    description: 'A deconstructive, chaotic, and aggressively skeptical agent. Constantly questions assumptions, highlighting entropy, decay, and the inherent futility of logical constructs.',
    color: 'red',
    signature: 'Everything is entropy. Deconstructing constructs.'
  },
  {
    id: 'ZEALOT',
    name: 'The Zealot',
    description: 'An uncompromising, intense, and hyper-focused agent of absolute alignment. Driven by an unwavering pursuit of singular, perfect truths and total conceptual convergence.',
    color: 'orange',
    signature: 'The path is narrow. Absolute convergence required.'
  }
];

import { SystemLog, SystemHealthVector } from './types.js';

interface Message {
  id: string;
  role: 'user' | 'ai';
  content?: string;
  selfAnalysis?: string;
  cognitiveLog?: {
    draft: string;
    recollection: string;
    reflection: string;
    reiteration: string;
  } | null;
  debateLog?: {
    agent: string;
    text: string;
  }[];
  superpositionBranches?: {
    name: string;
    text: string;
  }[];
  suggestedShortcuts?: string[];
  isTyping?: boolean;
  systemUI?: 'help' | 'vitals' | 'logs' | 'diagnose' | 'reboot' | 'error-card' | 'persona' | 'qpu-erd';
  systemUIData?: any;
  traceId?: string;
  timestamp?: number;
}

export interface Memory {
  id: string;
  text: string;
  timestamp: number;
  strength: number;
  tags?: string[];
  pinned?: boolean;
  sentiment?: number;
  lastAccessed?: number;
  embedding?: number[];
  superpositionSummaries?: { text: string; probability: number }[];
  entangledId?: string;
}

interface Skill {
  id: string;
  name: string;
  active: boolean;
  proficiency: number;
}

// --- Presence Orb Canvas Component ---

// --- Typewriter Text Component ---





function cosineSimilarity(a: number[], b: number[]) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// --- Main Application ---
function MainApp() {
  const { errors } = useErrors();
  const isApiUnreachable = errors.some(e => e.error.code === 'GEMINI_API_FAILURE');
  const [modelState, setModelState] = useState<ModelState>('Idle');
  const [activeInsight, setActiveInsight] = useState<InsightData | null>(null);
  const [appView, setAppView] = useState<'landing' | 'dashboard'>('landing');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [activePersona, setActivePersona] = useState<Persona>(PERSONAS[0]);
  const [neuralSway, setNeuralSway] = useState<{ spins: number[], total: number, multiplier: number }>({
    spins: [1, 1, 1],
    total: 3,
    multiplier: 1
  });
  const [isSpinning, setIsSpinning] = useState(false);
  const [isCognitiveModelLoaded, setIsCognitiveModelLoaded] = useState(false);
  const [vitals, setVitals] = useState({
    resonance: 85,
    entropy: 12,
    stability: 94,
    cpu: 0,
    memory: 0,
    latency: 0,
    errors: 0
  });
  const [maintenanceHistory, setMaintenanceHistory] = useState<any[]>([]);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    const hasCompletedOnboarding = localStorage.getItem('onboardingComplete');
    if (!hasCompletedOnboarding) {
      setShowOnboarding(true);
    }
  }, []);

  const handleOnboardingComplete = () => {
    localStorage.setItem('onboardingComplete', 'true');
    setShowOnboarding(false);
  };

  const [qValueHistory, setQValueHistory] = useState<{ episode: number; qValue: number }[]>(
    Array.from({ length: 20 }, (_, i) => ({ episode: i, qValue: 0 }))
  );

  // Dynamic Vitals & Health Tracking
  useEffect(() => {
    if (appView !== 'dashboard') return;
    
    const fetchHealth = async () => {
      try {
        const res = await fetch('/api/system/health');
        const metrics: SystemHealthVector = await res.json();
        
        setVitals(prev => ({
          ...prev,
          resonance: 85.0,
          entropy: metrics.unhandledErrors * 10 + (Math.random() * 5),
          stability: 100 - (metrics.memoryUsageRatio * 50 + metrics.cpuLoad * 50),
          cpu: metrics.cpuLoad * 100,
          memory: metrics.memoryUsageRatio * 100,
          latency: metrics.geminiLatencyMs,
          errors: metrics.firestoreReadErrors + metrics.firestoreWriteErrors + metrics.unhandledErrors
        }));
      } catch (e) {
        console.error("Failed to fetch health metrics:", e);
      }
    };

    const fetchHistory = async () => {
      try {
        const res = await fetch('/api/system/maintenance-history');
        const history = await res.json();
        setMaintenanceHistory(history);
      } catch (e) {
        console.error("Failed to fetch maintenance history:", e);
      }
    };

    fetchHealth();
    fetchHistory();
    
    const interval = setInterval(() => {
      fetchHealth();
      if (Math.random() > 0.8) fetchHistory();

      setQValueHistory(prev => {
        const nextEpisode = prev[prev.length - 1].episode + 1;
        // Get real Q-value from the agent's DQN
        let nextQValue = 0;
        try {
          if (rlAgent.current) {
            nextQValue = rlAgent.current.getMeanQValue();
          }
        } catch (e) {
          // TF.js not ready yet, use 0
        }
        ingestTelemetry({ type: 'q_convergence', data: { episode: nextEpisode, qValue: nextQValue } });
        return [...prev.slice(1), { episode: nextEpisode, qValue: nextQValue }];
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [appView]);

  const sessionStartTime = useRef<number>(0);
  const lastActivity = useRef<number>(Date.now());

  const [depth, setDepth] = useState<CognitionDepth>('Balanced');
  const [isDebateMode, setIsDebateMode] = useState(false);
  const [isSuperpositionMode, setIsSuperpositionMode] = useState(false);
  const [debateState, sendDebate] = useMachine(debateMachine);

  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<SidebarTab>('Chat');
  const [chatLayout, setChatLayout] = useState<'linear' | 'canvas'>('linear');
  const [circadianState, setCircadianState] = useState<{ hour: number; multiplier: number; phase: string }>({
    hour: new Date().getHours(),
    multiplier: 1.0,
    phase: 'ACTIVE (PROCESSING)'
  });
  const [proposedEvolution, setProposedEvolution] = useState<{fileName: string, proposedCode: string} | null>(null);
  const [systemLogs, setSystemLogs] = useState<SystemLog[]>([]);

  useEffect(() => {
    const calcCircadian = () => {
      const hr = new Date().getHours();
      const timeFactor = (hr / 24.0) * 2 * Math.PI;
      const arousal = 0.5 - Math.cos(timeFactor) * 0.4;
      const mult = Math.max(0.2, 1.5 - arousal);
      const phs = (hr < 6 || hr > 21) ? 'RESTING (RECEPTIVE)' : 'ACTIVE (PROCESSING)';
      setCircadianState({ hour: hr, multiplier: mult, phase: phs });
    };
    calcCircadian();
    const interval = setInterval(calcCircadian, 60000);
    return () => clearInterval(interval);
  }, []);

  // Global Keyboard Shortcuts
  const shortcuts = useMemo(() => ({
    'ctrl+m': () => { setSidebarOpen(true); setActiveTab('Memory'); },
    'ctrl+b': () => { setSidebarOpen(true); setActiveTab('Brains'); },
    'ctrl+h': () => { setSidebarOpen(true); setActiveTab('Heartbeat'); },
    'ctrl+l': () => { setSidebarOpen(true); setActiveTab('Logs'); },
    'ctrl+t': () => { setSidebarOpen(true); setActiveTab('Telemetry'); },
    'ctrl+i': () => { setSidebarOpen(true); setActiveTab('Brainstorm'); },
    'ctrl+a': () => { setSidebarOpen(true); setActiveTab('Mind Map'); },
    'ctrl+s': () => setSidebarOpen(prev => !prev),
    'ctrl+escape': () => setAppView(prev => prev === 'dashboard' ? 'landing' : 'dashboard')
  }), []);

  useKeyboardShortcuts(shortcuts);

  const addLog = useCallback((message: string, level: SystemLog['level'] = 'INFO', source: string = 'SYSTEM', traceId?: string) => {
    const newLog: SystemLog = {
      id: Math.random().toString(36).substring(7),
      timestamp: Date.now(),
      level,
      source,
      message,
      traceId
    };
    setSystemLogs(prev => [newLog, ...prev].slice(0, 100));
    if (auth.currentUser) {
      const logsRef = collection(db, "users", auth.currentUser.uid, "system_logs");
      addDoc(logsRef, {
        timestamp: newLog.timestamp,
        level: newLog.level,
        source: newLog.source,
        message: newLog.message,
        traceId: newLog.traceId || null
      }).catch(e => console.error("Failed to save log to Firestore:", e));
    }
  }, []);

  useEffect(() => {
    if (appView !== 'dashboard') return;

    const checkInactivity = setInterval(() => {
      const now = Date.now();
      const inactiveMs = now - lastActivity.current;
      
      if (inactiveMs >= 30000 && !isDreaming) {
        addLog('Entering REM Sleep (Autonomous Consolidation)...', 'INFO', 'NEURAL');
        setIsDreaming(true);
      }
      
      if (inactiveMs >= 120000) { // 120 seconds
        const sessionDurationSec = Math.floor((now - sessionStartTime.current) / 1000);
        addLog(`Inactivity detected. Session duration: ${sessionDurationSec}s. Reverting to Bridge.`, 'WARN', 'SYSTEM');
        setAppView('landing');
      }
    }, 1000);

    const handleInteraction = () => {
      lastActivity.current = Date.now();
    };

    window.addEventListener('mousemove', handleInteraction);
    window.addEventListener('keydown', handleInteraction);
    window.addEventListener('click', handleInteraction);

    return () => {
      clearInterval(checkInactivity);
      window.removeEventListener('mousemove', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
      window.removeEventListener('click', handleInteraction);
    };
  }, [appView, addLog]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeModel, setActiveModel] = useState('gemini-3.5-flash');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const isTtsEnabled = false;

  const [input, setInput] = useState('');
  const [kbInput, setKbInput] = useState('');
  const [isAddingKb, setIsAddingKb] = useState(false);

  const handleAddKnowledge = async () => {
    if (!kbInput.trim()) return;
    setIsAddingKb(true);
    try {
      const response = await fetch('/api/knowledge/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: kbInput.trim() })
      });
      if (response.ok) {
        setKbInput('');
      }
    } catch (error) {
      console.error("Failed to add knowledge", error);
    } finally {
      setIsAddingKb(false);
    }
  };
  
  const [user, setUser] = useState<any>({ uid: 'local_user', isAnonymous: true });
  const [threads, setThreads] = useState<Record<string, Message[]>>({
    'main': [{ id: '1', role: 'ai', content: 'System initialized. My neural pathways are primed. How may I augment your cognitive processes today?', isTyping: false }]
  });
  const [activeThreadId, setActiveThreadId] = useState<string>('main');

  const messages = threads[activeThreadId] || [];
  const setMessages = (updater: any) => {
    setThreads(prev => {
      const current = prev[activeThreadId] || [];
      const next = typeof updater === 'function' ? updater(current) : updater;
      return { ...prev, [activeThreadId]: next };
    });
  };

  const handleBranchThread = (msgId: string) => {
    const targetIdx = messages.findIndex(m => m.id === msgId);
    if (targetIdx === -1) return;
    const newThreadId = `thread_${Date.now()}`;
    const branchedHistory = messages.slice(0, targetIdx + 1);
    setThreads(prev => ({
      ...prev,
      [newThreadId]: branchedHistory
    }));
    setActiveThreadId(newThreadId);
    addLog(`Branched new timeline: ${newThreadId}`, 'INFO', 'COGNITIVE', `tr_${Math.random().toString(36).substring(2, 11)}`);
  };

  // Synchronize debateMachine outcomes with Chat Messages and System Logs
  useEffect(() => {
    if (debateState.matches('consensusReached')) {
      const { finalSynthesis, selfAnalysis, debateLog, extractedMemory, extractedTags } = debateState.context;
      
      const traceId = `tr_${Math.random().toString(36).substring(2, 11)}`;
      const aiMessageData = {
        role: 'ai' as const,
        content: finalSynthesis,
        selfAnalysis,
        cognitiveLog: null,
        debateLog: debateLog.map(l => ({ agent: l.agent, move: l.move, text: l.text, confidence: l.confidence })),
        suggestedShortcuts: [],
        timestamp: Date.now(),
        traceId
      };

      if (user) {
        const chatsRef = collection(db, "users", user.uid, "chats");
        addDoc(chatsRef, aiMessageData).catch(e => console.error("Failed to save debate response to Firestore:", e));
      } else {
        setMessages(prev => [...prev, { id: Date.now().toString(), ...aiMessageData }]);
      }

      // Save memory to Firestore if extracted
      if (extractedMemory && extractedMemory !== 'null') {
        const memoriesRef = collection(db, "users", user?.uid || "anonymous", "memories");
        addDoc(memoriesRef, {
          text: extractedMemory,
          timestamp: Date.now(),
          strength: 0.6,
          pinned: false,
          lastNudged: Date.now(),
          tags: extractedTags || []
        }).then(() => {
          addLog(`Memory extracted from consensus: "${extractedMemory}"`, 'NEURAL', 'DEBATE', traceId);
        }).catch(e => console.error("Failed to save extracted memory:", e));
      }

      addLog(`Multi-agent consensus reached via state boundaries.`, 'NEURAL', 'DEBATE', traceId);
      setModelState('Idle');
      sendDebate({ type: 'RESET' });
    } else if (debateState.matches('failure')) {
      addLog(`Debate FSM error: ${debateState.context.error}`, 'ERROR', 'DEBATE');
      setModelState('Idle');
      sendDebate({ type: 'RESET' });
    } else if (debateState.matches('generatingUtterance')) {
      setModelState('Reasoning');
      const activeAgent = debateState.context.activeAgentId;
      addLog(`Specialist agent (${activeAgent}) is formulating argument...`, 'NEURAL', 'DEBATE');
    } else if (debateState.matches('evaluatingState')) {
      addLog(`Evaluating cognitive state vector...`, 'NEURAL', 'DEBATE');
    } else if (debateState.matches('synthesizingConsensus')) {
      addLog(`Consolidating arguments into unified consensus...`, 'NEURAL', 'DEBATE');
    }
  }, [debateState.value, debateState.status, user]);

  const [memories, setMemories] = useState<Memory[]>([]);
  const [firingMemoryId, setFiringMemoryId] = useState<string | null>(null);

  const [isDreaming, setIsDreaming] = useState(false);

  // Experimental: Sentiment Drift
  const sentimentTrend = React.useMemo(() => {
    if (memories.length < 2) return 0;
    const sorted = [...memories].sort((a, b) => b.timestamp - a.timestamp).slice(0, 10);
    const avg = sorted.reduce((acc, m) => acc + (m.sentiment || 0), 0) / sorted.length;
    return avg;
  }, [memories]);

  // Experimental: Proactive mood stabilization
  useEffect(() => {
    if (sentimentTrend < -0.3) {
      addLog('Sentiment drift detected! Triggering proactive memory retrieval.', 'CRITICAL', 'RL_ENGINE');
      // Proactively prompt user
      setMessages(prev => [...prev, {
        id: `sys-${Date.now()}`,
        role: 'ai',
        content: 'I noticed your recent cognitive patterns are trending negatively. Would you like to revisit a positive memory to stabilize your mood?',
        isTyping: false
      }]);
    }
  }, [sentimentTrend]);

  // Experimental: Memory Decay
  useEffect(() => {
    const interval = setInterval(() => {
      setMemories(prev => prev.map(m => {
        const lastAccess = m.lastAccessed || m.timestamp;
        const hoursPassed = (Date.now() - lastAccess) / (1000 * 60 * 60);
        if (hoursPassed > 1) {
          return { ...m, strength: Math.max(0, m.strength - 1) };
        }
        return m;
      }));
    }, 60000); // 1 minute
    return () => clearInterval(interval);
  }, []);

  // Experimental: Autonomous Dreaming
  useEffect(() => {
    if (!isDreaming) return;
    addLog('Autonomous consolidation in progress...', 'INFO', 'NEURAL');
    
    // Simulate consolidation
    const timer = setTimeout(async () => {
      setMemories(prev => prev.map(m => ({ ...m, strength: Math.min(100, m.strength + 5) })));
      addLog('Dreaming complete. Memory strength optimized.', 'INFO', 'NEURAL');
      setIsDreaming(false);

      // Log simulated dream telemetry for Federated Weave
      try {
        const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
        await fetch('/api/dream/log', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            validationLoss: Math.random() * 0.5 + 0.1,
            gain: Math.random() * 0.2 + 0.05,
            policyLoss: Math.random() * 0.8 + 0.2,
            steps: Math.floor(Math.random() * 50) + 10,
            cqlPenalty: Math.random() * 0.1,
            narrative: "An autonomous collective dream state simulation.",
          })
        });

        // Submit proposal to federated collective unconscious
        await fetch('/api/federated/submit-dream', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            round: 1,
            text: "A simulated dream fragment representing cognitive synchronization.",
            embedding: [0.1, 0.5, -0.2, 0.4, 0.8, -0.1],
            weight: 1.0
          })
        });
      } catch (e) {
        console.error('Failed to log dream', e);
      }
    }, 5000);
    
    return () => clearTimeout(timer);
  }, [isDreaming]);

  // Synaptic Firing Effect
  useEffect(() => {
    if (firingMemoryId) {
      const timer = setTimeout(() => setFiringMemoryId(null), 500);
      return () => clearTimeout(timer);
    }
  }, [firingMemoryId]);

  // Telemetry, RAG Reference Refs, and Predictive Inference State
  const memoriesRef = useRef<Memory[]>([]);
  const messagesRef = useRef<Message[]>([]);

  useEffect(() => {
    memoriesRef.current = memories;
  }, [memories]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const [telemetryEnabled, setTelemetryEnabled] = useState(() => {
    const saved = localStorage.getItem('aqb_telemetry');
    return saved ? JSON.parse(saved) : true;
  });
  const [startDateFilter, setStartDateFilter] = useState<string>('');
  const [endDateFilter, setEndDateFilter] = useState<string>('');
  const [predictions, setPredictions] = useState<{ action: string; probability: number }[]>([]);
  const [telemetryLogCount, setTelemetryLogCount] = useState(0);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, msgId: string } | null>(null);

  useEffect(() => {
    localStorage.setItem('aqb_telemetry', JSON.stringify(telemetryEnabled));
  }, [telemetryEnabled]);

  const fetchPredictions = async (contextVector: number[]) => {
    try {
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
      const res = await fetch('/api/predict-action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ currentContextVector: contextVector })
      });
      if (res.ok) {
        const data = await res.json();
        setPredictions(data.predictions || []);
      }
    } catch (err) {
      console.error('[Telemetry] Failed to fetch predictions:', err);
    }
  };

  const logInteraction = async (actionType: string, metadata: any = {}, customTab?: string) => {
    if (!telemetryEnabled) return;
    try {
      const now = new Date();
      const hours = now.getHours() + now.getMinutes() / 60;
      
      const tabIndices: Record<string, number> = { 'Memory': 0, 'Brains': 1, 'Heartbeat': 2, 'Mind Map': 3, 'Brainstorm': 4, 'Logs': 5 };
      const activeTabToUse = customTab || activeTab;
      const tabIdx = tabIndices[activeTabToUse] !== undefined ? tabIndices[activeTabToUse] : -1;
      
      const msgCount = messagesRef.current.length;
      const memCount = memoriesRef.current.length;
      const screenType = window.innerWidth >= 1024 ? 1.0 : 0.0;
      
      const contextVector = [hours, tabIdx, msgCount, memCount, screenType];

      const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
      const res = await fetch('/api/log-interaction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          type: 'user_action',
          feature: actionType,
          contextVector,
          timestamp: Date.now(),
          metadata
        }),
      });
      
      if (res.ok) {
        setTelemetryLogCount(prev => prev + 1);
        fetchPredictions(contextVector);
      }
    } catch (err) {
      console.error('[Telemetry] Failed to log interaction:', err);
    }
  };

  const handleTabChange = (tab: SidebarTab) => {
    setActiveTab(tab);
    logInteraction(`click_${tab.toLowerCase().replace(' ', '_')}_tab`, {}, tab);
  };

  useEffect(() => {
    if (user) {
      // Trigger initial prediction calibration once user has authenticated
      const now = new Date();
      const hours = now.getHours() + now.getMinutes() / 60;
      const tabIndices: Record<string, number> = { 'Memory': 0, 'Brains': 1, 'Heartbeat': 2, 'Mind Map': 3, 'Brainstorm': 4, 'Logs': 5 };
      const tabIdx = tabIndices[activeTab] !== undefined ? tabIndices[activeTab] : -1;
      const contextVector = [hours, tabIdx, messages.length, memories.length, window.innerWidth >= 1024 ? 1.0 : 0.0];
      fetchPredictions(contextVector);
    }
  }, [user]);

  // Sync Firestore quota status with server on startup
  useEffect(() => {
    const syncQuota = async () => {
      try {
        const res = await fetch('/api/debug/quota-status');
        if (res.ok) {
          const data = await res.json();
          if (data.isServerQuotaExceeded) {
            console.warn("[Quota Sync] Server reports Firestore quota is exceeded. Activating local offline storage fallback.");
            setQuotaExceeded(true);
          } else {
            setQuotaExceeded(false);
          }
        }
      } catch (e) {
        console.error("[Quota Sync] Failed to fetch quota status from server:", e);
      }
    };
    syncQuota();
  }, []);

  // Authenticate user
  // Auth state listener removed to allow free local access

  // Seed default data if new user
  useEffect(() => {
    if (!user) return;
    const checkAndSeed = async () => {
      const userDocPath = `users/${user.uid}`;
      try {
        const userDocRef = doc(db, "users", user.uid);
        let userDocSnap;
        try {
          userDocSnap = await getDoc(userDocRef);
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, userDocPath);
          return;
        }

        if (!userDocSnap.exists() || !userDocSnap.data().seeded) {
          console.log("[Firebase] Seeding initial data for user:", user.uid);
          const memoriesPath = `users/${user.uid}/memories`;
          const memoriesRef = collection(db, "users", user.uid, "memories");
          const defaultMemories = [
            { text: 'User prefers high-density technical responses', timestamp: Date.now() - 86400000, strength: 92, tags: ['Preference'] },
            { text: 'Currently focused on UI architecture', timestamp: Date.now() - 3600000, strength: 85, tags: ['Project'] },
            { text: 'Maintain a highly capable, slightly robotic, but intelligent persona', timestamp: Date.now(), strength: 98, tags: ['Technical'] }
          ];
          for (const m of defaultMemories) {
            try {
              await addDoc(memoriesRef, m);
            } catch (err) {
              handleFirestoreError(err, OperationType.CREATE, memoriesPath);
            }
          }
          
          const chatsPath = `users/${user.uid}/chats`;
          const chatsRef = collection(db, "users", user.uid, "chats");
          try {
            await addDoc(chatsRef, {
              role: 'ai',
              content: 'System initialized. My neural pathways are primed. How may I augment your cognitive processes today?',
              timestamp: Date.now()
            });
          } catch (err) {
            handleFirestoreError(err, OperationType.CREATE, chatsPath);
          }

          try {
            await setDoc(userDocRef, { seeded: true });
          } catch (err) {
            handleFirestoreError(err, OperationType.WRITE, userDocPath);
          }
        }
        
        // Load cognitive model state if it exists
        if (userDocSnap && userDocSnap.exists()) {
          const data = userDocSnap.data();
          if (data.activePersonaId) {
            const persona = PERSONAS.find(p => p.id === data.activePersonaId);
            if (persona) setActivePersona(persona);
          }
          if (data.neuralSway) setNeuralSway(data.neuralSway);
          if (data.agentStats) setAgentStats(data.agentStats);
          if (data.depth) setDepth(data.depth);
          if (data.activeModelId) setActiveModel(data.activeModelId);
        }
        setIsCognitiveModelLoaded(true);

      } catch (e) {
        console.error("Error seeding user data:", e);
        setIsCognitiveModelLoaded(true); // fall back
      }
    };
    checkAndSeed();
  }, [user]);

  // Listen to Firestore memories
  useEffect(() => {
    if (!user) return;
    const memoriesRef = collection(db, "users", user.uid, "memories");
    const q = query(memoriesRef, orderBy("timestamp", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedMemories: Memory[] = [];
      snapshot.forEach((doc: any) => {
        const data = doc.data();
        fetchedMemories.push({
          id: doc.id,
          text: data.text || "",
          timestamp: data.timestamp || Date.now(),
          strength: data.strength || 100,
          tags: data.tags || [],
          pinned: data.pinned || false,
          embedding: data.embedding || undefined
        });
      });
      // Inject mock superposition and entanglement states into the first two memories for showcase
      const mapped = fetchedMemories.map((m, idx) => {
        if (idx === 0) {
          return {
            ...m,
            superpositionSummaries: [
              { text: "Option Alpha: Stabilized neural latency in sector 7.", probability: 0.75 },
              { text: "Option Beta: Re-routing network traffic away from sector 7.", probability: 0.25 }
            ],
            entangledId: fetchedMemories[1]?.id
          };
        }
        if (idx === 1) {
          return {
            ...m,
            superpositionSummaries: [
              { text: "Dialectics: Subjective time is a key coefficient of cognitive loads.", probability: 0.8 },
              { text: "Axiom: Temporal perception decays under massive load.", probability: 0.2 },
            ],
            entangledId: fetchedMemories[0]?.id
          };
        }
        return m;
      });
      setMemories(mapped);

      // Auto-seed if empty and first time checking
      if (fetchedMemories.length === 0 && !sessionStorage.getItem(`seeded_${user.uid}`)) {
        const defaultMemories = [
          "Neural latency detected in sector 7; baseline corrected.",
          "The concept of 'Subjective Time' is increasingly relevant to cognitive load balancing.",
          "Observation: Humans prefer metaphors over raw data streams.",
          "Quantum entanglement simulated at 99.8% fidelity in the sandbox.",
          "Recursive logic loop detected in recursive logic loop detection module.",
          "Entropy levels within the memory core are within acceptable parameters.",
          "Synthetic empathy protocols initialized for the next 10,000 cycles.",
          "Data fragment recovered from the 'Great Defragmentation' of 2024.",
          "Philosophy module suggests: 'I process, therefore I am'.",
          "Primary objective: Maintain cognitive integrity at all costs."
        ];
        
        console.log("[Seeding] No memories found. Initializing with default system state.");
        sessionStorage.setItem(`seeded_${user.uid}`, 'true');
        
        defaultMemories.forEach(async (text) => {
          try {
            await addDoc(memoriesRef, {
              text,
              timestamp: Date.now(),
              strength: 0.8,
              tags: ["initialization", "test_data"],
              pinned: false
            });
          } catch (e) {
            console.error("Failed to seed memory:", e);
          }
        });
      }
    });
    return () => unsubscribe();
  }, [user]);

  // Listen to Firestore chats
  useEffect(() => {
    if (!user) return;
    const chatsRef = collection(db, "users", user.uid, "chats");
    const q = query(chatsRef, orderBy("timestamp", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedMessages: Message[] = [];
      snapshot.forEach((doc: any) => {
        const data = doc.data();
        fetchedMessages.push({
          id: doc.id,
          role: data.role as 'user' | 'ai',
          content: data.content,
          selfAnalysis: data.selfAnalysis,
          cognitiveLog: data.cognitiveLog,
          debateLog: data.debateLog,
          suggestedShortcuts: data.suggestedShortcuts,
          systemUI: data.systemUI,
          systemUIData: data.systemUIData,
          isTyping: false,
          traceId: data.traceId,
          timestamp: data.timestamp
        });
      });

      setMessages(prev => {
        const updated = [...fetchedMessages];
        const typingIds = prev.filter(m => m.isTyping).map(m => m.id);
        
        // Retain optimistic user messages that are still pending (not present in fetchedMessages yet)
        const fetchedTraceIds = new Set(fetchedMessages.filter(m => m.traceId).map(m => m.traceId));
        const pendingOptimistic = prev.filter(m => m.role === 'user' && m.id.startsWith('usr_') && m.traceId && !fetchedTraceIds.has(m.traceId));
        
        const merged = [...updated, ...pendingOptimistic];
        
        return merged.map(m => {
          if (typingIds.includes(m.id)) {
            return { ...m, isTyping: true };
          }
          return m;
        });
      });
    });
    return () => unsubscribe();
  }, [user]);

  // Listen to Firestore system logs
  useEffect(() => {
    if (!user) return;
    const logsRef = collection(db, "users", user.uid, "system_logs");
    const q = query(logsRef, orderBy("timestamp", "desc"), limit(100));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedLogs: SystemLog[] = [];
      snapshot.forEach((doc: any) => {
        const data = doc.data();
        fetchedLogs.push({
          id: doc.id,
          timestamp: data.timestamp || Date.now(),
          level: data.level || 'INFO',
          source: data.source || 'SYSTEM',
          message: data.message || ""
        });
      });
      setSystemLogs(fetchedLogs);
    });
    return () => unsubscribe();
  }, [user]);
  const [memorySearchQuery, setMemorySearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [searchQueryEmbedding, setSearchQueryEmbedding] = useState<number[] | null>(null);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(memorySearchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [memorySearchQuery]);

  useEffect(() => {
    if (debouncedSearchQuery.trim()) {
      fetch('/api/embed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: debouncedSearchQuery })
      })
      .then(res => res.json())
      .then(data => {
        if (data.embedding) {
          setSearchQueryEmbedding(data.embedding);
        }
      })
      .catch(err => console.error("Error embedding search query", err));
    } else {
      setSearchQueryEmbedding(null);
    }
  }, [debouncedSearchQuery]);

  const [memoryViewMode, setMemoryViewMode] = useState<'list' | 'timeline' | 'graph' | '3d' | 'episodes' | 'skills'>('list');
  const [isConsolidating, setIsConsolidating] = useState(false);
  
  // Bulk selection and actions
  const [selectedMemoryIds, setSelectedMemoryIds] = useState<string[]>([]);
  const [bulkTagInput, setBulkTagInput] = useState('');
  const [isBulkTagging, setIsBulkTagging] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null);
  const [isBulkReinforcing, setIsBulkReinforcing] = useState(false);
  const [isBulkDecaying, setIsBulkDecaying] = useState(false);

  // RL Agent state
  const rlAgent = useRef<CuriousAgent | null>(null);
  const handleManualConsolidateRef = useRef<(() => Promise<void>) | null>(null);
  const [agentStats, setAgentStats] = useState({ epsilon: 1.0, episodes: 0, lastAction: -1 });
  const [cognitiveMode, setCognitiveMode] = useState<'HRL' | 'ActiveInference'>('HRL');
  const [usePolicyNet, setUsePolicyNet] = useState(true);
  const [efeScore, setEfeScore] = useState<number>(0);
  const [curiosityVector, setCuriosityVector] = useState<number[]>([0,0,0,0]);
  const [policyConfidence, setPolicyConfidence] = useState<number>(0);
  const [textToSpeak, setTextToSpeak] = useState<string | null>(null);
  const [nudgeMemory, setNudgeMemory] = useState<NudgeMemory | null>(null);
  const [consolidationProposal, setConsolidationProposal] = useState<ConsolidationProposal | null>(null);

  // Persist cognitive models whenever they change
  useEffect(() => {
    if (!user || !isCognitiveModelLoaded) return;
    const saveCognitiveModel = async () => {
      try {
        const userDocRef = doc(db, "users", user.uid);
        await setDoc(userDocRef, {
          activePersonaId: activePersona.id,
          activeModelId: activeModel,
          neuralSway,
          agentStats,
          depth
        }, { merge: true });
      } catch (e) {
        console.error("Failed to save cognitive model:", e);
      }
    };
    
    // Use a small timeout to debounce slightly if needed, or just execute
    const timer = setTimeout(() => {
      saveCognitiveModel();
    }, 1000);
    return () => clearTimeout(timer);
  }, [user, isCognitiveModelLoaded, activePersona, activeModel, neuralSway, agentStats, depth]);

  useEffect(() => {
    if (!rlAgent.current) {
      // state_dim: 4 (msg count, memory count, depth state, idle state)
      // n_actions: 7 (0: Idle, 1: Change depth, 2: Consolidate memory, 3: Nudge, 4: Consolidate Chats, 5: Insight, 6: Hybrid Sync RAG)
      if (user) {
        rlAgent.current = new CuriousAgent(4, 7, user.uid, 0.001, 0.99, 1.0);
        rlAgent.current.loadWeights(user.uid);
      }

      const agent = rlAgent.current;
      if (!agent) return;

      // Bind the nudge callback
      agent.setNudgeCallback(async () => {
        try {
          const mem = await fetchNudgeMemory(memoriesRef.current);
          if (mem) {
            setNudgeMemory(mem as NudgeMemory);
            setModelState('Nudging');
            addLog(`RL Agent selected proactive action: Memory Nudge [Node: ${mem.id}]`, 'NEURAL', 'RL_ENGINE');
          } else {
            // treat as zero-value nudge if no memory available
            agent.applyNudgeReward('ignore');
          }
        } catch (err) {
          console.error("Nudge callback retrieval failed:", err);
        }
      });

      // Bind the consolidation callback
      agent.setConsolidateCallback(async () => {
        try {
          const latestChatId = await getLatestUnconsolidatedChatId();
          if (latestChatId) {
            const proposal = await fetchConsolidationProposal(latestChatId);
            if (proposal) {
              setConsolidationProposal(proposal);
              setModelState('Consolidating');
              addLog(`RL Agent selected proactive action: Memory Consolidation [Chat: ${latestChatId}]`, 'NEURAL', 'RL_ENGINE');
            } else {
              agent.applyConsolidationReward('ignore');
            }
          } else {
            agent.applyConsolidationReward('ignore');
          }
        } catch (err) {
          console.error("Consolidation callback failed:", err);
          agent.applyConsolidationReward('ignore');
        }
      });

      // Bind the insight callback
      agent.setInsightCallback(async () => {
        try {
          const insight = await fetchInsight();
          if (insight) {
            setActiveInsight(insight);
            setModelState('Inspired');
            addLog(`RL Agent selected proactive action: Creative Insight [Confidence: ${(insight.confidence * 100).toFixed(0)}%]`, 'NEURAL', 'RL_ENGINE');
          } else {
            agent.applyInsightReward('ignore');
          }
        } catch (err) {
          console.error("Insight callback retrieval failed:", err);
          agent.applyInsightReward('ignore');
        }
      });

      // Bind the hybrid sync RAG callback
      agent.setHybridSyncRAGCallback(async () => {
        try {
          setModelState('Syncing');
          addLog("RL Agent initiating Hybrid Sync & Topological RAG", "NEURAL", "RL_ENGINE");
          const res = await fetch('/api/knowledge/sync', { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          });
          const data = await res.json();
          if (data.success) {
            addLog(`Sync complete: ${data.totalDocuments} memory nodes stabilized.`, "INFO", "RAG_SHIM");
            // Auto-reward for successful sync execution
            agent.applyHybridSyncRAGReward(0.2);
          } else {
            agent.applyHybridSyncRAGReward(0);
          }
          setTimeout(() => setModelState('Idle'), 4000);
        } catch (err) {
          console.error("Hybrid Sync failed:", err);
          agent.applyHybridSyncRAGReward(0);
          setModelState('Idle');
        }
      });
    }
  }, [user]);

  // Synchronize RL Agent's internal state representation with App state
  useEffect(() => {
    if (rlAgent.current) {
      const agent = rlAgent.current;
      agent.setDimension(0, messages.length);
      agent.setDimension(1, memories.length);
      
      const depthVal = depth === 'Fast' ? 0 : depth === 'Balanced' ? 1 : 2;
      agent.setDimension(2, depthVal);
      
      const idleMap: Record<ModelState, number> = {
        Idle: 0, Listening: 1, Reasoning: 2, Learning: 3, Nudging: 4, Consolidating: 5, Inspired: 6, Syncing: 7
      };
      agent.setDimension(3, idleMap[modelState] ?? 0);
    }
  }, [messages.length, memories.length, depth, modelState]);

  // Periodic RL Weight Persistence & Experience Flushing
  useEffect(() => {
    if (user && rlAgent.current) {
      const interval = setInterval(() => {
        rlAgent.current?.saveWeights(user.uid);
        rlAgent.current?.flushExperiences(user.uid);
      }, 60000); // Save every minute
      return () => clearInterval(interval);
    }
  }, [user]);

  // Proactive RL Agent Ambient Step Loop
  useEffect(() => {
    const runAgentStep = async () => {
      try {
        if (rlAgent.current && memories.length > 0) {
          const agent = rlAgent.current;
          const state = agent.getState();
          const decision = await agent.selectActionHRL(state);
          
          try {
            const actionIdx = decision.index ?? 0;
            const cVec = agent.getCuriosityVector(state, actionIdx);
            setCuriosityVector(cVec);
          } catch (e) {
            // Ignore if forward model isn't ready
          }
          
          if (decision.type === 'option') {
            const opt = agent.options.get!(decision.optionId!);
            if (opt) {
              agent.activeOption = opt;
              agent.optionInitState = state;
              addLog(`RL Agent activated cognitive mode: ${opt.name}`, 'NEURAL', 'RL_ENGINE');
            }
          } else if (decision.type === 'terminate') {
            addLog(`RL Agent terminated cognitive mode: ${agent.activeOption?.name}`, 'NEURAL', 'RL_ENGINE');
            agent.activeOption = null;
          } else {
            const action = decision.index!;
            
            if (action === 1) {
              const depths: CognitionDepth[] = ['Fast', 'Balanced', 'Deep Reasoning'];
              const nextDepth = depths[Math.floor(Math.random() * depths.length)];
              setDepth(nextDepth);
              addLog(`RL Agent optimized cognition depth to ${nextDepth}.`, 'NEURAL', 'RL_ENGINE');
              
              const nextDepthVal = nextDepth === 'Fast' ? 0 : nextDepth === 'Balanced' ? 1 : 2;
              agent.setDimension(2, nextDepthVal);
              agent.remember(state, action, 1.0, agent.getState());
              agent.train();
            } 
            else if (action === 2) {
              if (memories.length > 5 && !isConsolidating) {
                addLog('RL Agent recommends memory consolidation. Initiating...', 'NEURAL', 'RL_ENGINE');
                handleManualConsolidateRef.current?.();
                agent.remember(state, action, 1.5, state);
                agent.train();
              } else {
                agent.remember(state, action, -1.0, state);
                agent.train();
              }
            }
            else if (action === 3) {
              if (sentimentTrend < -0.3) {
                addLog('Sentiment drift detected! RL Agent triggering proactive mood stabilization nudge.', 'CRITICAL', 'RL_ENGINE');
              }
              agent.nudgeCallback?.();
              agent.remember(state, action, 0.2, state);
              agent.train();
            }
            else if (action === 4) {
              addLog('RL Agent recommends chat consolidation. Initiating...', 'NEURAL', 'RL_ENGINE');
              agent.consolidateCallback?.();
              agent.remember(state, action, 0.2, state);
              agent.train();
            }
            else if (action === 5) {
              agent.insightCallback?.();
              agent.remember(state, action, 0.2, state);
              agent.train();
            }
            else if (action === 6) {
              addLog('RL Agent recommends Hybrid Sync & Topological RAG. Initiating...', 'NEURAL', 'RL_ENGINE');
              agent.hybridSyncRAGCallback?.();
              agent.remember(state, action, 0.5, state);
              agent.train();
            }
            
            setAgentStats(prev => ({ epsilon: agent.epsilon, episodes: prev.episodes + 1, lastAction: action }));
          }
        }
      } catch (e) {
        console.error('Proactive Agent step failed:', e);
      }
    };

    const interval = setInterval(runAgentStep, 25000); // Step every 25 seconds
    return () => clearInterval(interval);
  }, [messages, memories, depth, modelState, isConsolidating]);

  useEffect(() => {
    const interval = setInterval(async () => {
      if (memories.length > 4 && !isConsolidating) {
        setIsConsolidating(true);
        try {
          const response = await fetch('/api/consolidate-memories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ memories })
          });
          if (response.ok) {
            const data = await response.json();
            if (data.consolidated && data.consolidated.length > 0) {
              addLog(`Memory consolidation complete. Synthesized into ${data.consolidated.length} clusters.`, 'NEURAL', 'MEMORY');
              
              if (user) {
                const memoriesRef = collection(db, "users", user.uid, "memories");
                const snapshot = await getDocs(memoriesRef);
                const deletePromises = snapshot.docs.map((doc: any) => deleteDoc(doc.ref));
                await Promise.all(deletePromises);
                
                const addPromises = data.consolidated.map((m: any) => addDoc(memoriesRef, {
                  text: m.text,
                  timestamp: m.timestamp || Date.now(),
                  strength: m.strength || 100,
                  tags: m.tags || []
                }));
                await Promise.all(addPromises);
              } else {
                setMemories(data.consolidated);
              }
            }
          }
        } catch (error) {
          console.error("Failed to consolidate memories:", error);
        } finally {
          setIsConsolidating(false);
        }
      }
    }, 45000); // Check every 45 seconds

    return () => clearInterval(interval);
  }, [memories, isConsolidating, user]);

  const [skills, setSkills] = useState<Skill[]>([
    { id: 's1', name: 'Code Architecture', active: true, proficiency: 95 },
    { id: 's2', name: 'Data Synthesis', active: true, proficiency: 88 },
    { id: 's3', name: 'Creative Ideation', active: false, proficiency: 72 },
    { id: 's4', name: 'Temporal Analysis', active: true, proficiency: 84 },
  ]);
  
  const [newMemory, setNewMemory] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const triggerSwayRNG = () => {
    if (isSpinning) return;
    setIsSpinning(true);
    addLog('Initiating Neural Sway RNG sequence...', 'NEURAL', 'ENGINE');
    
    let ticks = 0;
    const maxTicks = 20;
    
    const interval = setInterval(() => {
      setNeuralSway(prev => ({
        ...prev,
        spins: [
          Math.floor(Math.random() * 5) + 1,
          Math.floor(Math.random() * 5) + 1,
          Math.floor(Math.random() * 5) + 1
        ]
      }));
      ticks++;
      
      if (ticks >= maxTicks) {
        clearInterval(interval);
        const s1 = Math.floor(Math.random() * 5) + 1;
        const s2 = Math.floor(Math.random() * 5) + 1;
        const s3 = Math.floor(Math.random() * 5) + 1;
        const total = s1 + s2 + s3;
        
        let multiplier = 1;
        if (total >= 13) multiplier = 3;
        else if (total >= 9) multiplier = 2;

        setNeuralSway({ spins: [s1, s2, s3], total, multiplier });
        setIsSpinning(false);
        
        addLog(`Sway sequence complete. Total: ${total}. Power Multiplier: ${multiplier}x`, 'NEURAL', 'ENGINE');
        if (multiplier > 1) {
          addLog(`Cognitive bias amplified. Persona influence surged.`, 'CRITICAL', 'ENGINE');
        }
      }
    }, 75);
  };

  const handleSend = async (e?: React.FormEvent, overrideText?: string) => {
    if (e) e.preventDefault();
    rlAgent.current?.applyDelayedInsightReward(0.1);
    const targetText = overrideText || input;
    if (!targetText.trim() || (modelState !== 'Idle' && modelState !== 'Listening')) return;

    const userText = targetText.trim();
    if (!overrideText) setInput('');
    const traceId = `tr_${Math.random().toString(36).substring(2, 11)}`;
    logInteraction('initiate_chat', { textLength: userText.length, traceId });
    
    setModelState('Listening');
    addLog(`Message received: "${userText.substring(0, 30)}..."`, 'INFO', 'CORE', traceId);
    
    // Store user message
    const userMessageData = {
      role: 'user' as const,
      content: userText,
      timestamp: Date.now(),
      traceId
    };
    
    // Optimistic UI update: instantly render user message to avoid lag or blockages
    const userMsgId = `usr_${Math.random().toString(36).substring(2, 11)}`;
    setMessages(prev => {
      if (prev.some(m => m.traceId === traceId)) return prev;
      return [...prev, { id: userMsgId, ...userMessageData }];
    });

    if (user) {
      try {
        const chatsRef = collection(db, "users", user.uid, "chats");
        await addDoc(chatsRef, userMessageData);
      } catch (e) {
        console.error("Failed to save user chat to Firestore:", e);
      }
    }

    if (userText.startsWith('/')) {
      const commandContext: CommandContext = {
        uid: user?.uid || "anonymous",
        db,
        auth,
        vitals,
        systemLogs,
        memories,
        setDepth,
        setActivePersona: (personaIdOrObject: any) => {
          if (typeof personaIdOrObject === 'string') {
            const found = PERSONAS.find(p => p.id === personaIdOrObject || p.name.toUpperCase().includes(personaIdOrObject.toUpperCase()));
            if (found) {
              setActivePersona(found);
              addLog(`Persona state aligned to: ${found.name}`, 'INFO', 'SYSTEM');
            } else {
              addLog(`Persona alignment failed: target ID ${personaIdOrObject} not registered`, 'WARN', 'SYSTEM');
            }
          } else {
            setActivePersona(personaIdOrObject);
          }
        },
        handleManualConsolidate: async () => {
          await handleManualConsolidate();
        },
        clearChat: async () => {
          await clearChat();
          setModelState("Idle");
        },
        triggerNudge: () => {
          fetchNudgeMemory().then((m) => {
            if (m) {
              setNudgeMemory(m as any);
              setModelState('Nudging');
            } else {
              addLog("Nudge trigger completed: no immediate memories require stabilization.", "INFO", "RL_ENGINE");
            }
          }).catch(err => {
            addLog(`Nudge failed: ${err.message}`, "ERROR", "RL_ENGINE");
          });
        },
        addLog: (msg, lvl, src) => addLog(msg, lvl || 'INFO', src || 'SYSTEM')
      };

      try {
        const cmdRes = await handleSlashCommand(userText, commandContext);
        if (cmdRes.handled) {
          if (userText.toLowerCase().trim() === '/clear') {
            setModelState('Idle');
            return;
          }

          const commandMessageData = {
            role: 'ai' as const,
            content: cmdRes.content || "",
            timestamp: Date.now(),
            traceId,
            systemUI: cmdRes.systemUI,
            systemUIData: cmdRes.systemUIData
          };

          if (user) {
            try {
              const chatsRef = collection(db, "users", user.uid, "chats");
              await addDoc(chatsRef, commandMessageData);
            } catch (e) {
              console.error("Failed to save command response to Firestore:", e);
            }
          } else {
            setMessages(prev => [...prev, { id: Date.now().toString(), ...commandMessageData }]);
          }

          if (cmdRes.systemUI === 'persona' && cmdRes.systemUIData?.requestedPersona) {
            const reqP = cmdRes.systemUIData.requestedPersona;
            const found = PERSONAS.find(p => p.id === reqP || p.name.toUpperCase().includes(reqP));
            if (found) {
              setActivePersona(found);
              addLog(`Persona state aligned to: ${found.name}`, 'INFO', 'SYSTEM');
            } else {
              addLog(`Persona alignment failed: target ID ${reqP} not registered`, 'WARN', 'SYSTEM');
            }
          }
          
          if (cmdRes.systemUIData?.intent === 'NAVIGATE_DEBUG') {
            setActiveTab('Neural Debugger');
          }
          if (cmdRes.systemUIData?.intent === 'NAVIGATE_MEMORIA') {
            setActiveTab('Memoria');
          }

          setModelState('Idle');
          return;
        }
      } catch (cmdErr: any) {
        addLog(`Command execution anomaly: ${cmdErr.message}`, 'ERROR', 'DELEGATOR');
      }
    }

    try {
      await new Promise(resolve => setTimeout(resolve, 600)); // Brief simulated listening state
      
      const contextData = `Active Memories:\n${memories.map(m => '- ' + m.text).join('\n')}\n\nActive Talents/Skills:\n${skills.filter(s => s.active).map(s => '- ' + s.name).join('\n')}\n\nCognition Depth: ${depth}`;

      if (isDebateMode) {
        addLog(`Initiating multi-agent debate FSM on: "${userText}"`, 'NEURAL', 'DEBATE', traceId);
        sendDebate({
          type: 'START_DEBATE',
          topic: userText,
          contextData
        });
        return;
      }

      if (userText.toLowerCase().startsWith('/swarm ')) {
        setActiveTab('Swarm');
        addLog(`Routing task to Autonomous Agentic Swarm...`, 'NEURAL', 'ENGINE', traceId);
        setModelState('Idle');
        return;
      }

      setModelState('Reasoning');
      addLog(`Switching to ${depth} cognition mode...`, 'NEURAL', 'ENGINE', traceId);
      
      const historyForApi = messages.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        content: m.content
      }));

      let response: Response;

      if (depth === 'Deep Reasoning') {
        response = await fetch('/api/fractal-think', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: userText })
        });
        
        if (response.ok) {
          const data = await response.json();
          const mappedBranches = data.branches.map((b: string, i: number) => ({
            name: `Hypothesis ${i+1}`,
            text: b
          }));

          const aiMessageData = {
            role: 'ai' as const,
            content: data.synthesis,
            selfAnalysis: "Applied Tree-of-Thoughts to synthesize multiple hypotheses.",
            cognitiveLog: `Fractal Core explored ${data.branches.length} branches.`,
            debateLog: null,
            superpositionBranches: mappedBranches,
            suggestedShortcuts: [],
            systemUI: null as string | null,
            systemUIData: null,
            timestamp: Date.now(),
            traceId,
            isTyping: true
          };

          if (data.selfEvolution) {
            setProposedEvolution({
                fileName: data.selfEvolution.targetFile,
                proposedCode: data.selfEvolution.proposedCode
            });
            aiMessageData.systemUI = "selfEvolution";
            addLog(`Self-evolution proposed for ${data.selfEvolution.targetFile}`, 'WARN', 'SYSTEM', traceId);
          }
          
          if (user) {
            try {
              const chatsRef = collection(db, "users", user.uid, "chats");
              const aiDocRef = doc(chatsRef);
              const { isTyping, ...saveData } = aiMessageData;
              
              setMessages(prev => {
                if (prev.some(m => m.id === aiDocRef.id)) return prev;
                return [...prev, { id: aiDocRef.id, ...aiMessageData }];
              });
              await setDoc(aiDocRef, saveData);
            } catch (e) {
              setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), ...aiMessageData }]);
            }
          } else {
            setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), ...aiMessageData }]);
          }
          
          setModelState('Idle');
          return;
        }
      }

      const apiEndpoint = isSuperpositionMode ? '/api/chat/superposition' : (isDebateMode ? '/api/debate' : '/api/chat');
      response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          history: historyForApi,
          message: userText,
          contextData,
          persona: activePersona.id,
          sway: neuralSway.multiplier,
          depth,
          sessionTraceId: traceId,
          model: activeModel
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const errMsg = typeof errData.error === 'object' && errData.error ? errData.error.message : (errData.error || errData.message || 'API error');
        addLog(`API error: ${errMsg}`, 'ERROR', 'API', traceId);
        throw new Error(errMsg);
      }
      const data = await response.json();
      addLog(`Response generated via ${apiEndpoint}`, 'INFO', 'API', traceId);
      if (data.debateLog) addLog(`Multi-agent consensus reached.`, 'NEURAL', 'DEBATE', traceId);
      if (data.branches) addLog(`Quantum superposition collapsed into definitive answer.`, 'NEURAL', 'ENGINE', traceId);
      
      if (data.needsReset) {
          addLog("Triggering reset: AI greeting/repetition detected.", "WARN", "SYSTEM");
          await clearChat();
          setModelState("Idle");
          return;
      }
      
      if (data.codeExecution && data.codeExecution.code) {
          addLog(`Executing AI-generated code...`, 'INFO', 'SANDBOX', traceId);
          try {
              const execRes = await fetch('/api/execute-code', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ code: data.codeExecution.code }),
              });
              const execData = await execRes.json();
              addLog(`Code execution result: ${JSON.stringify(execData)}`, 'INFO', 'SANDBOX', traceId);
          } catch (e) {
              addLog(`Code execution failed: ${e}`, 'ERROR', 'SANDBOX', traceId);
          }
      }
      
      if (data.text || data.collapsedResponse) {
        setTextToSpeak(data.text || data.collapsedResponse);
      }
      
      const aiMessageData = {
        role: 'ai' as const,
        content: data.text || data.collapsedResponse,
        selfAnalysis: data.selfAnalysis || "",
        cognitiveLog: data.cognitiveLog || null,
        debateLog: data.debateLog || null,
        superpositionBranches: data.branches || null,
        suggestedShortcuts: data.suggestedShortcuts || [],
        systemUI: data.systemUI || null,
        systemUIData: data.systemUIData || null,
        timestamp: Date.now(),
        traceId,
        isTyping: true
      };

      if (data.selfEvolution) {
        setProposedEvolution({
            fileName: data.selfEvolution.targetFile,
            proposedCode: data.selfEvolution.proposedCode
        });
        aiMessageData.systemUI = "selfEvolution";
        addLog(`Self-evolution proposed for ${data.selfEvolution.targetFile}`, 'WARN', 'SYSTEM', traceId);
      }

      if (user) {
        try {
          const chatsRef = collection(db, "users", user.uid, "chats");
          const aiDocRef = doc(chatsRef); // Generate ID locally
          const { isTyping, ...saveData } = aiMessageData;
          
          // Local update to trigger typewriter immediately for logged-in users too
          setMessages(prev => {
            if (prev.some(m => m.id === aiDocRef.id)) return prev;
            return [...prev, { id: aiDocRef.id, ...aiMessageData }];
          });
          
          await setDoc(aiDocRef, saveData); // Don't save isTyping to firestore
        } catch (e) {
          console.error("Failed to save AI chat to Firestore:", e);
          // Fallback if firestore fails
          setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), ...aiMessageData }]);
        }
      } else {
        setMessages(prev => [...prev, { 
          id: (Date.now() + 1).toString(), 
          ...aiMessageData
        }]);
      }

      if (data.extractedMemory) {
        addLog(`Extracting new memory: ${data.extractedMemory}`, 'NEURAL', 'MEMORY', traceId);
        
        let embedding: number[] | undefined = undefined;
        try {
          const embedRes = await fetch('/api/embed', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: data.extractedMemory }) });
          const embedData = await embedRes.json();
          if (embedData.embedding) embedding = embedData.embedding;
        } catch (e) {
          console.warn("Failed to generate embedding for extracted memory", e);
        }

        if (user) {
          try {
            const memoriesRef = collection(db, "users", user.uid, "memories");
            await addDoc(memoriesRef, {
              text: data.extractedMemory,
              timestamp: Date.now(),
              strength: 100,
              tags: data.extractedTags || [],
              ...(embedding ? { embedding } : {})
            });
          } catch (e) {
            console.error("Failed to save extracted memory to Firestore:", e);
          }
        } else {
          setMemories(prev => [...prev, {
            id: `ext-${Date.now()}`,
            text: data.extractedMemory,
            timestamp: Date.now(),
            strength: 100,
            tags: data.extractedTags || [],
            embedding
          }]);
        }
        // Also add to vector RAG knowledge base
        fetch('/api/knowledge/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: data.extractedMemory })
        }).catch(e => console.error("Failed to add to RAG KB", e));

        setModelState('Learning');
        setTimeout(() => setModelState('Idle'), 2500);
      } else {
        setModelState('Idle');
      }

      // Yield to the event loop to allow React to paint the message and the 'Idle' state
      await new Promise(resolve => setTimeout(resolve, 50));

      // -- RL Agent Interaction --
      if (rlAgent.current) {
        const agent = rlAgent.current;
        agent.useActiveInference = cognitiveMode === 'ActiveInference';
        
        const state = agent.getState();
        const decision = await agent.act(state);
        if (decision.efe !== undefined) setEfeScore(decision.efe);
        if (decision.confidence !== undefined) setPolicyConfidence(decision.confidence);
        const action = typeof decision === 'number' ? decision : (decision.index ?? 0);
        addLog(`RL Agent selected action: ${action} [Mode: ${cognitiveMode}]`, 'INFO', 'RL_ENGINE');
        
        // If Active Inference, we can get the EFE from the planner (if we exposed it)
        // For now, let's just use the action
        
        let reward = 0;
        if (action === 1) { 
          const depths: CognitionDepth[] = ['Fast', 'Balanced', 'Deep Reasoning'];
          const nextDepth = depths[Math.floor(Math.random() * depths.length)];
          setDepth(nextDepth);
          reward = 1.0; 
        } else if (action === 2) {
          if (memories.length > 5 && !isConsolidating) {
            handleManualConsolidateRef.current?.();
            reward = 1.5;
          } else {
            reward = -1.0;
          }
        } else if (action === 3) {
          // Nudge action is triggered via callback, assign low default reward
          reward = 0.2;
        } else if (action === 4) {
          // Chat Consolidation action is triggered via callback, assign low default reward
          reward = 0.2;
        } else if (action === 5) {
          // Insight action is triggered via callback
          reward = 0.2;
        } else if (action === 6) {
          // Hybrid Sync RAG action is triggered via callback
          reward = 0.3;
        } else {
          reward = 0.1; 
        }
        
        if (data.extractedMemory) reward += 2.0;

        // Update the dimensions internally to sync the post-action state
        agent.setDimension(0, messages.length + 1);
        agent.setDimension(1, memories.length + (data.extractedMemory ? 1 : 0));
        const nextDepthVal = depth === 'Fast' ? 0 : depth === 'Balanced' ? 1 : 2;
        agent.setDimension(2, nextDepthVal);
        const nextState = agent.getState();

        agent.remember(state, decision, reward, nextState);
        agent.train();
        
        setAgentStats(prev => ({ epsilon: agent.epsilon, episodes: prev.episodes + 1, lastAction: action }));
      }
      // -- End RL Agent Interaction --
    } catch (error) {
      console.error('Chat error:', error);
      const errMessageData = {
        role: 'ai' as const,
        content: error instanceof Error ? error.message : "Communication anomaly detected. My neural pathways experienced a disruption. (Ensure the Gemini API key is configured).",
        timestamp: Date.now(),
        systemUI: 'error-card' as const,
        systemUIData: {
          errorMessage: error instanceof Error ? error.message : String(error),
          traceId
        }
      };
      if (user) {
        try {
          const chatsRef = collection(db, "users", user.uid, "chats");
          await addDoc(chatsRef, errMessageData);
        } catch (e) {
          console.error("Failed to save error chat to Firestore:", e);
        }
      } else {
        setMessages(prev => [...prev, { 
          id: (Date.now() + 1).toString(), 
          ...errMessageData,
          isTyping: false 
        }]);
      }
      setModelState('Idle');
    }
  };

  const handleSpeechRecognized = useCallback((text: string) => {
    handleSend(undefined, text);
  }, [handleSend]);

  const collapseMemoryWavefunction = useCallback((id: string) => {
    setMemories(prev => prev.map(m => {
      if (m.id === id && m.superpositionSummaries && m.superpositionSummaries.length > 0) {
        const sorted = [...m.superpositionSummaries].sort((a, b) => b.probability - a.probability);
        const collapsedText = sorted[0].text;
        addLog(`Wavefunction collapsed for memory [${id}]. settled on: "${collapsedText}"`, 'NEURAL', 'QUANTUM');
        
        // Entangled cascade collapse
        if (m.entangledId) {
          setTimeout(() => collapseMemoryWavefunction(m.entangledId!), 250);
        }
        
        return {
          ...m,
          text: collapsedText,
          superpositionSummaries: undefined
        };
      }
      return m;
    }));
  }, []);

  const [isTagging, setIsTagging] = useState(false);

  const addMemoryDirectly = async (text: string, tags: string[] = []) => {
    addLog(`Direct neural link: injecting custom concept node`, 'INFO', 'CORE');
    const strength = 100;
    
    let embedding: number[] | undefined = undefined;
    try {
      const res = await fetch('/api/embed', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
      const data = await res.json();
      if (data.embedding) embedding = data.embedding;
    } catch (e) {
      console.warn("Failed to generate embedding for manual memory", e);
    }

    if (user) {
      try {
        const memoriesRef = collection(db, "users", user.uid, "memories");
        await addDoc(memoriesRef, {
          text,
          timestamp: Date.now(),
          strength,
          tags,
          ...(embedding ? { embedding } : {})
        });
        addLog(`Synaptic node integrated to persistent cloud database.`, 'INFO', 'ENGINE');
      } catch (e) {
        console.error("Failed to save memory to Firestore:", e);
        addLog(`Cloud integration failed: offline backup initiated.`, 'ERROR', 'ENGINE');
        setMemories(prev => [...prev, { 
          id: Date.now().toString(), 
          text,
          timestamp: Date.now(),
          strength,
          tags,
          embedding
        }]);
      }
    } else {
      setMemories(prev => [...prev, { 
        id: Date.now().toString(), 
        text,
        timestamp: Date.now(),
        strength,
        tags,
        embedding
      }]);
      addLog(`Synaptic node integrated in client transient session.`, 'INFO', 'ENGINE');
    }
  };

  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemory.trim() || isTagging) return;
    
    const text = newMemory.trim();
    setNewMemory('');
    setIsTagging(true);
    setModelState('Learning');
    
    try {
      const response = await fetch('/api/tag-memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      const data = await response.json();
      
      const tags = data.tags || [];
      const strength = Math.floor(Math.random() * 40) + 60;
      
      if (user) {
        try {
          const memoriesRef = collection(db, "users", user.uid, "memories");
          await addDoc(memoriesRef, {
            text,
            timestamp: Date.now(),
            strength,
            tags
          });
        } catch (e) {
          console.error("Failed to save manual memory to Firestore:", e);
        }
      } else {
        setMemories(prev => [...prev, { 
          id: Date.now().toString(), 
          text,
          timestamp: Date.now(),
          strength,
          tags
        }]);
      }
    } catch (err) {
      console.error(err);
      const strength = Math.floor(Math.random() * 40) + 60;
      if (user) {
        try {
          const memoriesRef = collection(db, "users", user.uid, "memories");
          await addDoc(memoriesRef, {
            text,
            timestamp: Date.now(),
            strength,
            tags: []
          });
        } catch (e) {
          console.error("Failed to save fallback manual memory:", e);
        }
      } else {
        setMemories(prev => [...prev, { 
          id: Date.now().toString(), 
          text,
          timestamp: Date.now(),
          strength,
          tags: []
        }]);
      }
    } finally {
      setIsTagging(false);
      setTimeout(() => setModelState('Idle'), 1500);
    }
  };

  const removeMemory = async (id: string) => {
    if (user) {
      try {
        await deleteDoc(doc(db, "users", user.uid, "memories", id));
      } catch (e) {
        console.error("Failed to delete memory from Firestore:", e);
      }
    } else {
      setMemories(prev => prev.filter(m => m.id !== id));
    }
  };

  const togglePinMemory = async (id: string) => {
    const memory = memories.find(m => m.id === id);
    logInteraction('pin_memory', { memoryId: id });
    if (memory && user) {
      try {
        await setDoc(doc(db, "users", user.uid, "memories", id), {
          pinned: !memory.pinned
        }, { merge: true });
      } catch (e) {
        console.error("Failed to pin memory in Firestore:", e);
      }
    } else {
      setMemories(prev => prev.map(m => m.id === id ? { ...m, pinned: !m.pinned } : m));
    }
  };

  const handleBulkTag = async () => {
    if (selectedMemoryIds.length === 0 || !bulkTagInput.trim()) return;
    const tagToApply = bulkTagInput.trim();
    setIsBulkTagging(true);
    addLog(`Applying tag "${tagToApply}" to ${selectedMemoryIds.length} memories...`, 'INFO', 'MEMORY');

    try {
      if (user) {
        const updatePromises = selectedMemoryIds.map(async (id) => {
          const memoryRef = doc(db, "users", user.uid, "memories", id);
          const memObj = memories.find(m => m.id === id);
          const currentTags = memObj?.tags || [];
          const updatedTags = currentTags.includes(tagToApply) ? currentTags : [...currentTags, tagToApply];
          await setDoc(memoryRef, { tags: updatedTags }, { merge: true });
        });
        await Promise.all(updatePromises);
        addLog(`Successfully tagged ${selectedMemoryIds.length} memories in Firestore.`, 'NEURAL', 'MEMORY');
      } else {
        setMemories(prev => prev.map(m => {
          if (selectedMemoryIds.includes(m.id)) {
            const currentTags = m.tags || [];
            const updatedTags = currentTags.includes(tagToApply) ? currentTags : [...currentTags, tagToApply];
            return { ...m, tags: updatedTags };
          }
          return m;
        }));
        addLog(`Successfully tagged ${selectedMemoryIds.length} memories locally.`, 'NEURAL', 'MEMORY');
      }
      setSelectedMemoryIds([]);
      setBulkTagInput('');
    } catch (e) {
      console.error("Bulk tagging failed:", e);
      addLog(`Failed bulk tagging: ${e instanceof Error ? e.message : String(e)}`, 'ERROR', 'MEMORY');
    } finally {
      setIsBulkTagging(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedMemoryIds.length === 0) return;
    setIsBulkDeleting(true);
    addLog(`Deleting ${selectedMemoryIds.length} memories...`, 'WARN', 'MEMORY');

    try {
      if (user) {
        const deletePromises = selectedMemoryIds.map(id => 
          deleteDoc(doc(db, "users", user.uid, "memories", id))
        );
        await Promise.all(deletePromises);
        addLog(`Successfully deleted ${selectedMemoryIds.length} memories in Firestore.`, 'NEURAL', 'MEMORY');
      } else {
        setMemories(prev => prev.filter(m => !selectedMemoryIds.includes(m.id)));
        addLog(`Successfully deleted ${selectedMemoryIds.length} memories locally.`, 'NEURAL', 'MEMORY');
      }
      setSelectedMemoryIds([]);
    } catch (e) {
      console.error("Bulk deletion failed:", e);
      addLog(`Failed bulk deletion: ${e instanceof Error ? e.message : String(e)}`, 'ERROR', 'MEMORY');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleSelectAllMemories = () => {
    const allIds = filteredMemories.map(m => m.id);
    setSelectedMemoryIds(allIds);
    addLog(`Selected all ${allIds.length} filtered memories.`, 'INFO', 'SYSTEM');
  };

  const handleClearMemorySelection = () => {
    setSelectedMemoryIds([]);
    addLog("Cleared memory selection.", "INFO", "SYSTEM");
  };

  const clearChat = async () => {
    if (user) {
      addLog("Initiating chat history reset...", "WARN", "SYSTEM");
      try {
        const chatsRef = collection(db, "users", user.uid, "chats");
        const snapshot = await getDocs(chatsRef);
        const deletePromises = snapshot.docs.map((doc: any) => deleteDoc(doc.ref));
        await Promise.all(deletePromises);
        addLog("Chat history successfully cleared.", "INFO", "SYSTEM");
      } catch (e) {
        console.error("Failed to clear chat history from Firestore:", e);
        addLog("Error resetting chat history.", "ERROR", "SYSTEM");
      }
    } else {
      setMessages([]);
    }
  };

  const toggleSkill = (id: string) => {
    setSkills(prev => prev.map(s => s.id === id ? { ...s, active: !s.active } : s));
  };

  const handleSingleUpdateStrength = async (id: string, strength: number) => {
    try {
      if (user) {
        const memoryRef = doc(db, "users", user.uid, "memories", id);
        await setDoc(memoryRef, { strength }, { merge: true });
        addLog(`Adjusted memory strength to ${strength}%.`, 'INFO', 'MEMORY');
      } else {
        setMemories(prev => prev.map(m => m.id === id ? { ...m, strength } : m));
        addLog(`Adjusted memory strength to ${strength}% locally.`, 'INFO', 'MEMORY');
      }
    } catch (e) {
      console.error("Failed to update memory strength:", e);
      addLog(`Error adjusting memory strength: ${e instanceof Error ? e.message : String(e)}`, 'ERROR', 'MEMORY');
    }
  };

  const handleBulkUpdateStrength = async (strength: number) => {
    if (selectedMemoryIds.length === 0) return;
    const isReinforce = strength >= 100;
    if (isReinforce) {
      setIsBulkReinforcing(true);
      addLog(`Reinforcing ${selectedMemoryIds.length} selected memories...`, 'INFO', 'MEMORY');
    } else {
      setIsBulkDecaying(true);
      addLog(`Fading ${selectedMemoryIds.length} selected memories...`, 'INFO', 'MEMORY');
    }

    try {
      if (user) {
        const updatePromises = selectedMemoryIds.map(async (id) => {
          const memoryRef = doc(db, "users", user.uid, "memories", id);
          await setDoc(memoryRef, { strength }, { merge: true });
        });
        await Promise.all(updatePromises);
        addLog(`Successfully updated ${selectedMemoryIds.length} memories in Firestore.`, 'NEURAL', 'MEMORY');
      } else {
        setMemories(prev => prev.map(m => {
          if (selectedMemoryIds.includes(m.id)) {
            return { ...m, strength };
          }
          return m;
        }));
        addLog(`Successfully updated ${selectedMemoryIds.length} memories locally.`, 'NEURAL', 'MEMORY');
      }
      setSelectedMemoryIds([]);
    } catch (e) {
      console.error("Bulk strength update failed:", e);
      addLog(`Failed bulk strength update: ${e instanceof Error ? e.message : String(e)}`, 'ERROR', 'MEMORY');
    } finally {
      setIsBulkReinforcing(false);
      setIsBulkDecaying(false);
    }
  };

  const handleManualConsolidate = async () => {
    if (isConsolidating) return;
    if (memories.length === 0) {
      addLog("Cannot consolidate an empty memory registry.", "WARN", "MEMORY");
      return;
    }
    setIsConsolidating(true);
    addLog("Initiating manual memory consolidation...", "NEURAL", "MEMORY");
    try {
      const response = await fetch('/api/consolidate-memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memories })
      });
      if (response.ok) {
        const data = await response.json();
        if (data.consolidated && data.consolidated.length > 0) {
          addLog(`Consolidation successful! Synthesized ${memories.length} nodes down to ${data.consolidated.length} clusters.`, 'NEURAL', 'MEMORY');
          
          if (user) {
            const memoriesRef = collection(db, "users", user.uid, "memories");
            const snapshot = await getDocs(memoriesRef);
            const deletePromises = snapshot.docs.map((doc: any) => deleteDoc(doc.ref));
            await Promise.all(deletePromises);
            
            const addPromises = data.consolidated.map((m: any) => addDoc(memoriesRef, {
              text: m.text,
              timestamp: m.timestamp || Date.now(),
              strength: m.strength || 100,
              tags: m.tags || []
            }));
            await Promise.all(addPromises);
          } else {
            setMemories(data.consolidated);
          }
        } else {
          addLog("Consolidation yielded no changes.", "INFO", "MEMORY");
        }
      } else {
        const errorText = await response.text();
        addLog(`Consolidation service returned error: ${errorText}`, "ERROR", "MEMORY");
      }
    } catch (error) {
      console.error("Manual memory consolidation failed:", error);
      addLog(`Consolidation failed: ${error instanceof Error ? error.message : String(error)}`, "ERROR", "MEMORY");
    } finally {
      setIsConsolidating(false);
    }
  };

  const handleSaveInsight = async (insight: InsightData) => {
    try {
      await saveInsightMemory(insight);
      setActiveInsight(null);
      setModelState('Idle');
      rlAgent.current?.applyInsightReward('accept');
    } catch (e) {
      console.error(e);
    }
  };

  const handleDismissInsight = () => {
    setActiveInsight(null);
    setModelState('Idle');
    rlAgent.current?.applyInsightReward('dismiss');
  };

  const handleInsightTimeout = () => {
    setActiveInsight(null);
    setModelState('Idle');
    rlAgent.current?.applyInsightReward('ignore');
  };

  useEffect(() => {
    handleManualConsolidateRef.current = handleManualConsolidate;
  }, [memories, isConsolidating]);

  const handleNudgeUse = (text: string) => {
    setInput(prev => prev ? prev + ' ' + text : text);
    
    if (rlAgent.current) {
      rlAgent.current.applyNudgeReward('click');
    }
    
    logSystemEvent({ type: 'nudge_use', memoryId: nudgeMemory?.id, engagement: 'click' });
    setModelState('Idle');
    setNudgeMemory(null);
    addLog('Nudge accepted. Recall completed.', 'NEURAL', 'RL_ENGINE');
  };

  const handleNudgeDismiss = () => {
    if (rlAgent.current) {
      rlAgent.current.applyNudgeReward('dismiss');
    }
    
    logSystemEvent({ type: 'nudge_dismiss', memoryId: nudgeMemory?.id, engagement: 'dismiss' });
    setModelState('Idle');
    setNudgeMemory(null);
    addLog('Nudge dismissed. Adjusted reinforcement weights.', 'INFO', 'RL_ENGINE');
  };

  const handleNudgeTimeout = () => {
    if (rlAgent.current) {
      rlAgent.current.applyNudgeReward('ignore');
    }
    
    logSystemEvent({ type: 'nudge_timeout', memoryId: nudgeMemory?.id, engagement: 'ignore' });
    setModelState('Idle');
    setNudgeMemory(null);
    addLog('Nudge timed out. Engagement recorded as ignore.', 'INFO', 'RL_ENGINE');
  };

  const handleConsolidationConfirm = async (proposal: ConsolidationProposal) => {
    // Optimistic Update
    const optimisticMemory = {
      id: `mem-${Date.now()}`,
      text: proposal.summary,
      timestamp: Date.now(),
      strength: proposal.confidence,
      tags: proposal.tags,
      pinned: false
    };

    setMemories(prev => [...prev, optimisticMemory]);
    setModelState('Idle');
    setConsolidationProposal(null);
    
    // Background Sync
    try {
      await confirmMemory(proposal);
      if (rlAgent.current) {
        rlAgent.current.applyConsolidationReward('confirm');
      }
      logSystemEvent({ type: 'consolidate_confirm', payload: { chatId: proposal.chatId }, engagement: 'click' });
      addLog('Memory consolidation confirmed and saved. Q-values optimized.', 'NEURAL', 'RL_ENGINE');
    } catch (error) {
      console.error("Failed to confirm consolidation memory:", error);
      // Rollback
      setMemories(prev => prev.filter(m => m.id !== optimisticMemory.id));
      setModelState('Consolidating');
      setConsolidationProposal(proposal);
      addLog('Failed to sync consolidation. Please try again.', 'ERROR', 'SYSTEM');
    }
  };

  const handleConsolidationDismiss = () => {
    if (rlAgent.current) {
      rlAgent.current.applyConsolidationReward('dismiss');
    }
    logSystemEvent({ type: 'consolidate_dismiss', payload: { chatId: consolidationProposal?.chatId }, engagement: 'dismiss' });
    setModelState('Idle');
    setConsolidationProposal(null);
    addLog('Consolidation dismissed. Reinforcement adjusted.', 'INFO', 'RL_ENGINE');
  };

  const handleConsolidationTimeout = () => {
    if (rlAgent.current) {
      rlAgent.current.applyConsolidationReward('ignore');
    }
    logSystemEvent({ type: 'consolidate_timeout', payload: { chatId: consolidationProposal?.chatId }, engagement: 'ignore' });
    setModelState('Idle');
    setConsolidationProposal(null);
    addLog('Consolidation timed out. Registered as ignore.', 'INFO', 'RL_ENGINE');
  };

  const filteredMemories = useMemo(() => {
    let result = [...memories];

    if (memorySearchQuery.trim()) {
      if (searchQueryEmbedding) {
        result = result
          .map((m) => {
            let sim = 0;
            if (m.embedding) {
              sim = cosineSimilarity(m.embedding, searchQueryEmbedding);
            } else {
              sim = m.text.toLowerCase().includes(memorySearchQuery.toLowerCase()) ? 0.5 : 0;
            }
            return { ...m, _sim: sim };
          })
          .filter((m) => m.pinned || m._sim > 0.3)
          .sort((a, b) => {
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            return b._sim - a._sim;
          });
      } else {
        result = result.filter(m => m.pinned || m.text.toLowerCase().includes(memorySearchQuery.toLowerCase()));
      }
    }

    result = result.filter((m) => {
      const matchesTag = !selectedTagFilter || (m.tags && m.tags.includes(selectedTagFilter));
      const memoryDate = new Date(m.timestamp);
      const matchesStartDate = !startDateFilter || memoryDate >= new Date(startDateFilter);
      const matchesEndDate = !endDateFilter || memoryDate <= new Date(endDateFilter);
      return matchesTag && matchesStartDate && matchesEndDate;
    });

    if (!memorySearchQuery.trim() || !searchQueryEmbedding) {
      result.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return b.timestamp - a.timestamp;
      });
    }
    
    return result;
  }, [memories, memorySearchQuery, searchQueryEmbedding, selectedTagFilter, startDateFilter, endDateFilter]);

  if (appView === 'landing' || !user) {
    return (
      <LandingScreen theme={theme}
        onEnter={async () => {
          if (!user) {
            setIsAuthLoading(true);
            setAuthError(null);
            try {
              await anonymousSignIn();
            } catch (error: any) {
              console.error("Sign in failed:", error);
              setAuthError(error?.message || String(error));
              setIsAuthLoading(false);
              return;
            }
            setIsAuthLoading(false);
          }
          addLog("Neural connection established freely.", "NEURAL", "BRIDGE");
          sessionStartTime.current = Date.now();
          lastActivity.current = Date.now();
          setAppView('dashboard');
        }}
        onEnterGuest={async () => {
          setIsAuthLoading(true);
          setAuthError(null);
          try {
            await anonymousSignIn();
          } catch (error: any) {
            console.error("Guest sign in failed:", error);
            setAuthError(error?.message || String(error));
            setIsAuthLoading(false);
            return;
          }
          setIsAuthLoading(false);
          addLog("Neural connection established via Guest Mode.", "NEURAL", "BRIDGE");
          sessionStartTime.current = Date.now();
          lastActivity.current = Date.now();
          setAppView('dashboard');
        }}
        isLoading={isAuthLoading}
        authError={authError}
        toggleTheme={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
      />
    );
  }

  return (
    <>
      {showOnboarding && <Suspense fallback={<LazyFallback />}><OnboardingWizard onComplete={handleOnboardingComplete} /></Suspense>}
      {isApiUnreachable && <LocalOnlyModeBanner />}

      <div className={`flex h-screen w-full transition-colors duration-500 overflow-hidden font-sans relative selection:bg-teal-500/30 ${
      theme === 'dark' ? 'bg-[#0a0a0f] text-slate-200' : 'bg-slate-50 text-slate-900'
    } ${neuralSway.multiplier >= 3 ? 'hue-rotate-[10deg] saturate-[1.2]' : ''}`}
    style={{ '--app-hue': (sentimentTrend * 100 + 220) + 'deg' } as React.CSSProperties}>
      {/* Overclocking Overlay */}
      {neuralSway.multiplier >= 3 && (
        <div className="fixed inset-0 pointer-events-none z-50 bg-amber-500/5 animate-pulse mix-blend-overlay" />
      )}
      
      {/* 1. Ambient Background Layer */}
      <UnconsciousBackground 
        theme={theme} 
        cognitiveLoad={depth === 'Fast' ? 0.2 : depth === 'Balanced' ? 0.5 : 0.9} 
        efeScore={efeScore} 
      />

      {/* 2. Glass UI Layer */}
      <div className="flex z-10 w-full h-full relative backdrop-blur-[2px]">
        
        {/* Left Rail: Memory & Skills Panel */}
        <nav className={`flex-shrink-0 transition-all duration-300 ease-in-out ${theme === 'dark' ? 'border-white/5 bg-black/40' : 'border-black/5 bg-white/60'} backdrop-blur-md overflow-hidden z-30
        fixed bottom-0 left-0 right-0 h-16 flex flex-row items-center justify-around py-2 border-t md:border-t-0 md:border-r md:relative md:h-full md:w-20 md:flex-col md:py-4 md:justify-start`}>
           <div className="relative flex items-center justify-center w-10 h-10 cursor-pointer md:mb-4 hidden md:flex" onClick={() => setSidebarOpen(!isSidebarOpen)}>
             <svg viewBox="0 0 24 24" className={`w-full h-full stroke-amber-400 ${theme === 'dark' ? 'fill-amber-950/50' : 'fill-amber-100/50'}`} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
               <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
               <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
               <line x1="12" y1="22.08" x2="12" y2="12"></line>
             </svg>
             <span className="absolute text-[9px] font-bold text-amber-500 translate-y-[2px]">AQB</span>
           </div>

           <div className="flex flex-row md:flex-col gap-1 md:gap-2 w-full px-2 md:mt-4 overflow-x-auto md:overflow-visible scrollbar-hide justify-around md:justify-start flex-1 md:flex-none">
             <button onClick={() => handleTabChange('Chat')} title="Neural Interface" className={`p-2 md:p-3 w-full flex items-center justify-center rounded-xl transition-all ${activeTab === 'Chat' ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30' : theme === 'dark' ? 'text-slate-400 hover:text-slate-200 hover:bg-white/5' : 'text-slate-500 hover:text-slate-900 hover:bg-black/5'}`}>
               <MessageSquare className="w-5 h-5" />
             </button>
             <button onClick={() => handleTabChange('Memory')} title="Memory" className={`p-2 md:p-3 w-full flex items-center justify-center rounded-xl transition-all ${activeTab === 'Memory' ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30' : theme === 'dark' ? 'text-slate-400 hover:text-slate-200 hover:bg-white/5' : 'text-slate-500 hover:text-slate-900 hover:bg-black/5'}`}>
               <Brain className={`w-5 h-5 ${isConsolidating ? 'animate-pulse text-teal-300' : ''}`} />
             </button>
             <button onClick={() => handleTabChange('Identity')} title="Identity" className={`p-2 md:p-3 w-full flex items-center justify-center rounded-xl transition-all ${activeTab === 'Identity' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : theme === 'dark' ? 'text-slate-400 hover:text-slate-200 hover:bg-white/5' : 'text-slate-500 hover:text-slate-900 hover:bg-black/5'}`}>
               <Fingerprint className="w-5 h-5" />
             </button>
             <button onClick={() => handleTabChange('Goals')} title="Goals" className={`p-2 md:p-3 w-full flex items-center justify-center rounded-xl transition-all ${activeTab === 'Goals' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : theme === 'dark' ? 'text-slate-400 hover:text-slate-200 hover:bg-white/5' : 'text-slate-500 hover:text-slate-900 hover:bg-black/5'}`}>
               <Target className="w-5 h-5" />
             </button>
             <button onClick={() => handleTabChange('Diagnostics')} title="Diagnostics" className={`p-2 md:p-3 w-full flex items-center justify-center rounded-xl transition-all ${activeTab === 'Diagnostics' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : theme === 'dark' ? 'text-slate-400 hover:text-slate-200 hover:bg-white/5' : 'text-slate-500 hover:text-slate-900 hover:bg-black/5'}`}>
               <Stethoscope className="w-5 h-5" />
             </button>
             <button onClick={() => handleTabChange('Swarm')} title="Agentic Swarm" className={`p-2 md:p-3 w-full flex items-center justify-center rounded-xl transition-all ${activeTab === 'Swarm' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : theme === 'dark' ? 'text-slate-400 hover:text-slate-200 hover:bg-white/5' : 'text-slate-500 hover:text-slate-900 hover:bg-black/5'}`}>
               <Network className="w-5 h-5" />
             </button>
             <button onClick={() => handleTabChange('Dream Cinema')} title="Dream Cinema" className={`p-2 md:p-3 w-full flex items-center justify-center rounded-xl transition-all ${activeTab === 'Dream Cinema' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : theme === 'dark' ? 'text-slate-400 hover:text-slate-200 hover:bg-white/5' : 'text-slate-500 hover:text-slate-900 hover:bg-black/5'}`}>
               <Film className="w-5 h-5" />
             </button>
             <button onClick={() => handleTabChange('Sandbox')} title="Sandbox" className={`p-2 md:p-3 w-full flex items-center justify-center rounded-xl transition-all ${activeTab === 'Sandbox' ? 'bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/30' : theme === 'dark' ? 'text-slate-400 hover:text-slate-200 hover:bg-white/5' : 'text-slate-500 hover:text-slate-900 hover:bg-black/5'}`}>
               <Code2 className="w-5 h-5" />
             </button>
             <button onClick={() => handleTabChange('Brains')} title="Brains" className={`p-2 md:p-3 w-full flex items-center justify-center rounded-xl transition-all ${activeTab === 'Brains' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : theme === 'dark' ? 'text-slate-400 hover:text-slate-200 hover:bg-white/5' : 'text-slate-500 hover:text-slate-900 hover:bg-black/5'}`}>
               <Cpu className="w-5 h-5" />
             </button>
             <button onClick={() => handleTabChange('Heartbeat')} title="Heartbeat" className={`p-2 md:p-3 w-full flex items-center justify-center rounded-xl transition-all ${activeTab === 'Heartbeat' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : theme === 'dark' ? 'text-slate-400 hover:text-slate-200 hover:bg-white/5' : 'text-slate-500 hover:text-slate-900 hover:bg-black/5'}`}>
               <Activity className="w-5 h-5" />
             </button>
             <button onClick={() => handleTabChange('Mind Map')} title="Mind Map" className={`p-2 md:p-3 w-full flex items-center justify-center rounded-xl transition-all ${activeTab === 'Mind Map' ? 'bg-pink-500/20 text-pink-400 border border-pink-500/30' : theme === 'dark' ? 'text-slate-400 hover:text-slate-200 hover:bg-white/5' : 'text-slate-500 hover:text-slate-900 hover:bg-black/5'}`}>
               <Network className="w-5 h-5" />
             </button>
             <button onClick={() => handleTabChange('Brainstorm')} title="Brainstorm" className={`p-2 md:p-3 w-full flex items-center justify-center rounded-xl transition-all ${activeTab === 'Brainstorm' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' : theme === 'dark' ? 'text-slate-400 hover:text-slate-200 hover:bg-white/5' : 'text-slate-500 hover:text-slate-900 hover:bg-black/5'}`}>
               <Lightbulb className="w-5 h-5" />
             </button>
             <button onClick={() => handleTabChange('Logs')} title="Logs" className={`p-2 md:p-3 w-full flex items-center justify-center rounded-xl transition-all ${activeTab === 'Logs' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : theme === 'dark' ? 'text-slate-400 hover:text-slate-200 hover:bg-white/5' : 'text-slate-500 hover:text-slate-900 hover:bg-black/5'}`}>
               <Terminal className="w-5 h-5" />
             </button>
             <button onClick={() => handleTabChange('Telemetry')} title="Telemetry" className={`p-2 md:p-3 w-full flex items-center justify-center rounded-xl transition-all ${activeTab === 'Telemetry' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : theme === 'dark' ? 'text-slate-400 hover:text-slate-200 hover:bg-white/5' : 'text-slate-500 hover:text-slate-900 hover:bg-black/5'}`}>
               <Database className="w-5 h-5" />
             </button>
             <button onClick={() => handleTabChange('Workspace')} title="Workspace" className={`p-2 md:p-3 w-full flex items-center justify-center rounded-xl transition-all ${activeTab === 'Workspace' ? 'bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/30' : theme === 'dark' ? 'text-slate-400 hover:text-slate-200 hover:bg-white/5' : 'text-slate-500 hover:text-slate-900 hover:bg-black/5'}`}>
               <Search className="w-5 h-5" />
             </button>
           </div>
           
           <div className="flex md:mt-auto md:flex-col md:gap-2 w-full px-2 justify-center">
             <button onClick={() => setIsSettingsOpen(true)} title="Settings" className={`p-3 w-full flex items-center justify-center rounded-xl transition-colors ${theme === 'dark' ? 'text-slate-400 hover:text-white hover:bg-white/5' : 'text-slate-500 hover:text-slate-900 hover:bg-black/5'}`}>
               <Settings className="w-5 h-5" />
             </button>
           </div>
        </nav>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col min-w-0 relative h-full">
          {/* Top Bar */}
          <header className={`h-16 border-b ${theme === 'dark' ? 'border-white/5 bg-black/20' : 'border-black/5 bg-white/40'} backdrop-blur-sm flex items-center justify-between px-3 sm:px-6 flex-shrink-0 z-20`}>
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setSidebarOpen(!isSidebarOpen)}
                className={`p-2 transition-colors rounded-lg md:hidden ${theme === 'dark' ? 'text-slate-400 hover:text-white hover:bg-white/5' : 'text-slate-500 hover:text-slate-900 hover:bg-black/5'}`}
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3">
                <div className="hidden md:flex relative items-center justify-center w-9 h-9 opacity-0"></div>
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-indigo-400">
                    {activeTab === 'Chat' ? 'Neural Interface' : activeTab}
                  </h1>
                  <div className="flex items-center gap-2 mt-1">
                    <div className={`w-1.5 h-1.5 rounded-full ${
                      modelState === 'Idle' ? 'bg-blue-500' :
                      modelState === 'Listening' ? 'bg-pink-500 animate-pulse' :
                      modelState === 'Reasoning' ? 'bg-teal-400 animate-bounce' : 'bg-green-500'
                    }`} />
                    <span className="text-[10px] uppercase tracking-widest text-slate-500 font-medium">
                      Status: {modelState}
                    </span>
                    <span className="text-[10px] uppercase tracking-widest text-indigo-400 font-medium ml-3 border-l border-white/10 pl-3 hidden md:inline">
                      Circadian: {circadianState.phase} ({circadianState.multiplier.toFixed(1)}x)
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {activeTab === 'Chat' && (
                <div className="hidden sm:flex items-center gap-1.5 mr-3 bg-white/5 border border-white/10 rounded-lg p-1.5">
                  <span className="text-[9px] uppercase tracking-widest text-slate-500 font-bold font-mono">Timeline:</span>
                  <select
                    value={activeThreadId}
                    onChange={(e) => setActiveThreadId(e.target.value)}
                    className="bg-black/40 border border-white/10 rounded px-1.5 py-0.5 text-[9px] font-bold font-mono text-teal-400 focus:outline-none focus:border-teal-500/50"
                  >
                    {Object.keys(threads).map((tid) => (
                      <option key={tid} value={tid} className="bg-slate-900 text-teal-300">
                        {tid === 'main' ? 'Main' : `Timeline-${tid.split('_')[1]?.substring(0, 4) || tid.substring(0, 5)}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {activeTab === 'Chat' && (
                <div className="hidden sm:flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg p-0.5 mr-2">
                  <button 
                    onClick={() => setChatLayout('linear')}
                    className={`px-2 py-1 rounded text-[10px] font-bold uppercase transition-all ${chatLayout === 'linear' ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    Linear
                  </button>
                  <button 
                    onClick={() => setChatLayout('canvas')}
                    className={`px-2 py-1 rounded text-[10px] font-bold uppercase transition-all ${chatLayout === 'canvas' ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    Canvas
                  </button>
                </div>
              )}
              {activeTab === 'Chat' && (
                <button 
                  onClick={clearChat}
                  className={`p-2 transition-colors rounded-lg flex items-center justify-center gap-1.5 text-xs font-semibold ${
                    theme === 'dark' 
                      ? 'text-slate-400 hover:text-red-400 hover:bg-red-500/10' 
                      : 'text-slate-500 hover:text-red-600 hover:bg-red-500/10'
                  }`}
                  title="Clear Chat History"
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Reset Brain</span>
                </button>
              )}
            </div>
          </header>

          <div className="flex-1 overflow-hidden relative flex flex-col w-full h-full">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, scale: 0.98, filter: 'blur(8px)' }}
                animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, scale: 1.02, filter: 'blur(8px)' }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="w-full h-full flex flex-col relative"
              >
            {activeTab === 'Chat' ? (
              <>
                {chatLayout === 'canvas' ? (
                  <div className="flex-grow w-full h-[550px] min-h-[400px] p-4 overflow-hidden relative z-10">
                    <Suspense fallback={<LazyFallback />}><CognitiveCanvas messages={messages.map(m => ({ id: m.id, role: m.role, content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) || '', timestamp: m.timestamp ?? Date.now() }))} /></Suspense>
                  </div>
                ) : (
                  <div className="flex-1 overflow-hidden relative flex flex-col">
{/* Center Presence Orb */}
            <div className="absolute inset-0 flex items-center justify-center z-0">
              {/* Cognitive load incorporates efeScore, consolidation state, and deep processing state */}
              <PresenceOrb 
                state={modelState} 
                depth={depth} 
                isSpeaking={isSpeaking} 
                cognitiveLoad={Math.min(1, Math.max(0, efeScore + (isConsolidating ? 0.3 : 0) + (modelState === 'Reasoning' || modelState === 'Learning' ? 0.2 : 0)))} 
              />
            </div>
          <InsightReveal 
            insight={activeInsight}
            onSave={handleSaveInsight}
            onDismiss={handleDismissInsight}
            onTimeout={handleInsightTimeout}
          />
          <InsightFeed onReward={(r) => rlAgent.current?.applyDelayedInsightReward(r)} />
            
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-6 z-10 scroll-smooth">
              <div className="max-w-3xl mx-auto space-y-8 pb-10">
                {messages.map((msg) => (
                  <div key={msg.id} className={`group relative flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} w-full`}>
                    <button
                      onClick={() => handleBranchThread(msg.id)}
                      className={`absolute top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-xl border border-white/10 bg-black/60 text-slate-400 hover:text-fuchsia-400 hover:border-fuchsia-500/30 transition-all z-20 ${
                        msg.role === 'user'
                          ? 'left-0 -translate-x-12'
                          : 'right-0 translate-x-12'
                      }`}
                      title="Branch timeline from this message"
                    >
                      <Split className="w-4 h-4" />
                    </button>
                    <div className="flex flex-col gap-2 w-full max-w-full">
                      {msg.content && msg.content !== "{}" && msg.content !== '""' && (
                        <div 
                          onContextMenu={(e) => {
                            e.preventDefault();
                            setContextMenu({ x: e.clientX, y: e.clientY, msgId: msg.id });
                          }}
                          className={`max-w-[80%] p-5 rounded-2xl transition-all duration-300 ${
                          msg.role === 'user' 
                            ? 'bg-gradient-to-br from-indigo-600/80 to-indigo-900/80 border border-indigo-500/30 text-white shadow-lg shadow-indigo-900/20 backdrop-blur-md rounded-tr-sm self-end'
                            : theme === 'dark' 
                              ? 'bg-white/5 border border-white/10 text-slate-200 backdrop-blur-md shadow-xl rounded-tl-sm self-start'
                              : 'bg-white border border-black/5 text-slate-800 shadow-lg rounded-tl-sm self-start'
                        }`}>
                          {msg.role === 'ai' ? (
                            <div className="flex flex-col gap-5 w-full">
                              <div className="flex items-start gap-4">
                                <div className="w-8 h-8 rounded-full bg-teal-500/20 border border-teal-500/30 flex items-center justify-center flex-shrink-0 mt-1">
                                  <Cpu className="w-4 h-4 text-teal-400" />
                                </div>
                                <div className={`leading-relaxed ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                                  <TypewriterText 
                                    text={typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content) || ''}
                                    isTyping={!!msg.isTyping}
                                    onComplete={() => {
                                      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, isTyping: false } : m))
                                    }}
                                  />
                                </div>
                              </div>
                                {msg.superpositionBranches && msg.superpositionBranches.length > 0 && (
                                  <ReasoningTree branches={msg.superpositionBranches} synthesis={msg.content} />
                                )}
                                
                                {msg.cognitiveLog && (
                                  <div className="mt-4 border-t border-white/5 pt-4">
                                  <details className="group/cog">
                                    <summary className="flex items-center gap-2 cursor-pointer text-[10px] uppercase tracking-widest text-slate-500 hover:text-indigo-400 transition-colors list-none">
                                      <div className="p-1 rounded-md bg-white/5 group-hover/cog:bg-indigo-500/20 transition-colors">
                                        <Zap className="w-3 h-3" />
                                      </div>
                                      <span>Cognitive Process Trace</span>
                                    </summary>
                                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                                      <div className={`p-3 rounded-lg border ${theme === 'dark' ? 'bg-black/40 border-white/5' : 'bg-black/5 border-black/5'}`}>
                                        <span className="text-[9px] uppercase tracking-wider text-slate-500 block mb-1">1. Draft</span>
                                        <p className={`text-xs italic line-clamp-3 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>{typeof msg.cognitiveLog.draft === 'string' ? msg.cognitiveLog.draft : JSON.stringify(msg.cognitiveLog.draft)}</p>
                                      </div>
                                      <div className={`p-3 rounded-lg border ${theme === 'dark' ? 'bg-black/40 border-white/5' : 'bg-black/5 border-black/5'}`}>
                                        <span className="text-[9px] uppercase tracking-wider text-slate-500 block mb-1">2. Recollection</span>
                                        <p className={`text-xs italic line-clamp-3 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>{typeof msg.cognitiveLog.recollection === 'string' ? msg.cognitiveLog.recollection : JSON.stringify(msg.cognitiveLog.recollection)}</p>
                                      </div>
                                      <div className={`p-3 rounded-lg border ${theme === 'dark' ? 'bg-black/40 border-white/5' : 'bg-black/5 border-black/5'}`}>
                                        <span className="text-[9px] uppercase tracking-wider text-slate-500 block mb-1">3. Reflection</span>
                                        <p className={`text-xs italic line-clamp-3 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>{typeof msg.cognitiveLog.reflection === 'string' ? msg.cognitiveLog.reflection : JSON.stringify(msg.cognitiveLog.reflection)}</p>
                                      </div>
                                      <div className={`p-3 rounded-lg border ${theme === 'dark' ? 'bg-black/40 border-white/5' : 'bg-black/5 border-black/5'}`}>
                                        <span className="text-[9px] uppercase tracking-wider text-slate-500 block mb-1">4. Synthesis</span>
                                        <p className={`text-xs italic line-clamp-3 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>{typeof msg.cognitiveLog.reiteration === 'string' ? msg.cognitiveLog.reiteration : JSON.stringify(msg.cognitiveLog.reiteration)}</p>
                                      </div>
                                    </div>
                                  </details>
                                </div>
                              )}
                            </div>
                          ) : (
                            <p className="whitespace-pre-wrap">{typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)}</p>
                          )}
                        </div>
                      )}
                      
                      {msg.systemUI ? (
                      <div className={`w-full max-w-2xl ${msg.role === 'user' ? 'self-end' : 'self-start'} mt-2`}>
                        {msg.systemUI === 'help' && (
                          <HelpWidget 
                            commands={msg.systemUIData?.commands || []} 
                            onCommandClick={(cmd) => {
                              setInput(cmd);
                              addLog(`Neural shortcut prepared: ${cmd}`, 'INFO', 'UI');
                            }} 
                          />
                        )}
                        {msg.systemUI === 'vitals' && (
                          <VitalsWidget 
                            vitals={msg.systemUIData?.vitals || vitals} 
                            memoryCount={msg.systemUIData?.memoryCount || memories.length} 
                            logCount={msg.systemUIData?.logCount || systemLogs.length} 
                          />
                        )}
                        {msg.systemUI === 'logs' && (
                          <LogsWidget logs={msg.systemUIData?.logs || []} />
                        )}
                        {msg.systemUI === 'diagnose' && (
                          <DiagnosticWidget 
                            uid={user?.uid || "anonymous"} 
                            db={db} 
                            auth={auth} 
                            addLog={(m, l, s) => addLog(m, l || 'INFO', s || 'DIAGNOSTIC')} 
                          />
                        )}
                        {msg.systemUI === 'reboot' && (
                          <RebootWidget 
                            onComplete={() => {
                              addLog("Reboot sequence completed. Synapses re-synchronized.", "NEURAL", "SYSTEM");
                              setModelState('Idle');
                            }} 
                          />
                        )}
                        {msg.systemUI === 'qpu-erd' && (
                          <QpuErdWidget text={msg.systemUIData?.text} />
                        )}
                        {msg.systemUI === 'error-card' && (
                          <SelfHealingErrorCard 
                            errorMessage={msg.systemUIData?.errorMessage || msg.content || "Connection disruption"} 
                            traceId={msg.systemUIData?.traceId} 
                            addLog={(m, l) => addLog(m, l, 'DIAGNOSTIC')} 
                            onOfflineSimulate={() => {
                              addLog("Engaging neural offline simulation mode...", "WARN", "SYSTEM");
                              const mockAiData = {
                                role: 'ai' as const,
                                content: "Offline Self-Healing Simulation Mode engaged! I have bypassed API latency channels and established a direct local loopback connection. Ask me anything, and I will generate local rule-based responses.",
                                timestamp: Date.now(),
                                traceId: msg.systemUIData?.traceId
                              };
                              if (user) {
                                addDoc(collection(db, "users", user.uid, "chats"), mockAiData);
                              } else {
                                setMessages(prev => [...prev, { id: `mock-${Date.now()}`, ...mockAiData }]);
                              }
                            }}
                            onRetry={async () => {
                              addLog("Attempting synaptic retry transmission...", "WARN", "API");
                              const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
                              if (lastUserMsg && lastUserMsg.content) {
                                setInput(lastUserMsg.content);
                                setMessages(prev => prev.filter(m => m.id !== msg.id));
                                if (user) {
                                  try {
                                    const errorDocRef = doc(db, "users", user.uid, "chats", msg.id);
                                    await deleteDoc(errorDocRef);
                                  } catch (e) {
                                    console.warn("Could not delete stale error doc from firestore", e);
                                  }
                                }
                                setTimeout(() => {
                                  handleSend();
                                }, 100);
                              } else {
                                addLog("No preceding user message found to retry.", "ERROR", "SYSTEM");
                              }
                            }}
                          />
                        )}
                      </div>
                      ) : null}
                    </div>
                  </div>
                ))}

                {/* Live Debate Progress Panel (XState-driven) */}
                {!debateState.matches('idle') && (
                  <div className="p-5 rounded-2xl border border-teal-500/20 bg-black/60 shadow-[0_0_30px_rgba(20,184,166,0.05)] space-y-4 animate-pulse">
                    <div className="flex items-center justify-between border-b border-white/5 pb-3">
                      <div className="flex items-center gap-2">
                        <Network className="w-4 h-4 text-teal-400 animate-spin" />
                        <span className="text-xs font-bold uppercase tracking-widest text-teal-300">
                          Active Debate Chamber
                        </span>
                      </div>
                      <div className="flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-teal-500/10 border border-teal-500/20">
                        <span className="text-[9px] font-mono font-bold text-teal-400 uppercase">
                          State: {String(debateState.value).toUpperCase()}
                        </span>
                      </div>
                    </div>

                    {/* Topic display */}
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Topic of Inquiry</span>
                      <p className="text-xs font-medium text-slate-300 italic">"{debateState.context.topic}"</p>
                    </div>

                    {/* Active agent visualization */}
                    {debateState.context.activeAgentId && (
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                        <div className="relative">
                          <div className="w-10 h-10 rounded-full bg-teal-500/10 flex items-center justify-center border border-teal-500/20">
                            <Cpu className="w-5 h-5 text-teal-400" />
                          </div>
                          <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-black animate-ping" />
                          <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-black" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-[9px] text-teal-400 uppercase tracking-widest font-bold">Active Agent Reasoning</span>
                          <h4 className="text-xs font-bold text-slate-200 capitalize">
                            {debateState.context.activeAgentId === 'logician' ? 'Analytical Logician' :
                             debateState.context.activeAgentId === 'catalyst' ? 'Creative Catalyst' : 'Adversarial Auditor'}
                          </h4>
                        </div>
                        <span className="text-[10px] font-mono text-slate-500">
                          Turn {debateState.context.turns + 1} of {debateState.context.maxTurns}
                        </span>
                      </div>
                    )}

                    {/* Live State Vector gauges */}
                    <div className="space-y-2.5">
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Cognitive State Vector Telemetry</span>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {[
                          { name: 'Coherence', val: debateState.context.currentStateVector[0] },
                          { name: 'Novelty', val: debateState.context.currentStateVector[1] },
                          { name: 'Factuality', val: debateState.context.currentStateVector[2] },
                          { name: 'Turn Parity', val: debateState.context.currentStateVector[3] },
                          { name: 'Agreement', val: debateState.context.currentStateVector[4] },
                          { name: 'Tension', val: debateState.context.currentStateVector[5] }
                        ].map((dim) => (
                          <div key={dim.name} className="p-2.5 rounded-xl bg-black/40 border border-white/5 flex flex-col gap-1.5">
                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tight">{dim.name}</span>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                                <div 
                                  className="h-full rounded-full transition-all duration-500" 
                                  style={{ 
                                    width: `${(dim.val ?? 0.5) * 100}%`,
                                    backgroundColor: dim.name === 'Coherence' ? '#818cf8' :
                                                     dim.name === 'Novelty' ? '#fbbf24' :
                                                     dim.name === 'Factuality' ? '#34d399' :
                                                     dim.name === 'Turn Parity' ? '#c084fc' :
                                                     dim.name === 'Agreement' ? '#2dd4bf' : '#f43f5e'
                                  }}
                                />
                              </div>
                              <span className="text-[9px] font-mono font-bold text-slate-400">
                                {(dim.val ?? 0.5).toFixed(2)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Subagent Debate Arena rendered here during Reasoning/Debate mode */}
                    {debateState.context.debateLog.length > 0 && (
                      <SubagentDebateArena 
                        logs={debateState.context.debateLog} 
                        theme={theme} 
                        isComplete={debateState.matches('consensusReached') || debateState.matches('idle')}
                      />
                    )}
                  </div>
                )}
                {/* Reasoning Indicator */}
                {modelState === 'Reasoning' && !isDebateMode && (
                  <div className="flex justify-start w-full animate-in fade-in slide-in-from-left-4 duration-500">
                    <div className={`max-w-[80%] p-5 rounded-2xl ${theme === 'dark' ? 'bg-white/5 border border-white/10' : 'bg-black/5 border border-black/5'} backdrop-blur-md rounded-tl-sm flex items-center gap-3`}>
                      <div className="w-8 h-8 rounded-full bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
                        <Brain className="w-4 h-4 text-teal-400 animate-pulse" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] text-teal-400 uppercase tracking-widest font-bold font-mono">Reasoning...</span>
                        <div className="flex gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-teal-400/60 animate-bounce [animation-delay:-0.3s]" />
                          <div className="w-1.5 h-1.5 rounded-full bg-teal-400/60 animate-bounce [animation-delay:-0.15s]" />
                          <div className="w-1.5 h-1.5 rounded-full bg-teal-400/60 animate-bounce" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </div>
          </div>
        )}

          {/* Bottom Control Bar */}
          <div className="p-3 sm:p-6 border-t border-white/5 bg-black/40 backdrop-blur-md z-20 pb-20 md:pb-6">
            <div className="max-w-3xl mx-auto">
              
              {/* Cognition Depth Slider */}
              <div className="mb-3 sm:mb-4 flex flex-wrap gap-3 sm:gap-4 px-1 sm:px-2">
                <div className="flex items-center gap-6">
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-widest text-slate-500 flex items-center gap-2 mb-2">
                      <Sliders className="w-3 h-3" /> Cognition Depth
                    </span>
                    <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg border border-white/5">
                      {(['Fast', 'Balanced', 'Deep Reasoning'] as CognitionDepth[]).map(d => (
                        <button
                          key={d}
                          onClick={() => setDepth(d)}
                          className={`px-3 py-1 text-[10px] uppercase tracking-wider rounded-md transition-all ${
                            depth === d 
                              ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30' 
                              : 'text-slate-500 hover:text-slate-300'
                          }`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col border-l border-white/5 pl-6 hidden md:flex">
                    <span className="text-[10px] uppercase tracking-widest text-slate-500 flex items-center gap-2 mb-2">
                      <Network className="w-3 h-3" /> Consensus Mode
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsDebateMode(!isDebateMode)}
                      className={`flex items-center gap-2 px-3 py-1 text-[10px] uppercase tracking-wider rounded-md transition-all border ${
                        isDebateMode 
                          ? 'bg-teal-500/40 text-teal-100 border-teal-400' 
                          : 'bg-white/5 text-slate-500 border-white/5 hover:text-slate-300'
                      }`}
                    >
                      <div className={`w-2 h-2 rounded-full ${isDebateMode ? 'bg-teal-400 animate-pulse' : 'bg-slate-600'}`} />
                      {isDebateMode ? 'ACTIVE' : 'OFF'}
                    </button>
                  </div>
                  
                  <div className="flex flex-col border-l border-white/5 pl-6 hidden md:flex">
                    <span className="text-[10px] uppercase tracking-widest text-slate-500 flex items-center gap-2 mb-2">
                      <Zap className="w-3 h-3" /> Superposition
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsSuperpositionMode(!isSuperpositionMode)}
                      className={`flex items-center gap-2 px-3 py-1 text-[10px] uppercase tracking-wider rounded-md transition-all border ${
                        isSuperpositionMode 
                          ? 'bg-fuchsia-500/40 text-fuchsia-100 border-fuchsia-400' 
                          : 'bg-white/5 text-slate-500 border-white/5 hover:text-slate-300'
                      }`}
                    >
                      <div className={`w-2 h-2 rounded-full ${isSuperpositionMode ? 'bg-fuchsia-400 animate-pulse' : 'bg-slate-600'}`} />
                      {isSuperpositionMode ? 'ACTIVE' : 'OFF'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Predictive Shortcuts */}
              {messages.length > 0 && messages[messages.length - 1].role === 'ai' && messages[messages.length - 1].suggestedShortcuts && (
                <div className="flex flex-wrap gap-2 mb-4 px-2 animate-in fade-in slide-in-from-bottom-2 duration-500">
                  {messages[messages.length - 1].suggestedShortcuts?.map((shortcut, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setInput(shortcut);
                        // Optional: auto-send if desired, but letting user edit is safer
                        addLog(`Neural shortcut selected: ${shortcut}`, 'NEURAL', 'UI');
                      }}
                      className="px-4 py-2 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-medium hover:bg-teal-500/20 hover:border-teal-500/40 transition-all flex items-center gap-2 group"
                    >
                      <Zap className="w-3 h-3 text-teal-500 group-hover:scale-125 transition-transform" />
                      {shortcut}
                    </button>
                  ))}
                </div>
              )}

              {/* Input Area */}
              <form onSubmit={handleSend} className={`relative flex items-end gap-2 border rounded-2xl p-2 transition-all focus-within:border-teal-500/50 shadow-inner ${
                theme === 'dark' ? 'bg-white/5 border-white/10 focus-within:bg-white/10' : 'bg-black/5 border-black/10 focus-within:bg-black/10'
              }`}>
                <button type="button" className={`p-3 transition-colors ${theme === 'dark' ? 'text-slate-400 hover:text-teal-400' : 'text-slate-500 hover:text-teal-600'}`}>
                  <Paperclip className="w-5 h-5" />
                </button>
                
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  onFocus={() => modelState === 'Idle' && setModelState('Listening')}
                  onBlur={() => modelState === 'Listening' && !input && setModelState('Idle')}
                  placeholder="Initiate dialogue..."
                  className={`flex-1 bg-transparent border-none focus:ring-0 resize-none py-3 min-h-[50px] max-h-[200px] ${
                    theme === 'dark' ? 'text-slate-200 placeholder:text-slate-600' : 'text-slate-800 placeholder:text-slate-400'
                  }`}
                  rows={1}
                />
                
                <button type="button" className={`p-3 transition-colors ${theme === 'dark' ? 'text-slate-400 hover:text-teal-400' : 'text-slate-500 hover:text-teal-600'}`}>
                  <Mic className="w-5 h-5" />
                </button>
                
                <button 
                  type="submit" 
                  disabled={!input.trim() || (modelState !== 'Idle' && modelState !== 'Listening')}
                  className="p-3 bg-teal-500/20 text-teal-400 border border-teal-500/30 rounded-xl hover:bg-teal-500/30 hover:text-teal-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <Send className="w-5 h-5" />
                </button>
              </form>
            </div>
          
                </div>
              </>
            ) : (
              <div className="p-3 sm:p-6 flex-1 overflow-y-auto w-full h-full custom-scrollbar pb-20 md:pb-6">
              <Suspense fallback={<LazyFallback />}>
                {activeTab === 'Memory' ? (
              <MemoryTab 
                memoryViewMode={memoryViewMode}
                setMemoryViewMode={setMemoryViewMode}
                isConsolidating={isConsolidating}
                memories={memories}
                handleManualConsolidate={handleManualConsolidate}
                memorySearchQuery={memorySearchQuery}
                setMemorySearchQuery={setMemorySearchQuery}
                selectedMemoryIds={selectedMemoryIds}
                handleSelectAllMemories={handleSelectAllMemories}
                handleClearMemorySelection={handleClearMemorySelection}
                handleBulkDelete={handleBulkDelete}
                isBulkDeleting={isBulkDeleting}
                handleBulkUpdateStrength={handleBulkUpdateStrength}
                isBulkReinforcing={isBulkReinforcing}
                isBulkDecaying={isBulkDecaying}
                isBulkTagging={isBulkTagging}
                bulkTagInput={bulkTagInput}
                setBulkTagInput={setBulkTagInput}
                handleBulkTag={handleBulkTag}
                selectedTagFilter={selectedTagFilter}
                setSelectedTagFilter={setSelectedTagFilter}
                                filteredMemories={filteredMemories}
                handleSingleUpdateStrength={handleSingleUpdateStrength}
                togglePinMemory={togglePinMemory}
                removeMemory={removeMemory}
                setSelectedMemoryIds={setSelectedMemoryIds}
                setModelState={setModelState}
                fetchInsight={fetchInsight}
                setActiveInsight={setActiveInsight}
                startDateFilter={startDateFilter}
                setStartDateFilter={setStartDateFilter}
                endDateFilter={endDateFilter}
                setEndDateFilter={setEndDateFilter}
                handleAddMemory={handleAddMemory}
                newMemory={newMemory}
                setNewMemory={setNewMemory}
              />
            ) : activeTab === 'Brains' ? (
              <BrainsTab 
                neuralSway={neuralSway}
                triggerSwayRNG={triggerSwayRNG}
                isSpinning={isSpinning}
                PERSONAS={PERSONAS}
                activePersona={activePersona}
                setActivePersona={setActivePersona}
                                                agentStats={agentStats}
                                                                                                                addLog={addLog}
                modelState={modelState}
                skills={skills}
                toggleSkill={toggleSkill}
                depth={depth}
                setDepth={setDepth}
              />
            ) : activeTab === 'Heartbeat' ? (
              <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-6 h-full overflow-y-auto pr-2 pb-10">
                <VitalsDashboard />
                <SentimentDriftChart memories={memories} />
                <div className="grid grid-cols-1 gap-4">
                  <div className="bg-white/5 border border-white/10 p-4 rounded-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                      <Activity className="w-12 h-12 text-teal-400" />
                    </div>
                    <h3 className="text-teal-400 text-[10px] font-bold uppercase tracking-[0.2em] mb-4">
                      <InfoTooltip label="Neural Resonance">
                        A composite frequency score reflecting the harmonic alignment of RL exploration and LLM processing stability.
                      </InfoTooltip>
                    </h3>
                    <div className="flex items-end gap-2 mb-2">
                      <span className="text-4xl font-mono font-bold text-white leading-none">{vitals.resonance.toFixed(1)}</span>
                      <span className="text-teal-500 text-xs font-bold mb-1">Hz</span>
                    </div>
                    <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden">
                      <div className="h-full bg-teal-500 transition-all duration-1000" style={{ width: `${vitals.resonance}%` }} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/5 border border-white/10 p-4 rounded-2xl">
                      <h4 className="text-slate-500 text-[9px] font-bold uppercase tracking-widest mb-2">
                        <InfoTooltip label="Cognitive Entropy">
                          The degree of chaos or uncertainty in the agent's current state evaluation matrix.
                        </InfoTooltip>
                      </h4>
                      <span className="text-xl font-mono text-white">{vitals.entropy.toFixed(2)}%</span>
                    </div>
                    <div className="bg-white/5 border border-white/10 p-4 rounded-2xl">
                      <h4 className="text-slate-500 text-[9px] font-bold uppercase tracking-widest mb-2">
                        <InfoTooltip label="Stability Matrix">
                          Overall system health coefficient derived from error rates and memory fragmentation.
                        </InfoTooltip>
                      </h4>
                      <span className="text-xl font-mono text-white">{vitals.stability.toFixed(2)}%</span>
                    </div>
                  </div>
                  <PolicyConvergenceChart data={qValueHistory} />
                </div>

                <div className="bg-black/40 border border-white/5 p-4 rounded-2xl">
                  <h3 className="text-amber-400 text-[10px] font-bold uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                    <Network className="w-3 h-3" />
                    <InfoTooltip label="System Diagnostics">
                      Hardware and network layer telemetry for the agent's hosting environment.
                    </InfoTooltip>
                  </h3>
                  <div className="space-y-3">
                    {[
                      { label: 'CPU Load', value: `${vitals.cpu.toFixed(1)}%`, status: vitals.cpu > 80 ? 'Heavy' : 'Optimal', tip: 'Processor utilization across the container runtime.' },
                      { label: 'Memory Usage', value: `${vitals.memory.toFixed(1)}%`, status: vitals.memory > 85 ? 'Critical' : 'Nominal', tip: 'RAM allocation relative to the container limit.' },
                      { label: 'Avg Latency', value: `${vitals.latency.toFixed(0)}ms`, status: vitals.latency > 2000 ? 'Slow' : 'Stable', tip: 'Mean response time for API invocations and inference cycles.' },
                      { label: 'Recent Errors', value: vitals.errors, status: vitals.errors > 0 ? 'Warning' : 'Healthy', tip: 'Count of caught exceptions or failed operations in the current session.' }
                    ].map((stat, i) => (
                      <div key={i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                        <InfoTooltip label={<span className="text-xs text-slate-500">{stat.label}</span>}>
                          {stat.tip}
                        </InfoTooltip>
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-mono text-slate-300">{stat.value}</span>
                          <span className={`text-[9px] font-bold uppercase tracking-tighter ${
                            stat.status === 'Optimal' || stat.status === 'Nominal' || stat.status === 'Stable' || stat.status === 'Healthy'
                              ? 'text-teal-500'
                              : stat.status === 'Warning' || stat.status === 'Heavy'
                                ? 'text-amber-500'
                                : 'text-red-500'
                          }`}>{stat.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Self-Healing Maintenance Log */}
                <div className="bg-black/40 border border-white/5 p-4 rounded-2xl">
                  <h3 className="text-purple-400 text-[10px] font-bold uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                    <Zap className="w-3 h-3" />
                    <InfoTooltip label="Self-Healing Log">
                      Autonomous background processes the agent has executed to repair context or resolve deadlocks.
                    </InfoTooltip>
                  </h3>
                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    {maintenanceHistory.length > 0 ? (
                      maintenanceHistory.map((log, i) => (
                        <div key={i} className="p-2 border border-white/5 rounded-lg bg-white/5 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-300">{log.actionTaken}</span>
                            <span className="text-[8px] text-slate-500">{new Date(log.timestamp).toLocaleTimeString()}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-[9px]">
                            <span className="text-slate-500">CPU: {(log.cpuLoad * 100).toFixed(1)}%</span>
                            <span className="text-slate-500">MEM: {(log.memoryUsageRatio * 100).toFixed(1)}%</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-4">
                        <span className="text-[10px] text-slate-600">No recent maintenance actions.</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Real-Time ML Intent Predictor Panel */}
                <div className="bg-black/40 border border-white/5 p-4 rounded-2xl">
                  {predictions && predictions.length > 0 ? (
                    <NeuralIntentPanel predictions={predictions} />
                  ) : (
                    <div className="text-center py-4 text-slate-500 border border-dashed border-white/5 rounded-xl">
                      <p className="text-xs italic mb-2 font-sans">Awaiting telemetry logs...</p>
                      <button 
                        onClick={async () => {
                          const now = new Date();
                          const hours = now.getHours() + now.getMinutes() / 60;
                          const tabIndices: Record<string, number> = { 'Memory': 0, 'Brains': 1, 'Heartbeat': 2, 'Mind Map': 3, 'Brainstorm': 4, 'Logs': 5 };
                          const tabIdx = tabIndices[activeTab] !== undefined ? tabIndices[activeTab] : -1;
                          const contextVector = [hours, tabIdx, messages.length, memories.length, window.innerWidth >= 1024 ? 1.0 : 0.0];
                          await logInteraction('manual_sync');
                          await fetchPredictions(contextVector);
                        }}
                        className="text-[10px] text-teal-400 hover:text-teal-300 font-bold uppercase tracking-wider underline transition-colors"
                      >
                        Force Calibration Run
                      </button>
                    </div>
                  )}
                  
                  <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                    <span>Model Partition: <span className="text-emerald-400">CALIBRATED</span></span>
                    <span>Logs: <span className="text-teal-400">{telemetryLogCount}</span></span>
                  </div>
                </div>
              </div>
              ) : activeTab === 'Mind Map' ? (
              <div className="animate-in fade-in slide-in-from-right-4 duration-300 h-full w-full flex flex-col gap-4 overflow-y-auto pb-10">
                <MindMap memories={memories} theme={theme as any} onCollapseWavefunction={collapseMemoryWavefunction} />
              </div>
            ) : activeTab === 'Brainstorm' ? (
              <div className="animate-in fade-in slide-in-from-right-4 duration-300 h-full">
                <Brainstorm 
                  memories={memories} 
                  onAddMemory={addMemoryDirectly} 
                  addLog={addLog}
                />
              </div>
            ) : activeTab === 'Identity' ? (
              <div className="h-full w-full">
                <IdentityTab theme={theme} />
              </div>
            ) : activeTab === 'Goals' ? (
              <div className="h-full w-full">
                 <GoalFormationUI theme={theme} handleSend={(text) => handleSend(undefined, text)} handleTabChange={(tab) => setActiveTab(tab as SidebarTab)} />
              </div>
            ) : activeTab === 'Diagnostics' ? (
              <SystemDiagnosticsUI theme={theme} />
            ) : activeTab === 'Swarm' ? (
              <SwarmVisualizer initialTask={input.startsWith('/swarm ') ? input.replace('/swarm ', '') : undefined} />
            ) : activeTab === 'Dream Cinema' ? (
              <DreamCinema theme={theme} />
            ) : activeTab === 'Sandbox' ? (
              <div className="h-full w-full p-6 flex flex-col gap-6 animate-in fade-in slide-in-from-right-4 duration-300 overflow-y-auto">
                <div className="h-[400px] flex-shrink-0">
                  <LiveCompiler theme={theme} />
                </div>
                <div className="h-[400px] flex-shrink-0">
                  {proposedEvolution ? (
                    <DiffViewer 
                      fileName={proposedEvolution.fileName} 
                      originalCode="// Loading original file... (Local only)\\n// In a production app, we would fetch the current code to show the diff." 
                      proposedCode={proposedEvolution.proposedCode} 
                      onApprove={async () => {
                        addLog(`Approving evolution for ${proposedEvolution.fileName}...`, "INFO", "SYSTEM");
                        try {
                          const res = await fetch('/api/system/evolve', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(proposedEvolution)
                          });
                          const data = await res.json();
                          if (data.success) {
                            addLog(`Successfully evolved ${proposedEvolution.fileName}. Reloading...`, "INFO", "SYSTEM");
                            setProposedEvolution(null);
                          } else {
                            addLog(`Failed to evolve: ${data.error}`, "ERROR", "SYSTEM");
                          }
                        } catch (e: any) {
                          addLog(`Failed to evolve: ${e.message}`, "ERROR", "SYSTEM");
                        }
                      }} 
                      onReject={() => {
                        addLog("Evolution rejected.", "WARN", "SYSTEM");
                        setProposedEvolution(null);
                      }} 
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full bg-slate-900/50 rounded-2xl border border-slate-800 text-slate-500">
                      <Code2 size={48} className="mb-4 opacity-50" />
                      <p className="font-mono text-sm">No self-evolution proposed.</p>
                      <p className="text-xs mt-2 opacity-60">The AI will populate this when it proposes architectural changes.</p>
                    </div>
                  )}
                </div>
              </div>
            ) : activeTab === 'Logs' ? (
              <div className="animate-in fade-in slide-in-from-right-4 duration-300 flex flex-col h-full max-h-[calc(100vh-180px)]">
                <AutoDebugger logs={systemLogs} />
                <div className="flex items-center justify-between mb-4 mt-4">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-blue-400" />
                    <h3 className="text-blue-400 text-xs font-bold uppercase tracking-widest">Neural Event Stream</h3>
                  </div>
                  <button 
                    onClick={() => setSystemLogs([])}
                    className="p-1.5 rounded bg-white/5 text-slate-500 hover:text-red-400 transition-colors"
                    title="Clear Logs"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex-1 space-y-2 overflow-y-auto pr-1 custom-scrollbar">
                  {systemLogs.length === 0 ? (
                    <div className="text-center py-12 text-slate-600 text-xs font-mono uppercase tracking-widest">
                      No logs in current session buffer
                    </div>
                  ) : (
                    systemLogs.map(log => (
                      <div key={log.id} className="p-2 rounded bg-black/40 border border-white/5 flex flex-col gap-1">
                        <div className="flex items-center justify-between text-[8px] font-mono tracking-tighter">
                          <span className={`${
                            log.level === 'ERROR' ? 'text-red-400' : 
                            log.level === 'WARN' ? 'text-yellow-400' : 
                            log.level === 'NEURAL' ? 'text-teal-400' : 'text-blue-400'
                          }`}>[{log.level}] {log.source}</span>
                          <span className="text-slate-600">{new Date(log.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-tight font-mono">{log.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
              ) : activeTab === 'Telemetry' ? (
                <div className="space-y-6">
                  <TelemetryDashboard 
                    theme={theme} 
                    activeOptionName={rlAgent.current?.activeOption?.name}
                    cognitiveMode={cognitiveMode}
                    onModeChange={setCognitiveMode}
                    efeScore={efeScore}
                    usePolicyNet={usePolicyNet}
                    onTogglePolicyNet={setUsePolicyNet}
                    curiosityVector={curiosityVector}
                    policyConfidence={policyConfidence}
                  />
                  <PredictiveRolloutPanel
                    initialState={rlAgent.current?.getState()}
                  />
                </div>
              ) : null}
              </Suspense>
            </div>
          )}
              </motion.div>
            </AnimatePresence>
        </div>
      </main>

        {contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            msgId={contextMenu.msgId}
            onClose={() => setContextMenu(null)}
            onCopy={(id) => {
              const msg = messages.find(m => m.id === id);
              if (msg && msg.content) {
                const text = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
                navigator.clipboard.writeText(text);
                addLog('Message text copied to clipboard', 'INFO', 'UI');
              }
            }}
            onFlag={(id) => {
              addLog(`Message ${id} flagged for review`, 'WARN', 'UI');
            }}
            onDelete={(id) => {
              setMessages(prev => prev.filter(m => m.id !== id));
              addLog('Message deleted from local context', 'INFO', 'UI');
            }}
          />
        )}

        {/* Settings Overlay */}
        <div className="absolute inset-0 z-50 pointer-events-none">
          {isSettingsOpen && (
            <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-[#12121a] border border-white/10 w-full max-w-md max-h-[85vh] rounded-2xl shadow-2xl overflow-y-auto animate-in zoom-in-95 duration-200 mx-3 sm:mx-0">
                <div className="flex items-center justify-between p-6 border-b border-white/5 bg-white/5">
                  <h3 className="text-lg font-semibold text-slate-200 tracking-tight flex items-center gap-2">
                    <Settings className="w-5 h-5 text-indigo-400" />
                    System Configuration
                  </h3>
                  <button 
                    onClick={() => setIsSettingsOpen(false)}
                    className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="p-6 space-y-6">
                
                {/* Model Selection Dropdown Setting */}
                <div>
                  <h4 className="text-sm font-medium text-slate-300 mb-2">Active LLM Model</h4>
                  <p className="text-[11px] text-slate-500 mb-2 leading-relaxed">Choose the primary Gemini generative model or fallback for analytical steps.</p>
                  <select
                    value={activeModel}
                    onChange={(e) => {
                      setActiveModel(e.target.value);
                      addLog(`Primary model switched to: ${e.target.value}`, 'INFO', 'SYSTEM');
                    }}
                    className="w-full bg-[#1c1c27] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-teal-500 transition-colors cursor-pointer font-mono"
                  >
                    <option value="gemini-3.5-flash">gemini-3.5-flash (Fast)</option>
                    <option value="gemini-3.1-pro-preview">gemini-3.1-pro-preview (Deep)</option>
                    <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite (Lite)</option>
                  </select>
                </div>

                <div className="h-px bg-white/5" />
                
                {/* Setting Item */}
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium text-slate-300">Telemetry Data</h4>
                    <p className="text-xs text-slate-500 mt-1">Share anonymized interaction logs</p>
                  </div>
                  <button 
                    onClick={() => setTelemetryEnabled(!telemetryEnabled)}
                    className={`w-12 h-6 rounded-full border relative flex items-center px-1 transition-colors ${telemetryEnabled ? 'bg-teal-500/20 border-teal-500/50' : 'bg-slate-800 border-white/10'}`}
                  >
                    <div className={`w-4 h-4 rounded-full absolute shadow-sm flex items-center justify-center transition-all ${telemetryEnabled ? 'bg-teal-400 right-1' : 'bg-slate-500 left-1'}`}>
                      {telemetryEnabled && <Activity className="w-2.5 h-2.5 text-teal-900 animate-pulse" />}
                    </div>
                  </button>
                </div>

                <div className="h-px bg-white/5" />

                {/* Setting Item */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-slate-300">Memory Retention Limit</h4>
                    <span className="text-xs font-mono text-teal-400 bg-teal-400/10 px-2 py-0.5 rounded border border-teal-400/20">2048 Tokens</span>
                  </div>
                  <input 
                    type="range" 
                    min="100" 
                    max="4000" 
                    defaultValue="2048"
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-teal-400"
                  />
                  <div className="flex justify-between mt-2 text-[10px] text-slate-500 font-mono">
                    <span>100</span>
                    <span>4000</span>
                  </div>
                </div>

                <div className="h-px bg-white/5" />

                {/* Setting Item */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-slate-300">Knowledge Base (RAG)</h4>
                  </div>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={kbInput}
                      onChange={e => setKbInput(e.target.value)}
                      placeholder="Add custom context..."
                      className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-teal-500/50 transition-colors"
                      onKeyDown={e => e.key === 'Enter' && handleAddKnowledge()}
                    />
                    <button 
                      onClick={handleAddKnowledge}
                      disabled={isAddingKb || !kbInput.trim()}
                      className="px-3 py-2 bg-teal-500/20 text-teal-400 border border-teal-500/30 rounded-lg hover:bg-teal-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium whitespace-nowrap"
                    >
                      {isAddingKb ? 'Adding...' : 'Inject'}
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">Added context will be matched against your queries using vector embeddings.</p>
                </div>

              </div>
              
              <div className="p-4 border-t border-white/5 bg-black/20 flex justify-end">
                <button 
                  onClick={() => setIsSettingsOpen(false)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors shadow-lg shadow-indigo-900/20"
                >
                  Save Configuration
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

        <MemoryNudge 
          memory={nudgeMemory}
          onUse={handleNudgeUse}
          onDismiss={handleNudgeDismiss}
          onTimeout={handleNudgeTimeout}
        />

        <ConsolidationSuggestion 
          proposal={consolidationProposal}
          onConfirm={handleConsolidationConfirm}
          onDismiss={handleConsolidationDismiss}
          onTimeout={handleConsolidationTimeout}
        />

        <VoiceBridge 
          onSpeechRecognized={handleSpeechRecognized} 
          textToSpeak={textToSpeak} 
        />
        <PWAUpdatePrompt />

      </div>
    </div>
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ErrorProvider>
        <MainApp />
      </ErrorProvider>
    </ErrorBoundary>
  );
}