# Gitale Story Checkpoint contract

`.story/nodes/<node_id>.json` stores one immutable Story Checkpoint. The
contract is intentionally local and agent-agnostic so both Codex and Claude
Code can write the same artifact through `gitale`.

Required fields:

- `node_id`: non-empty path-safe identifier, unique within a workspace.
- `parent_node_id`: one existing checkpoint ID, or `null` for the root.
- `story_content`: non-empty generated story text.
- `user_intent`: non-empty explanation of the direction requested for this
  generation.
- `status`: exactly one of `candidate`, `accepted`, or `abandoned`; new nodes
  start as `candidate`.
- `created_at`: an ISO-8601 timestamp.
- `context_snapshot`: `ancestor_node_ids` and `branch_node_ids`, containing the
  root-to-current path by reference. Sibling and descendant nodes are never
  copied into it.

`run_metadata` is optional runtime information. `state_snapshot` is optional
agent assistance and, when present, must be encoded with `"advisory": true`;
it is not verified story canon.

## Valid example

```json
{
  "node_id": "n1-doubt",
  "parent_node_id": "n0",
  "status": "candidate",
  "user_intent": "怀疑赵衡隐瞒了父亲失踪的真相。",
  "story_content": "他把铜铃埋回渡口，转身调查守夜人赵衡。",
  "created_at": "2026-08-29T09:02:00Z",
  "context_snapshot": {
    "ancestor_node_ids": ["n0"],
    "branch_node_ids": ["n0", "n1-doubt"]
  },
  "run_metadata": {"agent": "codex", "run_id": "run-2"},
  "state_snapshot": {"advisory": true, "data": {"location": "渡口"}}
}
```

## Invalid examples

```json
{"node_id": "n1", "parent_node_id": "missing", "story_content": "孤儿节点"}
```

The parent is missing and required fields are absent. These are also invalid:

```json
{"status": "draft"}
{"status": "candidate", "story_content": ""}
{"state_snapshot": {"advisory": false, "data": {}}}
```

Invalid input is rejected before a node is added to the store.
