#!/usr/bin/env node
import { program } from "commander";
import { Cause, Effect, Exit, Fiber, Runtime } from "effect";
import * as fs from "node:fs";
import * as path from "node:path";

import { compileFoundry } from "./workflow/compiler.js";
import { discoverWorkflows } from "./workflow/discovery.js";
import { runWorkflow, type WorkflowDef } from "./workflow/scheduler.js";
// Global state for managing workflow fibers across single and parallel run modes

const foundry = program
  .name("foundry")
  .description("Automate your project with factory control loops");

/**
 * Shared state for managing workflow fibers across single and parallel run modes.
 */
interface _FoundryState {
  forks: Fiber.RuntimeFiber<void, unknown>[];
}
/**
 * Run an Effect in the foreground, returning its result.
 * Throws on failure.
 */
async function runEffect<A>(effect: Effect.Effect<A, unknown>): Promise<A> {
  const exit = await Runtime.runPromiseExit(Runtime.defaultRuntime, effect);
  if (Exit.isFailure(exit)) {
    const cause = exit.cause;
    if (Cause.isInterrupted(cause)) {
      process.exit(0);
    }
    console.error("Error:", Cause.pretty(cause));
    process.exit(1);
  }
  return (exit as Exit.Success<A, unknown>).value;
}

/**
 * Scaffold the .foundry directory.
 */
const initCommand = program.command("init").description("Initialize foundry in your project");

initCommand.action(() => {
  const projectRoot = process.cwd();
  const foundryDir = path.join(projectRoot, ".foundry");

  if (fs.existsSync(foundryDir)) {
    console.log("Foundry directory already exists.");
    return;
  }

  // Create directory structure
  fs.mkdirSync(foundryDir, { recursive: true });
  fs.mkdirSync(path.join(foundryDir, "workflows"), { recursive: true });

  // Create package.json
  const packageJson = {
    name: "@foundry/workflows",
    version: "0.1.0",
    private: true,
    type: "module",
    main: "index.js",
    scripts: {
      build: "tsc",
      typecheck: "tsc --noEmit",
    },
    dependencies: {
      "cron-parser": "^5.0.0",
      effect: "^3.22.0",
    },
    devDependencies: {
      "@effect/tsgo": "catalog:",
      "@types/node": "catalog:",
      typescript: "catalog:",
    },
  };
  fs.writeFileSync(
    path.join(foundryDir, "package.json"),
    JSON.stringify(packageJson, null, 2) + "\n",
  );

  // Create tsconfig.json
  const tsconfig = {
    compilerOptions: {
      target: "ES2022",
      module: "ESNext",
      moduleResolution: "bundler",
      strict: true,
      verbatimModuleSyntax: true,
      isolatedModules: true,
      moduleDetection: "force",
      noUncheckedIndexedAccess: true,
      exactOptionalPropertyTypes: true,
      skipLibCheck: true,
      rootDir: "./",
      outDir: "./dist",
      composite: true,
      declaration: true,
      declarationMap: true,
      sourceMap: true,
      types: ["node"],
    },
    include: ["./src/**/*.ts", "./workflows/**/*.ts", "./index.ts"],
    exclude: ["./node_modules", "./dist"],
  };
  fs.writeFileSync(
    path.join(foundryDir, "tsconfig.json"),
    JSON.stringify(tsconfig, null, 2) + "\n",
  );

  // Create index.ts with workflow registry
  const indexTs = `import { Effect } from "effect";

/**
 * Registry of workflow definitions.
 * Each entry maps a workflow name to its effect and schedule.
 */
export const workflows: Record<string, { effect: Effect.Effect<unknown, unknown>; schedule: number | string }> = {};

/**
 * Register a workflow definition.
 * The registry is built by importing individual workflow files
 * and adding them to this map.
 */
export function registerWorkflow(name: string, entry: { effect: Effect.Effect<unknown, unknown>; schedule: number | string }): void {
  workflows[name] = entry;
}

/**
 * Get all registered workflows.
 */
export function getWorkflows(): ReadonlyMap<string, { effect: Effect.Effect<unknown, unknown>; schedule: number | string }> {
  return new Map(Object.entries(workflows));
}
`;
  fs.writeFileSync(path.join(foundryDir, "index.ts"), indexTs);

  // Create sample workflow
  const sampleWorkflow = `import { Effect } from "effect";

/**
 * Sample workflow effect.
 * Replace this with your actual workflow logic.
 */
export default {
  effect: Effect.log("Hello from the implementation workflow!"),
  schedule: 60, // Run every 60 seconds
};
`;
  fs.writeFileSync(path.join(foundryDir, "workflows", "implementation.ts"), sampleWorkflow);

  console.log("Foundry initialized!");
  console.log("Edit .foundry/workflows/*.ts to define your workflows.");
  console.log('Run "foundry ls" to list workflows.');
  console.log('Run "foundry run <name>" to execute a workflow.');
});

