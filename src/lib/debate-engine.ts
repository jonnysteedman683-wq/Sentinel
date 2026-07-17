import { PolicyNetwork } from './policy-network.js';
import { WorldModel } from './world-model.js';

export type DebateMove = 
  | 'ARGUE'
  | 'QUESTION'
  | 'REFINE'
  | 'CONCEDE'
  | 'SUMMARIZE'
  | 'INJECT_CREATIVITY'
  | 'FACT_CHECK';

export const DEBATE_MOVES: DebateMove[] = [
  'ARGUE',
  'QUESTION',
  'REFINE',
  'CONCEDE',
  'SUMMARIZE',
  'INJECT_CREATIVITY',
  'FACT_CHECK'
];

export interface DebateState {
  coherence: number;
  novelty: number;
  factuality: number;
  turnParity: number;
  agreement: number;
  tension: number;
}

export class DebateWorldModel extends WorldModel {
  constructor() {
    super(6, DEBATE_MOVES.length, 8, 16); // Smaller dims for debate
  }
}

export class DebateAgent {
  public id: string;
  public persona: string;
  public preferences: { mu: number[]; invCov: number[][] };
  public policyNet: PolicyNetwork;
  public usePolicyNet: boolean = true;
  private actionDim: number = DEBATE_MOVES.length;

  constructor(id: string, persona: string, prefMu: number[], prefSigma: number[]) {
    this.id = id;
    this.persona = persona;
    
    // Convert sigma to invCov (diagonal)
    const invCov = prefSigma.map(s => 1 / (s * s + 1e-6));
    const invCovMatrix = Array(6).fill(0).map((_, i) => {
      const row = Array(6).fill(0);
      row[i] = invCov[i];
      return row;
    });

    this.preferences = { mu: prefMu, invCov: invCovMatrix };
    this.policyNet = new PolicyNetwork(6, this.actionDim);
  }

  async selectMove(state: number[]): Promise<{ move: DebateMove; confidence: number; efe: number }> {
    if (this.usePolicyNet) {
      const { action, confidence } = await this.policyNet.predict(state);
      if (confidence > 0.6) {
        return { move: DEBATE_MOVES[action], confidence, efe: 0 };
      }
    }

    // Fallback to planning (placeholder for now, will implement actual EFE planning if needed)
    const action = Math.floor(Math.random() * this.actionDim);
    return { move: DEBATE_MOVES[action], confidence: 0, efe: 0 };
  }

  serialize(): any {
    return {
      id: this.id,
      persona: this.persona,
      preferences: this.preferences,
      usePolicyNet: this.usePolicyNet
    };
  }
}

export class DebateEngine {
  // Pointing to a local inference daemon (e.g., Ollama running locally or via reverse proxy)
  private readonly LOCAL_INFERENCE_URL = process.env.LOCAL_INFERENCE_URL || 'http://localhost:11434/v1/chat/completions';
  private readonly LOCAL_INFERENCE_MODEL = process.env.LOCAL_INFERENCE_MODEL || 'llama3';
  
  public async generateSpecialistArgument(
    specialistRole: string, 
    context: string
  ): Promise<string> {
    try {
      const response = await fetch(this.LOCAL_INFERENCE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // API key is required by the OpenAI spec, but ignored by Ollama
          'Authorization': 'Bearer ollama' 
        },
        body: JSON.stringify({
          model: this.LOCAL_INFERENCE_MODEL,
          messages: [
            { role: 'system', content: `You are the ${specialistRole}.` },
            { role: 'user', content: context }
          ],
          stream: false
        })
      });

      if (!response.ok) throw new Error('Local daemon unreachable');
      
      const data = await response.json();
      return data.choices[0].message.content;
      
    } catch (error: any) {
      console.warn(`Debate node failed: ${error?.message || 'Unknown error'}. Triggering Circuit Breaker...`);
      return "CONSENSUS_FALLBACK"; 
    }
  }
}

