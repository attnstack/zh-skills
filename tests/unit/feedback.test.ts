// 反馈闭环单测：记录 → 重放 → 命中率报告；坏行跳过不阻塞报告
import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { recordFeedback, summarizeFeedback } from "../../src/core/feedback.js";
import { SkillRouter } from "../../src/router/index.js";
import { loadSkillDir } from "../../src/core/skill.js";

const skills = loadSkillDir(join(dirname(fileURLToPath(import.meta.url)), "..", "..", "skills"));
const router = new SkillRouter(skills);

function tmpFile(name: string): string {
  return join(mkdtempSync(join(tmpdir(), "zh-feedback-")), name);
}

describe("feedback", () => {
  it("记录后可重放计算命中率，未命中进 misses", () => {
    const file = tmpFile("fb.jsonl");
    const entry = recordFeedback(file, {
      query: "帮我写周报",
      expected: ["zh-weekly-report"],
      got: ["zh-weekly-report"],
    });
    expect(entry.ts).toBeTruthy();
    recordFeedback(file, {
      query: "把这段话翻译成英文",
      expected: ["zh-typography"],
      got: [],
    });
    const report = summarizeFeedback(router, file);
    expect(report.total).toBe(2);
    expect(report.hit1).toBeCloseTo(0.5);
    expect(report.hit3).toBeCloseTo(0.5);
    expect(report.misses).toHaveLength(1);
    expect(report.misses[0]?.query).toBe("把这段话翻译成英文");
    rmSync(file, { force: true });
  });

  it("文件不存在返回零报告", () => {
    const report = summarizeFeedback(router, join(tmpdir(), "zh-no-such-dir", "none.jsonl"));
    expect(report.total).toBe(0);
    expect(report.misses).toHaveLength(0);
  });

  it("损坏行被跳过，不影响其余记录", () => {
    const file = tmpFile("broken.jsonl");
    recordFeedback(file, { query: "帮我写周报", expected: ["zh-weekly-report"], got: [] });
    writeFileSync(file, "{broken json\n", { flag: "a" });
    recordFeedback(file, { query: "帮我写周报", expected: ["zh-weekly-report"], got: [] });
    const report = summarizeFeedback(router, file);
    expect(report.total).toBe(2);
    rmSync(file, { force: true });
  });
});
