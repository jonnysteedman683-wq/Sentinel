import { Brain, Cpu, Mic, Network, Paperclip, Send, Sliders, Split, Zap } from 'lucide-react';
import { lazy, Suspense } from 'react';
import { addDoc, collection, deleteDoc, doc } from '../../firebase.js';
import {
  DiagnosticWidget,
  HelpWidget,
  LogsWidget,
  RebootWidget,
  VitalsWidget,
} from '../CommandWidgets.js';
import InsightFeed from '../InsightFeed.js';
import InsightReveal from '../InsightReveal.js';
import { PresenceOrb } from '../PresenceOrb.js';
import { QpuErdWidget } from '../QpuErdWidget.js';
import { ReasoningTree } from '../ReasoningTree.js';
import { SelfHealingErrorCard } from '../SelfHealingErrorCard.js';
import { SubagentDebateArena } from '../SubagentDebateArena.js';
import { TypewriterText } from '../TypewriterText.js';

type CognitionDepth = 'Fast' | 'Balanced' | 'Deep Reasoning';

const CognitiveCanvas = lazy(() => import('../CognitiveCanvas.js'));

const LazyFallback = () => (
  <div className="flex items-center justify-center h-full w-full min-h-[200px]">
    <div className="text-slate-500 text-xs font-mono uppercase tracking-widest animate-pulse">
      Loading module...
    </div>
  </div>
);

export interface ChatTabProps {
  [key: string]: any;
}

