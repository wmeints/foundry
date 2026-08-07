## Why

Workflows in the foundry need a way to invoke AI agent sessions programmatically — to ask an agent to review code, plan features, or execute tasks as part of a factory control loop. Currently there is no reusable effect for launching an OMP session from within a workflow.

## What Changes

- Add a new `runSession` Effect to `@foundry/tasks` that spawns `omp --mode rpc` and drives a single-agent session via the RPC protocol over stdio.
- Return a structured `SuccessResult` containing the full conversation history and session stats.
- Define a discriminated union of tagged errors (`ProcessError`, `ProtocolError`, `PromptError`, `MessagesError`, `StatsError`, `AgentError`, `TimeoutError`) so workflow code can handle each failure mode differently via `Effect.catchTag`.
- Support an optional `cwd` to set the working directory for the agent and an optional `onEvent` callback for live progress streaming.

## Capabilities

### New Capabilities
- `run-session`: Spawn an OMP agent session via RPC mode, send a prompt, collect the full conversation and session stats, and return structured results with tagged errors.
