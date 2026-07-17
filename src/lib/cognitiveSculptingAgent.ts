import { ActiveInferenceAgent } from './active-inference.js';
import { WorldModel } from './world-model.js';
import { PreferenceManager } from './preferences.js';
import { Option } from './options.js';
import { RLDecision } from './rl-agent.js';

export class CognitiveSculptingAgent extends ActiveInferenceAgent {
  
  constructor(
    worldModel: WorldModel,
    prefManager: PreferenceManager,
    options: Option[],
    stateDim: number,
    actionDim: number,
    userId: string
  ) {
    // We add 1 more action to actionDim for TRIGGER_NEUROGENESIS
    // We add 4 more dimensions to stateDim (graphDensity, avgEdgeTrace, liquidEntropy, recentAnomaliesCount)
    super(worldModel, prefManager, options, stateDim + 4, actionDim + 1, userId);
  }

  /**
   * Enhances the standard state vector with plasticity metrics.
   */
  async enhanceStateVector(baseState: number[], metrics: {
    graphDensity: number;
    avgEdgeTrace: number;
    liquidEntropy: number;
    recentAnomaliesCount: number;
  }): Promise<number[]> {
    return [
      ...baseState,
      metrics.graphDensity,
      metrics.avgEdgeTrace,
      metrics.liquidEntropy,
      metrics.recentAnomaliesCount
    ];
  }

  async selectSculptingAction(enhancedState: number[]): Promise<RLDecision & { efe: number; confidence?: number }> {
    // If the policy net chooses the last action index, it's TRIGGER_NEUROGENESIS
    const decision = await this.selectAction(enhancedState);
    if (decision.type === 'action' && decision.index === this['actionDim'] - 1) { // assuming protected actionDim or calculate it
       // It's the neurogenesis action
       // We can return it or handle it in rl-agent
    }
    return decision;
  }
}
