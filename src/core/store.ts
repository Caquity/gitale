import { CycleError, DuplicateNodeError, MissingParentError, NodeNotFoundError } from "./errors.js";
import type { AmendmentInput, NodeStatus, StoryCheckpoint, StoryRevision } from "./types.js";
import {
  freezeCheckpoint,
  freezeRevision,
  validateAmendmentInput,
  validateStatus,
} from "./types.js";

export interface StoryStore {
  save(checkpoint: StoryCheckpoint): void;
  get(nodeId: string): StoryCheckpoint;
  list(): readonly StoryCheckpoint[];
  updateStatus(nodeId: string, status: NodeStatus): StoryCheckpoint;
  amend(nodeId: string, input: AmendmentInput): StoryRevision;
  listRevisions(nodeId: string): readonly StoryRevision[];
  setCurrentNode(nodeId: string): void;
  currentNodeId(): string | null;
}

export class InMemoryStoryStore implements StoryStore {
  private readonly nodes = new Map<string, StoryCheckpoint>();
  private readonly revisions = new Map<string, StoryRevision[]>();
  private currentNode: string | null = null;

  constructor(checkpoints: Iterable<StoryCheckpoint> = []) {
    for (const checkpoint of checkpoints) {
      if (this.nodes.has(checkpoint.nodeId)) {
        throw new DuplicateNodeError(`node ${checkpoint.nodeId} already exists`);
      }
      this.nodes.set(checkpoint.nodeId, checkpoint);
      this.revisions.set(checkpoint.nodeId, [revisionOne(checkpoint)]);
    }
    this.validateParentGraph(this.nodes);
    this.currentNode = this.nodes.keys().next().value ?? null;
  }

  save(checkpoint: StoryCheckpoint): void {
    if (this.nodes.has(checkpoint.nodeId)) {
      throw new DuplicateNodeError(`node ${checkpoint.nodeId} already exists`);
    }
    if (checkpoint.parentNodeId !== null && !this.nodes.has(checkpoint.parentNodeId)) {
      throw new MissingParentError(`parent node ${checkpoint.parentNodeId} does not exist`);
    }
    const prospective = new Map(this.nodes);
    prospective.set(checkpoint.nodeId, checkpoint);
    this.validateParentGraph(prospective);
    this.nodes.set(checkpoint.nodeId, checkpoint);
    this.revisions.set(checkpoint.nodeId, [revisionOne(checkpoint)]);
    this.currentNode = checkpoint.nodeId;
  }

  get(nodeId: string): StoryCheckpoint {
    const checkpoint = this.nodes.get(nodeId);
    if (!checkpoint) {
      throw new NodeNotFoundError(`node ${nodeId} does not exist`);
    }
    return checkpoint;
  }

  list(): readonly StoryCheckpoint[] {
    return Object.freeze([...this.nodes.values()]);
  }

  updateStatus(nodeId: string, status: NodeStatus): StoryCheckpoint {
    validateStatus(status);
    const current = this.get(nodeId);
    const updated = Object.freeze({ ...current, status });
    this.nodes.set(nodeId, updated);
    return updated;
  }

  amend(nodeId: string, input: AmendmentInput): StoryRevision {
    validateAmendmentInput(input);
    const current = this.get(nodeId);
    if ([...this.nodes.values()].some((node) => node.parentNodeId === nodeId)) {
      throw new Error(`cannot amend node ${nodeId}: descendant continuity retcon is unsupported`);
    }
    const history = this.revisions.get(nodeId);
    if (history === undefined) {
      throw new NodeNotFoundError(`node ${nodeId} does not exist`);
    }
    const revision = freezeRevision({
      nodeId,
      revisionNumber: history.length + 1,
      storyContent: input.storyContent,
      userIntent: input.userIntent ?? current.userIntent,
      createdAt: input.createdAt ?? new Date().toISOString(),
    });
    this.revisions.set(nodeId, [...history, revision]);
    this.nodes.set(
      nodeId,
      freezeCheckpoint({
        ...current,
        storyContent: revision.storyContent,
        userIntent: revision.userIntent,
      }),
    );
    return revision;
  }

  listRevisions(nodeId: string): readonly StoryRevision[] {
    this.get(nodeId);
    return Object.freeze([...(this.revisions.get(nodeId) ?? [])]);
  }

  setCurrentNode(nodeId: string): void {
    this.get(nodeId);
    this.currentNode = nodeId;
  }

  currentNodeId(): string | null {
    return this.currentNode;
  }

  private validateParentGraph(nodes: ReadonlyMap<string, StoryCheckpoint>): void {
    for (const checkpoint of nodes.values()) {
      const seen = new Set<string>();
      let currentId: string | null = checkpoint.nodeId;
      while (currentId !== null) {
        if (seen.has(currentId)) {
          throw new CycleError(`cycle detected from node ${checkpoint.nodeId}`);
        }
        seen.add(currentId);
        const current = nodes.get(currentId);
        if (!current) {
          throw new MissingParentError(`parent node ${currentId} does not exist`);
        }
        currentId = current.parentNodeId;
      }
    }
  }
}

function revisionOne(checkpoint: StoryCheckpoint): StoryRevision {
  return freezeRevision({
    nodeId: checkpoint.nodeId,
    revisionNumber: 1,
    storyContent: checkpoint.storyContent,
    userIntent: checkpoint.userIntent,
    createdAt: checkpoint.createdAt,
  });
}
