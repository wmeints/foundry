import type { Conversation } from "./types";
/**
 * Discriminated union of tagged error types for the run-session module.
 *
 * Each variant carries the specific context needed for workflow code
 * to handle failures via Effect.catchTag.
 */

/**
 * A process-level error (spawn failure, OS error).
 */
export interface ProcessError {
  _tag: "ProcessError";
  message: string;
  code?: string;
}

/**
 * An RPC protocol error (missing ready frame, bad negotiation, malformed JSON).
 */
export interface ProtocolError {
  _tag: "ProtocolError";
  message: string;
  step: "ready" | "negotiate" | "parse";
}

/**
 * A prompt rejection error (OMP rejected the user's message).
 */
export interface PromptError {
  _tag: "PromptError";
  message: string;
}

/**
 * A message collection error (session_busy, stale_cursor, API failure).
 */
export interface MessagesError {
  _tag: "MessagesError";
  message: string;
  code: "session_busy" | "stale_cursor" | string;
}

/**
 * A session stats query error.
 */
export interface StatsError {
  _tag: "StatsError";
  message: string;
  code: string;
}

/**
 * An agent-level error (OMP exited with non-zero status).
 */
export interface AgentError {
  _tag: "AgentError";
  message: string;
  exitCode: number;
  stderr: string;
  partialConversation?: Conversation;
}

/**
 * A timeout error (ready phase or prompt phase exceeded).
 */
export interface TimeoutError {
  _tag: "TimeoutError";
  message: string;
  phase: "ready" | "prompt";
}

/**
 * The complete discriminated union of all session error types.
 */
export type SessionError =
  | ProcessError
  | ProtocolError
  | PromptError
  | MessagesError
  | StatsError
  | AgentError
  | TimeoutError;
