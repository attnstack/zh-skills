// route 命令：本地模拟路由——写 description 的调试工具
// 定位说明：Claude Code 等平台自带触发机制，本命令的价值是离线验证
// 「这句 description 能不能被这类 query 触发」，是路由回归集的单条手工入口
import { defineCommand } from "citty";
import { SkillRouter } from "../../router/index.js";
import { Logger } from "../../util/logger.js";
import { loadConfig } from "../../util/config.js";
import { loadBundledSkills, positionals } from "./shared.js";

export default defineCommand({
  meta: { name: "route", description: '模拟路由：zh-skills route "帮我写周报"' },
  args: {
    topK: { type: "string", description: "返回数量，默认取配置（3）" },
    debug: { type: "boolean", description: "显示命中词元与被负向惩罚压掉的候选" },
    json: { type: "boolean", description: "JSON 输出" },
  },
  async run(ctx) {
    const logger = Logger.fromEnv();
    const config = loadConfig();
    const parts = positionals(ctx.args._);
    const query = parts.join(" ").trim();
    if (query.length === 0) {
      throw new Error('用法：zh-skills route "<用户输入>"（query 需要引号包住）');
    }

    const skills = loadBundledSkills(logger);
    const router = new SkillRouter(skills);
    const topK = ctx.args.topK !== undefined ? Number.parseInt(ctx.args.topK, 10) : config.routeTopK;
    if (!Number.isInteger(topK) || topK < 1) {
      throw new Error(`--topK 必须是正整数，收到 "${ctx.args.topK}"`);
    }
    const result = router.route(query, { topK });

    if (ctx.args.json === true) {
      logger.out(JSON.stringify({ query, ...result }, null, 2));
      return;
    }
    if (result.items.length === 0) {
      logger.out(`「${query}」没有命中任何 skill（可能是 query 与所有 description 无词面重叠，或全被负向惩罚压掉）。`);
      if (ctx.args.debug === true) {
        for (const s of result.suppressed) {
          logger.out(`  [suppressed] ${s.name} score=${s.score.toFixed(3)} matched=${s.matchedTerms.join("/")}`);
        }
      }
      return;
    }
    for (const item of result.items) {
      logger.out(`${item.name}  score=${item.score.toFixed(3)}`);
      if (ctx.args.debug === true) {
        logger.out(`  matched: ${item.matchedTerms.join(" / ") || "（无）"}`);
      }
    }
    if (ctx.args.debug === true) {
      for (const s of result.suppressed) {
        logger.out(`  [suppressed] ${s.name} score=${s.score.toFixed(3)} matched=${s.matchedTerms.join("/")}`);
      }
    }
  },
});
