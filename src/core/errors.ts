export class StoryWorkspaceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class InvalidCheckpointError extends StoryWorkspaceError {}

export class DuplicateNodeError extends StoryWorkspaceError {}

export class MissingParentError extends StoryWorkspaceError {}

export class NodeNotFoundError extends StoryWorkspaceError {}

export class CycleError extends StoryWorkspaceError {}

export class InvalidStatusError extends StoryWorkspaceError {}

export class GenerationFailedError extends StoryWorkspaceError {}

export class PersistenceError extends StoryWorkspaceError {}

export class WorkspaceNotInitializedError extends StoryWorkspaceError {}

export class WorkspaceAlreadyExistsError extends StoryWorkspaceError {}

export class BootstrapError extends StoryWorkspaceError {}
