import { db } from './db';
import { recordSemanticEntry } from './memory';
import { Type } from '@google/genai';
import { getGeminiClient } from './geminiClient';

/**
 * The "Sleep" Job: Consolidates raw episodic memories into semantic knowledge,
 * and prunes stale or unused semantic entries to keep the memory fabric healthy.
 */
export async function runConsolidationJob(): Promise<void> {
  console.log("Starting Memory Consolidation Job...");
  try {
    const ai = getGeminiClient();
    
    // 1. Fetch recent episodes to consolidate (e.g., limit to 50 for token limits)
    const episodes = await db.episodes.orderBy('timestamp').reverse().limit(50).toArray();
    
    if (episodes.length > 0) {
      const episodeTexts = episodes.map(e => `[${new Date(e.timestamp).toISOString()}] ${e.type}: ${e.content}`).join('\n');
      
      const prompt = `
        You are the Memory Consolidation subsystem of an autonomous agent.
        Review the following recent episodic interactions and extract 1-3 highly salient, 
        long-term facts, user preferences, or contextual rules. Ignore trivial chatter.
        
        Recent Episodes:
        ${episodeTexts}
      `;

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
                fact: { type: Type.STRING, description: 'The distilled semantic fact or preference.' },
                tags: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Categorical tags for this fact.' }
              },
              required: ['fact', 'tags']
            }
          }
        }
      });

      const textOutput = response.text;
      if (textOutput) {
        const distilledFacts = JSON.parse(textOutput);
        const episodeIds = episodes.map(e => e.id as string).filter(Boolean);

        for (const item of distilledFacts) {
          await recordSemanticEntry(item.fact, episodeIds, item.tags);
        }
        console.log(`Consolidated ${distilledFacts.length} new semantic entries.`);
      }
    }

    // 2. Decay stale/low-value semantic memories
    // If a memory is older than 7 days and has a very low retrieval count, delete it.
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    
    const allSemantic = await db.semanticEntries.toArray();
    const toDelete = allSemantic.filter(entry => {
      const age = now - entry.timestamp;
      // Decay condition: older than 7 days AND retrieved less than 2 times
      return age > SEVEN_DAYS_MS && entry.retrievalCount < 2;
    }).map(e => e.id as string).filter(Boolean);

    if (toDelete.length > 0) {
      await db.semanticEntries.bulkDelete(toDelete);
      console.log(`Decayed ${toDelete.length} stale semantic entries.`);
    }

    console.log("Memory Consolidation Job complete.");
  } catch (err) {
    console.error("Consolidation job failed:", err);
  }
}
