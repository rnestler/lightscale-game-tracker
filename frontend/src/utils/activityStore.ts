export type ActivityStatus =
  { kind: 'running' } | { kind: 'retrying'; attempt: number; maximumAttempts: number };

export interface ActivityOperation {
  id: string;
  label: string;
  elapsedMilliseconds: number;
  status: ActivityStatus;
}

export interface ActivityState {
  pending: number;
  operations: ActivityOperation[];
  updatedAt: number;
}

type ActivityListener = (state: ActivityState) => void;

let pending = 0;
let probes = 0;
const operations: ActivityOperation[] = [];
const updatedAt = Date.now();
const listeners = new Set<ActivityListener>();

function snapshot(): ActivityState {
  return { pending, operations, updatedAt };
}

function notify(): void {
  const state = snapshot();
  for (const listener of listeners) {
    listener(state);
  }
}

export function beginActivity(): void {
  pending += 1;
  notify();
}

export function endActivity(): void {
  pending = pending > 0 ? pending - 1 : 0;
  notify();
}

export function beginProbe(): void {
  probes += 1;
}

export function endProbe(): void {
  probes = probes > 0 ? probes - 1 : 0;
}

export function subscribeActivity(listener: ActivityListener): () => void {
  listeners.add(listener);
  listener(snapshot());
  return (): void => {
    listeners.delete(listener);
  };
}
