import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

import {
  DuplicateNodeError,
  InvalidCheckpointError,
  MissingParentError,
  NodeNotFoundError,
  PersistenceError,
  WorkspaceAlreadyExistsError,
  WorkspaceNotInitializedError,
} from "../core/errors.js";
import {
  checkpointToDocument,
  documentToCheckpoint,
  validateCheckpointDocument,
} from "../core/contract.js";
import {
  freezeCheckpoint,
  freezeRevision,
  validateAmendmentInput,
  validateStatus,
  type AmendmentInput,
  type NodeStatus,
  type StoryCheckpoint,
  type StoryRevision,
} from "../core/types.js";
import { type StoryStore } from "../core/store.js";

const FORMAT_VERSION = 1;

interface WorkspaceManifest {
  readonly format_version: typeof FORMAT_VERSION;
  readonly workspace_id: string;
  readonly node_ids: readonly string[];
  readonly current_node_id: string | null;
}

interface RevisionDocument {
  readonly node_id: string;
  readonly revision_number: number;
  readonly story_content: string;
  readonly user_intent: string;
  readonly created_at: string;
}

export class FileStoryStore implements StoryStore {
  readonly storyDirectory: string;
  readonly nodesDirectory: string;
  readonly revisionsDirectory: string;
  readonly manifestPath: string;
  private readonly nodes = new Map<string, StoryCheckpoint>();
  private readonly baseNodes = new Map<string, StoryCheckpoint>();
  private readonly revisions = new Map<string, StoryRevision[]>();
  private workspaceId: string;
  private currentNode: string | null;

  constructor(readonly workspaceRoot: string) {
    this.storyDirectory = join(workspaceRoot, ".story");
    this.nodesDirectory = join(this.storyDirectory, "nodes");
    this.revisionsDirectory = join(this.storyDirectory, "revisions");
    this.manifestPath = join(this.storyDirectory, "workspace.json");
    this.workspaceId = "";
    this.currentNode = null;
    this.load();
  }

  static initialize(
    workspaceRoot: string,
    workspaceId = `workspace-${randomUUID()}`,
  ): FileStoryStore {
    const storyDirectory = join(workspaceRoot, ".story");
    if (existsSync(storyDirectory) && readdirSync(storyDirectory).length > 0) {
      throw new WorkspaceAlreadyExistsError(`workspace already exists at ${storyDirectory}`);
    }
    mkdirSync(join(storyDirectory, "nodes"), { recursive: true });
    const manifest: WorkspaceManifest = {
      format_version: FORMAT_VERSION,
      workspace_id: workspaceId,
      node_ids: [],
      current_node_id: null,
    };
    try {
      atomicWrite(join(storyDirectory, "workspace.json"), jsonBytes(manifest));
    } catch {
      throw new PersistenceError(`could not initialize workspace at ${storyDirectory}`);
    }
    return new FileStoryStore(workspaceRoot);
  }

  static open(workspaceRoot: string): FileStoryStore {
    return new FileStoryStore(workspaceRoot);
  }

