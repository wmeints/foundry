## 1. Types module

- [x] 1.1 Create `packages/tasks/src/session/types.ts` with all type definitions: `RunSessionOptions`, `RunSessionResult`, `SuccessResult`, `Conversation`, `SessionStats`, `AgentMessage`, `AgentContent`, `SessionEvent`
- [x] 1.2 Create `packages/tasks/src/session/errors.ts` with the discriminated union `SessionError` and all tagged error interfaces: `ProcessError`, `ProtocolError`, `PromptError`, `MessagesError`, `StatsError`, `AgentError`, `TimeoutError`
- [x] 1.3 Create `packages/tasks/src/session/index.ts` that re-exports `runSession`, all types, and all errors

## 2. NDJSON parser utility

- [x] 2.1 Create `packages/tasks/src/session/ndjson.ts` with a `parseLines` generator/async iterator that reads from a Node `readline` interface and yields parsed JSON objects
- [x] 2.2 Handle frame classification: differentiate `RpcResponse` frames (have `type: "response"`) from event frames (have `type` but not `"response"`) from control frames (`ready`, `rpc_chunk`, etc.)
- [x] 2.3 Handle v2 chunk reassembly for `rpc_chunk` frames (concatenate base64 data, decode, parse)

## 3. RPC client core

- [x] 3.1 Create `packages/tasks/src/session/rpcClient.ts` with a `createRpcClient` function that spawns `omp --mode rpc`, reads the ready frame, and negotiates v2 protocol
- [x] 3.2 Implement `send(cmd, timeout?)` that writes a JSON command to stdin and returns a Promise that resolves on the matching response (correlated by `id`)
- [x] 3.3 Implement the background stdout reader that feeds the NDJSON parser, routes events to a listener callback, and resolves pending request Promises
- [x] 3.4 Handle spawn errors (`ENOENT`, `EACCES`) and early exit (before ready frame) as rejections

## 4. runSession effect

- [x] 4.1 Create `packages/tasks/src/session/runSession.ts` with the main `runSession` Effect
- [x] 4.2 In the effect: create RPC client, spawn OMP, negotiate v2
- [x] 4.3 Send `prompt` command with the user message, set up event listener for `onEvent` callback
- [x] 4.4 Wait for completion: consume events, detect `agent_end`, apply timeout (default 10 minutes)
- [x] 4.5 After completion: call `get_messages_page` and drain all pages (handle cursor pagination, detect `session_busy` / `stale_cursor`)
- [x] 4.6 Call `get_session_stats` for model, context usage, token throughput
- [x] 4.7 Close stdin, await process exit, read exit code
- [x] 4.8 On success (exit 0): return `SuccessResult` with conversation and stats
- [x] 4.9 On failure (exit 1): return `AgentError` with exit code, stderr, and any partial conversation captured
- [x] 4.10 Error handling: wrap all RPC failures in their corresponding tagged error types (`ProtocolError`, `PromptError`, `MessagesError`, `StatsError`, `TimeoutError`, `ProcessError`)
- [x] 4.11 Cleanup: always close stdin and kill process on error path; capture stderr in errors

## 5. Export and test wiring

- [x] 5.1 Ensure `packages/tasks/src/index.ts` re-exports everything from `session/`
- [x] 5.2 Create `packages/tasks/src/session/runSession.test.ts` with vitest tests:
  - Spawn failure (mock ENOENT)
  - Protocol failure (mock missing ready frame)
  - Successful session (mock OMP process with controlled stdout)
  - Agent error (mock exit code 1)
  - Timeout (mock hang after prompt)
  - Full conversation collection (verify `get_messages_page` pagination)
  - Event streaming (verify `onEvent` callback receives events)

## 6. Build verification

- [x] 6.1 Run `pnpm --filter @foundry/tasks build` and verify no TypeScript errors
- [x] 6.2 Run `pnpm --filter @foundry/tasks test` and verify all tests pass
- [x] 6.3 Run `pnpm --filter @foundry/tasks typecheck` and verify clean output
