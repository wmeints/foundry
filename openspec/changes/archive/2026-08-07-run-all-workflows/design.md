## Context

The CLI currently has `foundry run <name>` with a required positional argument. It compiles the
`.foundry` package, discovers workflows, looks up one by name, and runs it via `Runtime.runFork`
into a single `Fiber.RuntimeFiber` stored on `globalThis._foundryFork`. The SIGINT handler
interrupts that single fiber.

We need `foundry run` (no name) to discover all workflows and run each in its own fiber, managed
collectively.

## Goals / Non-Goals

**Goals:**

- Make `run` command's name argument optional; when omitted, run all discovered workflows
  concurrently
- Each workflow runs in its own `RuntimeFiber` with independent scheduling
- SIGINT interrupts all fibers simultaneously via a single shared state
- Existing `foundry run <name>` behavior is unchanged

**Non-Goals:**

- Workflow dependency ordering (DAG scheduling)
- Dynamic add/remove of workflows at runtime
- Per-workflow health metrics or observability endpoints
- Using `@effect/workflow` — stay on raw Effect primitives

## Decisions

### 1. Commander signature: optional argument

Use `.argument('[name]', 'Workflow name to run (omit to run all)')`. Commander passes `undefined`
when the argument is absent, and the string when provided.

```ts
const runCommand = program
  .command("run")
  .argument("[name]", "Workflow name to run (omit to run all)")
  .description("Run a control loop in your project");
```

### 2. Fiber management: simple array on global state

Store an array of fibers on `globalThis._foundryForks` (plural). The SIGINT handler iterates the
array and interrupts each fiber.

```ts
// In action:
const fibers = await Effect.runPromise(
  Effect.forEach(workflows, ([name, entry]) =>
    Effect.sync(() =>
      Runtime.runFork(runWorkflow(name, { effect: entry.effect, schedule: entry.schedule })),
    ),
  ),
);
_fiberRef.forks = fibers;

// In SIGINT handler:
_fiberRef.forks.forEach((f) => Fiber.interrupt(f));
```

### 3. Waiting for all fibers: `Fiber.joinAll`

Effect provides `Fiber.joinAll(fibers: Iterable<Fiber<A, E>>): Effect<A[], E>`. This waits for every
fiber to settle and returns an array of results.

The top-level effect under `Effect.scoped` will be:

```ts
Effect.gen(function* () {
  const compiledPath = yield* compileFoundry();
  const workflows = yield* discoverWorkflows(compiledPath);
  if (workflows.size === 0) {
    /* empty case */ return;
  }
  const fibers = yield* Effect.forEach(Array.from(workflows), ([name, entry]) =>
    Effect.sync(() =>
      Runtime.runFork(runWorkflow(name, { effect: entry.effect, schedule: entry.schedule })),
    ),
  );
  yield* Effect.forEach(fibers, (f) => Effect.asVoid(Fiber.join(f)), { concurrency: "unbounded" });
}).pipe(Effect.scoped);
```

`Effect.forEach` with `concurrency: 'unbounded'` on `Fiber.join` is equivalent to `Fiber.joinAll`
but typed correctly within the effect pipeline. Each `Fiber.join(f)` awaits one fiber;
`Effect.forEach` runs them all concurrently.

### 4. Error propagation

The scheduler's `runWorkflow` already catches all causes (`catchAllCause`) and only logs errors — it
never fails. So `Fiber.join` on each fiber will always produce `Success<void>`. Errors within
individual workflow effects are logged, not propagated.

This means `Fiber.joinAll` or `Effect.forEach` of joins will never see a failure for workflow
errors. The only failure case is interruption (SIGINT), which `runEffect` already handles by
checking `Cause.isInterrupted`.

### 5. Shared state pattern

The existing code uses `globalThis` for the fiber reference. We extend this to an object:

```ts
interface _FoundryState {
  forks: Fiber.RuntimeFiber<void, unknown>[];
}
```

This keeps the pattern consistent with the existing `_foundryFork` approach while supporting
multiple fibers.

## Risks / Trade-offs

### Concurrency limit

All workflows run concurrently with no upper bound. If a project has 50 workflows, 50 fibers are
created. For a CLI tool this is acceptable — each fiber is lightweight and the scheduler's
`Effect.sleep` / `Schedule.forever` patterns are well-optimized. If needed in the future,
`concurrency: 'bounded'` could be added.

### Interrupt ordering

SIGINT interrupts all fibers simultaneously. A workflow fiber that is mid-sleep gets interrupted
immediately. A workflow fiber that is mid-execution will propagate the interrupt through
interruptible Effect operations. The scheduler's `catchAllCause` handler catches
`Cause.isInterrupted` and returns `Effect.void`, ensuring clean exit.

### Backwards compatibility

Making the `<name>` argument optional with `.argument('[name]')` preserves `foundry run <name>` —
the string is still passed to the action handler. The handler branches on `name === undefined` vs. a
string value. No breaking changes.
