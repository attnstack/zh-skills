// 路由回归测试：评测集卡 CI —— 改 description 必须跑这个
// 阈值与方案 §6.3 一致：Top-3 命中率 ≥ 85%；否定样本误报率 ≤ 10%
import { describe, expect, it } from "vitest";
import { evaluate, loadQueries, routerFor } from "../../src/router/eval.js";
import { loadSkillDir } from "../../src/core/skill.js";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const skills = loadSkillDir(join(repoRoot, "skills"));
const queries = loadQueries(join(repoRoot, "tests", "router", "queries.jsonl"));

describe("路由回归集", () => {
  const report = evaluate(routerFor(skills), queries);

  it("评测集规模符合约定（≥ 60 条，且三类样本齐全）", () => {
    expect(queries.length).toBeGreaterThanOrEqual(60);
    expect(report.positives).toBeGreaterThan(0);
    expect(report.negatives).toBeGreaterThan(0);
  });

  it("Top-3 命中率 ≥ 85%", () => {
    expect(
      report.top3,
      `Top-3 命中率 ${(report.top3 * 100).toFixed(1)}% 低于阈值，未通过样本：\n` +
        report.failures.map((f) => `  "${f.query}" 期望 ${f.expect.join("/")} 实得 ${f.got.join("/") || "空"}`).join("\n"),
    ).toBeGreaterThanOrEqual(0.85);
  });

  it("否定样本误报率 ≤ 10%", () => {
    expect(
      report.falsePositive,
      `否定样本误报率 ${(report.falsePositive * 100).toFixed(1)}% 超阈值，误报样本：\n` +
        report.failures
          .filter((f) => f.expect.length === 0)
          .map((f) => `  "${f.query}" 误报为 ${f.got.join("/")}`)
          .join("\n"),
    ).toBeLessThanOrEqual(0.1);
  });

  it("Top-1 命中率不低于 70%（内部质量线，防止靠 Top-3 兜底退化）", () => {
    expect(report.top1).toBeGreaterThanOrEqual(0.7);
  });
});
