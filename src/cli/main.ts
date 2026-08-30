import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { randomUUID } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";

import { checkpointToDocument } from "../core/contract.js";
import { StoryWorkspace } from "../core/workspace.js";
import { FileStoryStore } from "../adapters/file-story-store.js";
import {
  clearViewerSession,
  selectViewerPort,
  writeViewerSession,
  writeViewerSettings,
} from "../agent/viewer-session.js";
import { bootstrapGitale, stopGitale } from "../agent/bootstrap.js";
import { validateStatus, type NodeStatus } from "../core/types.js";
import { createViewerServer } from "../viewer/server.js";
import { diagnoseGitale, formatDoctorReport, type AgentKind } from "../doctor.js";

export interface GitaleResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

const workspaceOption = { type: "string" as const, default: "." };
const helpText = `Gitale - local Story Checkpoint Workspace

Commands:
  gitale init
  gitale stop
  gitale checkpoint
  gitale amend
  gitale fork
  gitale show
  gitale lineage
  gitale status
  gitale viewer
  gitale doctor

Gitale saves only explicit Story Workspace output; ordinary external Agent
conversation is not automatically captured.
`;

export function runGitale(argv: readonly string[]): GitaleResult {
  const [command, ...arguments_] = argv;
  try {
    switch (command) {
      case "help":
      case "--help":
        return successText(helpText);
      case "init":
        return init(arguments_);
      case "checkpoint":
        return checkpoint(arguments_);
      case "amend":
        return amend(arguments_);
      case "fork":
        return fork(arguments_);
      case "show":
        return show(arguments_);
      case "lineage":
        return lineage(arguments_);
      case "status":
        return status(arguments_);
      case "doctor":
        return doctor(arguments_);
      default:
        throw new Error(
          `unknown command ${command ?? ""}; use init, stop, checkpoint, amend, fork, show, lineage, status, viewer, or doctor`,
        );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { exitCode: 2, stdout: "", stderr: `gitale: ${message}\n` };
  }
}

export async function runGitaleAsync(argv: readonly string[]): Promise<GitaleResult> {
  const [command, ...arguments_] = argv;
  if (command === "init") {
    try {
      return await initAsync(arguments_);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { exitCode: 2, stdout: "", stderr: `gitale: ${message}\n` };
    }
  }
  if (command !== "stop") {
    return runGitale(argv);
  }
  try {
    return await stop(arguments_);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { exitCode: 2, stdout: "", stderr: `gitale: ${message}\n` };
  }
}

export async function main(argv: readonly string[] = process.argv.slice(2)): Promise<number> {
  if (argv[0] === "viewer") {
    if (argv[1] === "--help" || argv[1] === "help") {
      process.stdout.write(helpText);
      return 0;
    }
    return startViewer(argv.slice(1));
  }
  const result = await runGitaleAsync(argv);
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  return result.exitCode;
}

async function stop(argv: readonly string[]): Promise<GitaleResult> {
  const { values, positionals } = parseArgs({
    args: [...argv],
    options: { workspace: workspaceOption },
    allowPositionals: true,
    strict: true,
  });
  if (positionals.length > 0) {
    throw new Error("stop does not accept positional arguments");
  }
  return success(await stopGitale({ workspaceRoot: stringValue(values.workspace) }));
}

async function startViewer(argv: readonly string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: [...argv],
    options: {
      workspace: workspaceOption,
      host: { type: "string", default: "127.0.0.1" },
      port: { type: "string" },
    },
    allowPositionals: true,
    strict: true,
  });
  if (positionals.length > 0) {
    throw new Error("viewer does not accept positional arguments");
  }
  const host = stringValue(values.host);
  const requestedPort = values.port === undefined ? undefined : Number(stringValue(values.port));
  if (
    requestedPort !== undefined &&
    (!Number.isInteger(requestedPort) || requestedPort < 0 || requestedPort > 65535)
  ) {
    throw new Error("--port must be an integer between 0 and 65535");
  }
  const workspaceRoot = stringValue(values.workspace);
  const selection = await selectViewerPort(workspaceRoot, host, requestedPort);
  const server = createViewerServer(workspaceRoot, { host, port: selection.port });
  server.once("error", (error) => {
    process.stderr.write(`gitale viewer: ${error.message}\n`);
    process.exitCode = 1;
  });
  server.listen(selection.port, host, () => {
    const address = server.address();
    const boundPort =
      address !== null && typeof address === "object" ? address.port : selection.port;
    const url = `http://${host}:${boundPort}`;
    try {
      writeViewerSettings(workspaceRoot, boundPort);
      writeViewerSession(workspaceRoot, {
        pid: process.pid,
        host,
        port: boundPort,
        url,
        startedAt: new Date().toISOString(),
      });
    } catch (error) {
      server.close();
      process.stderr.write(
        `gitale viewer: could not record Viewer session: ${error instanceof Error ? error.message : String(error)}\n`,
      );
      process.exitCode = 1;
      return;
    }
    let shuttingDown = false;
    const shutdown = (exitCode: number) => {
      if (shuttingDown) return;
      shuttingDown = true;
      server.closeAllConnections();
      server.close((error) => {
        clearViewerSession(workspaceRoot, process.pid);
        if (error) {
          process.stderr.write(`gitale viewer: ${error.message}\n`);
          process.exitCode = 1;
          return;
        }
        process.exitCode = exitCode;
      });
    };
    process.once("SIGINT", () => shutdown(130));
    process.once("SIGTERM", () => shutdown(0));
    const fallbackMessage = selection.fallback
      ? ` (requested port ${selection.requestedPort} was occupied; using available port ${boundPort})`
      : "";
    process.stdout.write(`Gitale Viewer listening at ${url}${fallbackMessage}\n`);
  });
  return 0;
}

