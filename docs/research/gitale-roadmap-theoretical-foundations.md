# Gitale 理论依据与长期路线图研究报告

日期：2026-08-31
范围：当前 Gitale 故事检查点工作区，以及后续可能的 SkillOpt、受限自我改进、检索/溯源和人机协作扩展。
资料原则：优先使用论文正式出版页、论文原文、作者/研究机构页面和一手规范；2026 年尚未正式出版的工作明确标为预印本。本文不是对任何论文的复现，也不把论文中的实验指标当作 Gitale 的结果。

## 结论

Gitale 当前最稳妥的专业定位是：**由创作者控制的、可版本化的故事创作 Artifact 工作区**。它将故事结果保存为检查点，保留父子路线和修订历史，并用 Viewer 展示路线；这与故事版本控制和可视化研究有直接的概念对应，但不能声称 Gitale 首次提出了故事树或版本化写作。

后续路线应按以下顺序推进：

1. 先建立故事 Contract、确定性检查和可复现的回归用例；
2. 再按真实需求加入来源、声明级溯源、检索和分层上下文；
3. 将人工审核作为高风险写入和评测发布的明确门；
4. 只有在前述评测基础成立后，才做一次受限的 SkillOpt-lite；
5. 不把“RSI”直接作为产品承诺。仓库没有给出 RSI 的正式定义，当前应使用更精确的“受限自我改进工作流”描述。

推荐的整体闭环是：

```text
创作者意图
    ↓
候选故事 Artifact / 分支
    ↓
确定性 Contract 检查 + 证据/轨迹
    ↓
人工确认（必要时）
    ↓
可接受的版本 / 主线
    ↓
离线评测失败样例
    ↓
受限 Skill 或工作流候选 patch
    ↓
held-out 回归 + 人工发布 / 回滚
```

这条链路是工程设计建议，不是任何一篇论文已经证明的 Gitale 最优架构。

## 1. 本地事实与术语边界

### 已确认的项目事实

从当前仓库的 `CONTEXT.md`、`src/core/types.ts`、`src/core/workspace.ts`、`src/core/store.ts` 和 Viewer 实现可以确认：

- 故事产物是 `Story Checkpoint`，包含内容、用户意图、父节点、路线信息和状态；
- `Story Branch` 从已有检查点派生，父节点和兄弟路线保持不变；
- 检查点和 amendment 有独立的修订历史；只有明确的命令和保存确认才写入；
- Viewer 是本地只读展示层，当前实现有节点树、路线状态、正文和修订信息；
- 当前实现不是 Story Bible、RAG、知识图谱、完整叙事状态机，也没有 SkillOpt 或代码级自我修改运行时。

这些是代码/项目文件事实，不是外部论文结论。

### SkillOpt 在本项目中的已有含义

`STORY_BRAINSTORM_RESEARCH.md`、`LITERATURE_AGENT_ENGINEERING.md` 和 `SPEC_TOOLING_RESEARCH.md` 已把 SkillOpt 限定为一种**离线、受约束的 Skill 演进实验**：固定模型、任务集和 verifier，从失败轨迹提出小范围文本 patch，在 held-in/held-out 集上回归，保留被拒绝的候选并可回滚。它不是“让 Agent 任意改 Prompt”，也不是当前 Gitale 已实现的能力。

### RSI 仍是未决产品术语

本仓库没有给出 `RSI` 的展开或接口定义。现有文字一处将“自动修改源代码的 RSI”列为不进入首版，另一处使用较宽泛的 `Self-improving Story Workflow`。因此：

- **确认**：本地讨论想表达的是某种 Agent/工作流自我改进；代码中没有 RSI 实现；
- **合理但未定案的解释**：RSI 可能指 recursive self-improvement（递归自我改进），也可能只是 Skill/Workflow 的受限离线优化；
- **未知**：产品最终是否允许修改 Skill、规则、Verifier、工作流，还是修改源代码；由谁批准、以什么指标接受，也尚未定义。

