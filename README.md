# Foundry

Build your local AI factory with oh-my-pi and workflows. This is meant as an experimental runtime on top of an agent to help you build effective workflows for your agentic engineering projects. Make sure you're familiar with [oh-my-pi](https://omp.sh) before using the tooling from this repository.

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [pnpm](https://pnpm.io/) 11+ (installed automatically if missing)

### Development setup

```bash
# Clone the repository
git clone <repository-url>
cd foundry

# Install dependencies (pnpm is auto-resolved via devEngines)
pnpm install
```

This workspace contains the following packages:

- `packages/cli` — the `foundry` CLI tool
- `packages/tasks` — standard effects for building factory workflows

Each package supports these scripts:

| Script | Description |
|--------|-------------|
| `build` | Compile TypeScript to JavaScript |
| `test` | Run tests with vitest |
| `test:watch` | Run tests in watch mode |
| `lint` | Lint source files with oxlint |
| `format` | Format source files with oxfmt |
| `typecheck` | Type-check without emitting output |

### Building the CLI

```bash
pnpm --filter '@foundry/cli' build
```

### Using the tool locally

After building the CLI, you can run it from the workspace root:

```bash
# Initialize a .foundry directory in your project
pnpm --filter '@foundry/cli' start init

# List discovered workflows
pnpm --filter '@foundry/cli' start ls

# Run a specific workflow by name
pnpm --filter '@foundry/cli' start run <workflow-name>

# Run all workflows
pnpm --filter '@foundry/cli' start run
```

Or install globally so the `foundry` command is available everywhere:

```bash
pnpm --filter '@foundry/cli' install --global
```

Once installed, the standard commands become:

```bash
foundry init       # Scaffold .foundry/ with a sample workflow
foundry ls         # List all discovered workflows
foundry run        # Run all workflows
foundry run <name> # Run a specific workflow
```

## Running the Foundry tool

The Foundry CLI works by compiling TypeScript workflows in your project's `.foundry/` directory and scheduling them as Effect fibers.

### Quick start

```bash
# 1. Scaffold your project
foundry init

# 2. Edit .foundry/workflows/*.ts to define your control loops

# 3. Run the factory
foundry run
```

The `init` command creates:

- `.foundry/package.json` -- dependencies for the workflow package
- `.foundry/tsconfig.json` -- TypeScript configuration
- `.foundry/index.ts` -- workflow registry
- `.foundry/workflows/implementation.ts` -- a sample workflow

### Writing workflows

Workflows are TypeScript files in `.foundry/workflows/`. Each file must export a `default` object with two fields:

```typescript
import { Effect } from "effect";

export default {
  effect: Effect.log("Hello from the implementation workflow!"),
  schedule: 60, // Run every 60 seconds (or a cron expression like "0 * * * *")
};
```

- `effect` -- an Effect that runs on each iteration. This is the core logic of your control loop.
- `schedule` -- either a number (seconds between runs) or a cron expression string.

Each `.ts` file in the `workflows/` directory is discovered automatically. Files without a valid `effect` + `schedule` export are silently skipped.

### Running workflows

```bash
foundry run              # Run all workflows (each on its own schedule)
foundry run <name>       # Run a single workflow until completion
foundry ls               # List all discovered workflows and their schedules
```

Control loops run indefinitely. Press `Ctrl+C` to gracefully shut down all fibers.

### Architecture

See the [Architecture](#architecture) section below.

## Project structure 

- `packages/cli` - Contains the `foundry` CLI that allows you to run factory control loops.
- `packages/tasks` - Contains the standard effects you can use in the factory.

## Architecture

### Control loops

The purpose of foundry is to implement one or more control loops over your project to, for example, build features, fix bugs, or deploy code. Each control loop starts with an input signal from a specific source. It then translates this signal into actions that must be performed in the factory. After performing the actions, this results in a new state.

This sounds a little abstract, so let's translate this into a concrete example:

- **Measured input signal:** Pending backlog items on GitHub that must be implemented.
- **Control action:** Implementation workflow is invoked with an agent writing code to complete one backlog item.
- **New state:** Feature is implemented by the factory and submitted as pull request.

The control loop for the factory can stop here. You can also expand the factory with a second control loop that reviews pull requests and submits any comments on the PR. Having multiple control loops can be useful to modularize your factory.

The control loop looks awfully like a regular implementation workflow. But it isn't. Instead of pending backlog item you can also periodically review the code in the repository against your coding standards and create bugs for areas where the codebase deviates from your standards. The input signal is a measured error, and the control action is the submission of the bug. The new state is that we have a bug to fix. You can also let the factory review the structure of your code and propose improvements as issues or pull requests.

### Implementing control loops

Control loops are implemented as effects. The implementation control loop can be build like this:

```typescript
// Always export the effect used in the control loop as the default export.
// It will 
export default Effect.gen(function* () {
  const pendingItems = yield* fetchPendingBacklogItems()

  if(pendingItems.length > 0) {
    const firstPendingItem = pendingItems[0]
    const outcome = yield* implementBacklogItem(firstPendingItem)

    if(outcome.success) {
      yield* reviewPullRequest(outcome.pullRequest)
    }
  }
})
```

We include a number of tasks to help you build effects for the factory for the control loops in your factory. By using the effects exposed by `@foundry/tasks` you can quickly build basic control loops to build software.

## Documentation

TODO: Add documentation for the project.