function init(argv: readonly string[]): GitaleResult {
  const { values, positionals } = parseArgs({
    args: [...argv],
    options: {
      workspace: workspaceOption,
      "workspace-id": { type: "string" },
    },
    allowPositionals: true,
    strict: true,
  });
  if (positionals.length > 0) {
    throw new Error("init does not accept positional arguments");
  }
  const workspaceRoot = stringValue(values.workspace);
  const workspaceId = optionalString(values["workspace-id"]);
  const store = FileStoryStore.initialize(workspaceRoot, workspaceId);
  return success(store.readManifest());
}

async function initAsync(argv: readonly string[]): Promise<GitaleResult> {
  const { values, positionals } = parseArgs({
    args: [...argv],
    options: {
      workspace: workspaceOption,
      "workspace-id": { type: "string" },
      host: { type: "string", default: "127.0.0.1" },
      port: { type: "string" },
    },
    allowPositionals: true,
    strict: true,
  });
  if (positionals.length > 0) {
    throw new Error("init does not accept positional arguments");
  }
  const port = values.port === undefined ? undefined : Number(stringValue(values.port));
  if (port !== undefined && (!Number.isInteger(port) || port < 0 || port > 65535)) {
    throw new Error("--port must be an integer between 0 and 65535");
  }
  const workspaceId = optionalString(values["workspace-id"]);
  return success(
    await bootstrapGitale({
      workspaceRoot: stringValue(values.workspace),
      ...(workspaceId === undefined ? {} : { workspaceId }),
      host: stringValue(values.host),
      ...(port === undefined ? {} : { port }),
    }),
  );
}

function checkpoint(argv: readonly string[]): GitaleResult {
  return saveCheckpoint(argv, "checkpoint");
}

function amend(argv: readonly string[]): GitaleResult {
  const { values, positionals } = parseArgs({
    args: [...argv],
    options: {
      workspace: workspaceOption,
      content: { type: "string" },
      "content-file": { type: "string" },
      intent: { type: "string" },
    },
    allowPositionals: true,
    strict: true,
  });
  if (positionals.length !== 1 || positionals[0] === undefined) {
    throw new Error("amend requires one node ID");
  }
  const content = optionalString(values.content);
  const contentFile = optionalString(values["content-file"]);
  if (content !== undefined && contentFile !== undefined) {
    throw new Error("amend uses either --content or --content-file, not both");
  }
  if (content === undefined && contentFile === undefined) {
    throw new Error("amend requires --content or --content-file");
  }
  const storyContent = contentFile === undefined ? content : readFileSync(contentFile, "utf8");
  if (storyContent === undefined) throw new Error("amend requires story content");
  const userIntent = optionalString(values.intent);
  const workspace = new StoryWorkspace(FileStoryStore.open(stringValue(values.workspace)));
  const result = workspace.amend(positionals[0], {
    storyContent,
    ...(userIntent === undefined ? {} : { userIntent }),
  });
  return success({
    checkpoint: checkpointToDocument(result.checkpoint),
    revision: {
      node_id: result.revision.nodeId,
      revision_number: result.revision.revisionNumber,
      story_content: result.revision.storyContent,
      user_intent: result.revision.userIntent,
      created_at: result.revision.createdAt,
    },
  });
}

