---
name: gitale
description: 使用已安装的 Gitale 命令管理明确保存的本地故事工作区、分支、修订和只读 Viewer。
disable-model-invocation: true
---

# Gitale 工作流

这是一份用户主动调用的 Skill。只有创作者明确输入 `$gitale ...` 时，才进入下面的工作流。所有命令都必须调用已经安装的 `gitale` 命令；Gitale 命令默认使用当前工作目录，也可以通过 `--workspace <目标工作区>` 指定另一个目录。

普通对话、故事讨论、草稿、建议和还没有得到确认的生成结果，都不会被 Gitale 自动捕获、保存或修改。每次写入都必须有清楚的保存意图，并在完成后报告实际结果。

## `$gitale init`

这是有副作用的操作，只把创作者明确输入 `$gitale init` 视为执行确认。先确认当前目录就是目标工作区；目标不明确时先询问，不要猜测。

目标明确后运行：

```text
gitale init [--workspace <目标工作区>]
```

`init` 会创建或复用目标工作区，启动或复用该工作区管理的本地 Viewer。它不会创建 Story Checkpoint，也不会因为初始化而保存故事内容。向创作者报告工作区、节点数量以及 Viewer 地址；如果端口发生调整，也报告最终地址。

## `$gitale stop`

这是有副作用的操作，只把创作者明确输入 `$gitale stop` 视为执行确认。目标工作区明确后运行：

```text
gitale stop [--workspace <目标工作区>]
```

`stop` 只停止该工作区记录的 Gitale Viewer，清理对应的会话记录，并保留全部故事节点、正文、意图和修订历史。没有受 Gitale 管理的 Viewer 时安全结束。不要根据端口猜测进程，也不要停止其他程序。向创作者报告 Viewer 是否停止以及故事节点数量。

## 显式保存 Story Checkpoint

生成或讨论故事之后，先让创作者看到完整正文、保存意图和父节点选择。只有创作者明确要求保存为 checkpoint，或明确确认当前完整结果可以保存时，才调用 `gitale checkpoint`。单纯要求继续写、讨论方案或请求草稿，都不构成保存确认。

```text
gitale checkpoint --workspace <目标工作区> --node-id <新节点> --content-file <完整正文文件> --intent <用户意图> [--parent <父节点>]
```

根节点省略 `--parent`；从当前路线继续时使用明确的父节点。保存后报告节点编号、父节点和结果状态。

## 显式保存 Story Branch

分支必须从创作者选定的已有节点开始。先说明这是保留原路线的新路线，再展示要保存的完整正文和分支意图；只有创作者明确确认保存分支时，才调用：

```text
gitale fork --workspace <目标工作区> --from <已有节点> --node-id <新节点> --content-file <完整正文文件> --intent <分支意图>
```

`fork` 不改写父节点或其他路线。保存后报告分支的起点和新节点。

## `$gitale amend`

`$gitale amend` 只开启一次受控修订流程，不能把“讨论修订”当成写入确认：

1. 确认目标节点，并运行 `gitale show --workspace <目标工作区> <目标节点>` 读取当前有效正文；需要确认路线时运行 `gitale lineage --workspace <目标工作区> <目标节点>`。只有叶节点可以修订。
2. 准备完整的替换正文，说明修改意图和会被替换的内容；不得只提交片段或补丁。
3. 把完整替换正文展示给创作者，等待创作者明确说要应用或保存这份修订稿。创作者没有明确确认时，不运行写入命令。
4. 得到确认后运行：

   ```text
   gitale amend --workspace <目标工作区> <目标节点> --content-file <完整正文文件> [--intent <替换意图>]
   ```

   只在创作者提供了替换意图时传入 `--intent`。修订会保留原修订历史并追加新修订；有后代的节点不能修订，也不能借此重写后代路线。完成后报告修订编号和当前有效正文。

## Viewer

`$gitale init` 返回的地址是本地 Viewer 地址。把它交给创作者在浏览器中打开即可查看节点树、路线、正文、意图和修订信息。Viewer 是本地且只读的，浏览器中的查看不会写入故事。

如果创作者明确要求以前台方式查看，也只能调用已安装的命令：

```text
gitale viewer [--workspace <目标工作区>]
```

需要结束由 `init` 管理的 Viewer 时使用 `$gitale stop`；不要用浏览器操作代替保存命令。

## 完成标准

- `init` 和 `stop` 只有在对应的 `$gitale` 明确调用后执行。
- checkpoint、fork 和 amend 只有在创作者明确确认保存后写入。
- 每次写入都使用已安装的 `gitale` 命令，并报告命令结果。
- 普通对话和未确认草稿留在对话中，不出现在故事树里。
