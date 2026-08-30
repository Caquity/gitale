#!/usr/bin/env node

import { parseArgs } from "node:util";
import { stopGitale } from "../dist/agent/bootstrap.js";

const { values, positionals } = parseArgs({
  options: {
    workspace: { type: "string", default: process.cwd() },
  },
  allowPositionals: true,
  strict: true,
});

if (positionals.length > 0) {
  console.error("gitale stop: positional arguments are not supported");
  process.exitCode = 2;
} else {
  try {
    const result = await stopGitale({ workspaceRoot: values.workspace });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(`gitale stop: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 2;
  }
}