function fork(argv: readonly string[]): GitaleResult {
  return saveCheckpoint(argv, "fork");
}

function saveCheckpoint(argv: readonly string[], mode: "checkpoint" | "fork"): GitaleResult {
  const { values, positionals } = parseArgs({
    args: [...argv],
    options: {
      workspace: workspaceOption,
      "node-id": { type: "string" },
      content: { type: "string" },
      "content-file": { type: "string" },
      intent: { type: "string" },
      parent: { type: "string" },
      from: { type: "string" },
      agent: { type: "string" },
      "run-id": { type: "string" },
      "duration-ms": { type: "string" },
      "metadata-json": { type: "string" },
      "state-json": { type: "string" },
      "created-at": { type: "string" },
    },
    allowPositionals: true,
    strict: true,
  });
  if (positionals.length > 0) {
    throw new Error("checkpoint does not accept positional arguments");
  }
  const workspace = new StoryWorkspace(FileStoryStore.open(stringValue(values.workspace)));
  const content = optionalString(values.content);
  const contentFile = optionalString(values["content-file"]);
  if (content !== undefined && contentFile !== undefined) {
    throw new Error("use either --content or --content-file, not both");
  }
  if (content === undefined && contentFile === undefined) {
    throw new Error("checkpoint requires --content or --content-file");
  }
  const storyContent = contentFile === undefined ? content : readFileSync(contentFile, "utf8");
  if (storyContent === undefined) {
    throw new Error("checkpoint requires story content");
  }
  const createdAt = optionalString(values["created-at"]);
  const runMetadata = runMetadataFromValues(values);
  const stateSnapshot = stateSnapshotFromValues(values);
  const input = {
    nodeId: optionalString(values["node-id"]) ?? `node-${randomUUID()}`,
    storyContent,
    userIntent: stringValue(values.intent),
    ...(createdAt === undefined ? {} : { createdAt }),
    ...(runMetadata.runMetadata === undefined ? {} : runMetadata),
    ...(stateSnapshot.stateSnapshot === undefined ? {} : stateSnapshot),
  };
  const parentNodeId = optionalString(values[mode === "fork" ? "from" : "parent"]);
  if (mode === "fork" && parentNodeId === undefined) {
    throw new Error("fork requires --from <node-id>");
  }
  if (mode === "fork" && optionalString(values.parent) !== undefined) {
    throw new Error("fork uses --from instead of --parent");
  }
  if (mode === "checkpoint" && optionalString(values.from) !== undefined) {
    throw new Error("checkpoint uses --parent instead of --from");
  }
  const checkpoint =
    parentNodeId === undefined
      ? workspace.createRoot(input)
      : workspace.continueFrom(parentNodeId, input);
  return success(checkpointToDocument(checkpoint));
}

function runMetadataFromValues(values: Record<string, string | boolean | undefined>): {
  runMetadata?: Record<string, unknown>;
} {
  const agent = optionalString(values.agent);
  const runId = optionalString(values["run-id"]);
  const durationRaw = optionalString(values["duration-ms"]);
  const metadataRaw = optionalString(values["metadata-json"]);
  if (
    agent === undefined &&
    runId === undefined &&
    durationRaw === undefined &&
    metadataRaw === undefined
  ) {
    return {};
  }
  const durationMs = durationRaw === undefined ? undefined : Number(durationRaw);
  if (durationMs !== undefined && (!Number.isInteger(durationMs) || durationMs < 0)) {
    throw new Error("--duration-ms must be a non-negative integer");
  }
  const metadata = metadataRaw === undefined ? undefined : parseJsonObject(metadataRaw, "metadata");
  return {
    runMetadata: {
      ...(agent === undefined ? {} : { agent }),
      ...(runId === undefined ? {} : { runId }),
      ...(durationMs === undefined ? {} : { durationMs }),
      ...(metadata === undefined ? {} : { metadata }),
    },
  };
}