export function ChatTab(props: ChatTabProps) {
  const {
    chatLayout,
    setChatLayout,
    messages,
    setMessages,
    modelState,
    setModelState,
    depth,
    setDepth,
    isSpeaking,
    efeScore,
    isConsolidating,
    activeInsight,
    handleSaveInsight,
    handleDismissInsight,
    handleInsightTimeout,
    rlAgent,
    handleBranchThread,
    setContextMenu,
    theme,
    setInput,
    input,
    handleSend,
    addLog,
    vitals,
    memories,
    systemLogs,
    user,
    db,
    auth,
    debateState,
    isDebateMode,
    setIsDebateMode,
    isSuperpositionMode,
    setIsSuperpositionMode,
    messagesEndRef,
  } = props;

  return (
    <>
      {chatLayout === 'canvas' ? (
        <div className="flex-grow w-full h-[550px] min-h-[400px] p-4 overflow-hidden relative z-10">
          <Suspense fallback={<LazyFallback />}>
            <CognitiveCanvas
              messages={messages.map((m: any) => ({
                id: m.id,
                role: m.role,
                content:
                  typeof m.content === 'string' ? m.content : JSON.stringify(m.content) || '',
                timestamp: m.timestamp ?? Date.now(),
              }))}
            />
          </Suspense>
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
              cognitiveLoad={Math.min(
                1,
                Math.max(
                  0,
                  efeScore +
                    (isConsolidating ? 0.3 : 0) +
                    (modelState === 'Reasoning' || modelState === 'Learning' ? 0.2 : 0),
                ),
              )}
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
              {messages.map((msg: any) => (
                <div
                  key={msg.id}
                  className={`group relative flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} w-full`}
                >
                  <button
                    type="button"
                    onClick={() => handleBranchThread(msg.id)}
                    className={`absolute top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-xl border border-white/10 bg-black/60 text-slate-400 hover:text-fuchsia-400 hover:border-fuchsia-500/30 transition-all z-20 ${
                      msg.role === 'user' ? 'left-0 -translate-x-12' : 'right-0 translate-x-12'
                    }`}
                    title="Branch timeline from this message"
                  >
                    <Split className="w-4 h-4" />
                  </button>
                  <div className="flex flex-col gap-2 w-full max-w-full">
                    {msg.content && msg.content !== '{}' && msg.content !== '""' && (
                      // biome-ignore lint/a11y/noStaticElementInteractions: Context menu overlay
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
                        }`}
                      >
                        {msg.role === 'ai' ? (
                          <div className="flex flex-col gap-5 w-full">
                            <div className="flex items-start gap-4">
                              <div className="w-8 h-8 rounded-full bg-teal-500/20 border border-teal-500/30 flex items-center justify-center flex-shrink-0 mt-1">
                                <Cpu className="w-4 h-4 text-teal-400" />
                              </div>
                              <div
                                className={`leading-relaxed ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}
                              >
                                <TypewriterText
                                  text={
                                    typeof msg.content === 'string'
                                      ? msg.content
                                      : JSON.stringify(msg.content) || ''
                                  }
                                  isTyping={!!msg.isTyping}
                                  onComplete={() => {
                                    setMessages((prev: any) =>
                                      prev.map((m: any) =>
                                        m.id === msg.id ? { ...m, isTyping: false } : m,
                                      ),
                                    );
                                  }}
                                />
                              </div>
                            </div>
                            {msg.superpositionBranches && msg.superpositionBranches.length > 0 && (
                              <ReasoningTree
                                branches={msg.superpositionBranches}
                                synthesis={msg.content}
                              />
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
                                    <div
                                      className={`p-3 rounded-lg border ${theme === 'dark' ? 'bg-black/40 border-white/5' : 'bg-black/5 border-black/5'}`}
                                    >
                                      <span className="text-[9px] uppercase tracking-wider text-slate-500 block mb-1">
                                        1. Draft
                                      </span>
                                      <p
                                        className={`text-xs italic line-clamp-3 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}
                                      >
                                        {typeof msg.cognitiveLog.draft === 'string'
                                          ? msg.cognitiveLog.draft
                                          : JSON.stringify(msg.cognitiveLog.draft)}
                                      </p>
                                    </div>
                                    <div
                                      className={`p-3 rounded-lg border ${theme === 'dark' ? 'bg-black/40 border-white/5' : 'bg-black/5 border-black/5'}`}
                                    >
                                      <span className="text-[9px] uppercase tracking-wider text-slate-500 block mb-1">
                                        2. Recollection
                                      </span>
                                      <p
                                        className={`text-xs italic line-clamp-3 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}
                                      >
                                        {typeof msg.cognitiveLog.recollection === 'string'
                                          ? msg.cognitiveLog.recollection
                                          : JSON.stringify(msg.cognitiveLog.recollection)}
                                      </p>
                                    </div>
                                    <div
                                      className={`p-3 rounded-lg border ${theme === 'dark' ? 'bg-black/40 border-white/5' : 'bg-black/5 border-black/5'}`}
                                    >
                                      <span className="text-[9px] uppercase tracking-wider text-slate-500 block mb-1">
                                        3. Reflection
                                      </span>
                                      <p
                                        className={`text-xs italic line-clamp-3 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}
                                      >
                                        {typeof msg.cognitiveLog.reflection === 'string'
                                          ? msg.cognitiveLog.reflection
                                          : JSON.stringify(msg.cognitiveLog.reflection)}
                                      </p>
                                    </div>
                                    <div
                                      className={`p-3 rounded-lg border ${theme === 'dark' ? 'bg-black/40 border-white/5' : 'bg-black/5 border-black/5'}`}
                                    >
                                      <span className="text-[9px] uppercase tracking-wider text-slate-500 block mb-1">
                                        4. Synthesis
                                      </span>
                                      <p
                                        className={`text-xs italic line-clamp-3 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}
                                      >
                                        {typeof msg.cognitiveLog.reiteration === 'string'
                                          ? msg.cognitiveLog.reiteration
                                          : JSON.stringify(msg.cognitiveLog.reiteration)}
                                      </p>
                                    </div>
                                  </div>
                                </details>
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap">
                            {typeof msg.content === 'string'
                              ? msg.content
                              : JSON.stringify(msg.content)}
                          </p>
                        )}
                      </div>
                    )}

                    {msg.systemUI ? (
                      <div
                        className={`w-full max-w-2xl ${msg.role === 'user' ? 'self-end' : 'self-start'} mt-2`}
                      >
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
                            uid={user?.uid || 'anonymous'}
                            db={db}
                            auth={auth}
                            addLog={(m, l, s) => addLog(m, l || 'INFO', s || 'DIAGNOSTIC')}
                          />
                        )}
                        {msg.systemUI === 'reboot' && (
                          <RebootWidget
                            onComplete={() => {
                              addLog(
                                'Reboot sequence completed. Synapses re-synchronized.',
                                'NEURAL',
                                'SYSTEM',
                              );
                              setModelState('Idle');
                            }}
                          />
                        )}
                        {msg.systemUI === 'qpu-erd' && (
                          <QpuErdWidget text={msg.systemUIData?.text} />
                        )}
                        {msg.systemUI === 'error-card' && (
                          <SelfHealingErrorCard
                            errorMessage={
                              msg.systemUIData?.errorMessage ||
                              msg.content ||
                              'Connection disruption'
                            }
                            traceId={msg.systemUIData?.traceId}
                            addLog={(m, l) => addLog(m, l, 'DIAGNOSTIC')}
                            onOfflineSimulate={() => {
                              addLog(
                                'Engaging neural offline simulation mode...',
                                'WARN',
                                'SYSTEM',
                              );
                              const mockAiData = {
                                role: 'ai' as const,
                                content:
                                  'Offline Self-Healing Simulation Mode engaged! I have bypassed API latency channels and established a direct local loopback connection. Ask me anything, and I will generate local rule-based responses.',
                                timestamp: Date.now(),
                                traceId: msg.systemUIData?.traceId,
                              };
                              if (user) {
                                addDoc(collection(db, 'users', user.uid, 'chats'), mockAiData);
                              } else {
                                setMessages((prev: any) => [
                                  ...prev,
                                  { id: `mock-${Date.now()}`, ...mockAiData },
                                ]);
                              }
                            }}
                            onRetry={async () => {
                              addLog('Attempting synaptic retry transmission...', 'WARN', 'API');
                              const lastUserMsg = [...messages]
                                .reverse()
                                .find((m: any) => m.role === 'user');
                              if (lastUserMsg?.content) {
                                setInput(lastUserMsg.content);
                                setMessages((prev: any) =>
                                  prev.filter((m: any) => m.id !== msg.id),
                                );
                                if (user) {
                                  try {
                                    const errorDocRef = doc(db, 'users', user.uid, 'chats', msg.id);
                                    await deleteDoc(errorDocRef);
                                  } catch (e) {
                                    console.warn(
                                      'Could not delete stale error doc from firestore',
                                      e,
                                    );
                                  }
                                }
                                setTimeout(() => {
                                  handleSend();
                                }, 100);
                              } else {
                                addLog(
                                  'No preceding user message found to retry.',
                                  'ERROR',
                                  'SYSTEM',
                                );
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
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider block">
                      Topic of Inquiry
                    </span>
                    <p className="text-xs font-medium text-slate-300 italic">
                      "{debateState.context.topic}"
                    </p>
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
                        <span className="text-[9px] text-teal-400 uppercase tracking-widest font-bold">
                          Active Agent Reasoning
                        </span>
                        <h4 className="text-xs font-bold text-slate-200 capitalize">
                          {debateState.context.activeAgentId === 'logician'
                            ? 'Analytical Logician'
                            : debateState.context.activeAgentId === 'catalyst'
                              ? 'Creative Catalyst'
                              : 'Adversarial Auditor'}
                        </h4>
                      </div>
                      <span className="text-[10px] font-mono text-slate-500">
                        Turn {debateState.context.turns + 1} of {debateState.context.maxTurns}
                      </span>
                    </div>
                  )}

                  {/* Live State Vector gauges */}
                  <div className="space-y-2.5">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider block">
                      Cognitive State Vector Telemetry
                    </span>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {[
                        { name: 'Coherence', val: debateState.context.currentStateVector[0] },
                        { name: 'Novelty', val: debateState.context.currentStateVector[1] },
                        { name: 'Factuality', val: debateState.context.currentStateVector[2] },
                        { name: 'Turn Parity', val: debateState.context.currentStateVector[3] },
                        { name: 'Agreement', val: debateState.context.currentStateVector[4] },
                        { name: 'Tension', val: debateState.context.currentStateVector[5] },
                      ].map((dim) => (
                        <div
                          key={dim.name}
                          className="p-2.5 rounded-xl bg-black/40 border border-white/5 flex flex-col gap-1.5"
                        >
                          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tight">
                            {dim.name}
                          </span>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                  width: `${(dim.val ?? 0.5) * 100}%`,
                                  backgroundColor:
                                    dim.name === 'Coherence'
                                      ? '#818cf8'
                                      : dim.name === 'Novelty'
                                        ? '#fbbf24'
                                        : dim.name === 'Factuality'
                                          ? '#34d399'
                                          : dim.name === 'Turn Parity'
                                            ? '#c084fc'
                                            : dim.name === 'Agreement'
                                              ? '#2dd4bf'
                                              : '#f43f5e',
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
                      isComplete={
                        debateState.matches('consensusReached') || debateState.matches('idle')
                      }
                    />
                  )}
                </div>
              )}
              {/* Reasoning Indicator */}
              {modelState === 'Reasoning' && !isDebateMode && (
                <div className="flex justify-start w-full animate-in fade-in slide-in-from-left-4 duration-500">
                  <div
                    className={`max-w-[80%] p-5 rounded-2xl ${theme === 'dark' ? 'bg-white/5 border border-white/10' : 'bg-black/5 border border-black/5'} backdrop-blur-md rounded-tl-sm flex items-center gap-3`}
                  >
                    <div className="w-8 h-8 rounded-full bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
                      <Brain className="w-4 h-4 text-teal-400 animate-pulse" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] text-teal-400 uppercase tracking-widest font-bold font-mono">
                        Reasoning...
                      </span>
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
                  {(['Fast', 'Balanced', 'Deep Reasoning'] as CognitionDepth[]).map((d) => (
                    <button
                      type="button"
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
                  <div
                    className={`w-2 h-2 rounded-full ${isDebateMode ? 'bg-teal-400 animate-pulse' : 'bg-slate-600'}`}
                  />
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
                  <div
                    className={`w-2 h-2 rounded-full ${isSuperpositionMode ? 'bg-fuchsia-400 animate-pulse' : 'bg-slate-600'}`}
                  />
                  {isSuperpositionMode ? 'ACTIVE' : 'OFF'}
                </button>
              </div>
            </div>
          </div>

          {/* Predictive Shortcuts */}
          {messages.length > 0 &&
            messages[messages.length - 1].role === 'ai' &&
            messages[messages.length - 1].suggestedShortcuts && (
              <div className="flex flex-wrap gap-2 mb-4 px-2 animate-in fade-in slide-in-from-bottom-2 duration-500">
                {messages[messages.length - 1].suggestedShortcuts?.map((shortcut: any) => (
                  <button
                    type="button"
                    key={shortcut}
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
          <form
            onSubmit={handleSend}
            className={`relative flex items-end gap-2 border rounded-2xl p-2 transition-all focus-within:border-teal-500/50 shadow-inner ${
              theme === 'dark'
                ? 'bg-white/5 border-white/10 focus-within:bg-white/10'
                : 'bg-black/5 border-black/10 focus-within:bg-black/10'
            }`}
          >
            <button
              type="button"
              className={`p-3 transition-colors ${theme === 'dark' ? 'text-slate-400 hover:text-teal-400' : 'text-slate-500 hover:text-teal-600'}`}
            >
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
                theme === 'dark'
                  ? 'text-slate-200 placeholder:text-slate-600'
                  : 'text-slate-800 placeholder:text-slate-400'
              }`}
              rows={1}
            />

            <button
              type="button"
              className={`p-3 transition-colors ${theme === 'dark' ? 'text-slate-400 hover:text-teal-400' : 'text-slate-500 hover:text-teal-600'}`}
            >
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
  );
}
