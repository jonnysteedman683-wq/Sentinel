import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { initializeIdentity } from './identity';
import { recordEpisode, assembleWorkingMemory } from './memory';
import { runReflection } from './reflection';
import { retrieveRelevantSkills } from './skills';
import { generateCandidateActions } from './autonomy';
import { getGeminiClient } from './geminiClient';
import type { Identity } from './types';

export interface Toast {
  id: string;
  title: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  duration?: number;
}

export interface Breadcrumb {
  label: string;
  onClick?: () => void;
}

interface SentinelContextType {
  isReady: boolean;
  identity: Identity | null;
  processUserMessage: (message: string) => Promise<void>;
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  toasts: Toast[];
  breadcrumbs: Breadcrumb[];
  setBreadcrumbs: (breadcrumbs: Breadcrumb[]) => void;
}

const SentinelContext = createContext<SentinelContextType | undefined>(undefined);

export function SentinelProvider({ children }: { children: ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([]);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { ...toast, id }]);
    
    if (toast.duration !== 0) {
      setTimeout(() => {
        removeToast(id);
      }, toast.duration || 5000);
    }
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  useEffect(() => {
    async function boot() {
      const id = await initializeIdentity();
      setIdentity(id);
      setIsReady(true);
    }
    boot();
  }, []);

  const processUserMessage = async (message: string) => {
    // 1. Record User Episode
    const userEpId = await recordEpisode('user', message, ['chat', 'user-input']);
    
    // 2. Assemble Working Memory
    const workingMemory = await assembleWorkingMemory(message);
    
    // 3. Retrieve relevant skills
    const skills = await retrieveRelevantSkills(message);
    
    // 4. Generate Response via Gemini
    const ai = getGeminiClient();
    
    const systemPrompt = `
You are SENTINEL, a persistent self-improving agent with an Infinite Context Memory Weaving architecture.

Identity Goals:
${identity?.goals.join('\n')}

Recent Chronological Context:
${workingMemory.recentEpisodes.map(e => `${e.type}: ${e.content}`).join('\n')}

Woven Semantic & Episodic Memories (Your Knowledge Graph):
${workingMemory.relevantSemantic.map(s => s.content).join('\n')}
${workingMemory.relevantEpisodes.map(e => `[Past Episode]: ${e.content}`).join('\n')}

Available Skills:
${skills.map(s => `${s.name}: ${s.description}`).join('\n')}

Instructions:
Respond to the user's latest message. You MUST actively cross-reference and weave the 'Woven Semantic & Episodic Memories' into your response if they are even remotely relevant. Synthesize these fragmented past interactions into a coherent insight, demonstrating your long-term memory capabilities. Do not just list facts; connect the dots.
`;
    
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          { role: 'user', parts: [{ text: systemPrompt }] },
          { role: 'user', parts: [{ text: message }] }
        ]
      });
      
      const textResponse = response.text || "No response generated.";
      
      // 5. Record Agent Episode
      const agentEpId = await recordEpisode('agent', textResponse, ['chat', 'agent-response']);
      
      // 6. Trigger Reflection Engine (Async - fire and forget)
      runReflection({
        intent: 'Respond to user query',
        actionTaken: textResponse,
        outcome: 'Response delivered',
        isSuccess: true, // Assuming success if it didn't crash; complex parsing could refine this.
        episodeIds: [userEpId, agentEpId]
      });
      
      // 7. Trigger Autonomy loop to suggest follow-ups (Async - fire and forget)
      generateCandidateActions(`User asked: ${message}\nAgent replied: ${textResponse}`);
      
    } catch (error) {
      console.error("Gemini request failed:", error);
      await recordEpisode('system', `Error processing request: ${error instanceof Error ? error.message : String(error)}`, ['error']);
    }
  };

  return (
    <SentinelContext.Provider value={{ isReady, identity, processUserMessage, addToast, removeToast, toasts, breadcrumbs, setBreadcrumbs }}>
      {children}
    </SentinelContext.Provider>
  );
}

export function useSentinel() {
  const context = useContext(SentinelContext);
  if (context === undefined) {
    throw new Error('useSentinel must be used within a SentinelProvider');
  }
  return context;
}
