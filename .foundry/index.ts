import { Effect } from "effect";

/**
 * Registry of workflow definitions.
 * Each entry maps a workflow name to its effect and schedule.
 */
export const workflows: Record<string, { effect: Effect.Effect<unknown, unknown>; schedule: number | string }> = {};

/**
 * Register a workflow definition.
 * The registry is built by importing individual workflow files
 * and adding them to this map.
 */
export function registerWorkflow(name: string, entry: { effect: Effect.Effect<unknown, unknown>; schedule: number | string }): void {
  workflows[name] = entry;
}

/**
 * Get all registered workflows.
 */
export function getWorkflows(): ReadonlyMap<string, { effect: Effect.Effect<unknown, unknown>; schedule: number | string }> {
  return new Map(Object.entries(workflows));
}
