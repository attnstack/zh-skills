// 路由评测：JSONL 标注集 → Top-1 / Top-3 命中率 + 否定样本误报率
// 评测集分三类样本——直接指令、间接描述、否定样本。
// 只测「直接指令」会自证循环（description 怎么写都能命中）；
// 否定样本（期望路由为空）是防「什么都往 Top-3 塞」的关键指标。

import { readFileSync } from "node:fs";
import { z } from "zod";
import { SkillRouter, type RouteOptions, type RouteResult } from "./index.js";
import type { Skill } from "../core/skill.js";

const querySchema = z.object({
  query: z.string().min(1),
  /** 期望命中的 skill 名；空数组表示不应路由到任何 skill（否定样本） */
  expect: z.array(z.string()),
  /** 样本类型，仅用于分层报告 */
  kind: z.enum(["direct", "indirect", "negative"]).default("direct"),
});

export type LabeledQuery = z.infer<typeof querySchema>;

export function loadQueries(path: string): LabeledQuery[] {
  const lines = readFileSync(path, "utf8").split(/\r?\n/).filter((l) => l.trim().length > 0);
  return lines.map((line, i) => {
    const parsed = querySchema.safeParse(JSON.parse(line));
    if (!parsed.success) {
      const issues = parsed.error.issues.map((x) => `${x.path.join(".")}: ${x.message}`).join("; ");
      throw new Error(`评测集第 ${i + 1} 行非法：${issues}`);
    }
    return parsed.data;
  });
}

export interface EvalReport {
  /** 正向样本数 */
  positives: number;
  /** 否定样本数 */
  negatives: number;
  /** 期望 skill 排在第 1 位的比例（正向样本） */
  top1: number;
  /** 期望 skill 出现在返回结果中的比例（正向样本） */
  top3: number;
  /** 否定样本误报率：期望为空但返回了结果的样本占比 */
  falsePositive: number;
  /** 分层明细，便于定位哪类查询弱 */
  byKind: Record<string, { total: number; top1: number; top3: number }>;
  failures: Array<{ query: string; expect: string[]; got: string[] }>;
}

export function evaluate(router: SkillRouter, queries: LabeledQuery[]): EvalReport {
  let posTop1 = 0;
  let posTop3 = 0;
  let negTotal = 0;
  let negFp = 0;
  const byKind = new Map<string, { total: number; top1: number; top3: number; pos: number; posTop1: number; posTop3: number }>();
  const failures: EvalReport["failures"] = [];

  for (const { query, expect, kind } of queries) {
    const result: RouteResult = router.route(query);
    const got = result.items.map((i) => i.name);
    const bucket = byKind.get(kind) ?? { total: 0, top1: 0, top3: 0, pos: 0, posTop1: 0, posTop3: 0 };
    bucket.total += 1;

    if (expect.length === 0) {
      negTotal += 1;
      if (got.length > 0) {
        negFp += 1;
        failures.push({ query, expect, got });
      }
    } else {
      bucket.pos += 1;
      const hitTop1 = expect.includes(got[0] ?? "");
      const hitTop3 = expect.some((e) => got.includes(e));
      if (hitTop1) {
        posTop1 += 1;
        bucket.posTop1 += 1;
      }
      if (hitTop3) {
        posTop3 += 1;
        bucket.posTop3 += 1;
      }
      if (!hitTop3) {
        failures.push({ query, expect, got });
      }
    }
    byKind.set(kind, bucket);
  }

  const positives = queries.length - negTotal;
  const byKindReport: EvalReport["byKind"] = {};
  for (const [kind, b] of byKind) {
    byKindReport[kind] = {
      total: b.total,
      top1: b.pos === 0 ? 0 : b.posTop1 / b.pos,
      top3: b.pos === 0 ? 0 : b.posTop3 / b.pos,
    };
  }

  return {
    positives,
    negatives: negTotal,
    top1: positives === 0 ? 0 : posTop1 / positives,
    top3: positives === 0 ? 0 : posTop3 / positives,
    falsePositive: negTotal === 0 ? 0 : negFp / negTotal,
    byKind: byKindReport,
    failures,
  };
}

/** 从已加载的 skills 构建评测用 router（评测与生产共用同一构造路径，避免测的不是产的） */
export function routerFor(skills: Skill[], options: Partial<RouteOptions> = {}): SkillRouter {
  return new SkillRouter(skills, options);
}
