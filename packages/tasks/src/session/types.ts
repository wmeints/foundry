/**
 * Type definitions for the run-session module.
 *
 * Covers session options, results, conversation structure, stats,
 * agent message/content types, and event types.
 */

import type { AgentError } from "./errors";
/**
 * Configuration options for a run-session invocation.
 */
export interface RunSessionOptions {
  /**
   * The user message to send to the agent.
   */
  message: string;

  /**
   * Working directory for the OMP process. Defaults to the current process working directory.
   */
  cwd?: string;

  /**
   * Optional callback for live event streaming during agent execution.
   * Fired for agent lifecycle events (agent_start, message_update, tool_execution_start,
   * tool_execution_end, agent_end) as they arrive from the OMP process.
   */
  onEvent?: (event: SessionEvent) => void;

  /**
   * Timeout for the ready phase (waiting for OMP to emit its ready frame).
   * Defaults to 30 seconds.
   */
  readyTimeoutMs?: number;

  /**
   * Timeout for the prompt phase (waiting for agent completion).
   * Defaults to 10 minutes.
   */
  promptTimeoutMs?: number;
}

/**
 * Result of a run-session invocation.
 */
export type RunSessionResult = SuccessResult | AgentError;

/**
 * Successful session result containing the full conversation and session statistics.
 */
export interface SuccessResult {
  _tag: "SuccessResult";
  conversation: Conversation;
  stats: SessionStats;
}

/**
 * A conversation, consisting of ordered agent messages.
 */
export interface Conversation {
  messages: AgentMessage[];
}

/**
 * A single agent message in the conversation.
 */
export interface AgentMessage {
  /** Unique identifier for this message. */
  id: string;
  /** The role of the message sender. */
  role: string;
  /** Content blocks that make up this message. */
  content: AgentContent[];
  /** ISO timestamp when the message was created. */
  createdAt?: string;
  /** Session ID associated with this message. */
  sessionId?: string;
}

/**
 * A content block within an agent message.
 */
export interface AgentContent {
  /** Type of the content block. */
  type: string;
  /** The text content (for text-type blocks). */
  text?: string;
  /** A URL reference (for link-type blocks). */
  url?: string;
  /** A title (for title-type blocks). */
  title?: string;
}

/**
 * Session statistics returned by the OMP agent after completion.
 */
export interface SessionStats {
  /** The model ID used for this session. */
  modelId?: string;
  /** Total number of messages in the session. */
  messageCount?: number;
  /** Total input tokens consumed. */
  inputTokens?: number;
  /** Total output tokens consumed. */
  outputTokens?: number;
  /** Total tokens consumed (input + output). */
  totalTokens?: number;
  /** Context window usage percentage. */
  contextUsage?: number;
}

/**
 * Lifecycle event emitted by the OMP agent during execution.
 */
export type SessionEvent =
  | { type: "agent_start"; sessionId: string; model?: string }
  | { type: "message_update"; messageId: string; content: string }
  | { type: "tool_execution_start"; tool: string; args?: Record<string, unknown> }
  | { type: "tool_execution_end"; tool: string; output?: string }
  | { type: "agent_end"; sessionId: string };
