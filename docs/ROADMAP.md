# Gitale Roadmap

本路线图区分已实现能力、候选方向和研究性探索。它不承诺自动提升故事质量；每一阶段只有在本项目自己的任务集、独立验收和用户价值都成立后才进入实现。

理论依据、适用边界和完整来源见：[当前实现的理论依据](research/gitale-current-theoretical-foundations.md) 与 [长期路线图研究](research/gitale-roadmap-theoretical-foundations.md)。

## 当前版本：版本化故事工作区

- 显式保存 Story Checkpoint，保留父子路线和创作意图。
- 从任意已保存节点 fork，隔离原路线与新路线。
- 叶节点 amendment 保留 revision history；有后代节点拒绝就地修订。
- 本地只读 Viewer 展示树、正文、状态、修订和操作提示。
- 安装型 CLI/Skill 支持 Codex 与 Claude Code 的显式工作流。

当前仍需真实 Codex/Claude 互操作与 Viewer 理解性验收；在这些完成前，不把“帮助创作”或“提高理解”作为已证明结论。

## 近期：Narrative Contract 与人工审核

**目标：** 在 checkpoint、fork 和 amendment 的提交边界检查可明确表达的人物、时间、事件和角色知识约束；无法确定时升级给创作者，而不是由模型静默通过。

**进入条件：** 先收集可重复的故事一致性失败样例，并建立含人工金标准的固定案例。

**理论关联：** 长故事一致性研究和状态转移式故事生成提供“在转换边界检查”的方法启发；它们不证明 Gitale 已拥有一致性保证。

## 中期：可溯源 Story Material、检索与分层上下文

**目标：** 当创作确实需要文章、剧本或设定资料时，保存来源、版本/hash、文本范围和人工裁决；上下文只装配当前路线、当前 revision 与已批准的相关事实。

**进入条件：** 先确认用户存在外部材料、来源核验或知识更新需求；没有该需求时不为技术完整性引入 RAG 或知识图谱。

**理论关联：** provenance 模型、RAG/引用评测与长期记忆研究支持“来源、版本和召回应分开验证”的设计，而不保证检索命中就是真实或适合故事的内容。

## 中后期：SkillOpt-lite

**目标：** 只对一个可测 Story Skill 或上下文装配模板提出受限候选修改；候选必须通过固定任务集、独立 verifier、held-out 回归和人工发布，且可回滚。

**进入条件：** 已有稳定失败模式、明确 baseline、可执行评测和独立于优化 Agent 的验收机制。

**理论关联：** SkillsBench、SkillOpt、Self-Harness 与 RHO 支持“失败证据 → 小候选 → 回归门禁”的实验范式；它们不支持开放式自动改写 Gitale 代码或把主观故事偏好当作唯一评分器。

## 远期研究：受限工作流搜索

**目标：** 在已积累可信 trace 后，在受限 DSL 中比较 Extract、Verify、Revise、AskHuman、Commit 等工作流，而不是让 Agent 任意生成和执行代码。

**进入条件：** 固定 verifier、隔离实验环境、明确权限边界与人工发布流程。

## 不作为当前产品承诺：RSI / 代码级自我修改

仓库尚未定义 RSI 的正式含义或目标对象。若 RSI 指递归修改自身代码，它只能作为独立研究项目：隔离工作区、外部 benchmark、候选归档、固定评测器和人工批准缺一不可。当前 Gitale 不把代码级自我修改列为产品能力。
