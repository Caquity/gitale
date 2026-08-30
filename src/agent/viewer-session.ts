import { spawn } from "node:child_process";
import { createServer as createNetServer } from "node:net";
import {
  closeSync,
  existsSync,
  fsyncSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";

import { BootstrapError } from "../core/errors.js";

export interface ViewerSession {
  readonly pid: number;
  readonly host: string;
  readonly port: number;
  readonly url: string;
  readonly startedAt: string;
  readonly reused: boolean;
  readonly requestedPort: number;
  readonly portFallback: boolean;
}

export interface ViewerProcessInfo {
  readonly pid: number;
  readonly host: string;
  readonly port: number;
  readonly url: string;
  readonly startedAt: string;
}

export type ViewerStopReason = "stopped" | "stale-session" | "no-session";

export interface ViewerStopResult {
  readonly stopped: boolean;
  readonly reason: ViewerStopReason;
  readonly viewer: ViewerProcessInfo | null;
}

export interface ViewerSessionOptions {
  readonly workspaceRoot: string;
  readonly projectRoot: string;
  readonly host?: string;
  readonly port?: number;
}

export interface ViewerPortSelection {
  readonly requestedPort: number;
  readonly port: number;
  readonly fallback: boolean;
}

export const DEFAULT_VIEWER_PORT = 3000;

export async function ensureViewerSession(options: ViewerSessionOptions): Promise<ViewerSession> {
  const workspaceRoot = resolve(options.workspaceRoot);
  const projectRoot = resolve(options.projectRoot);
  const host = options.host ?? "127.0.0.1";
  const sessionPath = join(workspaceRoot, ".story", "viewer-session.json");
  const existing = readPersistedSession(sessionPath);
  if (existing && (await isHealthy(existing))) {
    return {
      ...existing,
      reused: true,
      requestedPort: existing.port,
      portFallback: false,
    };
  }
  if (existing) {
    removeIfPresent(sessionPath);
  }

  const cliPath = join(projectRoot, "dist", "cli", "main.js");
  if (!existsSync(cliPath)) {
    throw new BootstrapError(`Gitale build is missing at ${cliPath}; run npm run build first`);
  }
  const childArguments = [cliPath, "viewer", "--workspace", workspaceRoot, "--host", host];
  if (options.port !== undefined) {
    childArguments.push("--port", String(options.port));
  }
  const child = spawn(process.execPath, childArguments, {
    cwd: projectRoot,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (child.pid === undefined) {
    throw new BootstrapError("could not start the Gitale Viewer process");
  }
  const started = await waitForViewerUrl(child);
  const address = new URL(started.url);
  const persisted: ViewerProcessInfo = {
    pid: child.pid,
    host,
    port: Number(address.port),
    url: address.origin,
    startedAt: new Date().toISOString(),
  };
  writeViewerSession(workspaceRoot, persisted);
  child.stdout?.destroy();
  child.stderr?.destroy();
  child.unref();
  return {
    ...persisted,
    reused: false,
    requestedPort: started.requestedPort ?? persisted.port,
    portFallback: started.portFallback,
  };
}

export async function selectViewerPort(
  workspaceRoot: string,
  host: string,
  requestedPort?: number,
): Promise<ViewerPortSelection> {
  const preferredPort = requestedPort ?? readViewerSettings(workspaceRoot) ?? DEFAULT_VIEWER_PORT;
  validatePort(preferredPort);
  if (preferredPort === 0) {
    return { requestedPort: 0, port: 0, fallback: false };
  }
  if (await isPortAvailable(host, preferredPort)) {
    return { requestedPort: preferredPort, port: preferredPort, fallback: false };
  }
  return {
    requestedPort: preferredPort,
    port: await findAvailablePort(host),
    fallback: true,
  };
}

export function writeViewerSettings(workspaceRoot: string, preferredPort: number): void {
  validatePort(preferredPort);
  if (preferredPort === 0) {
    throw new BootstrapError("Viewer settings require a concrete port");
  }
  const settingsPath = join(resolve(workspaceRoot), ".story", "viewer-settings.json");
  atomicWrite(settingsPath, `${JSON.stringify({ preferred_port: preferredPort }, null, 2)}\n`);
}

export async function stopViewerSession(workspaceRoot: string): Promise<ViewerStopResult> {
  const resolvedWorkspaceRoot = resolve(workspaceRoot);
  const sessionPath = join(resolvedWorkspaceRoot, ".story", "viewer-session.json");
  if (!existsSync(sessionPath)) {
    return { stopped: false, reason: "no-session", viewer: null };
  }

  const session = readPersistedSession(sessionPath);
  if (!session || !isSafeViewerSession(session)) {
    throw new BootstrapError(
      `invalid Gitale Viewer session metadata at ${sessionPath}; refusing to stop`,
    );
  }
  if (session.pid === process.pid) {
    throw new BootstrapError("refusing to stop the current Gitale process");
  }

  const viewer = { ...session };
  if (!isProcessAlive(session.pid)) {
    clearViewerSession(resolvedWorkspaceRoot, session.pid);
    return { stopped: false, reason: "stale-session", viewer };
  }

  try {
    process.kill(session.pid, "SIGTERM");
  } catch (error) {
    if (!isNoSuchProcess(error)) {
      throw new BootstrapError(`could not stop Gitale Viewer process ${session.pid}`);
    }
    clearViewerSession(resolvedWorkspaceRoot, session.pid);
    return { stopped: false, reason: "stale-session", viewer };
  }

  if (!(await waitForProcessExit(session.pid))) {
    throw new BootstrapError(`Gitale Viewer process ${session.pid} did not exit after SIGTERM`);
  }
  clearViewerSession(resolvedWorkspaceRoot, session.pid);
  return { stopped: true, reason: "stopped", viewer };
}

export function writeViewerSession(workspaceRoot: string, session: ViewerProcessInfo): void {
  const sessionPath = join(resolve(workspaceRoot), ".story", "viewer-session.json");
  atomicWrite(sessionPath, `${JSON.stringify(session, null, 2)}\n`);
}

export function clearViewerSession(workspaceRoot: string, pid: number): void {
  const sessionPath = join(resolve(workspaceRoot), ".story", "viewer-session.json");
  const current = readPersistedSession(sessionPath);
  if (current?.pid === pid) {
    removeIfPresent(sessionPath);
  }
}

function readPersistedSession(path: string): ViewerProcessInfo | null {
  if (!existsSync(path)) {
    return null;
  }
  try {
    const value = JSON.parse(readFileSync(path, "utf8")) as Partial<ViewerProcessInfo>;
    if (
      typeof value.pid !== "number" ||
      typeof value.host !== "string" ||
      typeof value.port !== "number" ||
      typeof value.url !== "string" ||
      typeof value.startedAt !== "string"
    ) {
      return null;
    }
    return value as ViewerProcessInfo;
  } catch {
    return null;
  }
}

function readViewerSettings(workspaceRoot: string): number | null {
  const settingsPath = join(resolve(workspaceRoot), ".story", "viewer-settings.json");
  if (!existsSync(settingsPath)) return null;
  try {
    const value = JSON.parse(readFileSync(settingsPath, "utf8")) as {
      preferred_port?: unknown;
    };
    if (typeof value.preferred_port !== "number") return null;
    validatePort(value.preferred_port);
    return value.preferred_port === 0 ? null : value.preferred_port;
  } catch {
    return null;
  }
}

function validatePort(port: number): void {
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new BootstrapError("Viewer port must be an integer between 0 and 65535");
  }
}

async function isPortAvailable(host: string, port: number): Promise<boolean> {
  return new Promise((resolveAvailability, reject) => {
    const probe = createNetServer();
    probe.once("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "EADDRINUSE") {
        resolveAvailability(false);
      } else {
        reject(error);
      }
    });
    probe.listen(port, host, () => {
      probe.close((error) => {
        if (error) reject(error);
        else resolveAvailability(true);
      });
    });
  });
}

