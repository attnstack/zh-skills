// add 命令：安装 skill 到一个或多个 Agent，装后立即 verify
// 交互式多选仅在 TTY 且未给位置参数时启用；非 TTY 环境必须显式给参数（脚本友好）
import { defineCommand } from "citty";
import { ensureDir } from "../../adapters/base.js";
import { UsageError } from "../../core/errors.js";
import type { InstallResult, VerifyReport } from "../../adapters/types.js";
import { Logger } from "../../util/logger.js";
import { loadConfig } from "../../util/config.js";
import { findSkill, loadBundledSkills, parseMode, positionals, resolveTargetAdapters } from "./shared.js";
import { promptSkillAndAgents } from "../interactive.js";

interface AddJsonOutput {
  installed: InstallResult[];
  verify: VerifyReport[];
}

export default defineCommand({
  meta: { name: "add", description: "安装 skill（交互式多选或指定名字）" },
  args: {
    agent: { type: "string", alias: "a", description: "目标平台：claude-code / cursor / codex / opencode / gemini-cli / all" },
    mode: { type: "string", description: "落盘方式：auto（默认，按平台降级）/ symlink / junction / copy" },
    target: { type: "string", description: "自定义 skills 目录（与 --agent 互斥）" },
    all: { type: "boolean", description: "安装全部 skill" },
    json: { type: "boolean", description: "JSON 输出" },
  },
  async run(ctx) {
    const logger = Logger.fromEnv();
    const config = loadConfig();
    const skills = loadBundledSkills(logger);
    const adapters = resolveTargetAdapters(ctx.args.agent, ctx.args.target, config);
    const mode = parseMode(ctx.args.mode);

    let names = positionals(ctx.args._);
    if (ctx.args.all === true) {
      names = skills.map((s) => s.meta.name);
    } else if (names.length === 0) {
      if (!process.stdin.isTTY) {
        throw new UsageError(
          "未指定 skill。用法：zh-skills add <skill...> 或 zh-skills add --all（交互终端下可直接运行 zh-skills add 多选）",
        );
      }
      const picked = await promptSkillAndAgents(skills);
      names = picked.skillNames;
      // 交互选择的目标平台覆盖默认解析结果
      const interactive = resolveTargetAdapters(picked.agent, undefined, config);
      adapters.splice(0, adapters.length, ...interactive);
    }

    const installed: InstallResult[] = [];
    for (const adapter of adapters) {
      const dir = ensureDir(await adapter.skillsDir());
      logger.info(`目标目录：${dir}`);
      for (const name of names) {
        const skill = findSkill(skills, name);
        const result = await adapter.install(skill.dir, name, mode);
        installed.push(result);
        logger.info(`[${adapter.id}] ${name} 已安装（${result.mode}）→ ${result.targetPath}`);
      }
    }

    const verify: VerifyReport[] = [];
    for (const adapter of adapters) {
      verify.push(await adapter.verify(names));
    }

    if (ctx.args.json === true) {
      const output: AddJsonOutput = { installed, verify };
      logger.out(JSON.stringify(output, null, 2));
    } else {
      for (const report of verify) {
        if (report.ok) {
          logger.out(`✓ ${report.agent}: ${names.length} 个 skill 校验通过`);
        } else {
          for (const issue of report.issues) {
            logger.out(`✗ ${report.agent}: ${issue.skill} — ${issue.problem}`);
          }
        }
      }
      logger.out(
        `完成。共安装 ${installed.length} 个（平台 × skill）。Agent 新会话中生效。`,
      );
    }

    // verify 失败视为环境问题：退出码 2，脚本可感知
    const hasFailure = verify.some((r) => !r.ok);
    if (hasFailure) {
      process.exitCode = 2;
    }
  },
});
