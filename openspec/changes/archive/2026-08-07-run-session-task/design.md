## Context

The `@foundry/tasks` package is a new, empty package in the foundry monorepo intended to hold reusable Effect primitives for factory workflows. Workflows are TypeScript files compiled by `.foundry/` and executed by the `foundry` CLI scheduler. The `@foundry/tasks` package has no dependencies today — only devDependencies.

OMP (oh-my-pi) is available at `/home/wmeints/.local/bin/omp` on the host. It supports an RPC mode (`--mode rpc`) that communicates via NDJSON over stdio, with a ready frame, v2 protocol negotiation, and commands for prompt, get_messages_page, and get_session_stats.

The existing `compiler.ts` in `@foundry/cli` already uses `child_process.spawnSync` to spawn `tsc` — this pattern is established in the codebase.

## Goals / Non-Goals

**Goals:**
- Implement `runSession` as a single Effect that fully manages the OMP RPC lifecycle.
- Return structured conversation and stats in the success path.
- Use tagged errors for all failure modes.
- Zero runtime dependencies — use Node's `child_process` and `readline`.

**Non-Goals:**
- SDK-based embedding of OMP (no `@oh-my-pi/pi-coding-agent` dependency).
- Multi-turn conversations — one prompt per call.
- Session persistence or resume across runs.
- Model selection or thinking-level configuration.
- Custom tools or MCP server integration.

## Decisions

### D1: Spawn-based over SDK

**Decision:** Use `child_process.spawn` to run `omp --mode rpc` as a subprocess.

**Rationale:**
- No new dependencies — OMP is already on the host.
- Process isolation: OMP crashes don't affect the workflow.
- Matches existing pattern in `compiler.ts` (which spawns `tsc`).
- SDK embedding would require `@oh-my-pi/pi-coding-agent` (hundreds of MB unpacked).

**Trade-off:** No streaming of text deltas in real-time (only lifecycle events). Full conversation must be fetched after completion via `get_messages_page`.

### D2: RPC mode over print mode

**Decision:** Use `omp --mode rpc` instead of `omp -p` or `--mode json`.

**Rationale:**
- Print mode (`--mode json`) requires reconstructing conversation from delta events.
- RPC mode provides a clean `get_messages_page` call for the full conversation after completion.
- RPC mode also provides `get_session_stats` with model ID, context usage, and token throughput.
- Both modes use the same spawn mechanism; the complexity difference is in post-processing.

**Trade-off:** The NDJSON parser needs to handle both responses (with `id`) and events (without `id`). Print mode is simpler but gives incomplete conversation data.

### D3: Tagged errors in Effect error channel

**Decision:** Use `Effect.Effect<SuccessResult, SessionError, never>` where `SessionError` is a discriminated union with `_tag` fields.

**Rationale:**
- `Effect.catchTag` gives workflow code exhaustive error handling.
- Each error variant carries the specific context needed to respond (e.g., `code` for `ProcessError`, `stderr` for `AgentError`).
- The success path is clean: only `SuccessResult`, no `success: boolean` flag to check.

**Trade-off:** Slightly more boilerplate than returning `SuccessResult | SessionError` directly, but the exhaustiveness and `catchTag` ergonomics are worth it.

### D4: Completion detection via event stream

**Decision:** Detect agent completion by watching for `agent_end` events in the stdout stream, rather than polling `get_session_stats`.

**Rationale:**
- Events are already being parsed from stdout for the `onEvent` callback.
- No extra round-trip command needed.
- `agent_end` is the definitive completion signal.

**Trade-off:** If events are lost or delayed, we might hang. A timeout on the overall operation guards against this.

### D5: Process teardown on stdin close

**Decision:** After collecting results, close stdin to trigger OMP's graceful shutdown. Wait for process exit to read the exit code.

**Rationale:**
- OMP's protocol spec: "When stdin closes, pending extension UI, host-tool, and host-URI requests are rejected; accepted commands are drained, the session is disposed, and the process exits with code 0."
- Exit code 0 = success, 1 = error.
- No need for explicit `abort` or `SIGKILL` in the happy path.

**Trade-off:** If OMP hangs after stdin close, the timeout handles it.

## Risks / Trade-offs

| Risk | Severity | Mitigation |
|------|----------|------------|
| OMP binary not installed on host | Medium | `ProcessError` with OS error code; workflow can check and fail gracefully |
| NDJSON parser races with command responses | Low | Single reader loop; responses and events are differentiated by type field |
| Agent runs very long (hanging) | High | 10-minute timeout on prompt phase |
| Large conversation (>1MB single message) | Low | v2 protocol reassembly handles oversized frames; v1 caps at 1MB |
| OMP process leak on error path | Medium | Always close stdin and wait for exit in finally block; capture pgid for group kill if needed |
