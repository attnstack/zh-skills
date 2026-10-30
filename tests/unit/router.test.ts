// 路由器单测：正向命中、负向惩罚、阈值过滤、边界输入
import { describe, expect, it } from "vitest";
import { SkillRouter } from "../../src/router/index.js";
import { loadSkillDir } from "../../src/core/skill.js";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const skillsRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "skills");
const skills = loadSkillDir(skillsRoot);
const router = new SkillRouter(skills);

describe("SkillRouter（基于真实 12 个 skill）", () => {
  it("正向 query 命中", () => {
    const { items } = router.route("帮我写周报");
    expect(items.length).toBeGreaterThan(0);
    expect(items[0]?.name).toBe("zh-weekly-report");
  });

  it("与所有 description 零重叠时返回空", () => {
    expect(router.route("今天天气怎么样").items).toEqual([]);
  });

  it("空 query 返回空", () => {
    expect(router.route("").items).toEqual([]);
    expect(router.route("！？。").items).toEqual([]);
  });

  it("负向惩罚：营销文案不应命中 zh-tech-writing", () => {
    // tech-writing 的负向段含「营销文案」，若负向惩罚失效，query 会因词面重叠误命中
    const result = router.route("帮我写个营销文案");
    const hit = result.items.find((i) => i.name === "zh-tech-writing");
    expect(hit).toBeUndefined();
  });

  it("topK 生效", () => {
    const { items } = router.route("帮我写文档", { topK: 2 });
    expect(items.length).toBeLessThanOrEqual(2);
  });

  it("minScoreRatio 过滤弱候选", () => {
    // 极端 minScoreRatio=1：只保留与最高分完全持平的候选
    const { items } = router.route("帮我写周报", { minScoreRatio: 1 });
    const scores = items.map((i) => i.score);
    if (scores.length > 1) {
      expect(new Set(scores).size).toBe(1);
    }
  });

  it("matchedTerms 只含真实命中的词元", () => {
    const { items } = router.route("写周报");
    expect(items[0]?.matchedTerms.length).toBeGreaterThan(0);
  });

  it("12 个 skill 全部入库", () => {
    expect(router.size).toBe(12);
  });
});
