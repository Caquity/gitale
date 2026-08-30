import { FileStoryStore } from "../adapters/file-story-store.js";
import type { NodeStatus, StoryCheckpoint, StoryRevision } from "../core/types.js";
import { StoryWorkspace } from "../core/workspace.js";
import { renderViewerHtml } from "./render.js";

export class ViewerRevisionNotFoundError extends Error {
  constructor(nodeId: string, revisionNumber: number) {
    super(`revision ${revisionNumber} does not exist for node ${nodeId}`);
    this.name = "ViewerRevisionNotFoundError";
  }
}

export class InvalidViewerRevisionError extends Error {
  constructor(value: string) {
    super(`revision must be a positive integer, got ${value}`);
    this.name = "InvalidViewerRevisionError";
  }
}

export interface ViewerTreeNode {
  readonly nodeId: string;
  readonly title: string;
  readonly parentNodeId: string | null;
  readonly status: NodeStatus;
  readonly userIntent: string;
  readonly storyContent: string;
  readonly isCurrentPath: boolean;
  readonly isSelected: boolean;
}

export interface ViewerRevision extends StoryRevision {
  readonly isCurrent: boolean;
}

export interface ViewerSnapshot {
  readonly currentNodeId: string | null;
  readonly currentPath: readonly string[];
  readonly selectedNode: StoryCheckpoint | null;
  readonly selectedRevision: ViewerRevision | null;
  readonly revisionHistory: readonly ViewerRevision[];
  readonly tree: readonly ViewerTreeNode[];
  readonly availableInstruction: string | null;
}

export class ReadOnlyStoryViewer {
  constructor(private readonly workspace: StoryWorkspace) {}

  static open(workspaceRoot: string): ReadOnlyStoryViewer {
    return new ReadOnlyStoryViewer(new StoryWorkspace(FileStoryStore.open(workspaceRoot)));
  }

  snapshot(selectedNodeId?: string, revisionNumber?: number): ViewerSnapshot {
    const targetNodeId = selectedNodeId ?? this.workspace.currentNodeId();
    const context = targetNodeId === null ? null : this.workspace.resolveContext(targetNodeId);
    const currentPath = context?.lineage.map((node) => node.nodeId) ?? [];
    const currentPathIds = new Set(currentPath);
    const currentNode = context?.lineage.at(-1) ?? null;
    const revisions = currentNode === null ? [] : this.workspace.listRevisions(currentNode.nodeId);
    const currentRevisionNumber = revisions.at(-1)?.revisionNumber ?? 1;
    const revisionHistory = revisions.map((revision) =>
      toViewerRevision(revision, revision.revisionNumber === currentRevisionNumber),
    );
    const selectedRevision = selectRevision(targetNodeId, revisionHistory, revisionNumber);
    const selectedNode =
      currentNode === null || selectedRevision === null
        ? currentNode
        : projectNodeRevision(currentNode, selectedRevision);
    const tree = this.workspace.listNodes().map((node) => ({
      nodeId: node.nodeId,
      title: storyTitle(node.storyContent, node.nodeId),
      parentNodeId: node.parentNodeId,
      status: node.status,
      userIntent: node.userIntent,
      storyContent: node.storyContent,
      isCurrentPath: currentPathIds.has(node.nodeId),
      isSelected: node.nodeId === targetNodeId,
    }));
    return Object.freeze({
      currentNodeId: this.workspace.currentNodeId(),
      currentPath: Object.freeze(currentPath),
      selectedNode,
      selectedRevision,
      revisionHistory: Object.freeze(revisionHistory),
      tree: Object.freeze(tree),
      availableInstruction:
        selectedNode === null
          ? null
          : `gitale fork --from ${selectedNode.nodeId} --content-file <story.md> --intent <direction>`,
    });
  }

  render(selectedNodeId?: string, revisionNumber?: number): string {
    return renderViewerHtml(this.snapshot(selectedNodeId, revisionNumber));
  }
}

function storyTitle(storyContent: string, fallback: string): string {
  const lines = storyContent.split(/\r?\n/);
  const heading = lines.find((line) => /^#{1,6}\s+\S/.test(line.trim()));
  if (heading !== undefined) {
    return heading
      .trim()
      .replace(/^#{1,6}\s+/, "")
      .replace(/\s+#+$/, "")
      .trim();
  }
  return fallback;
}

function toViewerRevision(revision: StoryRevision, isCurrent: boolean): ViewerRevision {
  return Object.freeze({ ...revision, isCurrent });
}

function selectRevision(
  nodeId: string | null,
  history: readonly ViewerRevision[],
  revisionNumber: number | undefined,
): ViewerRevision | null {
  if (nodeId === null || history.length === 0) return null;
  const selectedNumber = revisionNumber ?? history.at(-1)?.revisionNumber;
  if (selectedNumber === undefined) return null;
  const selected = history.find((revision) => revision.revisionNumber === selectedNumber);
  if (selected === undefined) {
    throw new ViewerRevisionNotFoundError(nodeId, selectedNumber);
  }
  return selected;
}

function projectNodeRevision(node: StoryCheckpoint, revision: ViewerRevision): StoryCheckpoint {
  return Object.freeze({
    ...node,
    storyContent: revision.storyContent,
    userIntent: revision.userIntent,
  });
}
