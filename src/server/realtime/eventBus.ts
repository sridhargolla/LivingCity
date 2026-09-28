// LIVING CITY — In-process SSE event bus for real-time updates.
// Single Next.js process → in-memory pub/sub is correct and dependency-free.

export type RealtimeEventName =
  | "event.created"
  | "event.updated"
  | "analysis.started"
  | "memory.recalled"
  | "analysis.completed"
  | "memory.retained"
  | "event.relationship.created"
  | "feed.status_changed"
  | "outcome.recorded"
  | "anomaly.detected"
  | "anomaly.updated"
  | "feedback.recorded"
  | "scenario.completed"
  | "city.state.updated"
  | "heartbeat";

export interface RealtimePayload {
  event: RealtimeEventName;
  data: Record<string, unknown>;
  ts: string;
}

type Listener = (payload: RealtimePayload) => void;

const globalForBus = globalThis as unknown as {
  __livingCityBus?: Set<Listener>;
  __livingCityLast?: RealtimePayload[];
};

const listeners: Set<Listener> = (globalForBus.__livingCityBus ??= new Set());
const lastEvents: RealtimePayload[] = (globalForBus.__livingCityLast ??= []);

export function publish(event: RealtimeEventName, data: Record<string, unknown>): void {
  const payload: RealtimePayload = { event, data, ts: new Date().toISOString() };
  lastEvents.push(payload);
  if (lastEvents.length > 100) lastEvents.shift();
  for (const l of listeners) {
    try {
      l(payload);
    } catch {
      // a broken subscriber must never break the publisher
    }
  }
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function recentEvents(limit = 20): RealtimePayload[] {
  return lastEvents.slice(-limit);
}

export function subscriberCount(): number {
  return listeners.size;
}
