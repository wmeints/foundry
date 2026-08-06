import { Effect } from "effect";
import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Compile the .foundry TypeScript package.
 * Returns the path to the compiled index.js or an error.
 */
export function compileFoundry(
  projectRoot: string = process.cwd(),
): Effect.Effect<string, string> {
  return Effect.gen(function* () {
    const foundryDir = path.join(projectRoot, ".foundry");

    if (!fs.existsSync(foundryDir)) {
      return yield* Effect.fail(
        "No .foundry directory found. Run `foundry init` to scaffold.",
      );
    }

    const tsconfigPath = path.join(foundryDir, "tsconfig.json");
    if (!fs.existsSync(tsconfigPath)) {
      return yield* Effect.fail("No tsconfig.json in .foundry directory.");
    }

    // Check if compilation is needed by comparing timestamps
    const tsbuildinfo = path.join(foundryDir, "dist/.tsbuildinfo");
    const shouldRecompile = checkNeedsRecompile(
      foundryDir,
      tsbuildinfo,
      tsconfigPath,
    );

    if (shouldRecompile) {
      const tscPath = findTsc(projectRoot);
      const result = spawnSync(tscPath, ["--project", tsconfigPath], {
        cwd: foundryDir,
        encoding: "utf-8",
      });

      if (result.status !== 0) {
        const message = result.stderr || result.stdout || "TypeScript compilation failed";
        return yield* Effect.fail(message);
      }
    }

    return path.join(foundryDir, "dist/index.js");
  });
}

/**
 * Find tsc binary in node_modules.
 */
function findTsc(projectRoot: string): string {
  const candidates = [
    path.join(projectRoot, ".foundry", "node_modules", "typescript", "bin", "tsc"),
    path.join(projectRoot, "node_modules", ".bin", "tsc"),
    path.join(__dirname, "..", "..", "..", "node_modules", ".bin", "tsc"),
  ];

  // Also try the system PATH
  candidates.push("tsc");

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return "tsc";
}

/**
 * Check if the .foundry package needs recompilation.
 * Returns true if any .ts source is newer than the tsbuildinfo.
 */
function checkNeedsRecompile(
  foundryDir: string,
  tsbuildinfo: string,
  tsconfigPath: string,
): boolean {
  if (!fs.existsSync(tsbuildinfo)) {
    return true;
  }

  const buildTime = fs.statSync(tsbuildinfo).mtimeMs;

  if (fs.statSync(tsconfigPath).mtimeMs > buildTime) {
    return true;
  }

  return walkFiles(foundryDir, (filePath) => {
    if (!filePath.endsWith(".ts")) {
      return false;
    }
    return fs.statSync(filePath).mtimeMs > buildTime;
  });
}

/**
 * Walk files in directory, returning true if predicate matches any.
 */
function walkFiles(dir: string, predicate: (filePath: string) => boolean): boolean {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules" && walkFiles(fullPath, predicate)) {
        return true;
      }
    } else if (predicate(fullPath)) {
      return true;
    }
  }
  return false;
}
