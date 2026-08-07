import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as fs from "node:fs";
import * as path from "node:path";
import { discoverWorkflows } from "../src/workflow/discovery.js";

describe("discovery", () => {
  describe("discoverWorkflows", () => {
    it("should return an empty map when workflows directory does not exist", async () => {
      const emptyDir = fs.mkdtempSync(path.join("/tmp", "foundry-test-"));
      const nonExistentCompiled = path.join(emptyDir, "dist", "index.js");

      const result = await Effect.runPromise(discoverWorkflows(nonExistentCompiled));

      expect(result.size).toBe(0);
      fs.rmSync(emptyDir, { recursive: true, force: true });
    });

    it("should discover valid workflow files", async () => {
      const testDir = fs.mkdtempSync(path.join("/tmp", "foundry-test-"));
      const workflowsDir = path.join(testDir, "workflows");
      fs.mkdirSync(workflowsDir);

      // Create valid workflow files
      fs.writeFileSync(
        path.join(workflowsDir, "workflow1.ts"),
        `export default { effect: 42, schedule: 60 };`,
      );
      fs.writeFileSync(
        path.join(workflowsDir, "workflow2.ts"),
        `export default { effect: "hello", schedule: "0 * * * * *" };`,
      );

      const nonExistentCompiled = path.join(testDir, "dist", "index.js");

      const result = await Effect.runPromise(discoverWorkflows(nonExistentCompiled));

      expect(result.size).toBe(2);
      expect(result.has("workflow1")).toBe(true);
      expect(result.has("workflow2")).toBe(true);

      fs.rmSync(testDir, { recursive: true, force: true });
    });

    it("should skip files with missing effect field", async () => {
      const testDir = fs.mkdtempSync(path.join("/tmp", "foundry-test-"));
      const workflowsDir = path.join(testDir, "workflows");
      fs.mkdirSync(workflowsDir);

      fs.writeFileSync(path.join(workflowsDir, "invalid.ts"), `export default { schedule: 60 };`);
      fs.writeFileSync(
        path.join(workflowsDir, "valid.ts"),
        `export default { effect: 42, schedule: 60 };`,
      );

      const result = await Effect.runPromise(
        discoverWorkflows(path.join(testDir, "dist", "index.js")),
      );

      expect(result.size).toBe(1);
      expect(result.has("valid")).toBe(true);
      expect(result.has("invalid")).toBe(false);

      fs.rmSync(testDir, { recursive: true, force: true });
    });

    it("should skip files with missing schedule field", async () => {
      const testDir = fs.mkdtempSync(path.join("/tmp", "foundry-test-"));
      const workflowsDir = path.join(testDir, "workflows");
      fs.mkdirSync(workflowsDir);

      fs.writeFileSync(path.join(workflowsDir, "invalid.ts"), `export default { effect: 42 };`);
      fs.writeFileSync(
        path.join(workflowsDir, "valid.ts"),
        `export default { effect: 42, schedule: 60 };`,
      );

      const result = await Effect.runPromise(
        discoverWorkflows(path.join(testDir, "dist", "index.js")),
      );

      expect(result.size).toBe(1);
      expect(result.has("valid")).toBe(true);

      fs.rmSync(testDir, { recursive: true, force: true });
    });

    it("should skip non-ts files", async () => {
      const testDir = fs.mkdtempSync(path.join("/tmp", "foundry-test-"));
      const workflowsDir = path.join(testDir, "workflows");
      fs.mkdirSync(workflowsDir);

      fs.writeFileSync(
        path.join(workflowsDir, "workflow.js"),
        `export default { effect: 42, schedule: 60 };`,
      );
      fs.writeFileSync(
        path.join(workflowsDir, "workflow.ts"),
        `export default { effect: 42, schedule: 60 };`,
      );

      const result = await Effect.runPromise(
        discoverWorkflows(path.join(testDir, "dist", "index.js")),
      );

      expect(result.size).toBe(1);

      fs.rmSync(testDir, { recursive: true, force: true });
    });

    it("should reject invalid schedule values", async () => {
      const testDir = fs.mkdtempSync(path.join("/tmp", "foundry-test-"));
      const workflowsDir = path.join(testDir, "workflows");
      fs.mkdirSync(workflowsDir);

      fs.writeFileSync(
        path.join(workflowsDir, "invalid.ts"),
        `export default { effect: 42, schedule: {} };`,
      );
      fs.writeFileSync(
        path.join(workflowsDir, "valid.ts"),
        `export default { effect: 42, schedule: 60 };`,
      );

      const result = await Effect.runPromise(
        discoverWorkflows(path.join(testDir, "dist", "index.js")),
      );

      expect(result.size).toBe(1);
      expect(result.has("valid")).toBe(true);
      expect(result.has("invalid")).toBe(false);

      fs.rmSync(testDir, { recursive: true, force: true });
    });
  });
});
