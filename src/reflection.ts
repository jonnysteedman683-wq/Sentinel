import { Type } from '@google/genai';
import { db } from './db';
import { recordSemanticEntry } from './memory';
import type { Identity } from './types';
import { getGeminiClient } from './geminiClient';

export interface ReflectionContext {
  intent: string;
  actionTaken: string;
  outcome: string;
  isSuccess: boolean;
  usedSkillId?: string;
  episodeIds: string[];
}

/**
 * The Reflection Engine: A gemini-2.5-flash critic pass that runs after tasks.
 * It writes lessons to semantic memory, updates skill scores/heuristics, 
 * and can optionally propose updates to the Identity kernel.
 */
export async function runReflection(context: ReflectionContext): Promise<void> {
  try {
    const ai = getGeminiClient();
    
    // Fetch current identity to provide self-model context to the critic
    const identities = await db.identities.orderBy('version').reverse().limit(1).toArray();
    const currentIdentity = identities[0];

    const prompt = `
      You are the Reflection Engine for an autonomous agent.
      Review the recent action and determine what can be learned.
      
      Intent: ${context.intent}
      Action Taken: ${context.actionTaken}
      Outcome: ${context.outcome}
      Success: ${context.isSuccess}
      
      Tasks:
      1. Distill a concise, universally applicable lesson from this.
      2. If a skill was used, suggest heuristic improvements and a score adjustment (-0.1 to +0.1).
      3. Evaluate if the agent's core identity (capabilities/weaknesses) needs updating based on this outcome.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            lesson: { type: Type.STRING, description: 'Concise distilled lesson.' },
            skillScoreAdjustment: { type: Type.NUMBER, description: 'Value between -0.1 and 0.1' },
            newHeuristic: { type: Type.STRING, description: 'A new rule of thumb for this skill, if any.' },
            identityChangeNeeded: { type: Type.BOOLEAN },
            identityChangeDescription: { type: Type.STRING },
            newCapability: { type: Type.STRING },
            newWeakness: { type: Type.STRING }
          },
          required: ['lesson', 'skillScoreAdjustment', 'identityChangeNeeded']
        }
      }
    });

    const textOutput = response.text;
    if (!textOutput) throw new Error("No output from reflection model.");
    
    const analysis = JSON.parse(textOutput);

    // 1. Write the lesson to Semantic Memory
    await recordSemanticEntry(
      `Reflection on [${context.isSuccess ? 'Success' : 'Failure'}]: ${analysis.lesson}`,
      context.episodeIds,
      ['reflection', context.isSuccess ? 'success' : 'failure']
    );

    // 2. Update the Skill Card if one was used
    if (context.usedSkillId) {
      const skill = await db.skills.get(context.usedSkillId);
      if (skill) {
        const newScore = Math.max(0, Math.min(1, skill.successScore + analysis.skillScoreAdjustment));
        const updatedHeuristics = [...skill.heuristics];
        if (analysis.newHeuristic) {
          updatedHeuristics.push(analysis.newHeuristic);
        }
        
        await db.skills.update(context.usedSkillId, {
          successScore: newScore,
          heuristics: updatedHeuristics,
          lastUpdated: Date.now(),
          editHistory: [
            ...skill.editHistory,
            { timestamp: Date.now(), changeDescription: `Reflection adj: ${analysis.skillScoreAdjustment}. ${analysis.newHeuristic || ''}` }
          ]
        });
      }
    }

    // 3. Update Identity if a core shift in capability/weakness was detected
    if (analysis.identityChangeNeeded && currentIdentity) {
      const updatedCapabilities = [...currentIdentity.capabilities];
      const updatedWeaknesses = [...currentIdentity.knownWeaknesses];
      
      if (analysis.newCapability && !updatedCapabilities.includes(analysis.newCapability)) {
        updatedCapabilities.push(analysis.newCapability);
      }
      if (analysis.newWeakness && !updatedWeaknesses.includes(analysis.newWeakness)) {
        updatedWeaknesses.push(analysis.newWeakness);
      }

      const newIdentity: Omit<Identity, 'id'> = {
        ...currentIdentity,
        version: currentIdentity.version + 1,
        capabilities: updatedCapabilities,
        knownWeaknesses: updatedWeaknesses,
        lastUpdated: Date.now(),
        auditLog: [
          ...currentIdentity.auditLog,
          {
            timestamp: Date.now(),
            changeDescription: analysis.identityChangeDescription || 'Automated reflection update.',
            previousVersion: currentIdentity.version
          }
        ]
      };
      
      const newId = crypto.randomUUID();
      await db.identities.add({ ...newIdentity, id: newId });
    }
  } catch (err) {
    console.error("Reflection engine failed to run. Degrading gracefully.", err);
  }
}
