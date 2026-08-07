/**
 * NDJSON (Newline-Delimited JSON) parser for OMP's RPC protocol.
 *
 * Provides a streaming async iterator over stdin/stdout that:
 * 1. Splits raw byte streams into newline-delimited JSON lines
 * 2. Classifies frames into responses, events, and control frames
 * 3. Handles v2 chunked frame reassembly (base64 data concatenation)
 */

import type { ReadStream } from "node:fs";
import { Readable } from "node:stream";
import { createInterface } from "node:readline";

// ---------------------------------------------------------------------------
// Internal frame shapes (from OMP's NDJSON protocol)
// ---------------------------------------------------------------------------

export interface RawLine {
  type: string;
  [key: string]: unknown;
}

export interface RpcResponse {
  type: "response";
  id: number;
  result?: unknown;
  error?: { code: number; message: string };
}

export interface EventFrame {
  type:
    | "agent_start"
    | "message_update"
    | "tool_execution_start"
    | "tool_execution_end"
    | "agent_end"
    | string;
  [key: string]: unknown;
}

export interface ControlFrame {
  type: "ready" | "ack" | "rpc_chunk" | string;
  [key: string]: unknown;
}

export type Frame = RpcResponse | EventFrame | ControlFrame;

export interface RpcChunkPayload {
  type: "rpc_chunk";
  id: number;
  data: string;
  done: boolean;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// parseLines — async generator that yields parsed JSON lines
// ---------------------------------------------------------------------------

export async function* parseLines(stream: ReadStream | Readable): AsyncGenerator<RawLine> {
  const rl = createInterface({ input: stream, crlfDelay: Infinity });

  for await (const line of rl) {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      continue;
    }

    try {
      yield JSON.parse(trimmed) as RawLine;
    } catch {
      console.warn(`[ndjson] skipping non-JSON line: ${trimmed.slice(0, 120)}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Frame classification
// ---------------------------------------------------------------------------

export function classifyFrame(raw: RawLine): Frame {
  if (raw.type === "response") {
    return raw as unknown as RpcResponse;
  }

  const eventTypes = new Set([
    "agent_start",
    "message_update",
    "tool_execution_start",
    "tool_execution_end",
    "agent_end",
  ]);

  if (eventTypes.has(raw.type)) {
    return raw as unknown as EventFrame;
  }

  return raw as unknown as ControlFrame;
}

export function isRpcResponse(frame: Frame): frame is RpcResponse {
  return (frame as { type?: string }).type === "response";
}

export function isEventFrame(frame: Frame): frame is EventFrame {
  const t = (frame as { type?: string }).type;
  return typeof t === "string" && t !== "response";
}

export function isRpcChunkFrame(frame: Frame): frame is RpcChunkPayload {
  return (frame as { type?: string }).type === "rpc_chunk";
}

// ---------------------------------------------------------------------------
// v2 chunk reassembly
// ---------------------------------------------------------------------------

export function reassembleChunk(
  accumulator: Map<number, string>,
  frame: RpcChunkPayload,
): unknown | undefined {
  const existing = accumulator.get(frame.id) ?? "";
  accumulator.set(frame.id, existing + frame.data);

  if (!frame.done) {
    return undefined;
  }

  const fullData = accumulator.get(frame.id) ?? "";
  accumulator.delete(frame.id);

  try {
    const decoded = Buffer.from(fullData, "base64").toString("utf-8");
    return JSON.parse(decoded);
  } catch {
    console.warn(`[ndjson] failed to reassemble chunk ${frame.id}`);
    return undefined;
  }
}