  save(checkpoint: StoryCheckpoint): void {
    if (this.nodes.has(checkpoint.nodeId)) {
      throw new DuplicateNodeError(`node ${checkpoint.nodeId} already exists`);
    }
    if (checkpoint.parentNodeId !== null && !this.nodes.has(checkpoint.parentNodeId)) {
      throw new MissingParentError(`parent node ${checkpoint.parentNodeId} does not exist`);
    }
    const document = checkpointToDocument(checkpoint);
    validateCheckpointDocument(document);
    const prospective = new Map(this.nodes);
    prospective.set(checkpoint.nodeId, checkpoint);
    validateGraph(prospective);
    const currentNode = checkpoint.nodeId;
    const manifest = this.createManifest(prospective, currentNode);
    const nodePath = join(this.nodesDirectory, `${checkpoint.nodeId}.json`);
    const nodeTemporary = stage(nodePath, jsonBytes(document));
    const manifestTemporary = stage(this.manifestPath, jsonBytes(manifest));
    let nodeCommitted = false;
    try {
      renameSync(nodeTemporary, nodePath);
      nodeCommitted = true;
      renameSync(manifestTemporary, this.manifestPath);
    } catch {
      if (nodeCommitted) {
        unlinkSync(nodePath);
      }
      throw new PersistenceError(`could not persist node ${checkpoint.nodeId}`);
    } finally {
      removeIfPresent(nodeTemporary);
      removeIfPresent(manifestTemporary);
    }
    this.nodes.set(checkpoint.nodeId, checkpoint);
    this.baseNodes.set(checkpoint.nodeId, checkpoint);
    this.revisions.set(checkpoint.nodeId, [revisionOne(checkpoint)]);
    this.currentNode = currentNode;
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
    const current = this.get(nodeId);
    const base = this.baseNodes.get(nodeId);
    if (base === undefined) throw new NodeNotFoundError(`node ${nodeId} does not exist`);
    validateStatus(status);
    const updated = freezeCheckpoint({ ...current, status });
    const updatedBase = freezeCheckpoint({ ...base, status });
    try {
      atomicWrite(
        join(this.nodesDirectory, `${nodeId}.json`),
        jsonBytes(checkpointToDocument(updatedBase)),
      );
    } catch {
      throw new PersistenceError(`could not update status for node ${nodeId}`);
    }
    this.nodes.set(nodeId, updated);
    this.baseNodes.set(nodeId, updatedBase);
    return updated;
  }

  amend(nodeId: string, input: AmendmentInput): StoryRevision {
    validateAmendmentInput(input);
    const current = this.get(nodeId);
    if ([...this.nodes.values()].some((node) => node.parentNodeId === nodeId)) {
      throw new InvalidCheckpointError(
        `cannot amend node ${nodeId}: descendant continuity retcon is unsupported`,
      );
    }
    const history = this.revisions.get(nodeId);
    if (history === undefined) throw new NodeNotFoundError(`node ${nodeId} does not exist`);
    const revision = freezeRevision({
      nodeId,
      revisionNumber: history.length + 1,
      storyContent: input.storyContent,
      userIntent: input.userIntent ?? current.userIntent,
      createdAt: input.createdAt ?? new Date().toISOString(),
    });
    const directory = join(this.revisionsDirectory, nodeId);
    mkdirSync(directory, { recursive: true });
    const revisionPath = join(directory, `${revision.revisionNumber}.json`);
    if (existsSync(revisionPath)) {
      throw new PersistenceError(
        `revision ${revision.revisionNumber} already exists for node ${nodeId}`,
      );
    }
    try {
      atomicWrite(revisionPath, jsonBytes(revisionToDocument(revision)));
    } catch (error) {
      if (error instanceof PersistenceError) throw error;
      throw new PersistenceError(`could not persist revision for node ${nodeId}`);
    }
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
    try {
      atomicWrite(this.manifestPath, jsonBytes(this.createManifest(this.nodes, nodeId)));
    } catch {
      throw new PersistenceError(`could not select node ${nodeId}`);
    }
    this.currentNode = nodeId;
  }

  currentNodeId(): string | null {
    return this.currentNode;
  }

  nodeBytes(nodeId: string): Buffer {
    return readFileSync(join(this.nodesDirectory, `${nodeId}.json`));
  }

  readManifest(): WorkspaceManifest {
    return JSON.parse(readFileSync(this.manifestPath, "utf8")) as WorkspaceManifest;
  }

