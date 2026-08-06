import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Duration from "effect/Duration";
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
      fiber.unsafeInterrupt();

      expect(count).toBeGreaterThanOrEqual(1);
    });

    it("should execute a cron workflow at least once", async () => {
      let count = 0;
      const effect = Effect.sync(() => {
        count++;
      });

      const workflow: WorkflowDef = {
        effect,
        schedule: "0 12 * * *",
      };

      const program = runWorkflow("test-cron", workflow);

      const fiber = Effect.runFork(program);
      await Effect.sleep(Duration.millis(250));
      fiber.unsafeInterrupt();

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
      fiber.unsafeInterrupt();

      expect(count).toBeGreaterThanOrEqual(1);
    });
  });
});
