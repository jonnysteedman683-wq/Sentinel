export interface InteractionLog {
  userId: string;
  type: string;
  feature: string;
  contextVector: number[];
  timestamp: number;
  traceId?: string | null;
}
