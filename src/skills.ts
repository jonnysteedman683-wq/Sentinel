import { db } from './db';
import { generateEmbedding, rankBySimilarity } from './embeddings';
import type { SkillCard } from './types';
import { Type } from '@google/genai';
import { getGeminiClient } from './geminiClient';

/**
 * Distills a successful sequence of actions into a reusable SkillCard.
 * This is triggered by the Reflection Engine when a novel, successful task is completed.
 */
export async function distillSkill(
  taskIntent: string,
  successfulSteps: string[],
  context: string
): Promise<string | undefined> {
  try {
    const ai = getGeminiClient();
    const prompt = `
      Analyze this successful task execution and distill it into a reusable skill.
      
      Task Intent: ${taskIntent}
      Context: ${context}
      Steps Taken:
      ${successfulSteps.map((s, i) => `${i + 1}. ${s}`).join('\n')}
      
      Create a "Skill Card" that can be used by an agent to solve similar tasks in the future.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: 'Short, descriptive name for the skill (e.g. "WebSearchAndSummarize")' },
            description: { type: Type.STRING, description: 'What this skill does.' },
            triggerConditions: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'List of conditions/intents where this skill is applicable.' },
            promptTemplate: { type: Type.STRING, description: 'A template prompt for executing this skill. Use {{variables}}.' },
            toolSequence: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Sequential list of tools/actions required.' },
            heuristics: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Rules of thumb for applying this skill successfully.' }
          },
          required: ['name', 'description', 'triggerConditions', 'promptTemplate', 'toolSequence', 'heuristics']
        }
      }
    });

    const textOutput = response.text;
    if (!textOutput) throw new Error("No output from skill distillation model.");
    
    const distilled = JSON.parse(textOutput);

    const skillCard: Omit<SkillCard, 'id'> = {
      name: distilled.name,
      description: distilled.description,
      triggerConditions: distilled.triggerConditions,
      promptTemplate: distilled.promptTemplate,
      toolSequence: distilled.toolSequence,
      heuristics: distilled.heuristics,
      successScore: 0.5, // Start with a neutral score, modified by reflection
      lastUpdated: Date.now(),
      editHistory: [
        { timestamp: Date.now(), changeDescription: 'Initial distillation.' }
      ]
    };

    const id = crypto.randomUUID();
    await db.skills.add({ ...skillCard, id });
    return id;
  } catch (err) {
    console.error("Skill distillation failed:", err);
    return undefined;
  }
}

/**
 * Retrieves the top K most relevant skills for a given query/intent.
 */
export async function retrieveRelevantSkills(intent: string, topK: number = 3): Promise<SkillCard[]> {
  const queryEmbedding = await generateEmbedding(intent);
  
  const allSkills = await db.skills.toArray();
  
  // We rank skills based on a combination of their trigger conditions/description and the query.
  // To do this simply, we generate embeddings for the skill description on the fly, 
  // or we could store it. For simplicity in this v1, we embed on the fly, but ideally 
  // we'd cache embeddings on the SkillCard.
  
  // As a fast alternative for this module without altering types:
  // We'll embed the intent, and embed the skill representations to rank them.
  const scoredSkills = await Promise.all(allSkills.map(async (skill) => {
    const skillRep = `${skill.name} ${skill.description} ${skill.triggerConditions.join(' ')}`;
    const skillEmbedding = await generateEmbedding(skillRep);
    const score = generateEmbedding ? (await rankBySimilarity(queryEmbedding, [{ embedding: skillEmbedding }])[0]).score : 0;
    
    // Weight the score by the skill's historical success score
    const weightedScore = score * (0.5 + skill.successScore); 
    return { skill, score: weightedScore };
  }));

  return scoredSkills
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(s => s.skill);
}
