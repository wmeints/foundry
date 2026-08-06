## Purpose

Workflow scheduling provides the ability to execute discovered workflow Effects on a recurring schedule, supporting both fixed intervals (in seconds) and cron expressions, while keeping the factory runtime alive until the user stops it.

## ADDED Requirements

### Requirement: Interval scheduling

The system supports numeric schedule values (in seconds) that cause a workflow to execute repeatedly at fixed intervals.

#### Scenario: Run workflow with interval schedule

- **GIVEN** a workflow named `build` with `schedule: 60` is registered
- **WHEN** the user runs `foundry run build`
- **THEN** the system executes the `build` effect immediately
- **AND** the system re-executes the `build` effect every 60 seconds
- **AND** the factory remains active and responsive to `Ctrl+C`

#### Scenario: Run workflow with short interval

- **GIVEN** a workflow named `check` with `schedule: 5` is registered
- **WHEN** the user runs `foundry run check`
- **THEN** the system executes the `check` effect immediately
- **AND** the system re-executes the `check` effect every 5 seconds

#### Scenario: Interval scheduling tolerates slow execution

- **GIVEN** a workflow named `slow` with `schedule: 10` is registered
- **AND** the workflow's effect takes 15 seconds to complete
- **WHEN** the user runs `foundry run slow`
- **THEN** the system waits for the 15-second effect to finish before the next scheduled execution
- **AND** the system does NOT spawn overlapping executions of the same workflow

### Requirement: Cron scheduling

The system supports cron expression strings as schedule values that control when a workflow executes.

#### Scenario: Run workflow with cron schedule

- **GIVEN** a workflow named `daily-cleanup` with `schedule: "0 2 * * *"` is registered
- **WHEN** the user runs `foundry run daily-cleanup`
- **THEN** the system executes the effect immediately
- **AND** the system schedules the next execution at the next cron trigger time
- **AND** the factory remains active between executions

### Requirement: Workflow execution via run command

The `foundry run <name>` command executes a specific workflow by name.

#### Scenario: Run a specific workflow by name

- **GIVEN** the workflows `build`, `lint`, and `test` are discovered
- **WHEN** the user runs `foundry run lint`
- **THEN** only the `lint` workflow is scheduled and executed
- **AND** the `build` and `test` workflows are not executed

#### Scenario: Run nonexistent workflow fails gracefully

- **GIVEN** the workflows `build` and `test` are discovered
- **WHEN** the user runs `foundry run nonexistent`
- **THEN** the system prints an error listing available workflows
- **AND** the system exits with a non-zero status

### Requirement: Graceful shutdown

The factory responds to `Ctrl+C` by shutting down cleanly.

#### Scenario: Ctrl+C stops all workflows

- **GIVEN** a workflow is running with an active schedule
- **WHEN** the user presses `Ctrl+C`
- **THEN** the system stops scheduling further executions
- **AND** the system waits for any in-progress effect to complete
- **AND** the system exits with status code 0
