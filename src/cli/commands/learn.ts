// learn 命令：把失败反例写入已装 skill 的 pitfalls.md（经验库的本地落点）
// 注意：npx 缓存/npm 全局目录里的内容会在升级时丢失，
// 所以命令同时把格式化后的 markdown 打到 stdout，方便用户提 PR 回传上游——
// 反例库要持续生长，最终靠的是上游 PR 流程，不是本地文件
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { defineCommand } from "citty";
import { UsageError } from "../../core/errors.js";
import { Logger } from "../../util/logger.js";
import { loadConfig } from "../../util/config.js";
import { positionals, resolveTargetAdapters } from "./shared.js";

export default defineCommand({
  meta: { name: "learn", description: "把失败反例写进 skill 的经验库（pitfalls.md）" },
  args: {
    agent: { type: "string", alias: "a", description: "写入哪个平台的安装副本" },
  },
  async run(ctx) {
    const logger = Logger.fromEnv();
    const config = loadConfig();
    const parts = positionals(ctx.args._);
    if (parts.length < 2) {
      throw new UsageError('用法：zh-skills learn <skill名> <记录文件>（记录文件是反例描述，markdown 或纯文本）');
    }
    const [skillName, recordFile] = parts as [string, string];
    if (!existsSync(recordFile)) {
      throw new UsageError(`记录文件不存在：${recordFile}`);
    }
    const content = readFileSync(recordFile, "utf8").trim();
    if (content.length === 0) {
      throw new UsageError(`记录文件为空：${recordFile}`);
    }

    const adapters = resolveTargetAdapters(ctx.args.agent, undefined, config);
    const today = new Date().toISOString().slice(0, 10);
    const entry = `\n## [${today}] ${skillName} 反例\n${content
      .split(/\r?\n/)
      .map((line) => `- ${line}`)
      .join("\n")}\n`;

    let wroteAny = false;
    for (const adapter of adapters) {
      const dir = join(await adapter.skillsDir(), skillName);
      const pitfalls = join(dir, "references", "pitfalls.md");
      if (!existsSync(pitfalls)) {
        logger.warn(`[${adapter.id}] 未找到 ${pitfalls}（skill 未安装或不是 copy 安装），跳过写入`);
        continue;
      }
      mkdirSync(join(dir, "references"), { recursive: true });
      appendFileSync(pitfalls, entry, "utf8");
      wroteAny = true;
      logger.info(`[${adapter.id}] 已追加到 ${pitfalls}`);
    }

    logger.out("--- 回传上游的 markdown（复制到 PR 提给 zh-skills 仓库） ---");
    logger.out(entry.trimEnd());
    if (!wroteAny) {
      logger.warn("没有写入任何本地文件；上面的内容仍可用于回传上游。");
    }
  },
});
