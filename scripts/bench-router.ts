// 路由 benchmark：可复现实测脚本（CI 与本地共用）
// 输出三组指标：
//  1) 分词 n（1/2/3）与负向惩罚（on/off）的命中率矩阵 —— 默认值的依据
//  2) 单次路由延迟（预热后 1000 次取均值/中位数）
//  3) 上下文节省：全量注入 vs Top-3 注入的字节数对比
// 基线说明：上下文节省的基线是「12 个 skill 全量注入」（无路由的最朴素方案）
// 用法：npm run bench [-- --json]
import { writeFileSync, mkdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { SkillRouter } from "../src/router/index.js";
import { evaluate, loadQueries, routerFor } from "../src/router/eval.js";
import { loadSkillDir } from "../src/core/skill.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const skills = loadSkillDir(join(repoRoot, "skills"));
const queries = loadQueries(join(repoRoot, "tests", "router", "queries.jsonl"));

interface MatrixRow {
  cjkN: number;
  negativePenalty: number;
  top1: number;
  top3: number;
  falsePositive: number;
}

const rows: MatrixRow[] = [];
for (const cjkN of [1, 2, 3]) {
  for (const negativePenalty of [0, 1.0]) {
    const router = routerFor(skills, { cjkN, negativePenalty });
    const report = evaluate(router, queries);
    rows.push({
      cjkN,
      negativePenalty,
      top1: round3(report.top1),
      top3: round3(report.top3),
      falsePositive: round3(report.falsePositive),
    });
  }
}

// ---- 延迟：预热 50 次后测 1000 次（每次重建路由器模拟冷启动外的真实查询路径）----
const router = routerFor(skills);
const sampleQueries = queries.filter((q) => q.expect.length > 0).map((q) => q.query);
for (let i = 0; i < 50; i++) {
  router.route(sampleQueries[i % sampleQueries.length]!);
}
const latencies: number[] = [];
for (let i = 0; i < 1000; i++) {
  const query = sampleQueries[i % sampleQueries.length]!;
  const start = performance.now();
  router.route(query);
  latencies.push(performance.now() - start);
}
latencies.sort((a, b) => a - b);
const latency = {
  samples: latencies.length,
  meanMs: round3(latencies.reduce((a, b) => a + b, 0) / latencies.length),
  p50Ms: round3(percentile(latencies, 0.5)),
  p99Ms: round3(percentile(latencies, 0.99)),
};

// ---- 上下文节省：全量（12 个 SKILL.md 全文）vs Top-3（路由返回的 3 个）----
function skillBytes(dir: string): number {
  return statSync(join(dir, "SKILL.md")).size;
}
const totalBytes = skills.reduce((sum, s) => sum + skillBytes(s.dir), 0);
// 取每条 query 的 Top-3（若不足 3 个按实际数量计），汇总平均注入字节数
let top3Total = 0;
let top3Count = 0;
for (const q of sampleQueries) {
  const { items } = router.route(q);
  const bytes = items
    .map((i) => skills.find((s) => s.meta.name === i.name))
    .filter((s): s is NonNullable<typeof s> => s !== undefined)
    .reduce((sum, s) => sum + skillBytes(s.dir), 0);
  top3Total += bytes;
  top3Count += 1;
}
const avgTop3Bytes = top3Count === 0 ? 0 : top3Total / top3Count;
const context = {
  baseline: "12 个 skill 全量注入（无路由）",
  totalBytes,
  avgTop3Bytes: Math.round(avgTop3Bytes),
  savingRatio: round3(1 - avgTop3Bytes / totalBytes),
};

const output = {
  meta: {
    date: new Date().toISOString(),
    testSet: "tests/router/queries.jsonl",
    sampleSize: queries.length,
    positives: queries.filter((q) => q.expect.length > 0).length,
    negatives: queries.filter((q) => q.expect.length === 0).length,
    skills: skills.length,
    baseline: "全量注入（无路由）；命中率为 12 选 3 的检索结果，非模型判定",
    significance: "确定性计算（同输入同输出），无随机性，无需显著性检验",
  },
  matrix: rows,
  latency,
  context,
};

mkdirSync(join(repoRoot, "bench"), { recursive: true });
if (process.argv.includes("--json")) {
  process.stdout.write(JSON.stringify(output, null, 2) + "\n");
}
writeFileSync(join(repoRoot, "bench", "results.json"), JSON.stringify(output, null, 2) + "\n", "utf8");

// 人读的表
console.log("== 路由命中率矩阵（测试集 %d 条） ==", queries.length);
console.log("cjkN\tnegPenalty\tTop-1\tTop-3\t否定误报");
for (const r of rows) {
  console.log(
    `${r.cjkN}\t${r.negativePenalty}\t${(r.top1 * 100).toFixed(1)}%\t${(r.top3 * 100).toFixed(1)}%\t${(r.falsePositive * 100).toFixed(1)}%`,
  );
}
console.log("\n== 路由延迟（单次，%d 次采样） ==", latency.samples);
console.log(`mean=${latency.meanMs}ms p50=${latency.p50Ms}ms p99=${latency.p99Ms}ms`);
console.log("\n== 上下文节省（基线：全量注入） ==");
console.log(
  `全量 ${totalBytes} bytes → Top-3 平均 ${context.avgTop3Bytes} bytes，节省 ${(context.savingRatio * 100).toFixed(1)}%`,
);

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function percentile(sorted: number[], p: number): number {
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
  return sorted[idx] ?? 0;
}
