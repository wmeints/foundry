import { Effect } from "effect";
import * as fs from "node:fs";
import * as path from "node:path";

export interface WorkflowDef {
  readonly effect: unknown;
  readonly schedule: number | string;
}

export interface WorkflowEntry {
  readonly name: string;
  readonly effect: unknown;
  readonly schedule: number | string;
}

/**
 * Discover and validate workflow definitions from the compiled .foundry module.
 * Loads the compiled index.js via dynamic import and extracts workflow metadata.
 */
export function discoverWorkflows(
  compiledPath: string,
): Effect.Effect<Map<string, WorkflowEntry>, string> {
  return Effect.gen(function* () {
    // Read .foundry directory to discover workflow files directly
    const foundryDir = path.dirname(path.dirname(compiledPath));
    const workflowsDir = path.join(foundryDir, "workflows");

    if (!fs.existsSync(workflowsDir) || !fs.statSync(workflowsDir).isDirectory()) {
      return new Map();
    }

    const workflowFiles = fs
      .readdirSync(workflowsDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
      .map((entry) => entry.name.replace(/\.ts$/, ""));

    const results = new Map<string, WorkflowEntry>();

    for (const fileName of workflowFiles) {
      try {
        const filePath = path.join(foundryDir, "workflows", `${fileName}.ts`);
        const mod: { default?: unknown } = yield* Effect.promise(() => import(filePath));
        const defaultExport = mod.default;

        if (!defaultExport || typeof defaultExport !== "object") {
          console.warn(`[foundry] Skipping ${fileName}: default export is not an object`);
          continue;
        }

        const hasEffect = "effect" in defaultExport;
        const hasSchedule = "schedule" in defaultExport;

        if (!hasEffect) {
          console.warn(
            `[foundry] Skipping ${fileName}: missing 'effect' field`,
          );
          continue;
        }

        if (!hasSchedule) {
          console.warn(
            `[foundry] Skipping ${fileName}: missing 'schedule' field`,
          );
          continue;
        }

        const schedule = defaultExport.schedule;
        if (typeof schedule !== "number" && typeof schedule !== "string") {
          console.warn(
            `[foundry] Skipping ${fileName}: 'schedule' must be a number or string`,
          );
          continue;
        }

        results.set(fileName, {
          name: fileName,
          effect: defaultExport.effect,
          schedule,
        });
      } catch (err) {
        console.warn(`[foundry] Error loading ${fileName}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return results;
  });
}