本报告不替项目决定 RSI 的含义。后续设计应暂用“受限自我改进（bounded self-improvement）”作为可验收的名称；只有团队明确 RSI 定义后，才在 Roadmap 中恢复该缩写。

## 2. 当前能力的理论依据

| 当前设计                                           | 一手依据                                                                                                  | 关联强度与可迁移内容                                                                                                                                                                    | 不能从来源推出的结论                                                                  |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 检查点、父子路线、分支和 Viewer 图形化             | Zünd 等，_Story Version Control and Graphical Visualization for Collaborative Story Authoring_，CVMP 2017 | **直接概念依据**：论文以 story beats/events/participants 表示故事，用版本图、可视差异、冲突检测和三方合并支持协作；这支撑“故事演化需要可观察的版本关系”，也支持继续完善路线可视化。[S1] | 论文不是 Gitale 的用户研究；Gitale 当前没有论文中的三方合并、完整差异算法或多人协作。 |
| 明确保存、用户选择主线、Viewer 只读                | Amershi 等，_Guidelines for Human-AI Interaction_，CHI 2019                                               | **间接 HCI 依据**：该研究提出并评估了让系统行为可预测、让用户保持控制、及时反馈和解释不确定性的设计指导；Gitale 将生成候选与写入确认分离，是这些原则在故事工作流中的工程映射。[S2]      | 该研究不是故事创作实验，不能证明当前引导一定提高创作效率。                            |
| 节点状态和修订历史可审阅                           | S1 的故事版本表示；Gitale 自身的 append-only 修订设计                                                     | **工程映射**：版本化使创作者可以回看“何时产生、从哪里分支、后来如何修订”；它为后续评测和回滚提供可观察对象。                                                                            | 论文没有证明 Gitale 的具体 JSON 契约、状态名称或 amendment 规则。                     |
| 后续在提交边界做 Contract 检查，而不是只看最后文本 | Lightman 等，_Let's Verify Step by Step_，NeurIPS 2023/原文预印本                                         | **方法类比**：论文研究过程监督而非故事；可迁移的是“中间步骤得到独立反馈”的思想。对 Gitale 的合理实现是检查 checkpoint/scene transition，不是把数学过程监督结论包装成故事质量保证。[S3]  | 过程监督在数学任务上的结果不等于故事一致性已被证明。                                  |

因此，当前版本可以诚实地表述为“受故事版本控制和以人为中心的 AI 交互研究启发的本地故事 Artifact 工作区”，不应表述为“论文证明了 Gitale 会写出更好的故事”。

## 3. Roadmap：有证据才进入实现

优先级中的“高/中/低”是产品建议，不是论文给出的排序。每条路线都要先有本项目自己的 baseline、任务集和失败样例。

### R1：Narrative Contract / Narrative CI（高优先级）

**目标**：把人物关系、时间顺序、已知信息、道具/地点状态、必须发生或禁止发生的事件表示为可检查约束。在 checkpoint、fork、amend 或发布边界运行确定性检查；无法确定的语义判断返回 `UNKNOWN` 并请求人工确认，而不是默认通过。

**依据与关联**：

- _Lost in Stories: Consistency Bugs in Long Story Generation by LLMs_（ACL Findings 2026）建立了长故事一致性 benchmark 和证据驱动的检查流程，将错误拆成事实、时间、人物、风格和世界设定等维度。[S4]
- _ConWriter: Transition-Constrained Stateful Long-Form Story Generation with Lightweight Neuro-Symbolic Consistency Control_（2026 arXiv 预印本）将故事生成拆成场景级状态转移，使用静态要求、动态记忆、符号状态和风险信号，在错误传播前做局部检查和修复。[S5]

这两项与 Gitale 的 checkpoint/branch 对象有**直接方法关联**：每次保存可以视为一次候选状态提交，Contract 检查验证“这次转移是否合法”。实现时只借鉴状态转移和错误分类，不声称复现论文。

