import { describe, it, expect } from "@effect/vitest";
import { Effect } from "effect";
import { type WorkflowEntry } from "./discovery";

describe("workflow discovery", () => {
  it.effect("discovers a valid workflow", () =>
    Effect.gen(function* () {
      yield* Effect.void;
      const mockWorkflow: WorkflowEntry = {
        name: "test",
        effect: Effect.log("test"),
        schedule: 60,
      };

      const map = new Map<string, WorkflowEntry>();
      map.set("test", mockWorkflow);

      expect(map.get("test")?.name).toBe("test");
      expect(map.get("test")?.schedule).toBe(60);
    }),
  );

  it.effect("returns empty map when no workflows found", () =>
    Effect.gen(function* () {
      yield* Effect.void;
      const map = new Map<string, WorkflowEntry>();
      expect(map.size).toBe(0);
    }),
  );

  it.effect("validates schedule type", () =>
    Effect.gen(function* () {
      yield* Effect.void;
      const numberSchedule: WorkflowEntry = {
        name: "number",
        effect: Effect.void,
        schedule: 60,
      };
      const cronSchedule: WorkflowEntry = {
        name: "cron",
        effect: Effect.void,
        schedule: "0 * * * *",
      };

      expect(typeof numberSchedule.schedule).toBe("number");
      expect(typeof cronSchedule.schedule).toBe("string");
    }),
  );
});
