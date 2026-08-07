## Why

Users currently must invoke `foundry run <name>` once per workflow. When a project defines multiple
workflows, the common use case is to start all of them together. Running each manually is
error-prone (missing a workflow) and defeats the purpose of a single-process factory runner.

## What Changes

- Make the `run` command's name argument optional: `foundry run` (no name) or `foundry run <name>`
  (specific)
- When invoked without a name, `foundry run` discovers all workflows from `.foundry/workflows/*.ts`
  and runs each on its own schedule concurrently within the same process
- Each workflow runs in its own Effect fiber; the CLI holds all fibers and waits for `Ctrl+C` to
  interrupt them all
- Existing `foundry run <name>` behavior is preserved and unaffected

## Capabilities

### Modified Capabilities

- `workflow-scheduling` — the `foundry run` command now accepts an optional name argument; when
  omitted, all discovered workflows are run concurrently

### New Capabilities

- `parallel-run` — when no workflow name is specified, all discovered workflows execute
  simultaneously on their respective schedules
