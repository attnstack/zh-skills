// Skill 数据模型与加载：目录即 skill，SKILL.md frontmatter 是唯一元数据来源
// description 的结构约定（正向触发 / 不适用场景）直接决定路由质量：
// 路由器会按「不适用于」切分正负文本，写法不对会污染检索

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { FrontmatterError, parseFrontmatter } from "./frontmatter.js";

export const SKILL_FILE = "SKILL.md";

const NAME_RE = /^[a-z0-9][a-z0-9-]{1,63}$/;

export const skillMetaSchema = z.object({
  name: z
    .string()
    .regex(NAME_RE, "name 必须是 kebab-case（小写字母/数字/连字符，2-64 字符）"),
  description: z
    .string()
    .min(10, "description 至少 10 字符")
    .max(1024, "description 超过 1024 字符上限"),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, "version 必须是 semver 三段式"),
  "allowed-tools": z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
});

export type SkillMeta = z.infer<typeof skillMetaSchema>;

export interface Skill {
  meta: SkillMeta;
  /** SKILL.md 除 frontmatter 外的正文 */
  body: string;
  /** skill 目录绝对路径 */
  dir: string;
  /** 正文行数（用于 <500 行的渐进披露约束） */
  bodyLines: number;
}

export class SkillError extends Error {
  override readonly name = "SkillError";
  constructor(
    message: string,
    readonly skillDir: string,
  ) {
    super(message);
  }
}

function validateMeta(data: unknown): SkillMeta {
  const result = skillMetaSchema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new FrontmatterError(`frontmatter 字段非法：${issues}`);
  }
  return result.data;
}

/** 加载单个 skill 目录；目录不存在、缺 SKILL.md、frontmatter 非法都抛 SkillError */
export function loadSkill(dir: string): Skill {
  const file = join(dir, SKILL_FILE);
  let raw: string;
  try {
    raw = readFileSync(file, "utf8");
  } catch (err) {
    throw new SkillError(
      `无法读取 ${file}：${err instanceof Error ? err.message : String(err)}`,
      dir,
    );
  }
  try {
    const { data, body } = parseFrontmatter(raw, validateMeta);
    return {
      meta: data,
      body,
      dir,
      bodyLines: body.split(/\r?\n/).length,
    };
  } catch (err) {
    if (err instanceof FrontmatterError) {
      throw new SkillError(err.message, dir);
    }
    throw err;
  }
}

/**
 * 扫描 skills 根目录下所有子目录并加载。
 * 跳过非目录与隐藏目录；单个 skill 损坏只告警不拖垮整体——
 * 一个坏 skill 不应该让用户其余 11 个都不可用（局部失败隔离）。
 */
export function loadSkillDir(
  root: string,
  onError: (skillDir: string, err: Error) => void = () => {},
): Skill[] {
  const skills: Skill[] = [];
  let entries: string[];
  try {
    entries = readdirSync(root);
  } catch (err) {
    throw new SkillError(
      `skills 根目录不可读：${root}，${err instanceof Error ? err.message : String(err)}`,
      root,
    );
  }
  for (const entry of entries) {
    if (entry.startsWith(".")) continue;
    const dir = join(root, entry);
    if (!statSync(dir).isDirectory()) continue;
    try {
      skills.push(loadSkill(dir));
    } catch (err) {
      onError(dir, err instanceof Error ? err : new Error(String(err)));
    }
  }
  return skills.sort((a, b) => a.meta.name.localeCompare(b.meta.name));
}

/**
 * description 约定：以「不适用于：」为界，前段是正向触发描述，后段是负向排除。
 * 返回 null 表示没有负向段。路由器用负向段做打分惩罚，防止「不适用场景」里的
 * 触发词反而把 query 拉向该 skill（这是全文检索路由最经典的假阳性来源）。
 */
export function splitDescription(description: string): { positive: string; negative: string | null } {
  const idx = description.indexOf("不适用于");
  if (idx === -1) return { positive: description, negative: null };
  return {
    positive: description.slice(0, idx),
    negative: description.slice(idx),
  };
}
