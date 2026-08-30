import { watch, type FSWatcher } from "node:fs";
import { join, resolve } from "node:path";

export interface WorkspaceWatcher {
  close(): void;
}

export function watchWorkspace(workspaceRoot: string, onChange: () => void): WorkspaceWatcher {
  const storyDirectory = join(resolve(workspaceRoot), ".story");
  const nodesDirectory = join(storyDirectory, "nodes");
  let timer: ReturnType<typeof setTimeout> | undefined;
  let closed = false;

  const scheduleChange = () => {
    if (closed) return;
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      if (!closed) onChange();
    }, 25);
  };
  const storyWatcher = watch(storyDirectory, (_eventType, filename) => {
    const name = filename?.toString();
    if (name === undefined || name === "workspace.json") scheduleChange();
  });
  const nodesWatcher = watch(nodesDirectory, (_eventType, filename) => {
    const name = filename?.toString();
    if (name === undefined || name.endsWith(".json")) scheduleChange();
  });
  const watchers: readonly FSWatcher[] = [storyWatcher, nodesWatcher];

  return {
    close() {
      if (closed) return;
      closed = true;
      if (timer !== undefined) clearTimeout(timer);
      for (const watcher of watchers) watcher.close();
    },
  };
}
