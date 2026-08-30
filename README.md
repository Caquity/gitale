# Gitale

Gitale 是一个本地的 AI 故事工作区。它会把你明确要求保存的故事结果整理成可回看的检查点，让你可以继续原路线，也可以从较早的节点另开一条路线；故事内容保存在自己的电脑上。

[快速开始](#快速开始) · [工作方式](#工作方式) · [Roadmap](#roadmap) · [理论依据与边界](#理论依据与边界) · [参考文献](#参考文献)

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
$gitale init
```

Claude Code

```text
/gitale init
```

初始化完成后，Agent 会返回一个类似 `http://127.0.0.1:3000` 的地址。把这个地址复制到浏览器即可查看故事树。

> 初始化不会生成故事，也不会修改已有节点。如果提示的端口已被占用，Gitale 会自动换用可用端口，请使用它实际返回的新地址。

## 让 Agent 明确保存故事

Gitale 只保存你明确确认的结果。你可以让 Agent 先展示完整正文，再明确要求将其保存为 checkpoint；从已有节点探索新路线时使用 `fork`；仅修订没有后代的节点时使用 `amend`。Viewer 节点可点击切换，并会复制节点 ID，便于粘贴给 Agent 指定编辑目标。

常用命令：

```text
gitale checkpoint --node-id <新节点> --content-file <story.md> --intent <本轮意图>
gitale fork --from <已有节点> --node-id <新节点> --content-file <story.md> --intent <分支意图>
gitale amend <叶节点> --content-file <完整修订稿>
gitale restart
```

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

它只会停止 Gitale 自己记录的 Viewer，不会删除 `.story/`、故事节点、状态或修订历史。需要快速重新加载 Viewer 时，可显式使用 `$gitale restart` 或 `gitale restart`。下次回到同一个故事目录，再次输入 `$gitale init` 即可继续查看。

## 遇到问题怎么办

先在故事目录运行：

```text
gitale doctor
```

## 工作方式

- **显式保存**：普通对话、草稿和建议不会自动写入故事树；checkpoint、fork 和 amend 都必须由创作者明确确认。
- **路线隔离**：从已有节点 fork 会保留原路线和兄弟路线，不会覆盖父节点。
- **可追溯修订**：叶节点 amendment 追加 revision history；有后代的节点拒绝就地修订，避免悄悄改变既有路线的前提。
- **本地查看**：Viewer 只读，显示路线、正文、意图、状态和修订；它不调用模型或管理 API key。

## Roadmap

以下是条件性的发展方向，不是已交付能力；每一项都需要先证明用户需求，并通过 Gitale 自己的任务集、独立验收和人工审核。

1. **Narrative Contract / Narrative CI**：在 checkpoint、fork 和 amendment 边界检查人物、时间、事件和角色知识等可表达约束；不确定时交由创作者确认。
2. **可溯源 Story Material 与分层上下文**：当用户确实需要文章、剧本或设定资料时，保存来源、版本和人工裁决；按当前路线和有效 revision 装配上下文，而不是无差别拼接历史。
3. **SkillOpt-lite**：只优化一个可测的 Story Skill 或上下文模板，候选必须通过固定案例、独立 verifier、held-out 回归和人工发布，并能回滚。
4. **受限工作流搜索**：在可信 trace 积累后，比较 Extract、Verify、Revise、AskHuman、Commit 等受限流程，而不是让 Agent 任意生成和执行代码。
5. **RSI / 代码级自我修改**：不作为当前产品承诺。仓库尚未定义 RSI 的正式目标；若未来研究，必须使用隔离环境、外部评测、候选归档和人工批准。

完整的阶段门槛、指标、风险和证据映射见 [Roadmap](docs/ROADMAP.md) 与 [长期路线图研究](docs/research/gitale-roadmap-theoretical-foundations.md)。

## 理论依据与边界

Gitale 借鉴版本图、故事版本控制、混合主动创作、provenance 和信息可视化的实现思路：将明确保存的故事结果视为带父关系的版本化 Artifact，让创作者在树状历史中检查、分支和修订。它不因此宣称能自动提升故事质量、保证因果一致性、完成 Git 式语义合并，或完整重现一次外部 LLM 生成。

详细的“已实现机制—来源—限制”对照见 [当前实现的理论依据](docs/research/gitale-current-theoretical-foundations.md)。

## 参考文献

- Maddox et al., [Decibel: The Relational Dataset Branching System](https://doi.org/10.14778/2947618.2947619)：借鉴不可变版本、DAG、branch 和 lineage 的结构语义。
- Zünd et al., [Story Version Control and Graphical Visualization for Collaborative Story Authoring](https://doi.org/10.1145/3150165.3150175)：借鉴故事版本、创作意图与图形历史值得共同呈现的设计方向。
- Mishra et al., [WhatIF: Branched Narrative Fiction Visualization for Authoring Emergent Narratives using Large Language Models](https://doi.org/10.1145/3698061.3726933)：借鉴 LLM 辅助分支叙事中保留创作者控制的混合主动思路。
- Qin et al., [Counterfactual Story Reasoning and Generation](https://aclanthology.org/D19-1509/)：借鉴反事实重写的一致性难点，因而将当前 amendment 限定为叶节点。
- Moreau et al., [PROV-DM: The PROV Data Model](https://www.w3.org/TR/prov-dm/)：借鉴实体、活动、Agent 和派生关系来界定“局部可追溯”与“完整可重现”的区别。
- Shneiderman, [The Eyes Have It](https://doi.org/10.1109/VL.1996.545307)；Munzner, [A Nested Model for Visualization Design and Validation](https://doi.org/10.1109/TVCG.2009.111)：借鉴树概览、按需详情与任务级可用性验证的方法。
- Li et al., [SkillsBench](https://arxiv.org/abs/2602.12670)；Yang et al., [SkillOpt](https://arxiv.org/abs/2605.23904)：借鉴 Skill 必须通过配对评测、受限修改与回归门禁验证的长期演进方法。

上述论文和规范是设计依据，不是 Gitale 效果的直接证明；任何关于创作质量、一致性或 Skill 优化收益的结论都需要在 Gitale 自己的评测中重新验证。
