// feedback 命令：重放反馈记录，报告当前路由对真实误判的修复程度
// 用法：日常用 route --label 记录，改完 description 后跑 zh-skills feedback 看命中率变化
import { defineCommand } from "citty";
import { SkillRouter } from "../../router/index.js";
import { summarizeFeedback } from "../../core/feedback.js";
import { Logger } from "../../util/logger.js";
import { loadBundledSkills } from "./shared.js";

export default defineCommand({
  meta: { name: "feedback", description: "重放路由反馈记录，报告离线命中率" },
  args: {
    json: { type: "boolean", description: "JSON 输出" },
  },
  async run(ctx) {
    const logger = Logger.fromEnv();
    const skills = loadBundledSkills(logger);
    const router = new SkillRouter(skills);
    const { feedbackFilePath } = await import("../../core/feedback.js");
    const file = feedbackFilePath();
    const report = summarizeFeedback(router, file);

    if (ctx.args.json === true) {
      logger.out(JSON.stringify({ file, ...report }, null, 2));
      return;
    }
    if (report.total === 0) {
      logger.out(
        `还没有反馈记录。日常使用时用 route --label <技能名> 记录期望命中，再跑本命令查看报告（${file}）`,
      );
      return;
    }
    logger.out(`反馈记录 ${report.total} 条（重放按当前路由器计算，文件：${file}）`);
    logger.out(`Top-1 命中 ${(report.hit1 * 100).toFixed(1)}%，Top-K 命中 ${(report.hit3 * 100).toFixed(1)}%`);
    if (report.misses.length > 0) {
      logger.out("仍未命中的记录：");
      for (const m of report.misses) {
        logger.out(`  "${m.query}" 期望 ${m.expected.join("/")}，当前结果 ${m.gotNow.join("/") || "空"}`);
      }
    }
  },
});
