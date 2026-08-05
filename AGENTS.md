# Agent instructions

This project builds a workflow engine for running control loops to build a local
software factory using the effect library.

## Technology stack

- [Typescript](https://www.typescriptlang.org/)
- [Effect](https://effect.website)
- [Node](https://nodejs.org)

## General coding guidelines

- **Prefer deep modules with narrow interfaces.** Build focused, cohesive units
  and keep exports minimal and well-defined.

- **Reuse existing functionality as much as possible.** Before writing new code,
  check whether a standard library function or a function already available in
  one of the project dependencies can handle the task.

- **Only write new code when necessary.** If no standard function or project
  dependency provides what you need, then write it.

- **Use red-green-refactor when writing code.** Write a failing test first
  (red), make it pass with the minimal code needed (green), then refine the
  design and remove duplication (refactor).

## Writing tests

When writing tests, use the `@effect/vitest` library. It allows you to write
tests like this when testing individual effects:

```typescript
import { describe } from "vitest";
import { it, expect } from "@effect/vitest";

describe("something", () => {
  it.effect("some description", () =>
    Effect.gen(function* () {
      // Implementation
    }),
  );
});
```
