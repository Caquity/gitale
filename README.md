# Gitale

Gitale 是一个本地的 AI 故事工作区。它会把你明确要求保存的故事结果整理成可回看的检查点，让你可以继续原路线，也可以从较早的节点另开一条路线；故事内容保存在自己的电脑上，Viewer 只负责查看。

## 快速开始

> 本节面向 Gitale v0.2 分发版用户。它要求 `gitale` 已发布到 npm，且 GitHub 仓库中已经提供 `Caquity/gitale` Skill；如果你正在源码仓库中开发，请先完成 `gitale-distribution` change，源码目录里的 `./gitale` 不是普通用户的安装方式。

### 1. 先确认准备工作

你需要：

- 已安装 Node.js 20 或更高版本，以及随 Node.js 一起安装的 npm；没有的话请从 [Node.js 官网](https://nodejs.org/) 安装 LTS 版本。
- 已安装 Codex 或 Claude Code，并且已经在对应工具中配置好你自己的模型服务 key。
- 一个用来保存故事的文件夹。Gitale 不会替你配置模型 key，也不会把 key 保存到故事目录。

在终端中检查 Node.js 和 npm 是否可用：

```text
node --version
npm --version
```

看到版本号即可继续。Windows 用户可以在 PowerShell 中运行同样的命令；macOS/Linux 用户可以在“终端”中运行。

### 2. 安装 Gitale

在终端运行：

```text
npm install --global gitale
gitale --help
```

第二条命令能显示 Gitale 帮助，就说明命令已经安装成功。安装过程不会启动 Viewer、修改 Agent 配置或自动安装 Skill。

### 3. 安装 Agent Skill

在终端运行标准 Skills 安装命令：

```text
npx skills add Caquity/gitale
```

按照提示选择你使用的 Agent（Codex 或 Claude Code）和安装范围：

- 选择“用户级”适合你在自己的多个项目中使用；
- 选择“项目级”适合只在当前项目中使用。

安装完成后，关闭并重新打开 Codex 或 Claude Code，让它加载新 Skill。Skill 只是告诉 Agent 什么时候调用 Gitale；模型 key 仍由 Codex/Claude Code 自己管理。

如果你已经安装了 GitHub CLI，也可以明确指定 Agent 和用户级安装范围：

```text
gh skill install Caquity/gitale gitale --agent codex --scope user
gh skill install Caquity/gitale gitale --agent claude-code --scope user
```

只运行与你实际使用的 Agent 对应的那一条即可。

### 4. 初始化一个故事目录

在 Codex 或 Claude Code 中打开你准备保存故事的文件夹，然后明确输入：

```text
$gitale init
```

Gitale 会在该文件夹中创建或复用 `.story/`，启动一个只在本机可访问的 Viewer，并返回一个类似 `http://127.0.0.1:3000` 的地址。把这个地址复制到浏览器即可查看故事树。

初始化不会生成故事，也不会修改已有节点。如果提示的端口已被占用，Gitale 会自动换用可用端口，请使用它实际返回的新地址。

### 5. 让 Agent 明确保存故事

正常聊天不会自动写入故事树。完成一段创作后，请明确告诉 Agent 你要保存，例如：

```text
请把刚才的故事结果显式保存为 Gitale checkpoint，并记录本轮创作意图：让铜铃指向失踪父亲留下的线索。
```

之后你可以这样说：

- “请从刚才的 checkpoint 继续原来的路线。”
- “请从节点 `<节点 ID>` fork 一条新路线，方向是：怀疑守夜人隐瞒了真相。”
- “请把这个节点标记为 accepted。”

Agent 会通过已安装的 `gitale` 命令保存或读取内容。新节点默认是 `candidate`；只有你明确选择后才会变为 `accepted` 或 `abandoned`。Viewer 中的继续/fork 提示也可以直接复制给 Agent。

### 6. 结束使用

故事内容已经保存后，在 Agent 中输入：

```text
$gitale stop
```

它只会停止 Gitale 自己记录的 Viewer，不会删除 `.story/`、故事节点、状态或修订历史。下次回到同一个故事目录，再次输入 `$gitale init` 即可继续查看。

## 遇到问题怎么办

先在故事目录运行：

```text
gitale doctor
```

它会检查 Node.js、Gitale 命令、Skill、Workspace 和 Viewer 条件，并告诉你下一步怎么处理。常见情况如下：

- **提示找不到 `gitale`**：关闭并重新打开终端；仍然不行时可先用 `npx gitale --help` 验证 npm 是否可用。
- **Agent 不认识 `$gitale`**：重新执行 `npx skills add Caquity/gitale`，确认选择了正确的 Agent 和 scope，然后重启 Agent。
- **Node.js 版本太旧**：从 [Node.js 官网](https://nodejs.org/) 安装 20 或更高版本，再重新打开终端。
- **Viewer 打不开**：使用 `$gitale init` 返回的完整地址，不要自行猜端口；随后运行 `gitale doctor` 查看具体失败项。
- **已有故事无法打开**：不要删除 `.story/`。先保留目录原样，运行 `gitale doctor`，再根据诊断结果修复或寻求帮助。

## 重要说明

- Gitale 只保存你明确要求保存的 Story Checkpoint；普通对话、草稿和讨论不会被自动捕获。
- Gitale 不读取、生成、托管或转发模型 API key；模型服务仍由 Codex 或 Claude Code 负责。
- Viewer 是本地只读页面，不会在浏览器中改写故事；故事文件和 Viewer session 都位于目标目录的 `.story/` 中。
- 安装 Gitale 不会通过 `postinstall` 静默修改用户配置、复制 Skill 或启动后台进程。
