## Purpose

Workflow discovery provides the ability to automatically find, validate, and list TypeScript
workflow definitions stored in the `.foundry/workflows` directory. Each workflow file follows
a约定 format that exposes an Effect and a schedule.

## ADDED Requirements

### Requirement: Workflow file discovery

The system scans the `.foundry/workflows` directory for `.ts` files, compiles them against the
`.foundry` project, and extracts workflow definitions from default exports.

#### Scenario: Valid workflow file is discovered

- **GIVEN** the `.foundry/workflows` directory exists
- **AND** a file named `my-workflow.ts` exists with a valid default export containing `effect` and
  `schedule` fields
- **THEN** the system registers a workflow named `my-workflow` with the provided effect and schedule

#### Scenario: Missing schedule field produces error

- **GIVEN** a valid `.foundry/workflows` directory
- **AND** a file `bad-workflow.ts` exports a default object without a `schedule` field
- **THEN** the system logs a validation error and skips the file
- **AND** the system continues discovering other files

#### Scenario: Missing effect field produces error

- **GIVEN** a valid `.foundry/workflows` directory
- **AND** a file `bad-workflow.ts` exports a default object without an `effect` field
- **THEN** the system logs a validation error and skips the file

#### Scenario: Non-TypeScript files are ignored

- **GIVEN** the `.foundry/workflows` directory exists
- **AND** a file named `note.txt` exists in the directory
- **THEN** the system ignores the file and does not attempt to parse it

#### Scenario: TypeScript compilation failure produces error

- **GIVEN** the `.foundry/workflows` directory exists
- **AND** a file `broken.ts` has TypeScript syntax errors
- **THEN** the system logs a compilation error and skips the file
- **AND** the system continues discovering other files

### Requirement: Workflow listing

The `foundry ls` command lists all discovered workflows with their name and schedule.

#### Scenario: List displays discovered workflows

- **GIVEN** the `.foundry/workflows` directory contains `build.ts` (schedule: 60), `test.ts`
  (schedule: "0 2 * * *"), and `lint.ts` (schedule: 300)
- **WHEN** the user runs `foundry ls`
- **THEN** the output shows three entries: `build` with schedule `60s`, `test` with schedule
  `0 2 * * *`, and `lint` with schedule `300s`

#### Scenario: List is empty when no workflows exist

- **GIVEN** the `.foundry/workflows` directory is empty or does not exist
- **WHEN** the user runs `foundry ls`
- **THEN** the output indicates no workflows are defined

### Requirement: Foundry directory initialization

The `foundry init` command creates the `.foundry` directory with the required package structure.

#### Scenario: Init creates required structure

- **GIVEN** no `.foundry` directory exists in the project root
- **WHEN** the user runs `foundry init`
- **THEN** the system creates `.foundry/package.json` with type `module` and a `workflows`
  dependency
- **AND** the system creates `.foundry/tsconfig.json` referencing the foundry TypeScript base config
- **AND** the system creates `.foundry/workflows/implementation.ts` with a sample workflow
- **AND** the system creates `.foundry/index.ts` exporting the workflow registry

#### Scenario: Init preserves existing .foundry directory

- **GIVEN** a `.foundry` directory already exists in the project root
- **WHEN** the user runs `foundry init`
- **THEN** the system does not overwrite existing files
- **AND** the system exits with a status indicating the directory already exists
