import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as fs from "node:fs";
import * as path from "node:path";
import { compileFoundry } from "../src/workflow/compiler.js";

describe("compiler", () => {
  describe("compileFoundry", () => {
    it("should fail when .foundry directory does not exist", async () => {
      const tempDir = fs.mkdtempSync(path.join("/tmp", "foundry-test-"));
      const originalCwd = process.cwd();

      try {
        process.chdir(tempDir);

        const result = await Effect.runPromiseExit(compileFoundry());

        expect(result._tag).toBe("Failure");
        if (result._tag === "Failure") {
          expect(result.cause).toBeDefined();
        }
      } finally {
        process.chdir(originalCwd);
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("should compile successfully when .foundry has valid tsconfig", async () => {
      const tempDir = fs.mkdtempSync(path.join("/tmp", "foundry-test-"));
      const originalCwd = process.cwd();

      try {
        const foundryDir = path.join(tempDir, ".foundry");
        const distDir = path.join(foundryDir, "dist");
        fs.mkdirSync(distDir, { recursive: true });

        // Create package.json
        fs.writeFileSync(
          path.join(foundryDir, "package.json"),
          JSON.stringify({
            name: "@foundry/test",
            version: "0.1.0",
            type: "module",
            dependencies: { effect: "^3.0.0" },
          }),
        );

        // Create tsconfig.json
        fs.writeFileSync(
          path.join(foundryDir, "tsconfig.json"),
          JSON.stringify({
            compilerOptions: {
              target: "ES2022",
              module: "ESNext",
              moduleResolution: "bundler",
              strict: true,
              composite: true,
              rootDir: "./",
              outDir: "./dist",
            },
            include: ["./index.ts"],
          }),
        );

        // Create a simple index.ts
        fs.writeFileSync(path.join(foundryDir, "index.ts"), `export const hello = "world";`);

        process.chdir(tempDir);

        const result = await Effect.runPromiseExit(compileFoundry());

        expect(result._tag).toBe("Success");
        if (result._tag === "Success") {
          expect(result.value).toContain(".foundry/dist/index.js");
        }
      } finally {
        process.chdir(originalCwd);
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("should cache compilation when sources have not changed", async () => {
      const tempDir = fs.mkdtempSync(path.join("/tmp", "foundry-test-"));
      const originalCwd = process.cwd();

      try {
        const foundryDir = path.join(tempDir, ".foundry");
        const distDir = path.join(foundryDir, "dist");
        fs.mkdirSync(distDir, { recursive: true });

        // Create package.json
        fs.writeFileSync(
          path.join(foundryDir, "package.json"),
          JSON.stringify({
            name: "@foundry/test",
            version: "0.1.0",
            type: "module",
            dependencies: { effect: "^3.0.0" },
          }),
        );

        // Create tsconfig.json
        fs.writeFileSync(
          path.join(foundryDir, "tsconfig.json"),
          JSON.stringify({
            compilerOptions: {
              target: "ES2022",
              module: "ESNext",
              moduleResolution: "bundler",
              strict: true,
              composite: true,
              rootDir: "./",
              outDir: "./dist",
            },
            include: ["./index.ts"],
          }),
        );

        // Create a simple index.ts
        fs.writeFileSync(path.join(foundryDir, "index.ts"), `export const hello = "world";`);

        process.chdir(tempDir);

        // First compilation
        const result1 = await Effect.runPromiseExit(compileFoundry());

        expect(result1._tag).toBe("Success");

        // Second compilation should use cache (no recompilation)
        const result2 = await Effect.runPromiseExit(compileFoundry());

        expect(result2._tag).toBe("Success");
        if (result2._tag === "Success") {
          expect(result2.value).toContain(".foundry/dist/index.js");
        }
      } finally {
        process.chdir(originalCwd);
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });
});
