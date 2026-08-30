import { CycleError, MissingParentError, NodeNotFoundError } from "./errors.js";
import { InMemoryStoryStore, type StoryStore } from "./store.js";
import {
  freezeCheckpoint,
  validateNewCheckpointInput,
  type AmendmentInput,
  type NewCheckpointInput,
  type NodeStatus,
  type StoryCheckpoint,
  type StoryRevision,
} from "./types.js";

export interface ResolvedStoryContext {
  readonly selectedNodeId: string;
  readonly lineage: readonly StoryCheckpoint[];
  readonly ancestorNodeIds: readonly string[];
  readonly storyContents: readonly string[];
  readonly userIntents: readonly string[];
}

export class StoryWorkspace {
  constructor(readonly store: StoryStore = new InMemoryStoryStore()) {}

  createRoot(input: NewCheckpointInput): StoryCheckpoint {
    return this.createCheckpoint(null, input);
  }

  continueFrom(parentNodeId: string, input: NewCheckpointInput): StoryCheckpoint {
    return this.createCheckpoint(parentNodeId, input);
  }

  fork(fromNodeId: string, input: NewCheckpointInput): StoryCheckpoint {
    return this.continueFrom(fromNodeId, input);
  }

  getNode(nodeId: string): StoryCheckpoint {
    return this.store.get(nodeId);
  }

  listNodes(): readonly StoryCheckpoint[] {
    return this.store.list();
  }

  updateStatus(nodeId: string, status: NodeStatus): StoryCheckpoint {
    return this.store.updateStatus(nodeId, status);
  }

  amend(
    nodeId: string,
    input: AmendmentInput,
  ): { readonly checkpoint: StoryCheckpoint; readonly revision: StoryRevision } {
    const revision = this.store.amend(nodeId, input);
    return Object.freeze({ checkpoint: this.getNode(nodeId), revision });
  }

  listRevisions(nodeId: string): readonly StoryRevision[] {
    return this.store.listRevisions(nodeId);
  }

  selectCurrent(nodeId: string): StoryCheckpoint {
    this.store.setCurrentNode(nodeId);
    return this.getNode(nodeId);
  }

  currentNodeId(): string | null {
    return this.store.currentNodeId();
  }

  lineage(nodeId: string): readonly StoryCheckpoint[] {
    const reversed: StoryCheckpoint[] = [];
    const seen = new Set<string>();
    let current = this.getNode(nodeId);
    while (true) {
      if (seen.has(current.nodeId)) {
        throw new CycleError(`cycle detected from node ${nodeId}`);
      }
      seen.add(current.nodeId);
      reversed.push(current);
      if (current.parentNodeId === null) {
        return Object.freeze(reversed.reverse());
      }
      current = this.getNode(current.parentNodeId);
    }
  }

  resolveContext(nodeId: string): ResolvedStoryContext {
    const lineage = this.lineage(nodeId);
    return Object.freeze({
      selectedNodeId: nodeId,
      lineage,
      ancestorNodeIds: Object.freeze(lineage.slice(0, -1).map((node) => node.nodeId)),
      storyContents: Object.freeze(lineage.map((node) => node.storyContent)),
      userIntents: Object.freeze(lineage.map((node) => node.userIntent)),
    });
  }

  private createCheckpoint(
    parentNodeId: string | null,
    input: NewCheckpointInput,
  ): StoryCheckpoint {
    validateNewCheckpointInput(input);
    let ancestorNodeIds: string[];
    if (parentNodeId === null) {
      ancestorNodeIds = [];
    } else {
      try {
        ancestorNodeIds = this.lineage(parentNodeId).map((node) => node.nodeId);
      } catch (error) {
        if (error instanceof NodeNotFoundError) {
          throw new MissingParentError(`parent node ${parentNodeId} does not exist`);
        }
        throw error;
      }
    }
    const checkpoint = freezeCheckpoint({
      nodeId: input.nodeId,
      parentNodeId,
      status: "candidate",
      userIntent: input.userIntent,
      storyContent: input.storyContent,
      createdAt: input.createdAt ?? new Date().toISOString(),
      contextSnapshot: {
        ancestorNodeIds,
        branchNodeIds: [...ancestorNodeIds, input.nodeId],
      },
      runMetadata: input.runMetadata,
      stateSnapshot: input.stateSnapshot,
    });
    this.store.save(checkpoint);
    return checkpoint;
  }
}
