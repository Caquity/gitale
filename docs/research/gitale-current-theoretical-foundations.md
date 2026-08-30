# Gitale 当前实现的理论依据

检索日期：2026-08-31
范围：只评估当前 Gitale（故事检查点、分支、叶节点修订、只读 Viewer 和 Agent 适配层）已经实现或明确承诺的机制。SkillOpt、RSI、Story Bible、RAG、因果验证器和自动合并不属于当前实现，因此不把它们当成现有能力的证据。

本文件不是对已有 `LITERATURE_AGENT_ENGINEERING.md`、`LITERATURE_STORY_CONTROL.md` 和 `STORY_BRANCHING_LANDSCAPE.md` 的重复综述，而是把少数最直接的论文/规范压缩成“实现—来源—边界”对照。来源中的实验结果不等于 Gitale 的实验结果；“映射建议”是本项目的工程推断。

## 结论先行

Gitale 目前可以有依据地表述为：

> 一个由外部 Agent 负责生成、由本地工作区保存显式故事检查点的版本化创作工具。检查点以带父节点的有向无环关系形成可分支历史；叶节点修订以追加 revision 保留旧版本；只读 Viewer 用树和详情视图检查路线、正文、意图、状态和修订历史。

这一定义有较强的结构性先例：数据版本系统明确使用不可变版本 ID、父关系、DAG 和从历史版本建立分支；故事版本控制研究把故事元素、版本和作者意图放入可视化历史；交互叙事研究则把 LLM 辅助、分支图和人类控制作为混合主动工作流。

目前不能据此宣称：

- Gitale 已经证明能够提高创造力、故事质量或长期一致性；
- `fork` 自动完成了反事实因果推理；
- `amend` 会自动修复后代路线；
- `.story/` 已经是符合 W3C PROV 的完整 provenance 图，或足以重现一次 LLM 生成。

## 当前实现事实

以下是截至本报告日期从代码和既有契约确认的事实：

| 已实现机制                       | 代码/契约位置                                                                                                                                        | 可观测行为                                                                              |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 外部 Agent 生成后保存 checkpoint | [`src/core/agent.ts`](../../src/core/agent.ts)、[`skills/gitale/SKILL.md`](../../skills/gitale/SKILL.md)                                             | `StoryAgent` 提供生成结果；Skill 要求保存动作保持显式，不把普通聊天宣称为自动保存       |
| 有父节点的分支历史               | [`src/core/workspace.ts`](../../src/core/workspace.ts)、[`src/adapters/file-story-store.ts`](../../src/adapters/file-story-store.ts)                 | 节点 ID、父节点、路径快照；拒绝缺失父节点和环；`fork` 不改写父节点或兄弟节点            |
| 叶节点 amendment                 | [`src/adapters/file-story-store.ts`](../../src/adapters/file-story-store.ts)、[`docs/story-checkpoint-contract.md`](../story-checkpoint-contract.md) | 原节点文件保留；新 revision 追加到 `.story/revisions/<node-id>/`；有后代的节点拒绝修订  |
| 只读路线/详情/修订 Viewer        | [`src/viewer/read-model.ts`](../../src/viewer/read-model.ts)、[`src/viewer/render.ts`](../../src/viewer/render.ts)                                   | 树、正文、意图、父节点、状态、当前 revision 和历史 revision 可查看；Viewer 没有写入接口 |
| 受限运行元数据                   | [`src/core/types.ts`](../../src/core/types.ts)                                                                                                       | 可选记录 Agent、run ID、耗时及自定义元数据；并非完整生成环境记录                        |

需要注意一个术语边界：Gitale 的“不可变”主要指 checkpoint 的正文、意图和父关系，以及每个 revision 文件；状态是允许更新的工作流属性，叶节点的当前内容通过追加 revision 投影得到。因此不能把整个 `.story/nodes/<id>.json` 文件描述为所有字段永远不可变。

## 直接相关的理论与实现映射

### 1. 数据版本控制：不可变版本、DAG、checkpoint 和 branch

