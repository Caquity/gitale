# Gitale

Gitale 是一个本地的 AI 故事工作区。它会把你明确要求保存的故事结果整理成可回看的检查点，让你可以继续原路线，也可以从较早的节点另开一条路线；故事内容保存在自己的电脑上。

## 快速开始

### 1. 准备工作

你需要：

- 已安装 Node.js 20 或更高版本，以及随 Node.js 一起安装的 npm；没有的话请从 [Node.js 官网](https://nodejs.org/) 安装 LTS 版本。
- 已安装 Codex 或 Claude Code，并且已经在对应工具中配置好你自己的模型服务 key。
- 一个用来保存故事的文件夹。Gitale 不会替你配置模型 key，也不会把 key 保存到故事目录。

检查 Node.js 和 npm 是否可用：

```text
node --version
npm --version
```

### 2. 安装 Gitale

```text
npm install --global gitale
gitale --help
```

### 3. 安装 Agent Skill

在终端运行标准 Skills 安装命令：

```text
npx skills add Caquity/gitale
```

按照提示选择你使用的 Agent（Codex 或 Claude Code）和安装范围：

- 选择“用户级”适合你在自己的多个项目中使用；
- 选择“项目级”适合只在当前项目中使用。

安装完成后，关闭并重新打开 Codex 或 Claude Code，让它加载新 Skill。

```text
请先显式加载名为 gitale 的 Skill，并确认它已经可用。
  现在只做加载检查：不要执行 init、stop、checkpoint、fork 或 amend，也不要修改任何文件。
  加载成功后只回复“Gitale Skill 已加载，可用”。
  如果当前会话找不到该 Skill，请明确说明需要刷新或重启 Agent 会话，不要猜测、复制或替代 Skill 规则。

  Codex 先输入 $gitale 再粘贴正文；Claude Code 应先输入 /gitale 再粘贴正文。
```

## 初始化一个故事目录

在 Codex 或 Claude Code 中打开你准备保存故事的文件夹，然后明确输入：
Codex
```text
$gitale init  //codex
```

Claude Code
```text
/gitale init
```

初始化完成后，Agent 会返回一个类似 `http://127.0.0.1:3000` 的地址。把这个地址复制到浏览器即可查看故事树。

> 初始化不会生成故事，也不会修改已有节点。如果提示的端口已被占用，Gitale 会自动换用可用端口，请使用它实际返回的新地址。

## 让 Agent 明确保存故事



## 结束使用
Codex
```text
$gitale stop
```

Claude code
```text
/gitale stop
```


它只会停止 Gitale 自己记录的 Viewer，不会删除 `.story/`、故事节点、状态或修订历史。下次回到同一个故事目录，再次输入 `$gitale init` 即可继续查看。

## 遇到问题怎么办

先在故事目录运行：

```text
gitale doctor
```

