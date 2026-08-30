import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

import { FileStoryStore } from "../adapters/file-story-store.js";
import {
  ensureViewerSession,
  stopViewerSession,
  type ViewerProcessInfo,
  type ViewerSession,
  type ViewerStopReason,
} from "./viewer-session.js";

export interface BootstrapOptions {
  readonly workspaceRoot?: string;
  readonly projectRoot?: string;
  readonly host?: string;
  readonly port?: number;
}

export interface BootstrapResult {
  readonly workspaceRoot: string;
  readonly created: boolean;
  readonly nodeCount: number;
  readonly viewer: ViewerSession;
}

export interface StopOptions {
  readonly workspaceRoot?: string;
}

export interface StopResult {
  readonly workspaceRoot: string;
  readonly persisted: true;
  readonly nodeCount: number;
  readonly stopped: boolean;
  readonly reason: ViewerStopReason;
  readonly viewer: ViewerProcessInfo | null;
}

export async function bootstrapGitale(options: BootstrapOptions = {}): Promise<BootstrapResult> {
  const workspaceRoot = resolve(options.workspaceRoot ?? process.cwd());
  const projectRoot = resolve(options.projectRoot ?? process.cwd());
  const manifestPath = join(workspaceRoot, ".story", "workspace.json");
  const created = !existsSync(manifestPath);
  const store = created
    ? FileStoryStore.initialize(workspaceRoot)
    : FileStoryStore.open(workspaceRoot);
  const viewer = await ensureViewerSession({
    workspaceRoot,
    projectRoot,
    ...(options.host === undefined ? {} : { host: options.host }),
    ...(options.port === undefined ? {} : { port: options.port }),
  });
  return {
    workspaceRoot,
    created,
    nodeCount: store.list().length,
    viewer,
  };
}

export async function stopGitale(options: StopOptions = {}): Promise<StopResult> {
  const workspaceRoot = resolve(options.workspaceRoot ?? process.cwd());
  const store = FileStoryStore.open(workspaceRoot);
  const stoppedViewer = await stopViewerSession(workspaceRoot);
  return {
    workspaceRoot,
    persisted: true,
    nodeCount: store.list().length,
    stopped: stoppedViewer.stopped,
    reason: stoppedViewer.reason,
    viewer: stoppedViewer.viewer,
  };
}
