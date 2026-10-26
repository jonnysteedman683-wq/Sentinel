import { Timestamp } from "firebase/firestore";
import { dbShim as db } from "./firestore-shim.js";
import { trace } from '@opentelemetry/api';
import { randomUUID } from 'crypto';

export interface SystemEvent {
  eventId: string;
  eventType: string;
  aggregateId: string;   // 'dream-cycle', 'rl-agent', 'debate', 'system-health'
  timestamp: Date;
  userId: string;
  payload: Record<string, any>;
  causationId?: string;
  correlationId?: string; // traceId
}

export async function publishEvent(
  userId: string,
  aggregateId: string,
  eventType: string,
  payload: Record<string, any>,
  causationId?: string,
  correlationId?: string
) {
  const event: SystemEvent = {
    eventId: randomUUID(),
    eventType,
    aggregateId,
    timestamp: new Date(),
    userId,
    payload,
    causationId,
    correlationId: correlationId || trace.getActiveSpan()?.spanContext().traceId,
  };
  await db.collection(`users/${userId}/systemHealth/eventLog`).add({
    ...event,
    timestamp: Timestamp.fromDate(event.timestamp),
  });
  return event;
}