**最小方案**：先支持 4 类可审计约束：节点关系、时间前后、必需事件、角色已知信息；每条失败记录证据片段、受影响节点和 verifier 版本。先用固定小型中文案例和人工标注集验证误报/漏报，再扩大。

**验收指标**：硬约束 precision/recall、第一次错误位置、回滚后是否污染工作区、`UNKNOWN` 转人工比例、每次检查的时延和调用成本。

**限制**：S4 明确以英文小说和西方叙事惯例为主，并把一致性简化成二元判断；惊喜结局、故意歧义和中文叙事规范不能直接套用。Verifier 只能保证定义过的约束，不保证有趣、优美或文学价值。

### R2：可溯源 Story Material + 检索（中高优先级，需真实来源需求）

**目标**：当用户确实需要从文章、剧本或设定资料创作时，为人物/事件/关系等 Story Material 保存来源 ID、版本/hash、文本区间、来源状态和人工裁决；生成的原子声明能够回指这些证据。查询层可从关键词/BM25 起步，再实验向量或图检索。

**依据与关联**：

- Lewis 等的 RAG 原始论文把参数化模型与可更新的外部非参数记忆结合，并明确指出来源追溯和知识更新是开放问题。[S6]
- Gao 等的 ALCE（EMNLP 2023）将“流畅、正确、引用质量”分开评测，说明有引用不代表每条声明都被完整支持。[S7]
- Darren Edge 等的 GraphRAG 工作展示了从文档构建实体/关系图和社区摘要，适合全局问题；它支持图结构作为召回/组织层，但不等同于冲突裁决或 Canon。[S8]
- Google 的 OKF v0.2 规范是文件封装与 provenance/lifecycle 规范，可作为 Markdown Story Artifact 的 envelope；它没有定义 StorySpec、冲突语义或 SkillOpt。[S9]

这里的关系是**条件性的**：Gitale 当前输入主要是用户和 Agent 生成的故事检查点，不需要为了“有理论”强行加 RAG。只有产品加入外部材料、来源核验或知识更新时，R2 才有明确用户价值。

**最小方案**：先实现本地 `source_ref`、段落/字符 span、内容 hash、来源版本和 `proposed/accepted/conflicted/deprecated` 状态；查询只召回有权限且未失效的证据。将“检索命中”“声明被支持”“来源是否可信”拆成三个结果。

**验收指标**：证据召回率、声明支持率、未绑定声明率、过期来源检测、冲突召回、延迟/成本；同时保留人工金标准。

**限制与风险**：检索到来源不等于来源为真；图抽取可能产生错误关系；来源版权、隐私和版本权限需要单独治理。RAG/GraphRAG 不能绕过 Gitale 的人工确认和写入边界。

### R3：分层上下文与长期记忆（中优先级）

**目标**：让 Agent 在继续某条路线时按任务装配最近节点、祖先意图、已确认 Story Material、来源证据和修订日志，而不是无差别拼接全部历史；显式处理版本更新和“不知道”。

**依据与关联**：

- _Lost in the Middle_ 发现长上下文中相关信息的位置会影响模型利用，长上下文不是“全部塞进去就能记住”。[S10]
- LongMemEval 将长期记忆拆成信息抽取、多会话推理、时间推理、知识更新和 abstention，并分别考察 indexing/retrieval/reading。[S11]

与 Gitale 的关联是**直接的上下文工程问题**：当前 `ContextSnapshot` 记录路线祖先范围，但不保证已经恢复完整语义状态。后续可以为分支上下文增加版本、来源和时间优先级，但不能把 snapshot 自动升级成“已验证 Canon”。

**最小方案**：先实现确定性上下文装配器：当前节点 + 祖先用户意图 + 当前有效 revision + 已批准事实 + 与查询相关的证据；旧版本冲突时显式标记，不静默覆盖。