  private load(): void {
    if (!existsSync(this.manifestPath)) {
      throw new WorkspaceNotInitializedError(
        `no Gitale workspace manifest at ${this.manifestPath}`,
      );
    }
    let manifest: WorkspaceManifest;
    try {
      manifest = JSON.parse(readFileSync(this.manifestPath, "utf8")) as WorkspaceManifest;
    } catch {
      throw new PersistenceError(`could not read ${this.manifestPath}`);
    }
    if (
      manifest.format_version !== FORMAT_VERSION ||
      typeof manifest.workspace_id !== "string" ||
      !Array.isArray(manifest.node_ids)
    ) {
      throw new PersistenceError("invalid Gitale workspace manifest");
    }
    if (!existsSync(this.nodesDirectory)) {
      throw new PersistenceError(`missing node directory at ${this.nodesDirectory}`);
    }
    const nodeFiles = readdirSync(this.nodesDirectory).filter((name) => name.endsWith(".json"));
    const nodeIds = nodeFiles.map((name) => name.slice(0, -5));
    if (
      new Set(nodeIds).size !== new Set(manifest.node_ids).size ||
      nodeIds.some((nodeId) => !manifest.node_ids.includes(nodeId))
    ) {
      throw new PersistenceError("workspace manifest and node files disagree");
    }
    const loaded = new Map<string, StoryCheckpoint>();
    try {
      for (const nodeFile of nodeFiles) {
        const value = JSON.parse(
          readFileSync(join(this.nodesDirectory, nodeFile), "utf8"),
        ) as unknown;
        const checkpoint = documentToCheckpoint(value);
        const expectedId = nodeFile.slice(0, -5);
        if (checkpoint.nodeId !== expectedId || loaded.has(checkpoint.nodeId)) {
          throw new InvalidCheckpointError(`node file ${nodeFile} has an invalid node ID`);
        }
        loaded.set(checkpoint.nodeId, checkpoint);
      }
      validateGraph(loaded);
      const baseLoaded = new Map(loaded);
      const revisions = this.loadRevisions(baseLoaded);
      for (const [nodeId, history] of revisions) {
        const current = history.at(-1);
        const base = loaded.get(nodeId);
        if (current === undefined || base === undefined) continue;
        loaded.set(
          nodeId,
          freezeCheckpoint({
            ...base,
            storyContent: current.storyContent,
            userIntent: current.userIntent,
          }),
        );
      }
      for (const [nodeId, checkpoint] of loaded) {
        this.nodes.set(nodeId, checkpoint);
      }
      for (const checkpoint of baseLoaded.values()) {
        this.baseNodes.set(checkpoint.nodeId, checkpoint);
      }
      for (const [nodeId, history] of revisions) this.revisions.set(nodeId, history);
    } catch (error) {
      if (error instanceof InvalidCheckpointError || error instanceof MissingParentError) {
        throw error;
      }
      throw new PersistenceError("could not load Gitale checkpoint nodes");
    }
    if (manifest.current_node_id !== null && !loaded.has(manifest.current_node_id)) {
      throw new PersistenceError("manifest current_node_id does not exist");
    }
    this.workspaceId = manifest.workspace_id;
    this.currentNode = manifest.current_node_id;
  }

  private loadRevisions(
    baseNodes: ReadonlyMap<string, StoryCheckpoint>,
  ): Map<string, StoryRevision[]> {
    const revisions = new Map<string, StoryRevision[]>();
    for (const checkpoint of baseNodes.values())
      revisions.set(checkpoint.nodeId, [revisionOne(checkpoint)]);
    if (!existsSync(this.revisionsDirectory)) return revisions;
    for (const nodeId of readdirSync(this.revisionsDirectory)) {
      const directory = join(this.revisionsDirectory, nodeId);
      if (!baseNodes.has(nodeId))
        throw new InvalidCheckpointError(`revision directory ${nodeId} has no node`);
      const files = readdirSync(directory).filter((name) => name.endsWith(".json"));
      const numbers = files.map((name) => Number(name.slice(0, -5))).sort((a, b) => a - b);
      if (numbers.some((number, index) => !Number.isInteger(number) || number !== index + 2)) {
        throw new InvalidCheckpointError(
          `revision files for node ${nodeId} must be contiguous from 2`,
        );
      }
      const history = revisions.get(nodeId) ?? [];
      for (const number of numbers) {
        const document = JSON.parse(
          readFileSync(join(directory, `${number}.json`), "utf8"),
        ) as unknown;
        const revision = documentToRevision(document);
        if (revision.nodeId !== nodeId || revision.revisionNumber !== number) {
          throw new InvalidCheckpointError(
            `revision file ${nodeId}/${number}.json does not match its identity`,
          );
        }
        history.push(revision);
      }
      revisions.set(nodeId, history);
    }
    return revisions;
  }

