// 适配层类型定义：平台差异全部收敛到 AgentAdapter 接口之后
// 各 Agent 的「发现机制 / 目录约定 / 配置格式」不同，但安装语义相同——
// 平台差异做成适配表数据，而不是散落在 if-else 里。

export type AgentId = "claude-code" | "cursor" | "codex" | "opencode" | "gemini-cli";

export const AGENT_IDS: readonly AgentId[] = [
  "claude-code",
  "cursor",
  "codex",
  "opencode",
  "gemini-cli",
] as const;

export function isAgentId(value: string): value is AgentId {
  return (AGENT_IDS as readonly string[]).includes(value);
}

/** 落盘方式：symlink 需要权限（Unix 通常可行；Windows 需开发者模式），junction 仅 Windows 目录且免权限，copy 永远可行但 update 语义不同 */
export type LinkMode = "symlink" | "junction" | "copy";

export interface DetectResult {
  installed: boolean;
  /** 检测依据，输出给 doctor 展示 */
  reason: string;
}

export interface InstallResult {
  agent: AgentId;
  skill: string;
  /** 实际使用的落盘方式（可能与请求不同：auto 会降级） */
  mode: LinkMode;
  targetPath: string;
}

export interface VerifyIssue {
  skill: string;
  problem: string;
}

export interface VerifyReport {
  agent: AgentId;
  ok: boolean;
  issues: VerifyIssue[];
}

export interface AgentAdapter {
  readonly id: AgentId;
  /** experimental 平台：目录约定未经官方文档确认，doctor 与 README 均标注 */
  readonly experimental: boolean;
  /** 平台是否在本机可用（目录约定存在或可创建） */
  detect(): Promise<DetectResult>;
  /** skills 目标目录（绝对路径，不要求已存在） */
  skillsDir(): Promise<string>;
  /** 把 skill 安装（链接/复制）到目标目录 */
  install(skillDir: string, skillName: string, mode: LinkMode | "auto"): Promise<InstallResult>;
  /** 读取 manifest，返回已安装的 skill 名与安装信息 */
  installedSkills(): Promise<Manifest>;
  /** 装后校验：目标文件存在 + frontmatter 可读 */
  verify(skillNames: string[]): Promise<VerifyReport>;
  /** 移除：按 manifest 反链接/删除 */
  remove(skillName: string): Promise<void>;
}

/** manifest.json 的运行时表示 */
export interface Manifest {
  version: 1;
  skills: Record<
    string,
    {
      version: string;
      mode: LinkMode;
      installedAt: string;
      /** 安装来源（npm 包名@版本），便于排查与升级 */
      source: string;
    }
  >;
}

export function emptyManifest(): Manifest {
  return { version: 1, skills: {} };
}
