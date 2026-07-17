import { DebateAgent } from './debate-engine.js';

/**
 * Adjusts the preferences of a DebateAgent based on the user's current VAD state.
 * 
 * VAD:
 * v: Valence (negative to positive)
 * a: Arousal (calm to excited)
 * d: Dominance (submissive to dominant)
 * 
 * State indices in DebateWorldModel (6 dims):
 * 0: coherence
 * 1: novelty
 * 2: factuality
 * 3: turnParity
 * 4: agreement
 * 5: tension
 */
export function applyAffectiveModulation(agent: DebateAgent, vad: { v: number; a: number; d: number }) {
  // We bias the internal preference target based on user emotion.
  // Example heuristic:
  // If user is stressed (high A, negative V), reduce preferred tension, increase agreement and coherence.
  // If user is bored (low A, low V), increase preferred novelty and tension.
  
  const [coherence, novelty, factuality, _turnParity, agreement, tension] = agent.preferences.mu;
  const newMu = [...agent.preferences.mu];
  
  // High arousal -> prefer lower tension if valence is low (stress)
  if (vad.a > 0.5 && vad.v < -0.2) {
    newMu[5] = Math.max(0, tension - 0.2); // tension down
    newMu[4] = Math.min(1, agreement + 0.2); // agreement up
  }
  
  // Low arousal -> prefer higher novelty
  if (vad.a < -0.2) {
    newMu[1] = Math.min(1, novelty + 0.2); // novelty up
  }

  // Low dominance -> prefer higher coherence and factuality to give structure
  if (vad.d < -0.2) {
    newMu[0] = Math.min(1, coherence + 0.2); // coherence up
    newMu[2] = Math.min(1, factuality + 0.2); // factuality up
  }
  
  agent.preferences.mu = newMu;
}