**Maddox et al. (2016), “Decibel: The Relational Dataset Branching System”, Proceedings of the VLDB Endowment 9(9), 624–635.** [论文全文（PMC）](https://pmc.ncbi.nlm.nih.gov/articles/PMC5278666/) · [DOI 10.14778/2947618.2947619](https://doi.org/10.14778/2947618.2947619)

**来源明确提出的内容：**Decibel 把带 ID 的 version 定义为时间点快照；对 version 的更新概念上产生新的 version ID；版本关系保存为 DAG；任意已有 version 都可以作为新 branch 的起点，branch 的 lineage 是从叶节点回到根的版本路径。论文还把显式 commit 描述为可检查和可 checkout 的逻辑 checkpoint。

**与 Gitale 的有限关联：**这与 `node_id`、`parent_node_id`、`context_snapshot`、`fork`、`lineage` 和“兄弟路线互不污染”是一一对应的结构类比。Gitale 的 `.story/nodes/*.json` 是故事快照，`context_snapshot` 是当前节点的根到节点路径，创建 child 是增加版本图节点而不是重写父节点。它为“把故事当成可回看、可分支的版本化 Artifact”提供了比 Git 隐喻更明确的形式化先例。

**限制：**Decibel 管理的是关系数据，研究重点是存储引擎、查询和并发，不是故事语义或 Agent 生成。它支持合并、事务和并发隔离，而 Gitale 当前不支持自动 merge，也没有把“两个故事分支如何语义合并”形式化。因此这里只能声称采用相同的版本图语义，不能声称获得 Decibel 的性能、事务或协作结论。

**采用建议：**对外说明时使用“结构上借鉴不可变版本图和 lineage”而不是“Gitale 实现了数据库级版本控制”。后续若引入 merge，应先定义语义冲突和人工确认，而不是只复用 `parent_node_id`。

### 2. 故事版本控制与创作意图可视化

**Zünd, Poulakos, Kapadia & Sumner (2017), “Story Version Control and Graphical Visualization for Collaborative Story Authoring”, CVMP 2017.** [Disney Research 论文全文](https://la.disneyresearch.com/wp-content/uploads/Story-Version-Control-and-Graphical-Visualization-for-Collaborative-Story-Authoring-Paper.pdf) · [DOI 10.1145/3150165.3150175](https://doi.org/10.1145/3150165.3150175)

**来源明确提出的内容：**论文把故事表示为 beats、events 和 participants，使用 tree-edit 操作构造版本控制、visual diff、冲突检测和三方合并，并从版本库可视化作者、故事元素和创作演化。两项用户研究报告了未受训用户使用系统以及正确解释图形信息的结果。

**与 Gitale 的有限关联：**Gitale 同样把创作意图随版本保存，并把版本关系呈现为可点击的故事图；Viewer 的“路线概览 + 当前节点正文/意图/状态”延续了“版本历史不应只存在于原始数据库”的设计方向。用户点击节点再查看详情，能够把抽象的父子关系和具体故事 Artifact 关联起来。

**重要限制：**该论文在限制部分明确写出其原型当时尚不支持 branching narratives；它的版本差异和协作机制也比 Gitale 丰富。论文样本和任务是协作式视觉故事板，不是单作者、外部 LLM、Markdown/JSON 工作区。因而它支持“故事版本历史值得可视化”这一设计依据，不支持“Gitale 的 fork、Viewer 或创作效果已经被论文验证”。

**采用建议：**可把该论文作为当前 Viewer 和版本化故事 Artifact 的最直接叙事领域先例；不要把其 visual diff、merge 或用户研究结果写成 Gitale 已有功能。未来做 semantic diff 时，应保留本论文的“故事元素而非只有文本行”的方向，但先定义本项目自己的事件/人物 schema。

### 3. LLM 辅助分支创作：混合主动、人类保留意图

**Mishra, Brudy, Zhou, Fitzmaurice & Anderson (2025), “WhatIF: Branched Narrative Fiction Visualization for Authoring Emergent Narratives using Large Language Models”, Creativity and Cognition 2025.** [作者/论文 PDF](https://fbrudy.net/media/pages/projects/whatif/8ee11ee7cb-1758902946/whatif-cc-paper.pdf) · [DOI 10.1145/3698061.3726933](https://doi.org/10.1145/3698061.3726933)

**来源明确提出的内容：**WhatIF 将 LLM 辅助与 node-link 分支图结合，支持作者建立、编辑和比较 branching narrative，并按自定义指标做检查。论文报告了 3 人 formative study 和 11 人 user study，讨论了迭代探索与作者控制；同时明确指出图随故事变复杂会拥挤，LLM 验证并不总被用户接受。

**与 Gitale 的有限关联：**Gitale 的 `StoryAgent` 是外部生成器，`resolveContext` 只向它提供所选节点的祖先路径，`StoryWorkspace` 再把结果存为 checkpoint。这是更小、更保守的 mixed-initiative 切片：Agent 负责提出正文，创作者决定是否保存、从哪里 fork 或是否应用 amendment，Viewer 负责观察历史。`user_intent` 让“为什么生成这条路线”成为可审阅字段，和论文强调保留 authorial intent 的问题相接。

**限制：**WhatIF 的目标是 BNF 游戏开发和故事图编辑，Gitale 没有集成 LLM、参数化情绪/地点视图、分支差异分析或自定义叙事指标。该研究样本较小且主要是探索性用户研究，不能证明 Gitale 提高创造力或让故事更连贯。

**采用建议：**对外可说“参考了 LLM 辅助分支叙事中的混合主动和作者意图保留问题”，并把 Gitale 的贡献限定为跨 Agent、可移植的本地保存/回看协议。若以后要声称“帮助探索”，应设计前后对照任务，测量路线识别、创作决策时间和保留/修改率，而非只展示生成数量。

### 4. 分支后的反事实一致性与 amendment 边界

**Qin, Bosselut, Holtzman, Bhagavatula, Clark & Choi (2019), “Counterfactual Story Reasoning and Generation”, EMNLP-IJCNLP 2019, 5043–5053.** [ACL Anthology 论文页](https://aclanthology.org/D19-1509/) · [DOI 10.18653/v1/D19-1509](https://doi.org/10.18653/v1/D19-1509)

**来源明确提出的内容：**论文定义了 counterfactual story rewriting：给定原故事和一个反事实事件，尽量少地修改故事，使它与新事件相容；关键难点是因果链和在反事实条件下仍应保持不变的内容。TIMETRAVEL 数据集含 29,849 个重写样例及 81,407 个没有重写正文的反事实分支；实验显示当时的语言模型通常难以完整保持一致性。

**与 Gitale 的有限关联：**这为 Gitale 当前的保守边界提供了理论动机：`fork` 保留原路线、只在新 child 中保存新方向；`amend` 只允许叶节点，避免修改祖先后自动让已有后代的正文、意图和状态失效。也就是说，当前实现把“路线探索”与“对已有后代做反事实重写”分开，避免把没有验证的 retcon 假装成普通编辑。

**限制：**Gitale 当前不会计算因果影响、寻找最小修改集合或自动重写后代；`fork` 的新正文是否与父路线在故事意义上相容，也没有由系统判断。TIMETRAVEL 是短常识故事的研究任务，不是 Gitale 的数据集或中文长篇保证。

**采用建议：**若未来实现 ancestor amendment/retcon，应新增 `base_revision`、影响节点、保留不变量、候选 diff 和人工批准状态，并以反事实一致性回归集验收。当前文档应继续明确“叶节点 amendment，不支持 descendant continuity retcon”。

### 5. Provenance、责任和“可追溯”与“可重现”的区别

**Moreau et al. (2013), “PROV-DM: The PROV Data Model”, W3C Recommendation, 30 April 2013.** [W3C 正式规范](https://www.w3.org/TR/prov-dm/)

**来源明确提出的内容：**PROV-DM 用 entity、activity、agent、time、derivation 等概念描述对象如何产生、被什么过程使用、由谁负责以及如何从旧对象派生出新对象；规范明确区分版本/修订产生的新 entity，并将 provenance 用于质量、信任、验证和重现判断。

**与 Gitale 的有限关联：**可以把一次故事生成看作 activity，把生成后的正文/checkpoint 或 revision 看作 entity，把外部 Codex/Claude/Agent 视为 agent，把父节点内容和用户意图视为输入/影响，把 `created_at`、`parent_node_id`、`context_snapshot` 和 `run_metadata` 作为最小追踪字段。`show`、`lineage` 和 Viewer 的修订历史已经能回答一部分“这个 Artifact 从哪里来、当前版本是什么”的问题。

**限制：**`.story/` 不是 PROV-DM 的序列化文件，也没有显式记录完整 activity graph、输入 prompt、模型版本/采样参数、Skill 内容 hash、依赖环境、源文件 hash 或权限上下文；`run_metadata` 还是可选的。因此当前最多称为“局部 provenance/创作历史可追溯”，不能称为“LLM 生成可重复重现”或“符合 PROV 标准”。此外，PROV 规范本身不判断故事内容真假。

**相关工程论文：**Miles, Groth, Munroe & Moreau (2011), “PrIMe: a methodology for developing provenance-aware applications”, _ACM Transactions on Software Engineering and Methodology_, 20(3), 8:1–8:42. [论文记录](https://eprints.soton.ac.uk/267450/) · [DOI 10.1145/2000791.2000792](https://doi.org/10.1145/2000791.2000792)。该论文把 provenance-aware application 定义为能够回答所产出数据的来源问题，并提出在应用设计中显式接入 provenance 层。对 Gitale 的启发是把“来源查询”作为产品能力，而不只是把 metadata 留在 JSON 里；但其 bioinformatics/medicine 案例不能直接证明故事应用效果。

**采用建议：**后续版本可在不改变 checkpoint 合同的前提下补充 `input_refs`、`model`、`skill_version`、`prompt_hash`、`content_hash` 和 `generated_by` 等可选字段，并提供只读 provenance 查询。字段补齐前，发布材料中使用“可审计的本地创作历史”更准确。

### 6. Viewer 的树概览、详情按需和验证方法

**Shneiderman (1996), “The Eyes Have It: A Task by Data Type Taxonomy for Information Visualizations”, Proceedings of IEEE Symposium on Visual Languages.** [IEEE 论文记录](https://doi.org/10.1109/VL.1996.545307) · [DOI 10.1109/VL.1996.545307](https://doi.org/10.1109/VL.1996.545307)

**来源明确提出的内容：**该任务—数据类型分类把 tree/network data 与 overview、relate、details-on-demand、history 等任务联系起来；其常用设计起点是先总览，再缩放/筛选，最后按需查看详情。

**与 Gitale 的有限关联：**Viewer 左侧的路线树提供 overview、父子/兄弟关系和节点选择；右侧只显示所选节点的正文、意图、状态、父节点和 revision history，正是“结构总览 + details-on-demand + history”的小型实现。点击节点复制 ID 和浏览器 URL 保留当前 selection，也让“从图中定位到可操作 Artifact”成为连续任务。

**限制：**这是任务分类和设计启发，不是 Gitale UI 的可用性证明；它没有测试本项目的中文节点标题、状态颜色、路线图布局或 Agent 工作流。若图规模变大，当前简单树和 SVG 连线可能不再满足可读性。

**Munzner (2009), “A Nested Model for Visualization Design and Validation”, _IEEE Transactions on Visualization and Computer Graphics_, 15(6), 921–928.** [作者论文页](https://www.cs.ubc.ca/labs/imager/tr/2009/NestedModel/) · [DOI 10.1109/TVCG.2009.111](https://doi.org/10.1109/TVCG.2009.111)

Munzner 把可视化工作拆成领域任务/数据、抽象操作、视觉编码/交互和算法四层，并强调上游任务理解错误会传递到下游；不同层应使用相应的验证方式。对 Gitale 的直接启发是：不能因为图“看起来像树”就声称用户理解了路线。已有的隐藏标签人工验收应具体测试“能否找出共同父节点、区分两条路线、说明意图和 abandoned 状态”，并记录准确率、完成时间和求助次数。该模型同样不证明当前布局优于其他布局。

## 可以采用的专业表述

### 可以说

- “Gitale 采用带父引用的不可变故事版本图，把显式保存的生成结果变成可回看的 checkpoint，并允许从旧节点开辟独立路线。”这属于对 Decibel 和故事版本控制先例的结构性迁移。
- “Gitale 的 Viewer 将路线关系与所选故事 Artifact 分离呈现，并保留 revision history；该设计对应信息可视化中的 tree overview、details-on-demand 和 history 任务。”这是设计依据，不是效果结论。
- “Gitale 保留 user intent、parent lineage 和有限 run metadata，提供局部 provenance；当前尚未达到可重现 LLM 运行所需的完整输入/环境记录。”这是符合 PROV 边界的说法。
- “叶节点 amendment 是一种显式的安全范围：对已有后代不做未经验证的反事实连续性修复。”这是基于当前实现和反事实重写难点的工程选择。

### 不应说

- “论文证明 Gitale 提高了创作力/故事质量。”没有 Gitale 自己的对照实验，且 WhatIF 等论文的用户研究不能外推到本项目。
- “Gitale 实现了完整的 Git 故事版本控制。”当前没有 semantic diff、merge、rebase、冲突解决或并发协作。
- “Gitale 的 checkpoint 是可复现的生成结果。”当前可复查保存的文本和路线，但外部 Agent 的模型、prompt、工具环境和随机性没有完整固化。
- “fork 后故事自动保持因果一致。”当前 fork 只隔离持久化路线并传递祖先上下文，不执行因果验证。

## 建议的最小验证计划

这些是验证 Gitale 自己的主张所需的实验，不是外部论文的结果：

1. **版本图不变量**：创建 root、连续 child、同父 sibling；检查父/兄弟文件字节不变、环和缺失父节点被拒绝、重启后 lineage 一致。
2. **修订不变量**：对叶节点执行两次 amendment，检查 revision 1/2/3 均可读取、原始 node 文件保留；对有后代节点执行 amendment，检查没有新文件或部分状态。
3. **跨 Agent 互操作**：让 Codex 和 Claude Code 分别写入同一合同格式，Viewer 只依赖 `.story/` 数据而不依赖 provider 专属字段。
4. **Viewer 理解性**：不提供 Agent 对话上下文，让测试者识别共同父节点、两条路线、各自意图和 abandoned 状态；记录准确率、时间、错误类型和是否需要提示。此项对应 Munzner 的任务级验证，也比单纯问“喜欢界面吗”更能验证当前主张。
5. **追溯性清单**：对每个 checkpoint 检查 node ID、父节点、意图、时间、内容、Agent/run metadata 是否能回答“谁在什么上下文下产生了什么版本”；把缺失的模型/Skill/prompt/environment 记录为“不可重现”而不是默认为可重现。

## 参考来源索引

1. Zünd et al. (2017), CVMP：故事版本控制、树编辑、可视化和用户理解；DOI `10.1145/3150165.3150175`。
2. Mishra et al. (2025), C&C：LLM 辅助分支叙事、node-link、作者意图和探索性用户研究；DOI `10.1145/3698061.3726933`。
3. Maddox et al. (2016), PVLDB：不可变版本、DAG、branch、lineage 和 checkpoint；DOI `10.14778/2947618.2947619`。
4. Qin et al. (2019), EMNLP-IJCNLP：反事实事件、最小修订、因果不变性和模型一致性局限；DOI `10.18653/v1/D19-1509`。
5. Moreau et al. (2013), W3C Recommendation：entity/activity/agent/derivation/time 的 provenance 模型；无 DOI，使用 W3C 正式规范。
6. Miles et al. (2011), ACM TOSEM：provenance-aware application 的工程方法；DOI `10.1145/2000791.2000792`。
7. Shneiderman (1996), IEEE VL：tree/network 的 overview、details-on-demand、history 任务；DOI `10.1109/VL.1996.545307`。
8. Munzner (2009), IEEE TVCG：可视化设计与验证的四层模型；DOI `10.1109/TVCG.2009.111`。
