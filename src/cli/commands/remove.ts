// remove 命令：按 manifest 反链接/删除已装 skill，并同步清理 manifest 记录
import { defineCommand } from "citty";
import { UsageError } from "../../core/errors.js";
import { Logger } from "../../util/logger.js";
import { loadConfig } from "../../util/config.js";
import { positionals, resolveTargetAdapters } from "./shared.js";

export default defineCommand({
  meta: { name: "remove", description: "移除已安装的 skill" },
  args: {
    agent: { type: "string", alias: "a", description: "只从某个平台移除" },
    all: { type: "boolean", description: "移除该平台全部已装 skill" },
    json: { type: "boolean", description: "JSON 输出" },
  },
  async run(ctx) {
    const logger = Logger.fromEnv();
    const config = loadConfig();
    const adapters = resolveTargetAdapters(ctx.args.agent, undefined, config);

    let names = positionals(ctx.args._);
    if (ctx.args.all === true) {
      names = [];
      for (const adapter of adapters) {
        const manifest = await adapter.installedSkills();
        names.push(...Object.keys(manifest.skills));
      }
    }
    if (names.length === 0) {
      throw new UsageError("未指定 skill。用法：zh-skills remove <skill...> 或 --all");
    }

    const removed: Array<{ agent: string; skill: string }> = [];
    const missing: Array<{ agent: string; skill: string }> = [];
    for (const adapter of adapters) {
      const manifest = await adapter.installedSkills();
      for (const name of names) {
        if (!manifest.skills[name]) {
          missing.push({ agent: adapter.id, skill: name });
          continue;
        }
        await adapter.remove(name);
        removed.push({ agent: adapter.id, skill: name });
        logger.info(`[${adapter.id}] ${name} 已移除`);
      }
    }

    if (ctx.args.json === true) {
      logger.out(JSON.stringify({ removed, missing }, null, 2));
    } else {
      for (const r of removed) logger.out(`- ${r.agent}: ${r.skill}`);
      if (missing.length > 0) {
        logger.warn(`未安装，跳过：${missing.map((m) => `${m.agent}/${m.skill}`).join(", ")}`);
      }
      logger.out(`移除 ${removed.length} 个。`);
    }
  },
});
