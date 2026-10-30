// 分词器单测：正常 / 边界 / 异常三类输入
import { describe, expect, it } from "vitest";
import { tokenize, normalize } from "../../src/router/tokenizer.js";

describe("normalize", () => {
  it("全角字母数字转半角", () => {
    expect(normalize("ＲＥＡＤＭＥ ２０２６")).toBe("readme 2026");
  });

  it("全角标点不转（留给上层决定）", () => {
    expect(normalize("！？")).toBe("！？");
  });

  it("空串", () => {
    expect(normalize("")).toBe("");
  });
});

describe("tokenize", () => {
  it("中文按 bigram 切分", () => {
    expect(tokenize("帮我写周报")).toEqual(["帮我", "我写", "写周", "周报"]);
  });

  it("ASCII 连续串作为整体词元", () => {
    expect(tokenize("use README.md v2")).toEqual(["use", "readme", "md", "v2"]);
  });

  it("中英混排分界正确", () => {
    // CJK 与 ASCII 各自成段，不产生跨界的混合词元（跨界匹配由 n-gram 的边界词元兜底）
    expect(tokenize("支持Node.js开发")).toEqual(["支持", "node", "js", "开发"]);
  });

  it("片段短于 n 时整段保留", () => {
    expect(tokenize("站")).toEqual(["站"]);
    expect(tokenize("B站")).toEqual(["b", "站"]);
  });

  it("标点与空白都是边界", () => {
    expect(tokenize("周报、总结；report!")).toEqual(["周报", "总结", "report"]);
  });

  it("空输入返回空数组", () => {
    expect(tokenize("")).toEqual([]);
    expect(tokenize("!!!???")).toEqual([]);
  });

  it("cjkN=3 的 trigram 切分", () => {
    expect(tokenize("写周报", { cjkN: 3 })).toEqual(["写周报"]);
  });

  it("cjkN 非法值抛出（防御式校验）", () => {
    expect(() => tokenize("测试", { cjkN: 0 })).toThrow(RangeError);
  });
});
