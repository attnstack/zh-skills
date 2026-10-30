// update 命令：按 manifest 增量更新——只重装版本变化的 copy 安装；链接安装天然跟随源头
import { defineCommand } from "citty";
import { EnvironmentError } from "../../core/errors.js";
import { needsUpdate } from "../../adapters/base.js";
import { Logger } from "../../util/logger.js";
import { loadConfig } from "../../util/config.js";
import { loadBundledSkills, resolveTargetAdapters } from "./shared.js";

export default defineCommand({
  meta: { name: "update", description: "按 manifest 增量更新已安装的 skill" },
  args: {
    agent: { type: "string", alias: "a", description: "只更新某个平台" },
    json: { type: "boolean", description: "JSON 输出" },
  },
  async run(ctx) {
    const logger = Logger.fromEnv();
    const config = loadConfig();
    const skills = loadBundledSkills(logger);
    const adapters = resolveTargetAdapters(ctx.args.agent, undefined, config);

    const updated: Array<{ agent: string; skill: string; from: string; to: string }> = [];
    const skipped: Array<{ agent: string; skill: string }> = [];
    const stale: Array<{ agent: string; skill: string }> = [];

    for (const adapter of adapters) {
      const manifest = await adapter.installedSkills();
      for (const [name, entry] of Object.entries(manifest.skills)) {
        const bundled = skills.find((s) => s.meta.name === name);
        if (!bundled) {
          // 内置包已不再提供：不擅自删除（用户数据原则），提示显式 remove
          stale.push({ agent: adapter.id, skill: name });
          continue;
        }
        if (!needsUpdate(manifest, name, bundled.meta.version)) {
          skipped.push({ agent: adapter.id, skill: name });
          continue;
        }
        // copy 模式才走到这里（link 模式 needsUpdate 恒 false）；
        // install 内部会先移除旧副本再落新版本，manifest 同步刷新
        await adapter.install(bundled.dir, name, entry.mode);
        updated.push({ agent: adapter.id, skill: name, from: entry.version, to: bundled.meta.version });
        logger.info(`[${adapter.id}] ${name} ${entry.version} → ${bundled.meta.version}`);
      }
    }

    if (ctx.args.json === true) {
      logger.out(JSON.stringify({ updated, skipped, stale }, null, 2));
    } else {
      for (const u of updated) logger.out(`↑ ${u.agent}: ${u.skill} ${u.from} → ${u.to}`);
      logger.out(
        `更新 ${updated.length} 个，无需变化 ${skipped.length} 个` +
          (stale.length > 0 ? `，已下架待处理 ${stale.length} 个（用 zh-skills remove 清理）` : "") +
          "。",
      );
    }
    if (stale.length > 0) {
      // 下架残留不算失败，但要被脚本看到：退出码 0，仅输出信息
      logger.warn(`以下 skill 已从 zh-skills 包中移除，仍在本地：${stale.map((s) => s.skill).join(", ")}`);
    }
    // 防御：如果安装过程出现环境错误由顶层 catch 统一转退出码 2
    if (updated.length === 0 && stale.length === 0 && skipped.length === 0) {
      throw new EnvironmentError("没有找到任何已安装记录。先执行 zh-skills add。");
    }
  },
});
