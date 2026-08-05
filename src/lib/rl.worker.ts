import { CuriousAgentCore } from './rl-agent-core.js';

let agent: CuriousAgentCore | null = null;

self.onmessage = async (e) => {
  const { id, method, args } = e.data;
  
  if (method === 'INIT') {
    agent = new CuriousAgentCore(args[0], args[1], args[2], args[3], args[4], args[5]);
    
    agent.setNudgeCallback(async (msg?: any) => { self.postMessage({ type: 'EVENT', event: 'nudgeCallback', data: msg }); });
    agent.setConsolidateCallback(async (msg?: any) => { self.postMessage({ type: 'EVENT', event: 'consolidateCallback', data: msg }); });
    agent.setInsightCallback(async (msg?: any) => { self.postMessage({ type: 'EVENT', event: 'insightCallback', data: msg }); });
    agent.setHybridSyncRAGCallback(async (msg?: any) => { self.postMessage({ type: 'EVENT', event: 'hybridSyncRAGCallback', data: msg }); });
    
    self.postMessage({ id, status: 'success' });
    return;
  }
  
  if (!agent) {
    self.postMessage({ id, status: 'error', error: 'Agent not initialized' });
    return;
  }

  try {
    const result = await (agent as any)[method](...args);
    self.postMessage({ id, status: 'success', data: result });
    
    // Sync state back for epsilon, options, etc.
    self.postMessage({
      type: 'EVENT',
      event: 'SYNC_STATE',
      data: {
        epsilon: agent.epsilon,
        activeOption: agent.activeOption,
        options: agent.options,
        optionInitState: agent.optionInitState,
        useActiveInference: agent.useActiveInference
      }
    });
  } catch (error: any) {
    self.postMessage({ id, status: 'error', error: error.message });
  }
};
