import { Cause, Effect, Schedule, Duration } from "effect";

export interface WorkflowDef {
  readonly effect: unknown;
  readonly schedule: number | string;
}

/**
 * Schedule and run a workflow effect repeatedly.
 */
export function runWorkflow(
  name: string,
  workflow: WorkflowDef,
): Effect.Effect<void, unknown, never> {
  const effect = workflow.effect as Effect.Effect<unknown, unknown, never>;

  const runOnce = Effect.asVoid(effect);

  const loopEffect = buildLoop(name, workflow.schedule, runOnce);

  return loopEffect.pipe(
    Effect.catchAllCause((cause) => {
      if (Cause.isInterrupted(cause)) {
        return Effect.void;
      }
      return Effect.logError(`[${name}] Error:`, Cause.pretty(cause));
    }),
  );
}

function buildLoop(
  name: string,
  schedule: number | string,
  runOnce: Effect.Effect<void, unknown, never>,
): Effect.Effect<void, unknown, never> {
  if (typeof schedule === "number") {
    return buildIntervalLoop(name, schedule, runOnce);
  } else {
    return buildCronLoop(name, schedule, runOnce);
  }
}

function buildIntervalLoop(
  name: string,
  intervalSec: number,
  runOnce: Effect.Effect<void, unknown, never>,
): Effect.Effect<void, unknown, never> {
  const intervalMs = intervalSec * 1000;

  return Effect.gen(function* () {
    yield* Effect.logInfo(`[${name}] Starting every ${intervalSec}s`);

    const runAndLog = runOnce.pipe(
      Effect.tap(() => Effect.logInfo(`[${name}] Executed`)),
      Effect.tapError((err) => Effect.logError(`[${name}] Error:`, String(err))),
    );

    const loop = runAndLog.pipe(
      Effect.flatMap(() =>
        Effect.sleep(Duration.millis(intervalMs)).pipe(Effect.flatMap(() => runAndLog)),
      ),
      Effect.repeat(Schedule.forever),
    );

    yield* loop;
  });
}

function buildCronLoop(
  name: string,
  expression: string,
  runOnce: Effect.Effect<void, unknown, never>,
): Effect.Effect<void, unknown, never> {
  return Effect.gen(function* () {
    yield* Effect.logInfo(`[${name}] Starting with cron: ${expression}`);

    const nextTime = computeNextCronTime(expression);
    if (nextTime === null) {
      yield* Effect.logError(`[${name}] Invalid cron expression: ${expression}`);
      return;
    }

    const delayMs = Math.max(0, nextTime - Date.now());
    if (delayMs > 0) {
      yield* Effect.logInfo(`[${name}] Next execution at ${new Date(nextTime).toISOString()}`);
    }

    const runAndLog = runOnce.pipe(
      Effect.tap(() => Effect.logInfo(`[${name}] Executed`)),
      Effect.tapError((err) => Effect.logError(`[${name}] Error:`, String(err))),
    );

    yield* runAndLog;

    const loopGen = Effect.gen(function* () {
      const next = computeNextCronTime(expression);
      if (next !== null && next > Date.now()) {
        yield* Effect.sleep(Duration.millis(next - Date.now()));
      } else {
        yield* Effect.sleep(Duration.minutes(5));
      }
      yield* runAndLog;
    }).pipe(Effect.repeat(Schedule.forever));

    yield* loopGen;
  });
}

/**
 * Compute the next fire time from a cron expression.
 */
function computeNextCronTime(expression: string): number | null {
  try {
    const parts = expression.trim().split(/\s+/);
    if (parts.length < 5) {
      return null;
    }

    const minute = Number(parts[0]);
    const hour = Number(parts[1]);
    const dayOfMonth = Number(parts[2]);
    const month = Number(parts[3]);

    if (Number.isNaN(minute) || minute < 0 || minute > 59) return null;
    if (Number.isNaN(hour) || hour < 0 || hour > 23) return null;
    if (Number.isNaN(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) return null;
    if (Number.isNaN(month) || month < 1 || month > 12) return null;

    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth(), dayOfMonth, hour, minute, 0, 0);

    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }

    return next.getTime();
  } catch {
    return null;
  }
}
