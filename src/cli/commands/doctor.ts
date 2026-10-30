// doctor 命令：环境体检——Node 版本 / 平台检测 / 符号链接能力 / 已装 skill 完整性
// 所有结论给「依据」而不给裸结论，便于用户自查与提 issue
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineCommand } from "citty";
import { loadBundledSkills, resolveTargetAdapters } from "./shared.js";
import { Logger } from "../../util/logger.js";
import { loadConfig } from "../../util/config.js";

interface CheckRow {
  check: string;
  ok: boolean;
  detail: string;
  /** error 级：影响核心功能；warn 级：不影响安装，影响触发 */
  level: "error" | "warn" | "info";
}

function probeSymlink(): { ok: boolean; detail: string } {
  // 在系统临时目录做一次真实 symlink 探测，而不是猜平台能力
  const dir = mkdtempSync(join(tmpdir(), "zh-skills-probe-"));
  try {
    const target = join(dir, "target");
    const link = join(dir, "link");
    mkdirSync(target);
    symlinkSync(target, link, "dir");
    return { ok: existsSync(link), detail: "symlink 可用" };
  } catch (err) {
    return {
      ok: false,
      detail: `symlink 不可用（${err instanceof Error ? err.message : String(err)}），将自动降级 junction/copy`,
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export default defineCommand({
  meta: { name: "doctor", description: "环境体检：Node 版本 / 平台 / 链接能力 / 已装完整性" },
  args: {
    agent: { type: "string", alias: "a", description: "只体检某个平台" },
    json: { type: "boolean", description: "JSON 输出" },
  },
  async run(ctx) {
    const logger = Logger.fromEnv();
    const config = loadConfig();
    const rows: CheckRow[] = [];

    const nodeMajor = Number.parseInt(process.versions.node.split(".")[0] ?? "0", 10);
    rows.push({
      check: "Node >= 20",
      ok: nodeMajor >= 20,
      detail: `当前 ${process.versions.node}`,
      level: nodeMajor >= 20 ? "info" : "error",
    });

    const skills = loadBundledSkills(logger);
    rows.push({
      check: "内置 skills",
      ok: skills.length > 0,
      detail: `${skills.length} 个`,
      level: skills.length > 0 ? "info" : "error",
    });

    const link = probeSymlink();
    rows.push({ check: "symlink 能力", ok: link.ok, detail: link.detail, level: "info" });

    const adapters = resolveTargetAdapters(ctx.args.agent, undefined, config);
    for (const adapter of adapters) {
      const detect = await adapter.detect();
      rows.push({
        check: `平台 ${adapter.id}`,
        ok: true,
        detail: detect.reason + (adapter.experimental ? "（experimental：目录约定以官方文档为准）" : ""),
        level: "info",
      });
      const manifest = await adapter.installedSkills();
      const names = Object.keys(manifest.skills);
      if (names.length === 0) continue;
      const report = await adapter.verify(names);
      rows.push({
        check: `已装校验 ${adapter.id}`,
        ok: report.ok,
        detail: report.ok ? `${names.length} 个 skill 完整` : report.issues.map((i) => `${i.skill}: ${i.problem}`).join("; "),
        level: report.ok ? "info" : "error",
      });
    }

    if (ctx.args.json === true) {
      logger.out(JSON.stringify(rows, null, 2));
    } else {
      for (const row of rows) {
        const mark = row.ok ? "✓" : row.level === "error" ? "✗" : "!";
        logger.out(`${mark} ${row.check} — ${row.detail}`);
      }
      const errors = rows.filter((r) => !r.ok && r.level === "error").length;
      logger.out(
        errors === 0
          ? "环境正常。"
          : `发现 ${errors} 个影响使用的问题，见上方 ✗ 项。`,
      );
    }
    if (rows.some((r) => !r.ok && r.level === "error")) {
      process.exitCode = 2;
    }
  },
});
