// adapter 注册表：id → 实例的唯一映射；支持 --target 自定义目录（任意 Agent 的兜底出口）
import { join } from "node:path";
import { homedir } from "node:os";
import { UsageError } from "../core/errors.js";
import { BaseAgentAdapter } from "./base.js";
import { ClaudeCodeAdapter } from "./claude-code.js";
import { CursorAdapter } from "./cursor.js";
import { CodexAdapter } from "./codex.js";
import { OpencodeAdapter } from "./opencode.js";
import { GeminiCliAdapter } from "./gemini-cli.js";
import { isAgentId, type AgentAdapter, type AgentId } from "./types.js";

export interface AdapterOptions {
  /** 测试注入：覆盖 HOME 根 */
  homeRoot?: string | undefined;
  /** --target 自定义目录时使用 */
  customTarget?: string | undefined;
}

export function createAdapters(options: AdapterOptions = {}): Map<AgentId, AgentAdapter> {
  const map = new Map<AgentId, AgentAdapter>();
  map.set("claude-code", new ClaudeCodeAdapter(options.homeRoot));
  map.set("cursor", new CursorAdapter(options.homeRoot));
  map.set("codex", new CodexAdapter(options.homeRoot));
  map.set("opencode", new OpencodeAdapter(options.homeRoot));
  map.set("gemini-cli", new GeminiCliAdapter(options.homeRoot));
  return map;
}

/** --target 自定义目录适配器：目录即约定，永远可用 */
export function createCustomAdapter(target: string, homeRoot?: string): AgentAdapter {
  const absolute = target.startsWith("~")
    ? join(homeRoot ?? homedir(), target.slice(1))
    : target;
  return new BaseAgentAdapter({
    id: "claude-code", // 语义占位：自定义目录复用 claude-code 的 skills 布局约定
    pathSegments: [],
    absoluteDir: absolute,
    detect: () => ({ installed: true, reason: `自定义目标目录：${absolute}` }),
    homeRoot,
  });
}

/** 按名称取 adapter；--target 与 --agent 互斥由 CLI 层校验 */
export function resolveAdapters(
  agentArg: string | undefined,
  options: AdapterOptions = {},
): AgentAdapter[] {
  if (agentArg === undefined || agentArg === "all") {
    return [...createAdapters(options).values()];
  }
  if (!isAgentId(agentArg)) {
    throw new UsageError(
      `未知平台 "${agentArg}"。可选：claude-code / cursor / codex / opencode / gemini-cli / all`,
    );
  }
  const adapters = createAdapters(options);
  const adapter = adapters.get(agentArg);
  if (!adapter) throw new UsageError(`平台 "${agentArg}" 未注册（程序 bug）`);
  return [adapter];
}
