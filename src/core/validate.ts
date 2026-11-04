// 技能资产校验的可复用核心：CLI 的 lint 命令与仓库门禁脚本共用同一套判定，
// 避免「仓库里能过、用户 lint 不过」的双标
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { loadSkill, splitDescription, type Skill } from "./skill.js";

export interface ValidationOptions {
  /** 技能数量下限；默认 0 不检查（外部目录可能合法为空） */
  minCount?: number;
}

export interface ValidationProblem {
  dir: string;
  /** 损坏到读不出 frontmatter 时为 null */
  name: string | null;
  message: string;
}

export interface ValidationResult {
  skills: Skill[];
  problems: ValidationProblem[];
}

export function validateSkillsRoot(root: string, options: ValidationOptions = {}): ValidationResult {
  const problems: ValidationProblem[] = [];
  const skills: Skill[] = [];
  const seen = new Set<string>();

  let entries: string[];
  try {
    entries = readdirSync(root);
  } catch (err) {
    return {
      skills,
      problems: [
        {
          dir: root,
          name: null,
          message: `目录不可读：${err instanceof Error ? err.message : String(err)}`,
        },
      ],
    };
  }

  for (const entry of entries) {
    const dir = join(root, entry);
    if (entry.startsWith(".")) continue;
    let isDir = false;
    try {
      isDir = statSync(dir).isDirectory();
    } catch {
      isDir = false;
    }
    if (!isDir) continue;

    let skill: Skill;
    try {
      skill = loadSkill(dir);
    } catch (err) {
      problems.push({
        dir,
        name: null,
        message: err instanceof Error ? err.message : String(err),
      });
      continue;
    }

    const { meta } = skill;
    const problem = (message: string): void => {
      problems.push({ dir, name: meta.name, message });
    };

    if (seen.has(meta.name)) problem(`name 重复：${meta.name}`);
    seen.add(meta.name);
    if (meta.name !== entry) problem(`目录名与 name(${meta.name}) 不一致`);
    // 渐进披露约束：正文过长说明细节没有下沉到 references/
    if (skill.bodyLines >= 500) problem(`SKILL.md 正文 ${skill.bodyLines} 行，超过 500 行上限`);
    // 负向段缺失会让路由假阳性上升（见 router/index.ts 的负向惩罚）
    const { negative } = splitDescription(meta.description);
    if (!negative) problem("description 缺少「不适用于」负向段");
    if (meta.description.includes("TODO")) problem("description 含 TODO 占位");
    if (
      !existsSync(join(dir, "examples", "input.md")) ||
      !existsSync(join(dir, "examples", "output.md"))
    ) {
      problem("examples/input.md 与 output.md 必须成对存在");
    }
    if (!existsSync(join(dir, "references", "pitfalls.md"))) {
      problem("缺少 references/pitfalls.md");
    }
    skills.push(skill);
  }

  if (skills.length === 0 && (options.minCount ?? 0) > 0) {
    problems.push({ dir: root, name: null, message: `未找到任何技能：${root}` });
  }
  return { skills, problems };
}