**验收指标**：跨节点事实召回、时间更新正确率、冲突时拒答率、分支隔离错误率、token/延迟成本。使用自建中文故事集，不直接报告 LongMemEval 的分数。

**限制**：对话记忆 benchmark 不等于故事创作 benchmark；记忆召回正确也不意味着生成内容正确。长期记忆会放大过期事实和错误摘要，必须与版本、来源和 verifier 配合。

### R4：人机协作审核与审计轨迹（高优先级基础设施）

**目标**：将低风险建议与高风险写入分开。Agent 可以提出故事候选、冲突解释、Skill patch 或影响范围；只有创作者确认/批准后，才更新主线、Canon 或发布的 Skill。每次审核保存候选版本、差异、证据、verifier 结果、受影响对象和决定。

**依据与关联**：S2 的 HCI 指导支持让系统行为可预测、向用户提供控制和反馈；S3 支持在中间步骤获得检查信号。它们对审核流是**设计依据/方法类比**，不是对 Gitale 的效果证明。

**最小方案**：统一 `Proposal → Verify → Review → Commit/Reject` 状态；禁止“模型自称已确认”直接通过；对不确定或冲突候选提供 `UNKNOWN`/人工升级；拒绝记录可回放。

**验收指标**：人工能否看懂变更、误接受/误拒绝率、审核时间、批准后回滚率、候选与最终版本的可追溯率。

**限制**：人工审核也会疲劳或受模型措辞影响；不能用一个 LLM Judge 作为唯一发布依据。若接入外部文本和工具，还需增加提示注入测试与最小权限策略。AgentDojo 说明了工具返回的不可信数据可能劫持 Agent 执行恶意动作，因此故事原文中的指令性文字也应按数据处理，而不是自动获得写入权限。[S19]

### R5：SkillOpt-lite（P3，必须满足门槛）

**目标**：只优化一个可测的故事 Skill，例如“故事导入”“引用绑定”“冲突解释”或“上下文装配”，不修改模型权重、不修改源代码、不自动修改 verifier 和权限策略。

**依据与关联**：

- SkillsBench 用配对条件比较 no-Skill、curated Skill 和 self-generated Skill；其结果显示 Skill 的收益因任务而异，且自生成 Skill 不能稳定带来收益。[S12]
- SkillOpt 将单个 Skill 文档视为冻结目标模型之外的可训练状态，用 rollout 评分提出受限 add/delete/replace 编辑，并以 held-out 改善作为接受门。[S13]
- Self-Harness 将流程分为 weakness mining、minimal harness proposal 和 regression validation；它在代码 Agent benchmark 上研究，说明“失败模式→小候选→回归”比无约束自改更可审计。[S14]
- RHO 研究只依赖历史轨迹做回顾式 Harness 优化，可作为没有大规模人工标签时的候选生成参考，但 self-preference 仍不是外部真值。[S15]

这组依据与仓库已有 SkillOpt 定义**高度一致**。适合的产品实现是离线实验/维护工具，不是创作对话中的“自动学习按钮”。

**准入门槛**：

1. 有稳定的故事任务集、明确 baseline 和可执行 verifier；
2. 先证明当前 Skill 相比 no-Skill 或旧版本存在可重复失败模式；
3. 一轮只允许一个 Skill、有限文本编辑和有限候选；
4. held-in 修复目标失败，held-out 无关键回归；
5. 保留候选、失败原因、分数、成本和版本；
6. 经过人工审阅后才安装新 Skill，支持一键回滚。

**建议指标**：配对通过率、硬约束回归数、引用/状态错误率、重复运行稳定性、token/时延/费用、人工批准率；不要只看一个总分。

**限制与风险**：故事质量有主观性，评测集小会过拟合，LLM Judge 可能与优化器互相迎合；外部论文的模型、任务和工具环境也不同。SkillOpt 论文的提升数字不能写成 Gitale 的提升。

