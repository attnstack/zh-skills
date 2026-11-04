// lint 命令：校验任意技能根目录的资产质量（frontmatter / 样例对 / 坑记录 / 行数约束）
// 定位：外部技能作者的自检入口，与仓库 CI 门禁共用 src/core/validate.ts 的判定
import { defineCommand } from "citty";
import { validateSkillsRoot } from "../../core/validate.js";
import { Logger } from "../../util/logger.js";
import { bundledSkillsDir } from "../skills-source.js";

export default defineCommand({
  meta: { name: "lint", description: "校验技能目录（默认内置技能）：frontmatter/样例/坑记录" },
  args: {
    dir: { type: "string", description: "技能根目录，默认为内置 skills/" },
    json: { type: "boolean", description: "JSON 输出" },
  },
  async run(ctx) {
    const logger = Logger.fromEnv();
    const root = ctx.args.dir ?? bundledSkillsDir();
    const { skills, problems } = validateSkillsRoot(root, { minCount: 1 });

    if (ctx.args.json === true) {
      logger.out(
        JSON.stringify(
          { root, skills: skills.map((s) => s.meta.name), problems },
          null,
          2,
        ) + "\n",
      );
    } else {
      for (const p of problems) {
        logger.out(`✗ ${p.name ?? "?"}: ${p.message}（${p.dir}）`);
      }
      logger.out(
        problems.length === 0
          ? `OK：${skills.length} 个技能全部通过校验`
          : `共 ${problems.length} 个问题`,
      );
    }
    if (problems.length > 0) {
      process.exitCode = 1;
    }
  },
});
