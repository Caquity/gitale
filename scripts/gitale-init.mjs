#!/usr/bin/env node

import { parseArgs } from "node:util";
import { bootstrapGitale } from "../dist/agent/bootstrap.js";

const { values, positionals } = parseArgs({
  options: {
    workspace: { type: "string", default: process.cwd() },
    "project-root": { type: "string", default: process.cwd() },
    host: { type: "string", default: "127.0.0.1" },
    port: { type: "string" },
  },
  allowPositionals: true,
  strict: true,
});

if (positionals.length > 0) {
  console.error("gitale init: positional arguments are not supported");
  process.exitCode = 2;
} else {
  try {
    const options = {
      workspaceRoot: values.workspace,
      projectRoot: values["project-root"],
      host: values.host,
    };
    if (values.port !== undefined) options.port = Number(values.port);
    const result = await bootstrapGitale(options);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(`gitale init: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 2;
  }
}