function stateSnapshotFromValues(values: Record<string, string | boolean | undefined>): {
  stateSnapshot?: { advisory: true; data: Record<string, unknown> };
} {
  const raw = optionalString(values["state-json"]);
  if (raw === undefined) {
    return {};
  }
  const value = parseJsonObject(raw, "state");
  if ("advisory" in value || "data" in value) {
    if (value.advisory !== true || !isRecord(value.data)) {
      throw new Error("state JSON must contain advisory: true and an object data field");
    }
    return { stateSnapshot: { advisory: true, data: value.data } };
  }
  return { stateSnapshot: { advisory: true, data: value } };
}

function parseJsonObject(raw: string, label: string): Record<string, unknown> {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error(`--${label}-json must contain valid JSON`);
  }
  if (!isRecord(value)) {
    throw new Error(`--${label}-json must contain a JSON object`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function show(argv: readonly string[]): GitaleResult {
  const { values, positionals } = parseArgs({
    args: [...argv],
    options: { workspace: workspaceOption },
    allowPositionals: true,
    strict: true,
  });
  if (positionals.length !== 1) {
    throw new Error("show requires one node ID");
  }
  const nodeId = positionals[0];
  if (nodeId === undefined) {
    throw new Error("show requires one node ID");
  }
  const workspace = new StoryWorkspace(FileStoryStore.open(stringValue(values.workspace)));
  return success(checkpointToDocument(workspace.getNode(nodeId)));
}

function lineage(argv: readonly string[]): GitaleResult {
  const { values, positionals } = parseArgs({
    args: [...argv],
    options: { workspace: workspaceOption },
    allowPositionals: true,
    strict: true,
  });
  if (positionals.length !== 1) {
    throw new Error("lineage requires one node ID");
  }
  const nodeId = positionals[0];
  if (nodeId === undefined) {
    throw new Error("lineage requires one node ID");
  }
  const workspace = new StoryWorkspace(FileStoryStore.open(stringValue(values.workspace)));
  return success(workspace.lineage(nodeId).map((checkpoint) => checkpointToDocument(checkpoint)));
}

function status(argv: readonly string[]): GitaleResult {
  const { values, positionals } = parseArgs({
    args: [...argv],
    options: { workspace: workspaceOption },
    allowPositionals: true,
    strict: true,
  });
  if (positionals.length !== 2) {
    throw new Error("status requires a node ID and candidate, accepted, or abandoned");
  }
  const statusValue = positionals[1];
  const nodeId = positionals[0];
  if (nodeId === undefined || statusValue === undefined) {
    throw new Error("status requires a node ID and candidate, accepted, or abandoned");
  }
  validateStatus(statusValue);
  const workspace = new StoryWorkspace(FileStoryStore.open(stringValue(values.workspace)));
  return success(checkpointToDocument(workspace.updateStatus(nodeId, statusValue as NodeStatus)));
}

function doctor(argv: readonly string[]): GitaleResult {
  const { values, positionals } = parseArgs({
    args: [...argv],
    options: {
      workspace: workspaceOption,
      agent: { type: "string" },
      json: { type: "boolean", default: false },
    },
    allowPositionals: true,
    strict: true,
  });
  if (positionals.length > 0) {
    throw new Error("doctor does not accept positional arguments");
  }
  const agentValue = optionalString(values.agent);
  if (agentValue !== undefined && agentValue !== "codex" && agentValue !== "claude-code") {
    throw new Error("--agent must be codex or claude-code");
  }
  const report = diagnoseGitale({
    workspaceRoot: stringValue(values.workspace),
    ...(agentValue === undefined ? {} : { agent: agentValue as AgentKind }),
  });
  return {
    exitCode: report.ok ? 0 : 1,
    stdout:
      values.json === true ? `${JSON.stringify(report, null, 2)}\n` : formatDoctorReport(report),
    stderr: "",
  };
}

function stringValue(value: string | boolean | undefined): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("a required non-empty string option is missing");
  }
  return value;
}

function optionalString(value: string | boolean | undefined): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function success(value: unknown): GitaleResult {
  return {
    exitCode: 0,
    stdout: `${JSON.stringify(value, null, 2)}\n`,
    stderr: "",
  };
}

function successText(value: string): GitaleResult {
  return { exitCode: 0, stdout: value, stderr: "" };
}

if (isMainModule()) {
  process.exitCode = await main();
}

function isMainModule(): boolean {
  const entrypoint = process.argv[1];
  if (entrypoint === undefined) return false;
  try {
    return realpathSync(entrypoint) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return entrypoint === fileURLToPath(import.meta.url);
  }
}
