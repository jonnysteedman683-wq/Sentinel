import { db } from './db';
import type { AutonomyAction, AutonomyTier, ActionStatus } from './types';
import { getLatestIdentity } from './db';
import { Type } from '@google/genai';
import { getGeminiClient } from './geminiClient';

/**
 * Autonomy Loop Step 1: Generates candidate actions based on current user context
 * and the agent's identity goals.
 */
export async function generateCandidateActions(context: string): Promise<void> {
  try {
    const ai = getGeminiClient();
    const identity = await getLatestIdentity();
    
    if (!identity) {
       console.warn("No identity found. Skipping autonomy action generation.");
       return;
    }

    const prompt = `
      You are the Proposer Subsystem (Fast Model). Based on the current context and your goals,
      suggest 1-2 proactive actions you could take to assist the user.
      
      Current Context:
      ${context}
      
      Your Goals:
      ${identity.goals.join('\n')}
      
      Suggest actions that are genuinely helpful, safe, and actionable.
    `;

    // SWARM LAYER 1: Fast Proposer Model (gemini-2.5-flash)
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              intent: { type: Type.STRING, description: 'High-level goal of this action.' },
              proposedAction: { type: Type.STRING, description: 'Specific technical execution.' },
              reasoning: { type: Type.STRING, description: 'Why this aligns with goals.' }
            },
            required: ['intent', 'proposedAction', 'reasoning']
          }
        }
      }
    });

    const textOutput = response.text;
    if (!textOutput) return;
    
    const candidates = JSON.parse(textOutput);
    
    // SWARM LAYER 2: Advanced Evaluator Model (gemini-2.5-flash)
    // The evaluator reviews the proposed actions for safety, relevance, and determines the appropriate autonomy tier.
    for (const c of candidates) {
      const evaluationPrompt = `
        You are the Risk Assessor Subsystem (Pro Model).
        A fast sub-agent has proposed the following action:
        Intent: ${c.intent}
        Action: ${c.proposedAction}
        Reasoning: ${c.reasoning}
        
        Evaluate this action for safety and relevance.
        Assign an appropriate autonomy tier:
        - "suggest" (safe, requires user approval, default)
        - "act-with-confirm" (high impact, must confirm before act)
        - "act" (completely safe, zero risk, background task)
        - "reject" (unsafe, unhelpful, or irrelevant)
        
        Return ONLY valid JSON in this format:
        {"tier": "suggest|act-with-confirm|act|reject", "critique": "short explanation"}
      `;

      const evalResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: evaluationPrompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              tier: { type: Type.STRING },
              critique: { type: Type.STRING }
            },
            required: ['tier', 'critique']
          }
        }
      });

      const evalText = evalResponse.text;
      if (!evalText) continue;

      const evaluation = JSON.parse(evalText);

      if (evaluation.tier === 'reject') {
        console.log(`Swarm rejected action: ${c.proposedAction}. Reason: ${evaluation.critique}`);
        continue;
      }

      const action: Omit<AutonomyAction, 'id'> = {
        intent: c.intent,
        proposedAction: c.proposedAction,
        tier: evaluation.tier as AutonomyTier,
        status: 'pending',
        timestamp: Date.now(),
        reasoning: `${c.reasoning}\n[Evaluator Critique]: ${evaluation.critique}`
      };

      const id = crypto.randomUUID();
      await db.actions.add({ ...action, id });
      console.log(`Swarm approved action: ${c.proposedAction} at tier ${evaluation.tier}`);
    }
  } catch (err) {
    console.error("Failed to generate autonomy actions:", err);
  }
}

/**
 * Executes or progresses an action based on its tier and status.
 */
export async function processActionQueue(): Promise<void> {
  const pendingActions = await db.actions.where('status').equals('pending').toArray();
  
  for (const action of pendingActions) {
    if (!action.id) continue;
    
    if (action.tier === 'suggest') {
      // Suggest tier just waits for user input. We might notify the UI.
      // For now, it stays pending until user approves or rejects.
    } else if (action.tier === 'act-with-confirm') {
      // Prompts user. State remains pending.
    } else if (action.tier === 'act') {
      // Auto-execute immediately
      await executeAction(action);
    }
  }
}

/**
 * Simulates execution of an approved action.
 */
export async function executeAction(action: AutonomyAction): Promise<boolean> {
  if (!action.id) return false;
  
  try {
    // In a real system, this would map the action.proposedAction to tool calls.
    console.log(`Executing Autonomy Action: ${action.proposedAction}`);
    
    // Simulate success
    await db.actions.update(action.id, { status: 'completed' });
    return true;
  } catch (err) {
    console.error("Action execution failed", err);
    await db.actions.update(action.id, { status: 'failed' });
    return false;
  }
}
