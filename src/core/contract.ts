import { readFileSync } from "node:fs";

import { Ajv } from "ajv";

import { packageResource } from "../runtime/resources.js";
import { InvalidCheckpointError } from "./errors.js";
import {
  freezeCheckpoint,
  validateStatus,
  type AdvisoryStateSnapshot,
  type ContextSnapshot,
  type NodeStatus,
  type RunMetadata,
  type StoryCheckpoint,
} from "./types.js";

export interface StoryCheckpointDocument {
  node_id: string;
  parent_node_id: string | null;
  status: NodeStatus;
  user_intent: string;
  story_content: string;
  created_at: string;
  context_snapshot: {
    ancestor_node_ids: readonly string[];
    branch_node_ids: readonly string[];
  };
  run_metadata?: {
    agent?: string;
    run_id?: string;
    duration_ms?: number;
    metadata?: Readonly<Record<string, unknown>>;
  };
  state_snapshot?: {
    advisory: true;
    data: Readonly<Record<string, unknown>>;
  };
}

const schema = JSON.parse(
  readFileSync(packageResource("schema", "story-checkpoint.schema.json"), "utf8"),
) as object;
const validator = new Ajv({ allErrors: true }).compile(schema);

export function validateCheckpointDocument(
  value: unknown,
): asserts value is StoryCheckpointDocument {
  if (!validator(value)) {
    const details = validator.errors
      ?.map((error) => `${error.instancePath || "/"} ${error.message}`)
      .join("; ");
    throw new InvalidCheckpointError(`invalid checkpoint document${details ? `: ${details}` : ""}`);
  }
}

export function checkpointToDocument(checkpoint: StoryCheckpoint): StoryCheckpointDocument {
  const document: StoryCheckpointDocument = {
    node_id: checkpoint.nodeId,
    parent_node_id: checkpoint.parentNodeId,
    status: checkpoint.status,
    user_intent: checkpoint.userIntent,
    story_content: checkpoint.storyContent,
    created_at: checkpoint.createdAt,
    context_snapshot: {
      ancestor_node_ids: [...checkpoint.contextSnapshot.ancestorNodeIds],
      branch_node_ids: [...checkpoint.contextSnapshot.branchNodeIds],
    },
  };
  if (checkpoint.runMetadata !== undefined) {
    document.run_metadata = {
      ...(checkpoint.runMetadata.agent === undefined
        ? {}
        : { agent: checkpoint.runMetadata.agent }),
      ...(checkpoint.runMetadata.runId === undefined
        ? {}
        : { run_id: checkpoint.runMetadata.runId }),
      ...(checkpoint.runMetadata.durationMs === undefined
        ? {}
        : { duration_ms: checkpoint.runMetadata.durationMs }),
      ...(checkpoint.runMetadata.metadata === undefined
        ? {}
        : { metadata: { ...checkpoint.runMetadata.metadata } }),
    };
  }
  if (checkpoint.stateSnapshot !== undefined) {
    document.state_snapshot = {
      advisory: true,
      data: { ...checkpoint.stateSnapshot.data },
    };
  }
  return document;
}

export function documentToCheckpoint(value: unknown): StoryCheckpoint {
  validateCheckpointDocument(value);
  const context = value.context_snapshot;
  const lastBranchNodeId = context.branch_node_ids.at(-1);
  const lastAncestorNodeId = context.ancestor_node_ids.at(-1);
  if (lastBranchNodeId !== value.node_id) {
    throw new InvalidCheckpointError("context_snapshot.branch_node_ids must end with node_id");
  }
  if (value.parent_node_id === null && context.ancestor_node_ids.length > 0) {
    throw new InvalidCheckpointError("a root checkpoint cannot have ancestors");
  }
  if (value.parent_node_id !== null && lastAncestorNodeId !== value.parent_node_id) {
    throw new InvalidCheckpointError(
      "context_snapshot.ancestor_node_ids must end with parent_node_id",
    );
  }

  validateStatus(value.status);
  const contextSnapshot: ContextSnapshot = {
    ancestorNodeIds: [...context.ancestor_node_ids],
    branchNodeIds: [...context.branch_node_ids],
  };
  const runMetadata: RunMetadata | undefined = value.run_metadata
    ? {
        ...(value.run_metadata.agent === undefined ? {} : { agent: value.run_metadata.agent }),
        ...(value.run_metadata.run_id === undefined ? {} : { runId: value.run_metadata.run_id }),
        ...(value.run_metadata.duration_ms === undefined
          ? {}
          : { durationMs: value.run_metadata.duration_ms }),
        ...(value.run_metadata.metadata === undefined
          ? {}
          : { metadata: { ...value.run_metadata.metadata } }),
      }
    : undefined;
  const stateSnapshot: AdvisoryStateSnapshot | undefined = value.state_snapshot
    ? { advisory: true, data: { ...value.state_snapshot.data } }
    : undefined;
  return freezeCheckpoint({
    nodeId: value.node_id,
    parentNodeId: value.parent_node_id,
    status: value.status,
    userIntent: value.user_intent,
    storyContent: value.story_content,
    createdAt: value.created_at,
    contextSnapshot,
    runMetadata,
    stateSnapshot,
  });
}
