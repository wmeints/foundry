/**
 * RPC client for communicating with OMP's --mode rpc subprocess.
 *
 * Spawns the OMP binary, negotiates the v2 protocol, and provides
 * a send() method for making RPC commands. A background reader loop
 * consumes stdout, classifies frames, and resolves request Promises.
 */

import { spawn } from "node:child_process";
import type { SessionEvent } from "./types";
import {
  type Frame,
  type RpcChunkPayload,
  type RpcResponse,
  classifyFrame,
  isRpcChunkFrame,
  isRpcResponse,
  parseLines,
  reassembleChunk,
} from "./ndjson";

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
}

interface ReadyFrame {
  type: "ready";
  version?: number;
}

interface ExitInfo {
  exitCode: number;
  stderr: string;
}

interface RpcClientInternal extends RpcClient {
  kill(): void;
}

interface KnownEventTypes {
  type: string;
  sessionId?: string;
  model?: string;
  messageId?: string;
  content?: string;
  tool?: string;
  args?: Record<string, unknown>;
  output?: string;
}

const KNOWN_EVENT_TYPES: Record<string, true> = {
  agent_start: true,
  message_update: true,
  tool_execution_start: true,
  tool_execution_end: true,
  agent_end: true,
};

export interface RpcClient {
  send(cmd: unknown, timeoutMs?: number): Promise<unknown>;
  onEvent: ((event: SessionEvent) => void) | undefined;
  onExit(): Promise<ExitInfo>;
  kill(): void;
}

export function createRpcClient(options: {
  cwd?: string;
  onEvent?: (event: SessionEvent) => void;
  readyTimeoutMs?: number;
  promptTimeoutMs?: number;
}): RpcClientInternal {
  const readyTimeoutMs = options.readyTimeoutMs ?? 30_000;
  const promptTimeoutMs = options.promptTimeoutMs ?? 10 * 60 * 1000;

  const childArgs: string[] = ["--mode", "rpc"];
  if (options.cwd) {
    childArgs.push("--cwd", options.cwd);
  }

  const child = spawn("omp", childArgs, {
    stdio: ["pipe", "pipe", "pipe"],
    cwd: options.cwd,
    shell: false,
  });

  let stderrBuf = "";
  child.stderr?.on("data", (chunk: Buffer) => {
    stderrBuf += chunk.toString();
  });

  const pending = new Map<number, PendingRequest>();
  const chunkAccum = new Map<number, string>();

  // Background stdout reader loop
  const readLoop = async () => {
    for await (const rawLine of parseLines(child.stdout!)) {
      const frame = classifyFrame(rawLine);

      // Ready frame
      if (isReadyFrame(frame)) {
        if (!seenReady) {
          readyResolveRef(frame as ReadyFrame);
          seenReady = true;
        }
        continue;
      }

      // Chunk frames (v2 reassembly)
      if (isRpcChunkFrame(frame)) {
        const assembled = reassembleChunk(chunkAccum, frame as RpcChunkPayload);
        if (assembled !== undefined && isRpcResponse(assembled as Frame)) {
          const resp = assembled as RpcResponse;
          const p = pending.get(resp.id);
          if (p) {
            clearTimeout(p.timer);
            p.resolve(resp.result);
            pending.delete(resp.id);
          }
        }
        continue;
      }

      // RPC responses
      if (isRpcResponse(frame)) {
        const resp = frame as RpcResponse;
        const p = pending.get(resp.id);
        if (p) {
          clearTimeout(p.timer);
          if (resp.error) {
            p.reject(new Error(resp.error.message));
          } else {
            p.resolve(resp.result);
          }
          pending.delete(resp.id);
        }
        continue;
      }

      // Events
      const eventType = typeof frame.type === "string" ? frame.type : undefined;
      if (eventType && KNOWN_EVENT_TYPES[eventType]) {
        const evt = frame as KnownEventTypes;
        const event = { type: eventType as SessionEvent["type"] } as SessionEvent;
        if ("sessionId" in evt && evt.sessionId) {
          (event as { sessionId: string }).sessionId = evt.sessionId;
        }
        if ("model" in evt && evt.model) {
          (event as { model?: string }).model = evt.model;
        }
        if ("messageId" in evt && evt.messageId) {
          (event as { messageId: string }).messageId = evt.messageId;
        }
        if ("content" in evt && evt.content) {
          (event as { content: string }).content = evt.content;
        }
        if ("tool" in evt && evt.tool) {
          (event as { tool: string }).tool = evt.tool;
        }
        if ("args" in evt && evt.args) {
          (event as { args?: Record<string, unknown> }).args = evt.args;
        }
        if ("output" in evt && evt.output) {
          (event as { output?: string }).output = evt.output;
        }
        options.onEvent?.(event);
      }
    }

    for (const [, req] of pending) {
      clearTimeout(req.timer);
      req.reject(new Error("OMP process exited"));
    }
    pending.clear();
  };

  void readLoop();

  // Ready frame
  const { promise: readyPromise, resolve: readyResolveRef } = Promise.withResolvers<ReadyFrame>();
  let seenReady = false;

  // Timeout for ready frame
  const { reject: rejectReady } = Promise.withResolvers<never>();
  const readyTimer = setTimeout(() => {
    rejectReady(new Error("OMP did not emit ready frame within timeout"));
  }, readyTimeoutMs);

  readyPromise
    .then(() => {
      clearTimeout(readyTimer);
    })
    .catch(() => {
      // Timeout fired
    });

  // Send function
  let nextId = 2;

  async function send(cmd: unknown, timeoutMs: number = promptTimeoutMs): Promise<unknown> {
    if (!seenReady) {
      throw new Error("OMP has not emitted ready frame");
    }

    const id = nextId++;
    const cmdWithId = { ...(cmd as Record<string, unknown>), id };

    const { promise, resolve, reject } = Promise.withResolvers<unknown>();
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`RPC command ${id} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    pending.set(id, { resolve, reject, timer });

    writeCmd(cmdWithId);

    return promise;
  }

  function writeCmd(cmd: Record<string, unknown>): void {
    if (child.stdin) {
      child.stdin.write(JSON.stringify(cmd) + "\n");
    }
  }

  function isReadyFrame(frame: Frame): boolean {
    return (frame as { type?: string }).type === "ready";
  }

  // onExit
  const { promise: exitPromise, resolve: exitResolve } = Promise.withResolvers<ExitInfo>();
  child.once("exit", (exitCode: number | null) => {
    exitResolve({ exitCode: exitCode ?? -1, stderr: stderrBuf });
  });

  function onExit(): Promise<ExitInfo> {
    return exitPromise;
  }

  function kill(): void {
    child.stdin?.end();
    child.kill("SIGTERM");
  }

  // Wait for ready and negotiate
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  (async () => {
    await readyPromise;
    seenReady = true;

    const negotiateId = 1;
    writeCmd({
      type: "negotiate_protocol",
      id: negotiateId,
      version: 2,
    } as Record<string, unknown>);
  })();

  return {
    send,
    get onEvent() {
      return options.onEvent;
    },
    set onEvent(val) {
      options.onEvent = val;
    },
    onExit,
    kill,
  };
}
