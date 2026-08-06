## Why

The foundry engine needs a way to discover and execute user-defined control loops (workflows). Currently there is no mechanism to define workflow files or load them into the factory runtime. Users need a structured way to register workflows and have them automatically discovered, listed, and scheduled by the CLI.

## What Changes

- **`.foundry` directory as private package**: The `.foundry` directory is treated as a Node.js package with its own `package.json` and TypeScript compilation. It serves as the workspace where users define workflows.
- **Workflow file convention**: Users create TypeScript files in `.foundry/workflows/` that export a default object with `effect` (an Effect) and `schedule` (number of seconds or cron expression).
- **Auto-discovery**: The CLI automatically scans `.foundry/workflows/*.ts`, compiles them, and registers discovered workflows.
- **`foundry ls` command**: Lists all discovered workflows with their names and schedules.
- **`foundry run <name>` command**: Schedules a specific workflow and keeps the factory alive (Ctrl+C stops it).
- **`foundry init` command**: Scaffolds the `.foundry` directory with `package.json`, a sample workflow, and a `tsconfig.json`.
- Uses plain Effect and tags for workflow services (not the alpha workflow engine).

## Capabilities

### New Capabilities
- `workflow-discovery`: Auto-discover, validate, and list workflow definitions from the `.foundry/workflows` directory
- `workflow-scheduling`: Schedule and execute workflows using Effect, supporting interval and cron-based schedules
