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
    route: { type: "string", description: '按查询路由安装 Top-K，例如 --route "写周报"' },
    json: { type: "boolean", description: "JSON 输出" },
  },
  async run(ctx) {
    const logger = Logger.fromEnv();
    const config = loadConfig();
    const skills = loadBundledSkills(logger);
    const adapters = resolveTargetAdapters(ctx.args.agent, ctx.args.target, config);
    const mode = parseMode(ctx.args.mode);

    let names = positionals(ctx.args._);
    if (ctx.args.route !== undefined) {
      // 按查询装 Top-K：把路由器接到安装器上，覆盖「我不知道有哪些，只知道我要干什么」的场景
      if (names.length > 0) {
        throw new UsageError('--route 与技能名参数互斥：二选一');
      }
      const { SkillRouter } = await import("../../router/index.js");
      const result = new SkillRouter(skills).route(ctx.args.route, { topK: config.routeTopK });
      names = result.items.map((i) => i.name);
      if (names.length === 0) {
        throw new UsageError(`查询「${ctx.args.route}」没有命中任何技能，换个说法或用 zh-skills list 查看`);
      }
      logger.info(`按路由安装：${names.join(", ")}`);
    } else if (ctx.args.all === true) {
      names = skills.map((s) => s.meta.name);
    } else if (names.length === 0) {
      if (!process.stdin.isTTY) {
        throw new UsageError(
          "未指定 skill。用法：zh-skills add <skill...>、zh-skills add --all，或 zh-skills add --route \"<需求描述>\"",
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
