## 1. Make run command argument optional

- [x] 1.1 Change `program.command("run <name>")` to
      `program.command("run").argument('[name]', 'Workflow name to run (omit to run all)')` in
      `packages/cli/src/index.ts`
- [x] 1.2 Update the action handler parameter from `(workflowName: string)` to accept
      `workflowName: string | undefined`

## 2. Implement all-workflows effect

- [x] 2.1 Define a `_FoundryState` interface with a `forks: Fiber.RuntimeFiber<void, unknown>[]`
      field on `globalThis`
- [x] 2.2 In the action handler, branch on `workflowName === undefined`: if undefined, run all
      workflows; if defined, keep existing single-workflow path
- [x] 2.3 For the all-workflows path, use `Effect.forEach` with `concurrency: 'unbounded'` to fork
      each workflow into its own `RuntimeFiber` via `Runtime.runFork(runWorkflow(...))`
- [x] 2.4 Store all returned fibers in the shared `_FoundryState`
- [x] 2.5 Use
      `Effect.forEach(fibers, f => Effect.asVoid(Fiber.join(f)), { concurrency: 'unbounded' })` to
      wait for all fibers concurrently
- [x] 2.6 Add handling for the empty-workflows case: if `workflows.size === 0`, log "No workflows
      defined." and return

## 3. Update SIGINT handler for multi-fiber

- [x] 3.1 Update the SIGINT handler to iterate `_foundryState.forks` and call
      `Fiber.interrupt(fiber)` on each
- [x] 3.2 Keep the existing `console.log("\nShutting down...")` and `process.exit(0)` behavior

## 4. Update existing single-fiber path

- [x] 4.1 Update the single-workflow path to use the shared `_FoundryState` instead of
      `_foundryFork`
- [x] 4.2 Ensure the single-workflow path pushes one fiber into `_foundryState.forks`

## 5. Update `ls` command to list "run all" option

- [x] 5.1 In the `foundry ls` output, add a line suggesting `foundry run` (without args) will
      execute all workflows
