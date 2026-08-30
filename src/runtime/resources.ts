import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const moduleDirectory = dirname(fileURLToPath(import.meta.url));

/** Absolute root of the installed Gitale package (or the repository in source tests). */
export const packageRoot = resolve(moduleDirectory, "..", "..");

export function packageResource(...segments: string[]): string {
  return join(packageRoot, ...segments);
}

export function packageCliPath(): string {
  return packageResource("dist", "cli", "main.js");
}
