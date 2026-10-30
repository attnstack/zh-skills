// list 命令：展示内置 skill 清单与各平台安装状态（installed / outdated / available）
import { defineCommand } from "citty";
import { Logger } from "../../util/logger.js";
import { loadConfig } from "../../util/config.js";
import { loadBundledSkills, resolveTargetAdapters } from "./shared.js";

interface Row {
  skill: string;
  version: string;
  agent: string;
  state: "installed" | "outdated" | "available" | "unmanaged";
}

export default defineCommand({
  meta: { name: "list", description: "列出可装与已装的 skill" },
  args: {
    agent: { type: "string", alias: "a", description: "只看某个平台" },
    json: { type: "boolean", description: "JSON 输出" },
  },
  async run(ctx) {
    const logger = Logger.fromEnv();
    const config = loadConfig();
    const skills = loadBundledSkills(logger);
    const adapters = resolveTargetAdapters(ctx.args.agent, undefined, config);

    const rows: Row[] = [];
    for (const adapter of adapters) {
      const manifest = await adapter.installedSkills();
      for (const skill of skills) {
        const entry = manifest.skills[skill.meta.name];
        let state: Row["state"] = "available";
        if (entry) {
          state = entry.version === skill.meta.version ? "installed" : "outdated";
        }
        rows.push({ skill: skill.meta.name, version: skill.meta.version, agent: adapter.id, state });
      }
      // manifest 里存在但内置包已不再提供的 skill：提示用户处理（remove 或手动清理）
      for (const name of Object.keys(manifest.skills)) {
        if (!skills.some((s) => s.meta.name === name)) {
          rows.push({ skill: name, version: manifest.skills[name]!.version, agent: adapter.id, state: "unmanaged" });
        }
      }
    }

    if (ctx.args.json === true) {
      logger.out(JSON.stringify(rows, null, 2));
      return;
    }

    const stateLabel: Record<Row["state"], string> = {
      installed: "已安装",
      outdated: "有更新",
      available: "可安装",
      unmanaged: "已下架",
    };
    const width = Math.max(...rows.map((r) => r.skill.length), 10);
    for (const row of rows) {
      logger.out(
        `${row.skill.padEnd(width)}  v${row.version.padEnd(8)}  ${row.agent.padEnd(12)}  ${stateLabel[row.state]}`,
      );
    }
    logger.out(`共 ${rows.length} 行（skill × 平台）。`);
  },
});