### R6：轨迹经验库与工作流搜索（P4，研究性）

**目标**：在 R1–R5 有稳定数据后，将失败轨迹抽象为带适用条件的 runbook，或在有限 DSL 中比较 `Extract → Verify → Revise → AskHuman → Commit` 等流程拓扑。

**依据与关联**：RHO 提供从历史轨迹提取候选 Harness 的思路；AFlow 将 Agent 工作流表示为节点/边并用搜索和执行反馈迭代；ADAS 进一步把 Agent 设计视为可搜索空间。[S15–S17]。这是**远期研究依据**，与当前 Gitale 的实际需求尚未建立直接证据。

**安全边界**：只搜索受限工作流 DSL，禁止执行未经审查的模型生成代码；固定 verifier、权限和数据集；候选必须在隔离副本中运行并接受人工发布。

### R7：RSI / 代码级自我修改（暂不列为产品能力）

如果团队将 RSI 明确定义为“递归修改自身代码并持续改进”，DGM 是相关的研究参照：它维护候选 Agent archive，在代码 benchmark 上经验验证每次修改，并使用沙箱和人工监督。[S18] 但其任务、指标和安全条件都是代码 Agent 研究环境，不是故事创作证据。

因此当前结论是：

- 可将“受限 Skill/Workflow 演进”列为 P3/P4 的研究路线；
- 不将“自动修改 Gitale 源代码的 RSI”列为当前产品 Roadmap 承诺；
- 若未来要研究代码级 RSI，必须另立研究项目，隔离工作区、固定外部 benchmark、候选归档、权限边界和人工批准；不得让系统修改 Story Canon、评测器或发布权限来提高自己的分数。

## 4. 建议的路线门禁与观测对象

### 进入下一阶段的必要证据

每个 roadmap 项目至少要回答：

- 用户遇到的具体失败是什么；
- 与 no-feature baseline 相比改善了什么；
- 真值由谁或什么独立于被测 Agent 的机制定义；
- 失败是否可定位到数据、模型、工具、上下文或 Harness；
- 成本、延迟、人工负担和误报/漏报是否可接受；
- 如何撤销候选变更，是否污染已接受故事。

### 建议的最小 Trace

不记录或暴露隐藏思维链，记录可复现的外部事实即可：

```text
trace_id / run_id / task_id
输入来源与版本 / Skill 版本 / Harness 版本
工具名与参数摘要 / 状态前后 hash
候选 Artifact / verifier 版本与 verdict
失败类型 / 受影响节点 / retry 次数
人工决定 / latency / token / cost
```

这使得后续 SkillOpt 或工作流搜索有证据可用，也使人工能回放“哪次执行引入了错误”。

## 5. 事实、推断与未知项分离

### 确认事实

- Gitale 当前代码实现了本地故事检查点、父子路线、状态、修订和只读 Viewer；
- 本地文档将 SkillOpt 定义为受限、可评测、可回滚的 Skill 更新，而不是开放式自改；
- 本地文档没有定义 RSI 的正式含义或接口；
- S1–S18 所述的论文/规范确实分别提出了故事版本可视化、HCI 指导、过程反馈、长故事一致性、检索/引用、长上下文/记忆、Skill/工作流优化或代码级自改研究；
- 这些外部结果都不是 Gitale 的实验结果。

### 工程推断

- 检查点图适合作为后续 Contract 检查、影响范围和评测结果的挂载位置；
- 在故事素材来源和长期记忆尚未成为用户需求前，不应为理论完整性强行引入 RAG 或知识图谱；
- 在没有稳定评测集和独立 verifier 前，SkillOpt/RSI 无法被可信地验收；
- 对 Gitale 更安全、更可操作的“自我改进”是离线生成候选 patch，再人工发布，而不是生产系统自改代码。

### 尚未知晓

