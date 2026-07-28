1. **Extract Chat Interface into a modular component**:
   - Write and execute a Node.js script that will read `src/App.tsx`, locate the precise start and end of the `activeTab === 'Chat'` rendering block (lines ~2583-3033), and extract it into a new file `src/components/tabs/ChatTab.tsx`.
   - The script will add the following specific imports to the top of `ChatTab.tsx` based on analysis of `App.tsx`:
     ```typescript
     import React, { Suspense } from 'react';
     import { Cpu, Zap, Split, Brain, Network, Sliders, Paperclip, Mic, Send } from 'lucide-react';
     import { PresenceOrb } from "../PresenceOrb.js";
     import { TypewriterText } from "../TypewriterText.js";
     import { SubagentDebateArena } from '../SubagentDebateArena.js';
     import { HelpWidget, VitalsWidget, LogsWidget, DiagnosticWidget, RebootWidget } from '../CommandWidgets.js';
     import { QpuErdWidget } from '../QpuErdWidget.js';
     import { SelfHealingErrorCard } from '../SelfHealingErrorCard.js';
     import InsightReveal from '../InsightReveal.js';
     import InsightFeed from '../InsightFeed.js';
     import { doc, addDoc, collection, deleteDoc } from '../../firebase.js';
     import { LazyFallback } from '../../App.js'; // Ensure LazyFallback is exported or recreate it
     // ... other necessary types and imports
     ```
     *(Note: The Node script will intelligently construct these based on the extracted content and use `any` types for props to ensure a safe, non-destructive migration that prevents TypeScript regressions).*
2. **Verify Extraction**:
   - Execute `cat src/components/tabs/ChatTab.tsx` to manually confirm the extraction logic worked, imports are present, and the TypeScript syntax is valid.
3. **Modify `App.tsx`**:
   - Write and execute a Node.js script to update `src/App.tsx`. The script will:
     - Add `import { ChatTab } from './components/tabs/ChatTab.js';` to the top of the file.
     - Replace the large inline chat block with `<ChatTab {...{chatLayout, setChatLayout, messages, setMessages, modelState, setModelState, depth, setDepth, isSpeaking, efeScore, isConsolidating, activeInsight, handleSaveInsight, handleDismissInsight, handleInsightTimeout, rlAgent, handleBranchThread, setContextMenu, theme, setInput, input, handleSend, addLog, vitals, memories, systemLogs, user, db, auth, debateState, isDebateMode, setIsDebateMode, isSuperpositionMode, setIsSuperpositionMode, messagesEndRef}} />`.
4. **Verify `App.tsx` Modification**:
   - Execute `grep -B 5 -A 10 "ChatTab" src/App.tsx` to explicitly verify the insertion of the modular component call is correct.
5. **Run Tests and Verification**:
   - Run the exact commands: `npx vitest run --globals --environment jsdom` and `npm run lint` to confirm zero regressions or type errors were introduced by the extraction.
6. **Pre-commit Step**:
   - Complete pre-commit steps to ensure proper testing, verification, review, and reflection are done.
7. **Submit Changes**:
   - Execute the `submit` tool to finalize the isolated, non-destructive upgrade of the chat interface.
