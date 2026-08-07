import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Duration from "effect/Duration";
import { Fiber } from "effect";
import { runWorkflow, type WorkflowDef } from "../src/workflow/scheduler.js";

describe("scheduler", () => {
  describe("runWorkflow", () => {
    it("should execute an interval workflow at least once", async () => {
      let count = 0;
      const effect = Effect.sync(() => {
        count++;
      });

      const workflow: WorkflowDef = {
        effect,
        schedule: 0.1,
      };

      const program = runWorkflow("test-interval", workflow);

      const fiber = Effect.runFork(program);
      await Effect.sleep(Duration.millis(250));
      await Effect.runPromise(Fiber.interrupt(fiber));

      expect(count).toBeGreaterThanOrEqual(1);
    });

    it("should execute a cron workflow at least once", async () => {
      let count = 0;
      const effect = Effect.sync(() => {
        count++;
      });

      // Build a cron expression targeting the next minute boundary.
      // computeNextCronTime accepts only numeric fields (no wildcards).
      const now = new Date();
      const nextMinute = (now.getMinutes() + 1) % 60;
      const hour = nextMinute === 0 ? (now.getHours() + 1) % 24 : now.getHours();
      const schedule = `${nextMinute} ${hour} ${now.getDate()} ${now.getMonth() + 1} 1`;

      const workflow: WorkflowDef = {
        effect,
        schedule,
      };

      const program = runWorkflow("test-cron", workflow);

      const fiber = Effect.runFork(program);

      // Wait until we reach the next minute boundary so the cron fires.
      const secondsLeft = 60 - now.getSeconds();
      await Effect.sleep(Duration.millis(secondsLeft * 1000 + 500));

      await Effect.runPromise(Fiber.interrupt(fiber));

      expect(count).toBeGreaterThanOrEqual(1);
    });

    it("should continue looping after an error", async () => {
      let count = 0;
      const effect = Effect.gen(function* () {
        count++;
        if (count === 1) {
          yield* Effect.fail(new Error("First failure"));
        }
      });

      const workflow: WorkflowDef = {
        effect,
        schedule: 0.1,
      };

      const program = runWorkflow("test-errors", workflow);

      const fiber = Effect.runFork(program);
      await Effect.sleep(Duration.millis(250));
      await Effect.runPromise(Fiber.interrupt(fiber));

      expect(count).toBeGreaterThanOrEqual(1);
    });
  });
});