- Gitale 是否能减少创作者返工、提高路线选择质量或提升长期写作完成率；当前没有针对目标用户的受控用户研究；
- 中文故事、故意歧义和不同体裁下，ConStory-Bench/ConWriter 的错误分类和检查器效果；
- SkillOpt 在 Gitale 的 Skill、模型、中文任务和本地文件工作区上的收益是否能复现；
- 用户是否需要文章/剧本来源溯源、知识更新或图检索；
- RSI 最终要优化什么对象、谁批准、何时回滚，以及“变好”的可接受定义；
- 各阶段的具体阈值、数据集规模、预算和发布策略。

## 6. 来源

以下按正文编号列出直接来源；论文结果只适用于其论文所用的任务、模型、数据和评测协议。

- **[S1]** Fabio Zünd, Steven Poulakos, Mubbasir Kapadia, Robert W. Sumner. “Story Version Control and Graphical Visualization for Collaborative Story Authoring.” CVMP 2017. [Disney Research 页面](https://la.disneyresearch.com/publication/story-version-control-and-graphical-visualization/)；[DOI 10.1145/3150165.3150175](https://doi.org/10.1145/3150165.3150175)。
- **[S2]** Saleema Amershi et al. “Guidelines for Human-AI Interaction.” CHI 2019. [ACM DOI 10.1145/3290605.3300233](https://doi.org/10.1145/3290605.3300233)；[论文 PDF](https://hci.stanford.edu/courses/cs194h/2023/wi/readings/restricted/Saleema_AI_UX_Guidelines.pdf)。
- **[S3]** Hunter Lightman et al. “Let's Verify Step by Step.” [arXiv:2305.20050](https://arxiv.org/abs/2305.20050)；[OpenAI 论文 PDF](https://cdn.openai.com/improving-mathematical-reasoning-with-process-supervision/Lets_Verify_Step_by_Step.pdf)。
- **[S4]** Junjie Li et al. “Lost in Stories: Consistency Bugs in Long Story Generation by LLMs.” Findings of ACL 2026. [ACL Anthology](https://aclanthology.org/2026.findings-acl.410/)；[DOI 10.18653/v1/2026.findings-acl.410](https://doi.org/10.18653/v1/2026.findings-acl.410)。
- **[S5]** Jindong Li et al. “ConWriter: Transition-Constrained Stateful Long-Form Story Generation with Lightweight Neuro-Symbolic Consistency Control.” [arXiv:2608.05169](https://arxiv.org/abs/2608.05169)。截至本报告日期标为预印本。
- **[S6]** Patrick Lewis et al. “Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks.” NeurIPS 2020. [NeurIPS 论文页](https://proceedings.neurips.cc/paper/2020/hash/6b493230205f780e1bc26945df7481e5-Abstract.html)；[arXiv:2005.11401](https://arxiv.org/abs/2005.11401)。
- **[S7]** Tianyu Gao, Howard Yen, Jiatong Yu, Danqi Chen. “Enabling Large Language Models to Generate Text with Citations.” EMNLP 2023. [ACL Anthology](https://aclanthology.org/2023.emnlp-main.398/)；[DOI 10.18653/v1/2023.emnlp-main.398](https://doi.org/10.18653/v1/2023.emnlp-main.398)。
- **[S8]** Microsoft Research et al. “From Local to Global: A Graph RAG Approach to Query-Focused Summarization.” [arXiv:2404.16130](https://arxiv.org/abs/2404.16130)；[Microsoft GraphRAG 官方仓库](https://github.com/microsoft/graphrag)。
- **[S9]** GoogleCloudPlatform. “Open Knowledge Format v0.2 Specification.” [官方规范](https://github.com/GoogleCloudPlatform/open-knowledge-format/blob/main/SPEC.md)；[官方仓库](https://github.com/GoogleCloudPlatform/open-knowledge-format)。这是规范，不是论文。
- **[S10]** Nelson F. Liu et al. “Lost in the Middle: How Language Models Use Long Contexts.” TACL. [DOI 10.1162/tacl_a_00638](https://doi.org/10.1162/tacl_a_00638)；[ACL Anthology](https://aclanthology.org/2024.tacl-1.9/)。
- **[S11]** Di Wu et al. “LongMemEval: Benchmarking Chat Assistants on Long-Term Interactive Memory.” ICLR 2025. [arXiv:2410.10813](https://arxiv.org/abs/2410.10813)；[ICLR 论文 PDF](https://proceedings.iclr.cc/paper_files/paper/2025/file/d813d324dbf0598bbdc9c8e79740ed01-Paper-Conference.pdf)。
- **[S12]** Xiangyi Li et al. “SkillsBench: Benchmarking How Well Agent Skills Work Across Diverse Tasks.” [arXiv:2602.12670](https://arxiv.org/abs/2602.12670)；[官方项目页](https://www.skillsbench.ai/)。截至本报告日期按预印本/项目发布标记。
- **[S13]** Yifan Yang et al. “SkillOpt: Executive Strategy for Self-Evolving Agent Skills.” [arXiv:2605.23904](https://arxiv.org/abs/2605.23904)；[Microsoft Research 一手介绍](https://www.microsoft.com/en-us/research/blog/skillopt-agent-skills-as-trainable-parameters/)。截至本报告日期按预印本标记。
- **[S14]** Hangfan Zhang et al. “Self-Harness: Harnesses That Improve Themselves.” [arXiv:2606.09498](https://arxiv.org/abs/2606.09498)。截至本报告日期按预印本标记。
- **[S15]** Wenbo Pan et al. “Retrospective Harness Optimization: Improving LLM Agents via Self-Preference over Trajectory Rollouts.” [arXiv:2606.05922](https://arxiv.org/abs/2606.05922)。截至本报告日期按预印本标记。
- **[S16]** Jiayi Zhang et al. “AFlow: Automating Agentic Workflow Generation.” [arXiv:2410.10762](https://arxiv.org/abs/2410.10762)；[作者/项目仓库](https://github.com/FoundationAgents/AFlow)。
- **[S17]** Shengran Hu, Cong Lu, Jeff Clune. “Automated Design of Agentic Systems.” [arXiv:2408.08435](https://arxiv.org/abs/2408.08435)；[作者项目页](https://www.shengranhu.com/ADAS/)。
- **[S18]** Jenny Zhang et al. “Darwin Gödel Machine: Open-Ended Evolution of Self-Improving Agents.” [arXiv:2505.22954](https://arxiv.org/abs/2505.22954)。它是代码 Agent 的自我修改研究参照，不是故事系统证据。
- **[S19]** Edoardo Debenedetti et al. “AgentDojo: A Dynamic Environment to Evaluate Prompt Injection Attacks and Defenses for LLM Agents.” NeurIPS 2024. [NeurIPS 论文页](https://proceedings.neurips.cc/paper_files/paper/2024/hash/97091a5177d8dc64b1da8bf3e1f6fb54-Abstract-Datasets_and_Benchmarks_Track.html)；[DOI 10.52202/079017-2636](https://doi.org/10.52202/079017-2636)；[作者/官方仓库](https://github.com/ethz-spylab/agentdojo)。

## 7. 与当前仓库研究资料的关系

本报告只新增当前文件。已有的 `STORY_BRAINSTORM_RESEARCH.md`、`LITERATURE_AGENT_ENGINEERING.md`、`LITERATURE_STORY_CONTROL.md`、`OKF_STORY_ARTIFACT_RESEARCH.md` 和 `STORY_BRANCHING_LANDSCAPE.md` 包含更广泛的研究笔记；本报告将其中与 Gitale 当前能力和长期路线直接相关的结论收敛为可执行门禁，并补充了来源状态、RSI 未决边界和“论文结论/工程推断/未知项”的分离。
