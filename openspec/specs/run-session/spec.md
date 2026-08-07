# run-session Specification

## Purpose

Provide a reusable Effect that spawns an OMP agent session via RPC mode, sends a prompt, collects the full conversation and session statistics, and returns a structured result with discriminated error types.

## Requirements

### Requirement: Spawn OMP in RPC mode

The system MUST spawn the `omp` binary with `--mode rpc` as a subprocess, passing the target working directory as `--cwd`. The subprocess MUST use stdio (stdin/stdout) for communication.

#### Scenario: OMP process spawns in correct working directory
- **WHEN** `runSession` is called with `cwd: "/path/to/project"`
- **THEN** the OMP process starts with its working directory set to `/path/to/project`

#### Scenario: OMP not found produces ProcessError
- **WHEN** `runSession` is called but `omp` is not available in PATH
- **THEN** the Effect fails with a `ProcessError` containing the OS error code (e.g. `ENOENT`)

### Requirement: RPC protocol negotiation

The system MUST read the initial `{type:"ready"}` frame from OMP's stdout, then negotiate protocol version 2 via a `negotiate_protocol` command.

#### Scenario: Missing ready frame produces ProtocolError
- **WHEN** OMP exits before emitting a ready frame
- **THEN** the Effect fails with a `ProtocolError` with `step: "ready"`

#### Scenario: V2 negotiation failure produces ProtocolError
- **WHEN** OMP does not support protocol version 2
- **THEN** the Effect fails with a `ProtocolError` with `step: "negotiate"`

#### Scenario: Malformed JSONL produces ProtocolError
- **WHEN** OMP stdout contains invalid JSON
- **THEN** the Effect fails with a `ProtocolError` with `step: "parse"`

### Requirement: Send prompt and await completion

The system MUST send a `prompt` command via the RPC protocol containing the user's message. It MUST wait for the agent to complete before collecting results.

#### Scenario: Prompt succeeds and agent runs
- **WHEN** `runSession("Implement X")` is called
- **THEN** the system sends `{type:"prompt", message:"Implement X"}` and waits for `agent_end`

#### Scenario: Prompt rejected produces PromptError
- **WHEN** OMP rejects the prompt command
- **THEN** the Effect fails with a `PromptError` containing the server error message

### Requirement: Collect conversation

After agent completion, the system MUST call `get_messages_page` (draining all pages) to retrieve the full conversation history.

#### Scenario: Messages collected successfully
- **WHEN** the agent completes successfully
- **THEN** `runSession` returns a `SuccessResult` with `conversation.messages` containing all agent messages in chronological order

#### Scenario: Message collection fails produces MessagesError
- **WHEN** `get_messages_page` fails (e.g. session_busy, stale_cursor)
- **THEN** the Effect fails with a `MessagesError` containing the error code

### Requirement: Collect session stats

After the agent completes, the system MUST call `get_session_stats` to retrieve model and context usage information.

#### Scenario: Stats collected successfully
- **WHEN** the agent completes successfully
- **THEN** `runSession` returns a `SuccessResult` with `stats` containing model ID, context usage, and message count

#### Scenario: Stats query fails produces StatsError
- **WHEN** `get_session_stats` fails
- **THEN** the Effect fails with a `StatsError` containing the error code

### Requirement: Handle agent errors

If OMP exits with a non-zero exit code, the system MUST NOT treat this as a successful result.

#### Scenario: Agent exits with code 1
- **WHEN** OMP exits with code 1 (agent crashed, API error, abort)
- **THEN** the Effect fails with an `AgentError` containing the exit code, stderr output, and any partial conversation captured

### Requirement: Timeout handling

The system MUST enforce timeouts for all major phases.

#### Scenario: Ready timeout
- **WHEN** OMP does not emit a ready frame within 30 seconds
- **THEN** the Effect fails with a `TimeoutError` with `phase: "ready"`

#### Scenario: Prompt timeout
- **WHEN** the agent does not complete within 10 minutes
- **THEN** the Effect fails with a `TimeoutError` with `phase: "prompt"`

### Requirement: Live event streaming

When `onEvent` is provided in options, the system MUST forward relevant agent lifecycle events to the callback.

#### Scenario: Agent events streamed via callback
- **WHEN** `runSession` is called with `onEvent: callback`
- **THEN** events such as `agent_start`, `message_update`, `tool_execution_start`, `tool_execution_end`, and `agent_end` are delivered to the callback during execution

### Requirement: Structured error types

All failures MUST use discriminated union types with `_tag` fields so that workflow code can handle each error variant via `Effect.catchTag`.

#### Scenario: ProcessError for spawn failure
- **WHEN** OMP process fails to spawn
- **THEN** the error has `_tag: "ProcessError"` with `message` and optional `code`

#### Scenario: AgentError for agent failure
- **WHEN** OMP exits with non-zero status
- **THEN** the error has `_tag: "AgentError"` with `message`, `exitCode`, `stderr`, and optional `partialConversation`
