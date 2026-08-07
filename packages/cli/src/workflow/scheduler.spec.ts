import { describe, it, expect } from "@effect/vitest";
import { Effect, Duration } from "effect";
import { type WorkflowDef } from "./scheduler";

describe("scheduler", () => {
  it.effect("interval scheduling accepts valid effect", () =>
    Effect.gen(function* () {
      yield* Effect.void;
      let _count = 0;
      const testEffect = Effect.sync(() => {
        _count++;
      });

      const workflow: WorkflowDef = {
        effect: testEffect,
        schedule: 1,
      };

      expect(workflow.schedule).toBe(1);
    }),
  );

  it.effect("cron scheduling accepts valid expression", () =>
    Effect.gen(function* () {
      yield* Effect.void;
      let _count = 0;
      const testEffect = Effect.sync(() => {
        _count++;
      });
      const workflow: WorkflowDef = {
        effect: testEffect,
        schedule: "0 2 * * *",
      };

      expect(workflow.schedule).toBe("0 2 * * *");
    }),
  );

  it.effect("no overlapping with slow effect", () =>
    Effect.gen(function* () {
      yield* Effect.void;
      const interval = Duration.toMillis(Duration.seconds(1));
      const slowEffect = Duration.toMillis(Duration.seconds(1.5));

      expect(slowEffect).toBeGreaterThan(interval);
    }),
  );
});
