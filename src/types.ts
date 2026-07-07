export type MemoryTier = 'episodic' | 'semantic';

export interface Episode {
  id?: string;
  type: 'user' | 'agent' | 'system' | 'observation';
  content: string;
  embedding?: number[];
  timestamp: number;
  tags: string[];
}

export interface SemanticEntry {
  id?: string;
  content: string;
  sourceEpisodeIds: string[];
  embedding?: number[];
  timestamp: number;
  tags: string[];
  retrievalCount: number;
}

export interface SkillCard {
  id?: string;
  name: string;
  description: string;
  code?: string;
  triggerConditions: string[];
  promptTemplate: string;
  toolSequence: string[];
  heuristics: string[];
  successScore: number;
  lastUpdated: number;
  editHistory: {
    timestamp: number;
    changeDescription: string;
  }[];
  parentId?: string; // Links to a parent skill if this is a sub-skill
  upgradesFromId?: string; // Links to a previous version if this is an upgrade
  tier?: number; // 1 for base skill, higher for upgrades
}

export interface Identity {
  id?: string;
  version: number;
  goals: string[];
  values: string[];
  capabilities: string[];
  knownWeaknesses: string[];
  relationshipContext: string;
  lastUpdated: number;
  auditLog: {
    timestamp: number;
    changeDescription: string;
    previousVersion: number;
  }[];
}

export type AutonomyTier = 'suggest' | 'act-with-confirm' | 'act';
export type ActionStatus = 'pending' | 'approved' | 'rejected' | 'completed' | 'failed';

export interface AutonomyAction {
  id?: string;
  intent: string;
  proposedAction: string;
  tier: AutonomyTier;
  status: ActionStatus;
  timestamp: number;
  reasoning: string;
}

export type AgentRole = 'core' | 'specialized' | 'open-source-simulated';

export interface AgentProfile {
  id?: string;
  name: string;
  role: AgentRole;
  model: string;
  systemPrompt: string;
  status: 'active' | 'inactive';
  capabilities: string[];
  createdAt: number;
}

export interface PromptEntry {
  id?: string;
  title: string;
  description: string;
  prompt: string;
  tags: string[];
  lastRefined?: number;
  createdAt: number;
}
