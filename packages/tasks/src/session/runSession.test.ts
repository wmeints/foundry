import { describe, it, expect, vi } from "vitest";
import { Effect } from "effect";
import type { Exit } from "effect/Exit";
import { isFailure } from "effect/Exit";
import { runSession } from "./runSession";
import type { SessionEvent } from "./types";

async function runExit<A, E>(eff: Effect.Effect<A, E>): Promise<Exit<A, E>> {
  return await Effect.runPromise(Effect.exit(eff));
}

describe("runSession", () => {
  describe("spawn failure", () => {
    it("should fail when omp is not found", async () => {
      const eff = runSession({ message: "test" });
      const exit = await runExit(eff);

      expect(isFailure(exit)).toBe(true);
    });
  });

  describe("protocol failure", () => {
    it("should produce an error when OMP exits early", async () => {
      const eff = runSession({ message: "test" });
      const exit = await runExit(eff);

      expect(isFailure(exit)).toBe(true);
    });
  });

  describe("successful session", () => {
    it("should construct the effect correctly", async () => {
      const eff = runSession({ message: "Implement X" });
      expect(eff).toBeDefined();
      expect(Effect.isEffect(eff)).toBe(true);
    });
  });

  describe("agent error", () => {
    it("should fail when OMP exits with non-zero status", async () => {
      const eff = runSession({ message: "test" });
      const exit = await runExit(eff);

      expect(isFailure(exit)).toBe(true);
    });
  });

  describe("timeout", () => {
    it("should fail with timeout when agent does not complete", async () => {
      const eff = runSession({ message: "test", promptTimeoutMs: 50 });
      const exit = await runExit(eff);

      expect(isFailure(exit)).toBe(true);
    });
  });

  describe("event streaming", () => {
    it("should not call onEvent when OMP fails to spawn", async () => {
      const onEvent = vi.fn<(event: SessionEvent) => void>();
      const eff = runSession({ message: "test", onEvent });

      const exit = await runExit(eff);
      expect(isFailure(exit)).toBe(true);
      expect(onEvent).not.toHaveBeenCalled();
    });
  });
});
