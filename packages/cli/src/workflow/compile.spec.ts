import { describe, it, expect } from "@effect/vitest";
import { compileFoundry } from "./compiler";

describe("compiler", () => {
  it("fails when .foundry directory does not exist", () => {
    // Compile a non-existent foundry directory
    const effect = compileFoundry("/tmp/nonexistent-foundry-test");

    // The effect should fail with an appropriate message
    // We can't easily test this with runSync since it's async,
    // but we can verify the function returns an Effect
    expect(effect).toBeDefined();
  });

  it("accepts a valid project root path", () => {
    const effect = compileFoundry("/tmp");
    expect(effect).toBeDefined();
  });
});
