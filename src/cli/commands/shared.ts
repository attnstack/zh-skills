// CLI 命令共享辅助：adapter 解析、skill 加载、输出格式化
// 保持命令实现只做「参数 → 编排 → 输出」三件事
import { UsageError } from "../../core/errors.js";
import { loadSkillDir, type Skill } from "../../core/skill.js";
import {
  createAdapters,
  createCustomAdapter,
} from "../../adapters/registry.js";
import type { AgentAdapter, LinkMode } from "../../adapters/types.js";
import { loadConfig, type Config } from "../../util/config.js";
import { bundledSkillsDir } from "../skills-source.js";

export function parseMode(raw: string | undefined): LinkMode | "auto" {
  if (raw === undefined || raw === "auto" || raw === "symlink" || raw === "junction" || raw === "copy") {
    return raw ?? "auto";
  }
  throw new UsageError(`--mode 只接受 auto / symlink / junction / copy，收到 "${raw}"`);
}

/**
 * 解析目标 adapter：--target（自定义目录）与 --agent 互斥；
 * 两者都没有时返回全部平台（add 默认装到检测到的所有平台由用户交互选择，列表命令展示全部）
 */
export function resolveTargetAdapters(
  agent: string | undefined,
  target: string | undefined,
  config: Config,
): AgentAdapter[] {
  if (target !== undefined && agent !== undefined && agent !== "all") {
    throw new UsageError("--target 与 --agent 互斥：--target 已指定唯一目标目录");
  }
  if (target !== undefined) {
    return [createCustomAdapter(target)];
  }
  const adapters = [...createAdapters().values()];
  if (agent === undefined || agent === "all") {
    if (config.agents.length > 0) {
      const allowed = adapters.filter((a) => config.agents.includes(a.id));
      if (allowed.length === 0) {
        throw new UsageError(
          `配置文件 agents 白名单（${config.agents.join(", ")}）未匹配任何已知平台`,
        );
      }
      return allowed;
    }
    return adapters;
  }
  const found = adapters.find((a) => a.id === agent);
  if (!found) {
    throw new UsageError(
      `未知平台 "${agent}"。可选：claude-code / cursor / codex / opencode / gemini-cli / all`,
    );
  }
  return [found];
}

/** 加载内置 skills；单个损坏 skill 告警但不中断（隔离局部失败） */
export function loadBundledSkills(logger: { warn(message: string): void }): Skill[] {
  const root = bundledSkillsDir();
  return loadSkillDir(root, (dir, err) => {
    logger.warn(`跳过损坏的 skill ${dir}：${err.message}`);
  });
}

export function findSkill(skills: Skill[], name: string): Skill {
  const found = skills.find((s) => s.meta.name === name);
  if (!found) {
    const available = skills.map((s) => s.meta.name).join(", ");
    throw new UsageError(`skill "${name}" 不存在。可用：${available || "（无）"}`);
  }
  return found;
}

export function positionals(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string") return [raw];
  return [];
}
