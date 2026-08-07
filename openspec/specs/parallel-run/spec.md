# Parallel Run Specification

## Purpose

The parallel run capability allows the `foundry run` command to discover and execute all workflow definitions concurrently when invoked without an explicit workflow name argument.

## Requirements

### Requirement: Optional run argument

The `foundry run` command accepts an optional workflow name argument. When called without a name, it runs all discovered workflows.

#### Scenario: Run all workflows when no name given

- **GIVEN** the `.foundry` directory exists with workflows `build`, `lint`, and `cleanup`
- **WHEN** the user runs `foundry run` (without a name argument)
- **THEN** the system compiles the `.foundry` package
- **AND** the system discovers all three workflows
- **AND** the system starts all three workflows concurrently on their respective schedules
- **AND** the system waits for `Ctrl+C` to stop all workflows

#### Scenario: Run all workflows when empty list

- **GIVEN** the `.foundry` directory exists but has no workflow files
- **WHEN** the user runs `foundry run`
- **THEN** the system prints a message indicating no workflows are defined
- **AND** the system exits with status code 0

#### Scenario: Specific name still runs single workflow

- **GIVEN** the workflows `build`, `lint`, and `cleanup` are discovered
- **WHEN** the user runs `foundry run lint`
- **THEN** only the `lint` workflow is executed (existing behavior unchanged)

### Requirement: Concurrent execution

When running all workflows, each workflow executes in its own fiber on its own schedule without blocking other workflows.

#### Scenario: Workflows execute independently

- **GIVEN** workflow A has `schedule: 2` and workflow B has `schedule: 300`
- **WHEN** the user runs `foundry run`
- **THEN** workflow A executes every 2 seconds on its own fiber
- **AND** workflow B executes on its 5-minute schedule on a separate fiber
- **AND** a long-running execution of A does not delay the next execution of B

#### Scenario: Slow execution does not overlap

- **GIVEN** a workflow with `schedule: 10` whose effect takes 15 seconds to complete
- **WHEN** the user runs `foundry run`
- **THEN** the system does not spawn a second overlapping execution of that workflow
- **AND** subsequent workflows continue to execute on schedule independently

#### Scenario: Workflow error does not kill others

- **GIVEN** workflow A fails with an error and workflow B succeeds
- **WHEN** the user runs `foundry run`
- **THEN** the failure of A is logged but does not interrupt B
- **AND** B continues executing on its schedule

### Requirement: Graceful shutdown

The system stops all workflow fibers on `Ctrl+C` and exits cleanly.

#### Scenario: Ctrl+C interrupts all fibers

- **GIVEN** multiple workflows are running concurrently
- **WHEN** the user presses `Ctrl+C`
- **THEN** the system interrupts all running workflow fibers
- **AND** the system prints a shutdown message
- **AND** the system exits with status code 0

#### Scenario: In-progress effect completes on shutdown

- **GIVEN** a workflow is mid-execution when `Ctrl+C` is pressed
- **WHEN** the system interrupts the workflow fiber
- **THEN** the interrupt is caught and logged
- **AND** the system exits cleanly
