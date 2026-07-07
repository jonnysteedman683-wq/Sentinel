import { db } from './db';
import { generateEmbedding, rankBySimilarity } from './embeddings';
import type { Episode, SemanticEntry } from './types';
import { getGeminiClient } from './geminiClient';
import { Type } from '@google/genai';

async function generateTagsForContent(content: string): Promise<string[]> {
  try {
    const ai = getGeminiClient();
    const prompt = `Categorize the following text by generating 1-3 short, relevant, categorical tags (e.g., 'technical', 'personal', 'project', 'question', 'fact'). Reply in JSON format as an array of strings.\n\nText: ${content}`;
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });
    if (response.text) {
      return JSON.parse(response.text) as string[];
    }
  } catch (err) {
    console.error("Failed to generate tags via Gemini:", err);
  }
  return [];
}

/**
 * Records a raw interaction (user message, agent response, or system event).
 * Automatically generates a vector embedding for retrieval.
 */
export async function recordEpisode(
  type: 'user' | 'agent' | 'system' | 'observation',
  content: string,
  tags: string[] = []
): Promise<string> {
  let finalTags = [...tags];
  
  if (type === 'user' || type === 'agent') {
    const autoTags = await generateTagsForContent(content);
    finalTags = Array.from(new Set([...finalTags, ...autoTags]));
  }

  const embedding = await generateEmbedding(content);
  const episode: Omit<Episode, 'id'> = {
    type,
    content,
    embedding,
    timestamp: Date.now(),
    tags: finalTags
  };
  
  const id = crypto.randomUUID();
  await db.episodes.add({ ...episode, id });
  return id;
}

/**
 * Records a distilled fact or rule derived from episodes.
 * Automatically generates a vector embedding for retrieval.
 */
export async function recordSemanticEntry(
  content: string,
  sourceEpisodeIds: string[],
  tags: string[] = []
): Promise<string> {
  const embedding = await generateEmbedding(content);
  const entry: Omit<SemanticEntry, 'id'> = {
    content,
    sourceEpisodeIds,
    embedding,
    timestamp: Date.now(),
    tags,
    retrievalCount: 0
  };
  
  const id = crypto.randomUUID();
  await db.semanticEntries.add({ ...entry, id });
  return id;
}

export interface WorkingMemory {
  recentEpisodes: Episode[];
  relevantEpisodes: Episode[];
  relevantSemantic: SemanticEntry[];
}

/**
 * Assembles a "Working Memory" context for the agent by combining immediate 
 * chronological history with vector-retrieved semantic and episodic memories.
 */
export async function assembleWorkingMemory(
  query: string, 
  topK: number = 5,
  recentCount: number = 10
): Promise<WorkingMemory> {
  // 1. Get recent chronological context (the immediate conversation window)
  const allEpisodes = await db.episodes.orderBy('timestamp').reverse().toArray();
  // Reverse again to put them back in chronological order for the context window
  const recentEpisodes = allEpisodes.slice(0, recentCount).reverse(); 

  // 2. Generate embedding for the current query to find semantic matches
  const queryEmbedding = await generateEmbedding(query);

  // 3. Find relevant historical episodes (excluding the ones we just pulled as "recent")
  const recentIds = new Set(recentEpisodes.map(e => e.id));
  const candidateEpisodes = allEpisodes.filter(e => e.id && !recentIds.has(e.id));
  
  const rankedEpisodes = rankBySimilarity(queryEmbedding, candidateEpisodes, topK);
  const relevantEpisodes = rankedEpisodes.map(r => r.item);

  // 4. Find relevant semantic memories
  const allSemantic = await db.semanticEntries.toArray();
  const rankedSemantic = rankBySimilarity(queryEmbedding, allSemantic, topK);
  const relevantSemantic = rankedSemantic.map(r => r.item);

  // 5. Update retrieval counts for semantic entries to track utility over time
  // This helps the consolidation/decay job identify valuable vs stale memories.
  for (const entry of relevantSemantic) {
    if (entry.id) {
      await db.semanticEntries.update(entry.id, { 
        retrievalCount: entry.retrievalCount + 1 
      });
    }
  }

  return {
    recentEpisodes,
    relevantEpisodes,
    relevantSemantic
  };
}