/**
 * List discovered workflows.
 */
const lsCommand = program.command("ls").description("List discovered workflows");

lsCommand.action(async () => {
  const effect = Effect.gen(function* () {
    const compiledPath = yield* compileFoundry();
    const workflows = yield* discoverWorkflows(compiledPath);

    if (workflows.size === 0) {
      console.log("No workflows defined.");
      return;
    }

    console.log("Discovered workflows:");
    for (const [name, entry] of workflows) {
      const scheduleType = typeof entry.schedule === "number" ? "interval" : "cron";
      console.log(`  ${name}  schedule: ${entry.schedule}s (${scheduleType})`);
    }
    console.log("\nRun 'foundry run' without arguments to execute all workflows.");
  }).pipe(Effect.catchAll((err) => Effect.sync(() => console.error("Error:", String(err)))));

  await runEffect(effect);
});

/**
 * Run a specific workflow.
 */
const runCommand = program
  .command("run")
  .argument("[name]", "Workflow name to run (omit to run all)");

runCommand.action(async (workflowName: string | undefined) => {
  if (!workflowName) {
    // All-workflows path
    const fiber = Runtime.runFork(
      Runtime.defaultRuntime,
      Effect.gen(function* () {
        const compiledPath = yield* compileFoundry();
        const workflows = yield* discoverWorkflows(compiledPath);

        if (workflows.size === 0) {
          console.log("No workflows defined.");
          return;
        }

        const fibers: Fiber.RuntimeFiber<void, unknown>[] = yield* Effect.forEach(
          Array.from(workflows.entries()),
          (entry) =>
            Effect.sync(() =>
              Runtime.runFork(
                Runtime.defaultRuntime,
                runWorkflow(entry[0], { effect: entry[1].effect, schedule: entry[1].schedule }),
              ),
            ),
        );

        yield* Effect.forEach(fibers, (f) => Effect.asVoid(Fiber.join(f)), {
          concurrency: "unbounded",
        });
      }).pipe(Effect.scoped),
    );

    (globalThis as unknown as { _foundryState: _FoundryState })._foundryState = { forks: [fiber] };

    const exit = await Runtime.runPromiseExit(Runtime.defaultRuntime, Fiber.join(fiber));
    if (Exit.isFailure(exit)) {
      process.exit(1);
    }
  } else {
    // Single-workflow path
    const fiber = Runtime.runFork(
      Runtime.defaultRuntime,
      Effect.gen(function* () {
        const compiledPath = yield* compileFoundry();
        const workflows = yield* discoverWorkflows(compiledPath);

        const workflow = workflows.get(workflowName);
        if (!workflow) {
          console.log(`Workflow '${workflowName}' not found.`);
          console.log("Available workflows:");
          for (const entry of workflows.values()) {
            console.log(`  ${entry.name}`);
          }
          return;
        }

        const def: WorkflowDef = {
          effect: workflow.effect,
          schedule: workflow.schedule,
        };

        yield* runWorkflow(workflowName, def);
      }).pipe(Effect.scoped),
    );

    // Fork the scheduler so SIGINT can interrupt it gracefully
    (globalThis as unknown as { _foundryState: _FoundryState })._foundryState = { forks: [fiber] };

    // Await the fiber — will resolve on completion or be interrupted by SIGINT
    const exit = await Runtime.runPromiseExit(Runtime.defaultRuntime, Fiber.join(fiber));
    if (Exit.isFailure(exit)) {
      process.exit(1);
    }
  }
});

// SIGINT handler: interrupt all workflow fibers gracefully
process.on("SIGINT", () => {
  const state = (globalThis as unknown as { _foundryState: _FoundryState | undefined })
    ._foundryState;
  if (state) {
    state.forks.forEach((f) => Fiber.interrupt(f));
  }
  console.log("\nShutting down...");
  process.exit(0);
});

foundry.parse();
