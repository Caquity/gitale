import { accessSync, constants, existsSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, join, resolve } from "node:path";

import { FileStoryStore } from "./adapters/file-story-store.js";
import { packageCliPath, packageResource } from "./runtime/resources.js";

export type AgentKind = "codex" | "claude-code";
export type DoctorCheckStatus = "pass" | "warn" | "fail";

export interface DoctorCheck {
  readonly name: string;
  readonly status: DoctorCheckStatus;
  readonly message: string;
  readonly remediation?: string;
}

export interface DoctorOptions {
  readonly workspaceRoot?: string;
  readonly agent?: AgentKind;
}

export interface DoctorReport {
  readonly ok: boolean;
  readonly workspaceRoot: string;
  readonly checks: readonly DoctorCheck[];
}

const minimumNodeMajor = 20;
const supportedAgents: readonly AgentKind[] = ["codex", "claude-code"];

export function diagnoseGitale(options: DoctorOptions = {}): DoctorReport {
  const workspaceRoot = resolve(options.workspaceRoot ?? process.cwd());
  const checks: DoctorCheck[] = [
    checkNodeRuntime(),
    checkResource(
      "CLI",
      packageCliPath(),
      "请重新安装 Gitale，或运行 npm run build（源码开发环境）。",
    ),
    checkResource(
      "Schema",
      packageResource("schema", "story-checkpoint.schema.json"),
      "请重新安装 Gitale，确保发布包包含 schema。",
    ),
    checkResource(
      "canonical Skill",
      packageResource("skills", "gitale", "SKILL.md"),
      "请重新安装包含 skills/gitale/SKILL.md 的 Gitale 版本。",
    ),
    checkWorkspace(workspaceRoot),
    checkViewerSession(workspaceRoot),
    checkInstalledSkill(workspaceRoot, options.agent),
    checkAgentExecutable(options.agent),
  ];
  return {
    ok: !checks.some((check) => check.status === "fail"),
    workspaceRoot,
    checks,
  };
}

export function formatDoctorReport(report: DoctorReport): string {
  const lines = ["Gitale doctor", `Workspace: ${report.workspaceRoot}`, ""];
  for (const check of report.checks) {
    const status = check.status.toUpperCase();
    lines.push(`[${status}] ${check.name}: ${check.message}`);
    if (check.remediation !== undefined) lines.push(`       ${check.remediation}`);
  }
  lines.push("");
  lines.push(
    report.ok
      ? "结果：Gitale 可以使用。"
      : "结果：需要处理上面的失败项。请修复后重新运行 gitale doctor。",
  );
  return `${lines.join("\n")}\n`;
}

function checkNodeRuntime(): DoctorCheck {
  const major = Number.parseInt(process.versions.node.split(".")[0] ?? "", 10);
  if (Number.isInteger(major) && major >= minimumNodeMajor) {
    return {
      name: "Node.js",
      status: "pass",
      message: `检测到 Node.js ${process.versions.node}，满足 >= ${minimumNodeMajor}。`,
    };
  }
  return {
    name: "Node.js",
    status: "fail",
    message: `检测到 Node.js ${process.versions.node || "未知版本"}，版本不兼容。`,
    remediation: `请安装 Node.js ${minimumNodeMajor} 或更高版本，然后重新打开终端。`,
  };
}

function checkResource(name: string, path: string, remediation: string): DoctorCheck {
  if (isRegularFile(path)) {
    return { name, status: "pass", message: "已找到发布包资源。" };
  }
  return { name, status: "fail", message: `找不到 ${path}。`, remediation };
}

function checkWorkspace(workspaceRoot: string): DoctorCheck {
  const storyDirectory = join(workspaceRoot, ".story");
  const manifestPath = join(storyDirectory, "workspace.json");
  if (!existsSync(storyDirectory) && !existsSync(manifestPath)) {
    return {
      name: "Story Workspace",
      status: "warn",
      message: "当前目录还没有 .story/；安装正常，运行 gitale init 即可创建。",
    };
  }
  if (!existsSync(manifestPath)) {
    return {
      name: "Story Workspace",
      status: "fail",
      message: `发现 .story/，但缺少 ${manifestPath}。`,
      remediation: "不要删除 .story/；先保留数据并检查是否使用了正确的故事目录。",
    };
  }
  try {
    const store = FileStoryStore.open(workspaceRoot);
    return {
      name: "Story Workspace",
      status: "pass",
      message: `Workspace 可读取，当前有 ${store.list().length} 个故事节点。`,
    };
  } catch (error) {
    return {
      name: "Story Workspace",
      status: "fail",
      message: `Workspace 无法读取：${error instanceof Error ? error.message : String(error)}`,
      remediation: "不要删除 .story/；确认目录完整后重新运行 gitale doctor。",
    };
  }
}

