## Context

The foundry CLI (`packages/cli`) currently has stub `init` and `run` commands. The project uses Effect as its concurrency library (from `vendor/effect`). The workspace has `packages/cli` and `packages/tasks` under `pnpm-workspace.yaml`. The `.foundry` directory does not exist yet.

## Goals / Non-Goals

**Goals:**
- Scaffold `.foundry` as a compilable TypeScript package with its own `package.json`, `tsconfig.json`, and `index.ts`
- Auto-discover `.foundry/workflows/*.ts` files, compile them, and extract `{ effect, schedule }` from default exports
- Implement `foundry ls` to list discovered workflows with name and schedule
- Implement `foundry run <name>` to schedule and execute a specific workflow on its schedule
- Implement `foundry init` to create the `.foundry` directory skeleton
- Handle graceful shutdown via `Ctrl+C` (SIGINT)

**Non-Goals:**
- Cron library parsing (use a lightweight third-party library like `cron-parser` or a simple numeric parser first)
- Concurrent workflow execution management (one workflow at a time per run)
- Configuration files for schedule tuning (schedules live in workflow files)
- Hot-reloading of workflow files on disk change

## Decisions

### 1. Separate `.foundry` as a compilable package

**Decision:** The `.foundry` directory is a TypeScript package compiled by `tsc` separately from the CLI. Workflow files import from `.foundry` via its compiled output.

**Rationale:** Keeps the CLI binary lean. Users can add dependencies to `.foundry/package.json` without affecting the CLI. Compilation is a build step the user runs once (or the CLI runs before discovery).

**Alternative:** Bundle workflow files at runtime with esbuild. Rejected — adds a compiler dependency to the CLI binary and complicates error messages.

### 2. Workflow registry pattern in `.foundry/index.ts`

**Decision:** `.foundry/index.ts` exports a registry object `foundry.workflows` mapping workflow names to their `{ effect, schedule }` definitions. Each workflow file in `.foundry/workflows/` imports into this registry.

**Rationale:** Users control what's exposed. A single workflow file can import and re-export multiple effects. The CLI reads a stable object shape.

**Alternative:** CLI scans files and imports each one individually. Rejected — error handling becomes harder, and users have less control over what gets registered.

### 3. Plain Effect + tags for workflow services

**Decision:** Use Effect's `Effect`, `Tag`, and `Context` APIs directly — do not use the `@effect/workflow` package (alpha).

**Rationale:** The workflow engine is still in alpha and the spec explicitly says to use plain effects.

### 4. Schedule types: number (seconds) or string (cron)

**Decision:** The `schedule` field accepts `number` (seconds interval) or `string` (cron expression).

**Rationale:** Simple type allows both common scheduling patterns. Runtime validation checks the type and format.

**Alternative:** Only support interval (number). Rejected — cron is a common requirement for batch/scheduled tasks.

### 5. CLI reads compiled `.foundry` output

**Decision:** Before listing or running, the CLI compiles `.foundry` with `tsc` (using `.foundry/tsconfig.json`) and loads the compiled `.foundry/index.js`.

**Rationale:** Ensures TypeScript errors are surfaced at compile time, not runtime. The compiled output is a plain JS module the CLI can `import()`.

**Implementation approach:** The CLI spawns a `tsc --noEmit` check before each `ls`/`run` to validate, then runs `tsc` if the output is stale (tracked via `.foundry/.tsbuildinfo` timestamp).

## Risks / Trade-offs

| Risk | Impact | Mitigation |
|------|--------|------------|
| TypeScript compilation adds latency to every `foundry` invocation | Medium | Cache compilation result; only recompile on file change. The CLI can run `tsc` in the background or on-demand. |
| Users may forget to add `.foundry` dependencies | Medium | `foundry init` scaffolds `package.json` with a note. Compilation error messages reference installing missing packages. |
| Cron expression parsing adds dependency | Low | Use a small, well-maintained library (`cron-parser`). No cron support is acceptable as an MVP. |
| Long-running effects block the next scheduled execution | Low (by design) | Document that workflows must be designed to complete within their interval. |
| SIGINT handling race conditions | Medium | Use Effect's `Runtime.runFork` + `Runtime.stop` for clean shutdown; await in-flight effects. |