async function findAvailablePort(host: string): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const probe = createNetServer();
    probe.once("error", reject);
    probe.listen(0, host, () => {
      const address = probe.address();
      if (address === null || typeof address === "string") {
        probe.close();
        reject(new BootstrapError("could not determine an available Viewer port"));
        return;
      }
      const port = address.port;
      probe.close((error) => {
        if (error) reject(error);
        else resolvePort(port);
      });
    });
  });
}

async function isHealthy(session: ViewerProcessInfo): Promise<boolean> {
  try {
    if (!isSafeViewerSession(session)) return false;
    process.kill(session.pid, 0);
    const response = await fetch(session.url);
    return response.ok;
  } catch {
    return false;
  }
}

function isSafeViewerSession(session: ViewerProcessInfo): boolean {
  try {
    const url = new URL(session.url);
    return (
      session.host === "127.0.0.1" &&
      session.port > 0 &&
      session.port <= 65535 &&
      url.protocol === "http:" &&
      url.hostname === "127.0.0.1" &&
      Number(url.port) === session.port &&
      url.pathname === "/" &&
      url.search === "" &&
      url.hash === ""
    );
  } catch {
    return false;
  }
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (isNoSuchProcess(error)) return false;
    throw error;
  }
}

function isNoSuchProcess(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ESRCH";
}

async function waitForProcessExit(pid: number, timeoutMs = 5000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline && isProcessAlive(pid)) {
    await new Promise<void>((resolvePromise) => setTimeout(resolvePromise, 50));
  }
  return !isProcessAlive(pid);
}

interface StartedViewer {
  readonly url: string;
  readonly requestedPort: number | null;
  readonly portFallback: boolean;
}

async function waitForViewerUrl(child: ReturnType<typeof spawn>): Promise<StartedViewer> {
  return new Promise((resolveUrl, reject) => {
    let output = "";
    let errorOutput = "";
    let settled = false;
    const timer = setTimeout(() => {
      finishReject(
        new BootstrapError(
          `Gitale Viewer did not start within the timeout${errorOutput ? `: ${errorOutput}` : ""}`,
        ),
      );
    }, 5000);

    const finishResolve = (url: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const fallback = output.match(/requested port (\d+) was occupied; using available port \d+/);
      resolveUrl({
        url,
        requestedPort: fallback?.[1] === undefined ? null : Number(fallback[1]),
        portFallback: fallback !== null,
      });
    };
    const finishReject = (error: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    };
    child.stdout?.on("data", (chunk: Buffer) => {
      output += chunk.toString();
      const lineEnd = output.indexOf("\n");
      const firstLine = lineEnd === -1 ? output : output.slice(0, lineEnd);
      const match = lineEnd === -1 ? null : firstLine.match(/http:\/\/127\.0\.0\.1:\d+/);
      if (match?.[0]) finishResolve(match[0]);
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      errorOutput += chunk.toString();
    });
    child.once("error", (error) => finishReject(error));
    child.once("exit", (code) => {
      if (code !== null && code !== 0) {
        finishReject(new BootstrapError(`Gitale Viewer exited with code ${code}`));
      }
    });
  });
}

function atomicWrite(path: string, contents: string): void {
  const temporary = `${path}.tmp-${randomUUID()}`;
  writeFileSync(temporary, contents, { flag: "wx", mode: 0o600 });
  const descriptor = openSync(temporary, "r");
  try {
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
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
