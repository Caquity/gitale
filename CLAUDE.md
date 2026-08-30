# Claude Code entry

For `$gitale init` or `$gitale stop`, follow `.agents/skills/gitale/SKILL.md` to
initialize/reuse the current Workspace, start the local Viewer, or stop its
managed Viewer. For Story Checkpoint generation, continuation, or fork work,
persist the result through `gitale`.
This project records explicit Gitale saves; ordinary conversation remains
outside the story tree.

For `$gitale amend`, follow the same skill: read the target's current artifact,
prepare a complete replacement, describe the intended change, and wait for the
creator's explicit confirmation before running `gitale amend`. Amendments are
for leaf nodes and preserve revision history; discussion or drafting alone
does not write the Workspace.
