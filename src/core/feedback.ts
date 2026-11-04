// 路由反馈闭环的数据层：query→期望技能 记录为 JSONL，离线用当前路由器重放算命中率。
// 这是设计文档 §6.3 的落点——description 改没改好，用真实使用中的误判说话
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import type { SkillRouter } from "../router/index.js";

const entrySchema = z.object({
  ts: z.string().min(1),
  query: z.string().min(1),
  expected: z.array(z.string()),
  /** 记录时的路由结果，供事后对比「当时」与「现在」 */
  got: z.array(z.string()),
});

export type FeedbackEntry = z.infer<typeof entrySchema>;

export function feedbackFilePath(): string {
  const override = process.env.ZH_SKILLS_FEEDBACK;
  if (override) return override;
  return join(homedir(), ".zh-skills", "feedback.jsonl");
}

export function recordFeedback(
  file: string,
  input: { query: string; expected: string[]; got: string[] },
): FeedbackEntry {
  const entry = entrySchema.parse({ ts: new Date().toISOString(), ...input });
  appendFileSync(file, JSON.stringify(entry) + "\n", "utf8");
  return entry;
}

export interface FeedbackReport {
  total: number;
  /** 按当前路由器重放：期望技能排第 1 的比例 */
  hit1: number;
  /** 按当前路由器重放：期望技能出现在 Top-K 的比例 */
  hit3: number;
  misses: Array<{ query: string; expected: string[]; gotNow: string[] }>;
}

export function summarizeFeedback(router: SkillRouter, file: string): FeedbackReport {
  if (!existsSync(file)) {
    return { total: 0, hit1: 0, hit3: 0, misses: [] };
  }
  let total = 0;
  let hit1Count = 0;
  let hit3Count = 0;
  const misses: FeedbackReport["misses"] = [];
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    if (line.trim().length === 0) continue;
    // 坏行跳过：反馈文件是用户数据，个别损坏不该让整份报告出不来
    let parsed: FeedbackEntry;
    try {
      const result = entrySchema.safeParse(JSON.parse(line));
      if (!result.success) continue;
      parsed = result.data;
    } catch {
      continue;
    }
    total += 1;
    const gotNow = router.route(parsed.query).items.map((i) => i.name);
    const hitTop1 = parsed.expected.includes(gotNow[0] ?? "");
    const hitTop3 = parsed.expected.some((e) => gotNow.includes(e));
    if (hitTop1) hit1Count += 1;
    if (hitTop3) hit3Count += 1;
    else misses.push({ query: parsed.query, expected: parsed.expected, gotNow });
  }
  return {
    total,
    hit1: total === 0 ? 0 : hit1Count / total,
    hit3: total === 0 ? 0 : hit3Count / total,
    misses,
  };
}
