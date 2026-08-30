---
name: gitale
description: Initialize, reopen, or stop the current directory's Gitale workspace Viewer, or amend a confirmed leaf checkpoint.
disable-model-invocation: true
---

# Gitale bootstrap and amendment

This skill handles the user-invoked `$gitale init`, `$gitale stop`, and
`$gitale amend` flows. It does not capture ordinary conversations or write
story nodes implicitly.

For `$gitale init`:

1. Treat the current working directory as the Gitale Workspace root.
2. If the project dependencies or compiled bootstrap are missing, ask for the
   required install/build approval and run `npm ci` and `npm run build`.
3. Run `node scripts/gitale-init.mjs --workspace "$PWD" --project-root "$PWD"`.
4. Return the command result, including the Workspace path, whether it was
   created or reused, the node count, and the local Viewer URL. If Gitale had
   to change the preferred port because it was occupied, explain that plainly
   and report the new URL; the user does not need to configure a port.

For `$gitale stop`:

1. Treat the current working directory as the Gitale Workspace root.
2. If the project dependencies or compiled bootstrap are missing, ask for the
   required install/build approval and run `npm ci` and `npm run build`.
3. Run `node scripts/gitale-stop.mjs --workspace "$PWD"`.
4. Return whether the managed Viewer was stopped or was already absent, the
   persisted node count, and the Viewer PID/URL when one was recorded.

The bootstrap reuses a valid `.story/` workspace and a healthy Viewer session.
It fails closed for invalid existing data, preserves existing story nodes, and
creates no Story Checkpoint. Story generation and node writes remain explicit
Gitale operations after initialization.

The stop flow validates the persisted Workspace before closing the managed
Viewer. It never scans ports, terminates unrelated processes, or deletes story
nodes; it removes only an exited or stale `.story/viewer-session.json`.

Completion for init means the command returns a reachable loopback Viewer URL
and a validated Workspace result. Completion for stop means the managed Viewer
has exited or was already absent and the persisted Workspace remains readable.
Both are Agent workflows; the user does not need to type the underlying
bootstrap scripts in a terminal.

For `$gitale amend`:

1. Identify the exact target node and read its current effective artifact with
   `gitale show --workspace "$PWD" <node-id>`. Check its route as needed with
   `gitale lineage --workspace "$PWD" <node-id>`; amendment is available only
   for a leaf node.
2. Prepare a complete replacement story artifact, describe the intended
   change, and state any replacement intent. A proposal is not a save.
3. Show the proposed artifact to the creator and wait for an explicit request
   to apply it. Discussion, drafting, or a request for suggestions does not
   authorize a write.
4. After explicit confirmation, run
   `gitale amend --workspace "$PWD" <node-id> --content-file <story.md>` and
   add `--intent <direction>` only when the creator supplied a replacement
   intent. Report the resulting revision number and effective artifact.

The command preserves the original revision and appends a new complete
revision. It rejects nodes with descendants; the Agent does not perform
retcon, rewrite descendants, or add a browser write action. Completion means
the creator has explicitly confirmed the replacement and the command has
reported its result.
