## 1. Scaffold .foundry directory

- [x] 1. Create `.foundry/package.json` with `"type": "module"` and dependencies on
      `@effect/platform` and `@effect/typeclass`
- [x] 1. Create `.foundry/tsconfig.json` with `module: "ESNext"`, `moduleResolution: "bundler"`, and
      `composite: true`
- [x] 1. Create `.foundry/workflows/` directory
- [x] 1. Create `.foundry/index.ts` that imports and re-exports workflow definitions

## 2. Implement `foundry init` command

- [x] 2. Wire up the `foundry init` command handler in `packages/cli/src/index.ts`
- [x] 2. Detect existing `.foundry` directory; exit with message if present
- [x] 2. Generate `.foundry/package.json` with `@effect/platform`, `@effect/typeclass`, and
      `cron-parser` as dependencies
- [x] 2. Generate `.foundry/tsconfig.json` with compilation settings
- [x] 2. Generate `.foundry/index.ts` with the workflow registry pattern
- [x] 2. Generate `.foundry/workflows/implementation.ts` with a sample workflow effect and 60s
      interval
- [x] 2. Print a success message with next-steps instructions

## 3. Implement compilation engine

- [x] 3. Create `packages/cli/src/workflow/compiler.ts` with a `compileFoundry()` function
- [x] 3. `compileFoundry()` runs `tsc` via `execa` (or Node `child_process.spawn`) using
      `.foundry/tsconfig.json`
- [x] 3. On success, resolve and return the compiled `.foundry/index.js` module path
- [x] 3. On failure, parse stderr for TypeScript errors and return a structured error
- [x] 3. Cache compiled output: only recompile if `.foundry/**/*.ts` is newer than
      `.foundry/.tsbuildinfo`

## 4. Implement workflow discovery

- [x] 4. Create `packages/cli/src/workflow/discovery.ts` with a `discoverWorkflows()` function
- [x] 4. `discoverWorkflows()` uses `import()` to load the compiled `.foundry/index.js` module
- [x] 4. Extract the `workflows` record from the imported module's default export
- [x] 4. Validate each workflow: must have a numeric/string `schedule` and an Effect `effect`
- [x] 4. Log warnings for invalid workflow files and skip them
- [x] 4. Return a
      `Map<string, { effect: Effect<unknown, unknown, unknown>, schedule: number | string }>`

## 5. Implement `foundry ls` command

- [x] 5. Wire up the `foundry ls` command handler in `packages/cli/src/index.ts`
- [x] 5. Call `compileFoundry()` then `discoverWorkflows()`
- [x] 5. Format output as a table: workflow name, schedule type, schedule value
- [x] 5. Handle empty discovery with "No workflows defined" message
- [x] 5. Handle compilation errors with a clear message

## 6. Implement scheduling engine

- [x] 6. Create `packages/cli/src/workflow/scheduler.ts` with a `runWorkflow()` function
- [x] 6. Accept a workflow `{ effect, schedule }` and return an Effect for the scheduling loop
- [x] 6. For numeric schedules: use `Effect.delay` + `Effect.loop` or `Schedule.recurs` to
      re-execute at fixed intervals
- [x] 6. For string (cron) schedules: parse the expression, compute next fire time, use
      `Schedule.duration` delay
- [x] 6. Ensure no overlapping executions: skip the next tick if the current effect is still running
- [x] 6. Log each execution start and completion

## 7. Implement `foundry run` command

- [x] 7. Wire up the `foundry run <name>` command handler in `packages/cli/src/index.ts`
- [x] 7. Accept the workflow name as an argument (via `program.argument()` or Commander args)
- [x] 7. Look up the named workflow from the discovered registry
- [x] 7. If not found, list available workflows and exit with non-zero status
- [x] 7. Call `runWorkflow()` to start the scheduling loop
- [x] 7. Use Effect's `Runtime.runFork` to run the scheduler so SIGINT can be intercepted

## 8. Implement graceful shutdown

- [x] 8. Register a SIGINT handler that calls `Runtime.stop` on the forked runtime
- [x] 8. After stopping, await completion of any in-progress effect via `Runtime.awaitFork`
- [x] 8. Print a shutdown message and exit with code 0
- [x] 8. Ensure no orphaned timers remain after shutdown

## 9. Add unit tests

- [x] 9. Create `packages/cli/src/workflow/discovery.test.ts` — test validation of workflow shapes
      (valid, missing schedule, missing effect, non-ts files ignored)
- [x] 9. Create `packages/cli/src/workflow/scheduler.test.ts` — test interval scheduling, cron
      scheduling, no-overlap behavior
- [x] 9. Create `packages/cli/src/workflow/compile.test.ts` — test compilation error detection and
      caching logic
- [x] 9. Test the CLI commands end-to-end using Commander's testing utilities or subagent process
      invocation
