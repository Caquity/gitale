import { InvalidCheckpointError, InvalidStatusError } from "./errors.js";

export const nodeStatuses = ["candidate", "accepted", "abandoned"] as const;
export type NodeStatus = (typeof nodeStatuses)[number];

export interface ContextSnapshot {
  readonly ancestorNodeIds: readonly string[];
  readonly branchNodeIds: readonly string[];
}

export interface RunMetadata {
  readonly agent?: string;
  readonly runId?: string;
  readonly durationMs?: number;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface AdvisoryStateSnapshot {
  readonly advisory: true;
  readonly data: Readonly<Record<string, unknown>>;
}

export interface StoryCheckpoint {
  readonly nodeId: string;
  readonly parentNodeId: string | null;
  readonly status: NodeStatus;
  readonly userIntent: string;
  readonly storyContent: string;
  readonly createdAt: string;
  readonly contextSnapshot: ContextSnapshot;
  readonly runMetadata: RunMetadata | undefined;
  readonly stateSnapshot: AdvisoryStateSnapshot | undefined;
}

export interface NewCheckpointInput {
  readonly nodeId: string;
  readonly userIntent: string;
  readonly storyContent: string;
  readonly createdAt?: string;
  readonly runMetadata?: RunMetadata;
  readonly stateSnapshot?: AdvisoryStateSnapshot;
}

export interface StoryRevision {
  readonly nodeId: string;
  readonly revisionNumber: number;
  readonly storyContent: string;
  readonly userIntent: string;
  readonly createdAt: string;
}

export interface AmendmentInput {
  readonly storyContent: string;
  readonly userIntent?: string;
  readonly createdAt?: string;
}

const nodeIdPattern = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export function validateNewCheckpointInput(input: NewCheckpointInput): void {
  if (!nodeIdPattern.test(input.nodeId)) {
    throw new InvalidCheckpointError("nodeId must be a path-safe non-empty identifier");
  }
  if (!input.storyContent.trim()) {
    throw new InvalidCheckpointError("storyContent must be non-empty");
  }
  if (!input.userIntent.trim()) {
    throw new InvalidCheckpointError("userIntent must be non-empty");
  }
  if (input.createdAt !== undefined && !input.createdAt.trim()) {
    throw new InvalidCheckpointError("createdAt must be non-empty");
  }
  if (input.stateSnapshot !== undefined) {
    if (input.stateSnapshot.advisory !== true) {
      throw new InvalidCheckpointError("stateSnapshot must be advisory");
    }
    if (!input.stateSnapshot.data || typeof input.stateSnapshot.data !== "object") {
      throw new InvalidCheckpointError("stateSnapshot.data must be an object");
    }
  }
}

export function validateAmendmentInput(input: AmendmentInput): void {
  if (!input.storyContent.trim()) {
    throw new InvalidCheckpointError("amendment storyContent must be non-empty");
  }
  if (input.userIntent !== undefined && !input.userIntent.trim()) {
    throw new InvalidCheckpointError("amendment userIntent must be non-empty when supplied");
  }
  if (input.createdAt !== undefined && !input.createdAt.trim()) {
    throw new InvalidCheckpointError("amendment createdAt must be non-empty when supplied");
  }
}

export function freezeRevision(revision: StoryRevision): StoryRevision {
  return Object.freeze({ ...revision });
}

export function validateStatus(status: string): asserts status is NodeStatus {
  if (!(nodeStatuses as readonly string[]).includes(status)) {
    throw new InvalidStatusError(`status must be one of ${nodeStatuses.join(", ")}, got ${status}`);
  }
}

export function freezeCheckpoint(checkpoint: StoryCheckpoint): StoryCheckpoint {
  const frozenContext: ContextSnapshot = Object.freeze({
    ancestorNodeIds: Object.freeze([...checkpoint.contextSnapshot.ancestorNodeIds]),
    branchNodeIds: Object.freeze([...checkpoint.contextSnapshot.branchNodeIds]),
  });
  const frozenRunMetadata = checkpoint.runMetadata
    ? Object.freeze({
        ...checkpoint.runMetadata,
        ...(checkpoint.runMetadata.metadata
          ? { metadata: Object.freeze({ ...checkpoint.runMetadata.metadata }) }
          : {}),
      })
    : undefined;
  const frozenStateSnapshot = checkpoint.stateSnapshot
    ? Object.freeze({
        ...checkpoint.stateSnapshot,
        data: Object.freeze({ ...checkpoint.stateSnapshot.data }),
      })
    : undefined;
  return Object.freeze({
    ...checkpoint,
    contextSnapshot: frozenContext,
    runMetadata: frozenRunMetadata,
    stateSnapshot: frozenStateSnapshot,
  });
}
