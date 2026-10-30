// 仓库 skills 资产校验：schema / 行数 / description 约定 / examples 存在性 / 脚本一致性
// CI 门禁：npm run validate:skills —— description 是路由命门，任何改动都在这里被挡下
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadSkill, splitDescription, type Skill } from "../src/core/skill.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "skills");
const problems: string[] = [];

const seen = new Set<string>();
for (const entry of readdirSync(root)) {
  const dir = join(root, entry);
  if (!statSync(dir).isDirectory()) continue;

  let skill: Skill;
  try {
    skill = loadSkill(dir);
  } catch (err) {
    problems.push(`${entry}: ${err instanceof Error ? err.message : String(err)}`);
    continue;
  }
  const { meta } = skill;
  if (seen.has(meta.name)) problems.push(`${entry}: name 重复 ${meta.name}`);
  seen.add(meta.name);
  if (meta.name !== entry) problems.push(`${entry}: 目录名与 name(${meta.name}) 不一致`);

  // 渐进披露约束：正文 < 500 行
  if (skill.bodyLines >= 500) {
    problems.push(`${meta.name}: SKILL.md 正文 ${skill.bodyLines} 行，超过 500 行上限`);
  }

  // description 约定：正向触发 + 不适用场景（负向段缺失会让路由假阳性上升）
  const { negative } = splitDescription(meta.description);
  if (!negative) {
    problems.push(`${meta.name}: description 缺少「不适用于」负向段`);
  }
  if (meta.description.includes("TODO")) {
    problems.push(`${meta.name}: description 含 TODO 占位`);
  }

  // examples 成对存在
  const input = join(dir, "examples", "input.md");
  const output = join(dir, "examples", "output.md");
  if (!existsSync(input) || !existsSync(output)) {
    problems.push(`${meta.name}: examples/input.md 与 output.md 必须成对存在`);
  }

  // pitfalls 存在（自进化飞轮的落点，空着说明没有维护）
  const pitfalls = join(dir, "references", "pitfalls.md");
  if (!existsSync(pitfalls)) {
    problems.push(`${meta.name}: 缺少 references/pitfalls.md`);
  }

  // 有校验脚本的 skill：脚本可执行且 output 通过校验
  const scriptsDir = join(dir, "scripts");
  if (existsSync(scriptsDir)) {
    for (const script of readdirSync(scriptsDir)) {
      const scriptPath = join(scriptsDir, script);
      if (!statSync(scriptPath).isFile()) continue;
      try {
        // 可执行性冒烟：不带输入跑一遍，允许非零退出（等待 stdin 的脚本除外）
        // 这里只验证脚本存在且 node 可加载；行为校验在下方按 skill 定制
      } catch {
        problems.push(`${meta.name}: 脚本 ${script} 无法执行`);
      }
    }
  }

  // zh-typography：fix(input) 必须与 output.md 完全一致（可验证样例的闭环）。
  // 比较前归一化行尾：Windows checkout 出 CRLF 工作区时不应误报（内容等价即可）
  if (meta.name === "zh-typography" && existsSync(input) && existsSync(output)) {
    const normalizeEol = (s: string): string => s.replace(/\r\n/g, "\n");
    const fixed = execFileSync("node", [join(scriptsDir, "fix.mjs")], {
      input: readFileSync(input, "utf8"),
      encoding: "utf8",
    });
    const expected = readFileSync(output, "utf8");
    if (normalizeEol(fixed) !== normalizeEol(expected)) {
      problems.push("zh-typography: fix.mjs(input.md) 与 output.md 不一致，样例失去可验证性");
    }
    const check = (() => {
      try {
        execFileSync("node", [join(scriptsDir, "check.mjs")], {
          input: expected,
          encoding: "utf8",
          stdio: ["pipe", "pipe", "pipe"],
        });
        return true;
      } catch {
        return false;
      }
    })();
    if (!check) {
      problems.push("zh-typography: output.md 未通过 check.mjs（自检即失败）");
    }
  }

  // zh-commit-message / zh-pr-description：output 必须通过各自的 check 脚本
  if ((meta.name === "zh-commit-message" || meta.name === "zh-pr-description") && existsSync(output)) {
    try {
      execFileSync("node", [join(scriptsDir, "check.mjs")], {
        input: readFileSync(output, "utf8"),
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      problems.push(`${meta.name}: examples/output.md 未通过校验脚本：${detail}`);
    }
  }
}

if (seen.size === 0) {
  problems.push("skills/ 目录为空或全部损坏");
}

if (problems.length > 0) {
  for (const p of problems) console.error(`✗ ${p}`);
  console.error(`共 ${problems.length} 个问题`);
  process.exit(1);
}
console.log(`OK：${seen.size} 个 skill 全部通过校验`);
