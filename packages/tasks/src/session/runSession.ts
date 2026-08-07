/**
 * Main runSession Effect — spawns OMP, drives an RPC session,
 * collects the full conversation and stats, and returns a structured result.
 */

import { Effect } from "effect";
import type {
  AgentError,
  MessagesError,
  ProcessError,
  ProtocolError,
  SessionError,
  StatsError,
  TimeoutError,
} from "./errors";
import { createRpcClient } from "./rpcClient";
import type {
  Conversation,
  RunSessionOptions,
  RunSessionResult,
  SessionStats,
  SuccessResult,
} from "./types";

interface MessagesPageResult {
  messages: Array<{
    id: string;
    role: string;
    content: Array<{ type: string; text?: string; url?: string; title?: string }>;
    createdAt?: string;
    sessionId?: string;
  }>;
  next_cursor?: string;
  session_busy?: boolean;
  stale_cursor?: boolean;
  error?: string;
}

interface SessionStatsResult {
  model_id?: string;
  message_count?: number;
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  context_usage?: number;
  error?: string;
}

function makeProcessError(message: string, code?: string): ProcessError {
  if (code !== undefined) {
    return { _tag: "ProcessError", message, code };
  }
  return { _tag: "ProcessError", message };
}

function makeProtocolError(message: string, step: "ready" | "negotiate" | "parse"): ProtocolError {
  return { _tag: "ProtocolError", message, step };
}

function makeTimeoutError(message: string, phase: "ready" | "prompt"): TimeoutError {
  return { _tag: "TimeoutError", message, phase };
}

function makeMessagesError(message: string, code: string): MessagesError {
  return { _tag: "MessagesError", message, code };
}

function makeStatsError(message: string, code: string): StatsError {
  return { _tag: "StatsError", message, code };
}

function makeAgentError(exitCode: number, stderr: string, partial?: Conversation): AgentError {
  if (partial !== undefined) {
    return {
      _tag: "AgentError",
      message: `OMP exited with code ${exitCode}`,
      exitCode,
      stderr,
      partialConversation: partial,
    };
  }
  return { _tag: "AgentError", message: `OMP exited with code ${exitCode}`, exitCode, stderr };
}

function buildConversation(messages: MessagesPageResult["messages"]): Conversation {
  return {
    messages: messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content.map((c) => ({ type: c.type, text: c.text, url: c.url, title: c.title })),
      createdAt: m.createdAt,
      sessionId: m.sessionId,
    })),
  };
}

function buildStats(result: SessionStatsResult): SessionStats {
  const stats: SessionStats = {};
  if (result.model_id !== undefined) stats.modelId = result.model_id;
  if (result.message_count !== undefined) stats.messageCount = result.message_count;
  if (result.input_tokens !== undefined) stats.inputTokens = result.input_tokens;
  if (result.output_tokens !== undefined) stats.outputTokens = result.output_tokens;
  if (result.total_tokens !== undefined) stats.totalTokens = result.total_tokens;
  if (result.context_usage !== undefined) stats.contextUsage = result.context_usage;
  return stats;
}

function buildPartialConversation(
  messages: MessagesPageResult["messages"],
): Conversation | undefined {
  if (messages.length === 0) return undefined;
  return buildConversation(messages);
}

function isSessionError(err: unknown): err is SessionError {
  return typeof err === "object" && err !== null && "_tag" in err;
}

/**
 * Spawns an OMP agent session, sends a prompt, collects the full
 * conversation and session stats, and returns a structured result.
 */
export function runSession(
  options: RunSessionOptions,
): Effect.Effect<RunSessionResult, SessionError> {
  return Effect.tryPromise({
    try: async (): Promise<RunSessionResult> => {
      let client: ReturnType<typeof createRpcClient> | undefined;
      let collectedMessages: MessagesPageResult["messages"] = [];

      try {
        client = createRpcClient({
          cwd: options.cwd,
          onEvent: options.onEvent,
          readyTimeoutMs: options.readyTimeoutMs,
          promptTimeoutMs: options.promptTimeoutMs,
        });

        // Send prompt
        await client.send(
          {
            type: "prompt",
            id: 2,
            message: options.message,
            cwd: options.cwd,
          } as Record<string, unknown>,
          options.promptTimeoutMs ?? 600_000,
        );

        // Collect conversation via pagination
        while (true) {
          const msgResult = (await client.send(
            {
              type: "get_messages_page",
              id: 3,
            } as Record<string, unknown>,
            30_000,
          )) as MessagesPageResult;

          if (msgResult.error) {
            throw makeMessagesError(msgResult.error, "unknown");
          }

          if (msgResult.session_busy) {
            await new Promise<void>((r) => setTimeout(r, 500));
            continue;
          }

          if (msgResult.stale_cursor) {
            continue;
          }

          collectedMessages.push(...msgResult.messages);

          if (!msgResult.next_cursor) {
            break;
          }
        }

        // Collect stats
        const statsResult = (await client.send(
          {
            type: "get_session_stats",
            id: 4,
          } as Record<string, unknown>,
          30_000,
        )) as SessionStatsResult;

        if (statsResult.error) {
          throw makeStatsError(statsResult.error, "unknown");
        }

        // Cleanup and read exit code
        client.kill();
        const exitInfo = await client.onExit();

        if (exitInfo.exitCode === 0) {
          return {
            _tag: "SuccessResult",
            conversation: buildConversation(collectedMessages),
            stats: buildStats(statsResult),
          } as SuccessResult;
        }

        throw makeAgentError(
          exitInfo.exitCode,
          exitInfo.stderr,
          buildPartialConversation(collectedMessages),
        );
      } finally {
        try {
          if (client) {
            client.kill();
          }
        } catch {
          // Ignore cleanup errors
        }
      }
    },
    catch: (err): SessionError => {
      if (isSessionError(err)) {
        return err;
      }
      const msg = String(err);
      if (msg.includes("ENOENT") || msg.includes("spawn")) {
        return makeProcessError(msg, "spawn");
      }
      if (msg.includes("ready")) {
        return makeProtocolError(msg, "ready");
      }
      if (msg.includes("negotiate")) {
        return makeProtocolError(msg, "negotiate");
      }
      if (msg.includes("timeout")) {
        return makeTimeoutError(msg, "prompt");
      }
      return makeProcessError(msg);
    },
  });
}
