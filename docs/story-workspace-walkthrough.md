# Story Workspace walkthrough

这是一条不需要模型 API Key 的本地演示。Agent 可以是 Codex、Claude Code，
或任何遵循共享 Skill 的入口；下面的正文是为了让演示可重复而固定的结果。

## 1. Bootstrap the Workspace from an Agent

在目标项目目录中明确调用 `$gitale init`。Agent 会创建或复用 `.story/`，启动
或复用只读 Viewer，并返回 Viewer URL。初始化会优先保持上次使用的本地端口；如果
端口被占用，Agent 会自动换用可用端口并把新地址报告给用户。初始化完成时节点数应为
0；该动作不会生成故事内容。

后续步骤中的底层 `./gitale` 命令用于固定演示和脚本化验收。

## 2. Generate and save the root

```bash
DEMO_DIR="$(mktemp -d)"
./gitale init --workspace "$DEMO_DIR"
./gitale checkpoint --workspace "$DEMO_DIR" --node-id n0 \
  --agent codex \
  --content "雨夜里，沈砚在渡口捡到一枚旧铜铃。" \
  --intent "建立铜铃与失踪父亲的悬念。"
./gitale status --workspace "$DEMO_DIR" n0 accepted
```

此时生成结果先以 `candidate` 保存，再明确变为 `accepted`。原始节点正文
和父节点引用不会被状态变更改写。

## 3. Continue the original route

```bash
./gitale checkpoint --workspace "$DEMO_DIR" --parent n0 --node-id n1-believe \
  --agent claude-code \
  --content "他把铜铃带回城里，寻找铸铃人的线索。" \
  --intent "相信铜铃指向父亲留下的线索。"
./gitale status --workspace "$DEMO_DIR" n1-believe accepted
```

## 4. Fork an alternative route from the earlier checkpoint

```bash
./gitale fork --workspace "$DEMO_DIR" --from n0 --node-id n1-doubt \
  --agent codex \
  --content "他把铜铃埋回渡口，转身调查守夜人赵衡。" \
  --intent "怀疑赵衡隐瞒了父亲失踪的真相。"
```

`n1-doubt` 默认是 `candidate`。它的上下文只有 `n0` 及其祖先；
`n1-believe` 的正文和意图不会进入这条路线。为了展示放弃状态：

```bash
./gitale status --workspace "$DEMO_DIR" n1-doubt abandoned
./gitale lineage --workspace "$DEMO_DIR" n1-doubt
```

## 5. Open the artifact

```bash
./gitale viewer --workspace "$DEMO_DIR" --port 3000
```

Viewer 中应能看到一个根节点和两个子路线，根节点与主线为 `accepted`，
怀疑路线为淡化的 `abandoned`。节点详情以故事正文为主，并显示创作意图、
父节点和可复制的 fork/continue 指令。关闭 Viewer 后重新执行同一命令，
内容从 `.story/` 恢复，不会重新生成故事。Viewer 已打开时，外部 checkpoint 或
status 写入会触发页面自动刷新，无需重启 Viewer。

## 6. Save and stop

如果 Viewer 是由 `$gitale init` 启动的，在 Agent 中输入 `$gitale stop`。Agent
会先重新读取并验证 `.story/`，确认已提交的节点可恢复，然后等待 Viewer 退出并清理
`.story/viewer-session.json`。故事节点、正文、意图和状态都会保留。

同样的底层验收命令是：

```bash
./gitale stop --workspace "$DEMO_DIR"
```

如果没有 Gitale 管理的 Viewer session，该命令是安全的 no-op；它不会扫描端口或终止
其他本地服务。
