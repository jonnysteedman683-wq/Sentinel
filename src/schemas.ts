import { z } from "zod";

// --- Chat API ---

export const ChatRequestSchema = z.object({
  history: z.array(z.object({
    role: z.enum(["user", "model", "system", "ai", "assistant"]),
    content: z.string()
  })),
  message: z.string(),
  contextData: z.string().optional(),
  sessionTraceId: z.string().optional(),
  persona: z.string().optional(),
  sway: z.number().optional(),
  depth: z.enum(['Fast', 'Balanced', 'Deep Reasoning']).optional(),
  model: z.string().optional()
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;

// --- Debug API ---

export const TraceSchema = z.object({
  traceId: z.string(),
  logs: z.array(z.any()),
  metrics: z.record(z.string(), z.number()),
  timestamp: z.number()
});

// --- Knowledge Base ---

export const KnowledgeNodeSchema = z.object({
  id: z.string(),
  content: z.string(),
  embedding: z.array(z.number()),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.any()).optional()
});

// --- Federated Learning ---

export const DreamProposalSchema = z.object({
  fragment: z.string(),
  userId: z.string().optional()
});

// --- Memory ---

export const MemoryNodeSchema = z.object({
  id: z.string(),
  content: z.string(),
  summary: z.string().optional(),
  embedding: z.array(z.number()),
  tags: z.array(z.string()),
  strength: z.number(),
  state: z.enum(['shortTerm', 'longTerm', 'core', 'archived']),
  createdAt: z.any(), // Firebase Timestamp or Date
  lastAccessed: z.any(),
  accessCount: z.number(),
  decayRate: z.number(),
  linkedMemories: z.array(z.string()).optional(),
  userId: z.string().optional()
});