  private createManifest(
    nodes: ReadonlyMap<string, StoryCheckpoint>,
    currentNode: string | null,
  ): WorkspaceManifest {
    return {
      format_version: FORMAT_VERSION,
      workspace_id: this.workspaceId,
      node_ids: [...nodes.keys()].sort(),
      current_node_id: currentNode,
    };
  }
}

function validateGraph(nodes: ReadonlyMap<string, StoryCheckpoint>): void {
  for (const checkpoint of nodes.values()) {
    const seen = new Set<string>();
    let currentId: string | null = checkpoint.nodeId;
    while (currentId !== null) {
      if (seen.has(currentId)) {
        throw new InvalidCheckpointError(`cycle detected from node ${checkpoint.nodeId}`);
      }
      seen.add(currentId);
      const current = nodes.get(currentId);
      if (!current) {
        throw new MissingParentError(`parent node ${currentId} does not exist`);
      }
      currentId = current.parentNodeId;
    }
    const path = pathFor(checkpoint.nodeId, nodes);
    const expectedAncestors = path.slice(0, -1).map((node) => node.nodeId);
    const expectedBranch = path.map((node) => node.nodeId);
    if (
      JSON.stringify(checkpoint.contextSnapshot.ancestorNodeIds) !==
        JSON.stringify(expectedAncestors) ||
      JSON.stringify(checkpoint.contextSnapshot.branchNodeIds) !== JSON.stringify(expectedBranch)
    ) {
      throw new InvalidCheckpointError(
        `context snapshot for node ${checkpoint.nodeId} does not match its parent path`,
      );
    }
  }
}

function pathFor(nodeId: string, nodes: ReadonlyMap<string, StoryCheckpoint>): StoryCheckpoint[] {
  const reversed: StoryCheckpoint[] = [];
  let current = nodes.get(nodeId);
  while (current) {
    reversed.push(current);
    current = current.parentNodeId === null ? undefined : nodes.get(current.parentNodeId);
  }
  return reversed.reverse();
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

function revisionToDocument(revision: StoryRevision): RevisionDocument {
  return {
    node_id: revision.nodeId,
    revision_number: revision.revisionNumber,
    story_content: revision.storyContent,
    user_intent: revision.userIntent,
    created_at: revision.createdAt,
  };
}

function documentToRevision(value: unknown): StoryRevision {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new InvalidCheckpointError("invalid revision document");
  }
  const document = value as Partial<RevisionDocument>;
  const revisionNumber = document.revision_number;
  if (
    typeof document.node_id !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(document.node_id) ||
    typeof revisionNumber !== "number" ||
    !Number.isInteger(revisionNumber) ||
    revisionNumber < 2 ||
    typeof document.story_content !== "string" ||
    !document.story_content.trim() ||
    typeof document.user_intent !== "string" ||
    !document.user_intent.trim() ||
    typeof document.created_at !== "string" ||
    !document.created_at.trim()
  ) {
    throw new InvalidCheckpointError("invalid revision document");
  }
  return freezeRevision({
    nodeId: document.node_id,
    revisionNumber,
    storyContent: document.story_content,
    userIntent: document.user_intent,
    createdAt: document.created_at,
  });
}

function jsonBytes(value: unknown): Buffer {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function stage(path: string, data: Buffer): string {
  const temporary = `${path}.tmp-${randomUUID()}`;
  writeFileSync(temporary, data, { flag: "wx", mode: 0o600 });
  const descriptor = openSync(temporary, "r");
  try {
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
  return temporary;
}

function atomicWrite(path: string, data: Buffer): void {
  const temporary = stage(path, data);
  try {
    renameSync(temporary, path);
  } finally {
    removeIfPresent(temporary);
  }
}

function removeIfPresent(path: string): void {
  if (existsSync(path)) {
    unlinkSync(path);
  }
}
