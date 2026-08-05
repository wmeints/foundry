# Defining workflows in the project

## Context

We're building an engine that can run agentic workflows in a project. The idea
is to build one or more control loops for a factory that automatically picks up
work and creates changes in the project and submits pull requests for the
project.

Currently, we have no way to define and load workflow files for the control
loops. We need to make sure the engine automatically loads `{workflow-name}.ts`
files from the `.foundry/workflows` directory in the project.

## Goal

We can discover and load workflow files and schedule the `Effect` that's
exported from the package stored in the `.foundry` directory.

## Design notes

### The Foundry directory

The `.foundry` directory should be considered as a private node package with
a `package.json` to define extra dependencies for the control loops.

It's a good idea to let the `.foundry` package compile itself with `tsc` instead
of adding a compiler to the foundry executable. Then import the various workflow
modules into the foundry environment.

The `.foundry` package should export a default member in the root of the package
that looks like this:

```typescript
import implementation from "./workflows/implementation.ts";

const foundry = {
  workflows: {
    implementation,
  },
};

export default foundry;
```

We can use this to automatically discover workflows and schedule them in the
application. It makes it easier for users to choose what to expose to the
foundry executable.

### Definining workflows

Users can define a workflow by creating a typescript file in
`.foundry/workflows` that has the following default export:

```typescript
const myEffect = Effect.sync(() => console.log("Example"));

const workflow = {
  effect: myEffect, // The effect that must be scheduled in the factory.
  schedule: 60, // Number -> Run every x seconds. String -> Cron expression.
};

export default workflow;
```

### Implementation using effect

Use plain effects and tags to define services, don't use the workflow engine
as it's in alpha state.

## Acceptance criteria

- Workflow files of the right format are loaded automatically.
- When I run `foundry ls` I get the discovered workflows listing their name and
  the schedule on the terminal.
- When I run `foundry run <workflow-name>` the specific workflow is scheduled
  and the factory remains active I press Ctrl+C.
- Unit tests verify the behavior of the new functionality.
