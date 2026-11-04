// 仓库 skills 资产门禁：在通用校验（src/core/validate.ts）之上叠加仓库专属检查——
// 样例与校验脚本的一致性（typography 逐字节比对、三个 check 脚本判分）
// CI 门禁：npm run validate:skills —— description 是路由命门，任何改动都在这里被挡下
import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { validateSkillsRoot } from "../src/core/validate.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "skills");
const { skills, problems } = validateSkillsRoot(root, { minCount: 1 });

// 这些 skill 的输出能被 scripts/check.mjs 判分：output.md 必须真的通过
const SCRIPT_CHECKED = ["zh-commit-message", "zh-pr-description", "zh-postmortem"];

for (const skill of skills) {
  const dir = skill.dir;
  const input = join(dir, "examples", "input.md");
  const output = join(dir, "examples", "output.md");
  const scriptsDir = join(dir, "scripts");

  // typography：fix(input) 必须与 output.md 内容一致（可验证样例的闭环）。
  // 比较前归一化行尾：Windows checkout 出 CRLF 工作区时不应误报（内容等价即可）
  if (skill.meta.name === "zh-typography" && existsSync(input) && existsSync(output)) {
    const normalizeEol = (s: string): string => s.replace(/\r\n/g, "\n");
    const fixed = execFileSync("node", [join(scriptsDir, "fix.mjs")], {
      input: readFileSync(input, "utf8"),
      encoding: "utf8",
    });
    const expected = readFileSync(output, "utf8");
    if (normalizeEol(fixed) !== normalizeEol(expected)) {
      problems.push({
        dir,
        name: skill.meta.name,
        message: "fix.mjs(input.md) 与 output.md 不一致，样例失去可验证性",
      });
    } else {
      try {
        execFileSync("node", [join(scriptsDir, "check.mjs")], {
          input: expected,
          stdio: ["pipe", "pipe", "pipe"],
        });
      } catch {
        problems.push({
          dir,
          name: skill.meta.name,
          message: "output.md 未通过 check.mjs（自检即失败）",
        });
      }
    }
    continue;
  }

  if (SCRIPT_CHECKED.includes(skill.meta.name) && existsSync(output) && existsSync(scriptsDir)) {
    try {
      execFileSync("node", [join(scriptsDir, "check.mjs")], {
        input: readFileSync(output, "utf8"),
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch {
      problems.push({
        dir,
        name: skill.meta.name,
        message: "examples/output.md 未通过校验脚本",
      });
    }
  }
}

if (problems.length > 0) {
  for (const p of problems) console.error(`✗ ${p.name ?? "?"}: ${p.message}`);
  console.error(`共 ${problems.length} 个问题`);
  process.exit(1);
}
console.log(`OK：${skills.length} 个 skill 全部通过校验`);
