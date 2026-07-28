import { readFileSync, writeFileSync } from 'fs';

const content = readFileSync('src/App.tsx', 'utf-8');
const lines = content.split('\n');

const chatStart = lines.findIndex(l => l.includes("{activeTab === 'Chat' ? ("));
const chatEnd = lines.findIndex((l, i) => i > chatStart && l.includes("activeTab === 'Memory' ? ("));

// The extracted code
let chatCode = lines.slice(chatStart, chatEnd).join('\n');

// We need to remove the first {activeTab === 'Chat' ? ( and the last ) : ( or similar.
// Actually chatStart is `{activeTab === 'Chat' ? (`
// The end is near `) : (`
// Let's strip the ternary.
chatCode = chatCode.replace("{activeTab === 'Chat' ? (", "").trim();
const endMatch = chatCode.lastIndexOf(') : (');
if (endMatch !== -1) {
    chatCode = chatCode.substring(0, endMatch).trim();
}

const finalCode = `import React, { Suspense, lazy } from 'react';
import { Cpu, Zap, Split, Brain, Network, Sliders, Paperclip, Mic, Send, Trash2 } from 'lucide-react';
import { PresenceOrb } from "../PresenceOrb.js";
import { TypewriterText } from "../TypewriterText.js";
import { SubagentDebateArena } from '../SubagentDebateArena.js';
import { HelpWidget, VitalsWidget, LogsWidget, DiagnosticWidget, RebootWidget } from '../CommandWidgets.js';
import { QpuErdWidget } from '../QpuErdWidget.js';
import { SelfHealingErrorCard } from '../SelfHealingErrorCard.js';
import InsightReveal from '../InsightReveal.js';
import InsightFeed from '../InsightFeed.js';
import { doc, addDoc, collection, deleteDoc } from '../../firebase.js';

const CognitiveCanvas = lazy(() => import('../CognitiveCanvas.js'));

const LazyFallback = () => (
  <div className="flex items-center justify-center h-full w-full min-h-[200px]">
    <div className="text-slate-500 text-xs font-mono uppercase tracking-widest animate-pulse">Loading module...</div>
  </div>
);

export interface ChatTabProps {
  [key: string]: any;
}

export function ChatTab(props: ChatTabProps) {
  const {
    chatLayout, setChatLayout, messages, setMessages, modelState, setModelState,
    depth, setDepth, isSpeaking, efeScore, isConsolidating, activeInsight,
    handleSaveInsight, handleDismissInsight, handleInsightTimeout, rlAgent,
    handleBranchThread, setContextMenu, theme, setInput, input, handleSend,
    addLog, vitals, memories, systemLogs, user, db, auth, debateState,
    isDebateMode, setIsDebateMode, isSuperpositionMode, setIsSuperpositionMode,
    messagesEndRef
  } = props;

  return (
    ${chatCode}
  );
}
`;

writeFileSync('src/components/tabs/ChatTab.tsx', finalCode);
console.log('Created src/components/tabs/ChatTab.tsx successfully.');
