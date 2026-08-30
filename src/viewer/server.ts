import { createServer, type Server, type ServerResponse } from "node:http";

import { NodeNotFoundError } from "../core/errors.js";
import {
  InvalidViewerRevisionError,
  ReadOnlyStoryViewer,
  ViewerRevisionNotFoundError,
} from "./read-model.js";
import { watchWorkspace } from "./workspace-watcher.js";

export interface ViewerServerOptions {
  readonly host?: string;
  readonly port?: number;
}

export function createViewerServer(
  workspaceRoot: string,
  options: ViewerServerOptions = {},
): Server {
  void options;
  ReadOnlyStoryViewer.open(workspaceRoot);
  const liveClients = new Set<ServerResponse>();
  const watcher = watchWorkspace(workspaceRoot, () => {
    for (const client of liveClients) {
      if (!client.writableEnded) {
        client.write("event: workspace-change\ndata: {}\n\n");
      }
    }
  });
  const server = createServer((request, response) => {
    if (request.method !== "GET") {
      response.writeHead(405, { Allow: "GET" });
      response.end("Gitale Viewer is read-only\n");
      return;
    }
    try {
      const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);
      if (url.pathname === "/events") {
        response.writeHead(200, {
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "Content-Type": "text/event-stream; charset=utf-8",
        });
        response.write(": Gitale Viewer connected\n\n");
        liveClients.add(response);
        response.once("close", () => liveClients.delete(response));
        return;
      }
      const selectedNodeId = url.searchParams.get("node") ?? undefined;
      const selectedRevision = parseRevision(url.searchParams.get("revision"));
      const viewer = ReadOnlyStoryViewer.open(workspaceRoot);
      const body = viewer.render(selectedNodeId, selectedRevision);
      const content = Buffer.from(body, "utf8");
      response.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Length": content.byteLength,
      });
      response.end(content);
    } catch (error) {
      const statusCode =
        error instanceof InvalidViewerRevisionError
          ? 400
          : error instanceof NodeNotFoundError || error instanceof ViewerRevisionNotFoundError
            ? 404
            : 500;
      response.writeHead(statusCode, { "Content-Type": "text/plain; charset=utf-8" });
      response.end(error instanceof Error ? error.message : String(error));
    }
  });
  server.once("close", () => {
    watcher.close();
    for (const client of liveClients) client.end();
    liveClients.clear();
  });
  return server;
}

function parseRevision(raw: string | null): number | undefined {
  if (raw === null) return undefined;
  if (!/^[1-9]\d*$/.test(raw)) {
    throw new InvalidViewerRevisionError(raw);
  }
  const revision = Number(raw);
  if (!Number.isSafeInteger(revision)) {
    throw new InvalidViewerRevisionError(raw);
  }
  return revision;
}
