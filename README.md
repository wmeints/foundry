# Foundry

Build your local AI factory with oh-my-pi and workflows. This is meant as an experimental runtime on top of an agent to help you build effective workflows for your agentic engineering projects. Make sure you're familiar with [oh-my-pi](https://omp.sh) before using the tooling from this repository.

## Getting started

TODO: Describe how to install the tool and how to use it.

## Project structure 

- `packages/cli` - Contains the `foundry` CLI that allows you to run factory control loops.
- `package/tasks` - Contains the standard effects you can use in the factory.

## Architecture

### Control loops

The purpose of foundry is to implement one or more control loops over your project to, for example, build features, fix bugs, or deploy code. Each control loop starts with an input signal from a specific source. It then translates this signal into actions that must be performed in the factory. After performing the actions, this results in a new state.

This sounds a little abstract, so let's translate this into a concrete example:

- **Measured input signal:** Pending backlog items on GitHub that must be implemented.
- **Control action:** Implementation workflow is invoked with an agent writing code to complete one backlog item.
- **New state:** Feature is implemented by the factory and submitted as pull request.

The control loop for the factory can stop here. You can also expand the factory with a second control loop that reviews pull requests and submits any comments on the PR. Having multiple control loops can be useful to modularize your factory.

The control loop looks awfully like a regular implementation workflow. But it isn't. Instead of pending backlog item you can also periodically review the code in the repository, against your coding standards and create bugs for areas where the codebase deviates from your standards. The input signal is a measured error, and the control action is the submission of the bug. The new state is that we have a bug to fix.

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

We include a number of tasks to help you build effects for the factory for the control loops in your factory.


## Documentation

TODO: Add documentation for the project.
