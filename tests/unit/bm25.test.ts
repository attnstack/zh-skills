// BM25 单测：打分方向性、零重叠、索引统计正确性
import { describe, expect, it } from "vitest";
import { buildBm25Index, score, idf } from "../../src/router/bm25.js";

function makeIndex() {
  return buildBm25Index([
    { id: "a", tokens: ["周报", "生成", "工具", "周报"] },
    { id: "b", tokens: ["排版", "修复", "工具"] },
  ]);
}

describe("buildBm25Index", () => {
  it("df 与平均长度统计正确", () => {
    const index = makeIndex();
    expect(index.df.get("周报")).toBe(1);
    expect(index.df.get("工具")).toBe(2);
    expect(index.avgLen).toBeCloseTo((4 + 3) / 2);
  });

  it("空语料", () => {
    const index = buildBm25Index([]);
    expect(index.avgLen).toBe(0);
    expect(score(index, ["x"])).toEqual([]);
  });
});

describe("score", () => {
  it("包含查询词的文档得分更高", () => {
    const index = makeIndex();
    const results = score(index, ["周报"]);
    expect(results[0]?.id).toBe("a");
    expect(results[0]!.score).toBeGreaterThan(0);
  });

  it("零重叠返回空（阈值路由依赖这一行为）", () => {
    const index = makeIndex();
    expect(score(index, ["天气"])).toEqual([]);
  });

  it("词频贡献有饱和（重复 token 增益递减）", () => {
    const index = buildBm25Index([
      { id: "a", tokens: ["周报", "周报", "其他"] },
    ]);
    const one = score(buildBm25Index([{ id: "a", tokens: ["周报", "其他"] }]), ["周报"])[0]!.score;
    const twice = score(index, ["周报"])[0]!.score;
    expect(twice).toBeGreaterThan(one); // 有增益
    expect(twice).toBeLessThan(one * 2); // 但不线性翻倍（K1 饱和）
  });
});

describe("idf", () => {
  it("df=N 时仍为正（BM25+ 变体）", () => {
    const index = buildBm25Index([
      { id: "a", tokens: ["工具"] },
      { id: "b", tokens: ["工具"] },
    ]);
    expect(idf(index, "工具")).toBeGreaterThan(0);
  });

  it("未登录词 idf 高于常见词", () => {
    const index = makeIndex();
    expect(idf(index, "未登录词xyz")).toBeGreaterThan(idf(index, "工具"));
  });
});
