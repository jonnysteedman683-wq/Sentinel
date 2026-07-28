import { readFileSync, writeFileSync } from 'fs';

let content = readFileSync('src/App.tsx', 'utf-8');

// Insert import
content = content.replace(
  "import { ContextMenu } from './components/ContextMenu.js';",
  "import { ContextMenu } from './components/ContextMenu.js';\nimport { ChatTab } from './components/tabs/ChatTab.js';"
);

const lines = content.split('\n');

const chatStart = lines.findIndex(l => l.includes("{activeTab === 'Chat' ? ("));
const chatEnd = lines.findIndex((l, i) => i > chatStart && l.includes("activeTab === 'Memory' ? ("));

const replacement = `            {activeTab === 'Chat' ? (
              <ChatTab {...{chatLayout, setChatLayout, messages, setMessages, modelState, setModelState, depth, setDepth, isSpeaking, efeScore, isConsolidating, activeInsight, handleSaveInsight, handleDismissInsight, handleInsightTimeout, rlAgent, handleBranchThread, setContextMenu, theme, setInput, input, handleSend, addLog, vitals, memories, systemLogs, user, db, auth, debateState, isDebateMode, setIsDebateMode, isSuperpositionMode, setIsSuperpositionMode, messagesEndRef, activeThreadId, setActiveThreadId, threads, clearChat}} />
            ) : (
              <div className="p-3 sm:p-6 flex-1 overflow-y-auto w-full h-full custom-scrollbar pb-20 md:pb-6">
              <Suspense fallback={<LazyFallback />}>
                {`;

const before = lines.slice(0, chatStart).join('\n');
const after = lines.slice(chatEnd + 1).join('\n'); // skip "activeTab === 'Memory' ? (" as well? wait let's look at how we matched it.