function checkViewerSession(workspaceRoot: string): DoctorCheck {
  const sessionPath = join(workspaceRoot, ".story", "viewer-session.json");
  if (!existsSync(sessionPath)) {
    return {
      name: "Viewer",
      status: "pass",
      message: "Viewer runtime 已就绪；运行 gitale init 时会启动本机只读 Viewer。",
    };
  }
  try {
    const value = JSON.parse(readFileSync(sessionPath, "utf8")) as Record<string, unknown>;
    const url = typeof value.url === "string" ? new URL(value.url) : null;
    const safe =
      typeof value.pid === "number" &&
      value.pid > 0 &&
      value.host === "127.0.0.1" &&
      typeof value.port === "number" &&
      value.port > 0 &&
      value.port <= 65535 &&
      url?.protocol === "http:" &&
      url.hostname === "127.0.0.1" &&
      Number(url.port) === value.port &&
      url.pathname === "/" &&
      url.search === "" &&
      url.hash === "";
    if (safe) {
      return { name: "Viewer", status: "pass", message: "已找到合法的本机 Viewer session。" };
    }
  } catch {
    // Fall through to the same actionable failure for malformed metadata.
  }
  return {
    name: "Viewer",
    status: "fail",
    message: `Viewer session metadata 无效：${sessionPath}。`,
    remediation: "在故事目录运行 gitale stop 清理已记录的 Viewer，或先修复该文件后再启动。",
  };
}

function checkInstalledSkill(workspaceRoot: string, agent: AgentKind | undefined): DoctorCheck {
  const candidates = skillCandidates(workspaceRoot).filter((candidate) =>
    agent === undefined ? true : candidate.agents.includes(agent),
  );
  const installed = candidates.find(
    (candidate) => isRegularFile(candidate.path) && containsGitaleSkill(candidate.path),
  );
  if (installed !== undefined) {
    return { name: "Agent Skill", status: "pass", message: `已找到 Skill：${installed.path}` };
  }
  const target = agent === undefined ? "Codex/Claude Code" : agent;
  return {
    name: "Agent Skill",
    status: "fail",
    message: `没有在支持的 ${target} user/project scope 找到 Gitale Skill。`,
    remediation:
      "运行 npx skills add Caquity/gitale，选择正确的 Agent 和安装范围，然后重启 Agent。",
  };
}

function checkAgentExecutable(agent: AgentKind | undefined): DoctorCheck {
  const targets = agent === undefined ? supportedAgents : [agent];
  const found = targets.filter((candidate) => findExecutable(agentCommand(candidate)));
  if (found.length > 0) {
    return {
      name: "Agent CLI",
      status: "pass",
      message: `检测到 ${found.join("、")} 命令。`,
    };
  }
  if (agent !== undefined) {
    return {
      name: "Agent CLI",
      status: "fail",
      message: `找不到 ${agentCommand(agent)} 命令。`,
      remediation: `请先安装 ${agent}，或使用 doctor 不带 --agent 检查另一种已安装的 Agent。`,
    };
  }
  return {
    name: "Agent CLI",
    status: "warn",
    message: "没有在 PATH 中识别到 codex 或 claude；Gitale 本身仍可使用。",
    remediation: "确认已安装并配置 Codex 或 Claude Code，然后重新打开终端。",
  };
}

function skillCandidates(workspaceRoot: string): readonly SkillCandidate[] {
  const userRoot = homedir();
  return [
    {
      path: join(workspaceRoot, ".agents", "skills", "gitale", "SKILL.md"),
      agents: supportedAgents,
    },
    {
      path: join(workspaceRoot, ".claude", "skills", "gitale", "SKILL.md"),
      agents: ["claude-code"],
    },
    {
      path: join(userRoot, ".agents", "skills", "gitale", "SKILL.md"),
      agents: supportedAgents,
    },
    {
      path: join(userRoot, ".codex", "skills", "gitale", "SKILL.md"),
      agents: ["codex"],
    },
    {
      path: join(userRoot, ".claude", "skills", "gitale", "SKILL.md"),
      agents: ["claude-code"],
    },
  ];
}

function containsGitaleSkill(path: string): boolean {
  try {
    return /(?:^|\n)name:\s*gitale\b/i.test(readFileSync(path, "utf8"));
  } catch {
    return false;
  }
}

function agentCommand(agent: AgentKind): string {
  return agent === "codex" ? "codex" : "claude";
}

function findExecutable(command: string): boolean {
  const pathValue = process.env.PATH ?? "";
  const directories = pathValue.split(delimiter).filter((directory) => directory.length > 0);
  const extensions =
    process.platform === "win32"
      ? (process.env.PATHEXT ?? ".EXE;.CMD;.BAT").split(";").filter(Boolean)
      : [""];
  const hasExtension = /\.[^./\\]+$/.test(command);
  for (const directory of directories) {
    for (const extension of extensions) {
      const candidate = join(
        directory,
        hasExtension || extension === "" ? command : `${command}${extension}`,
      );
      if (!isExecutableFile(candidate)) continue;
      return true;
    }
  }
  return false;
}

function isRegularFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function isExecutableFile(path: string): boolean {
  if (!isRegularFile(path)) return false;
  if (process.platform === "win32") return true;
  try {
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

interface SkillCandidate {
  readonly path: string;
  readonly agents: readonly AgentKind[];
}
