// frontmatter 解析：只处理 SKILL.md 顶部的 --- 包裹块，正文原样返回
// 不做通用 YAML 文档解析，保持行为可预测（这也是不引入 gray-matter 的原因：只需要这一个能力）

import { parse as parseYaml } from "yaml";

export interface ParsedFrontmatter<T> {
  data: T;
  body: string;
}

export class FrontmatterError extends Error {
  override readonly name = "FrontmatterError";
  constructor(message: string) {
    super(message);
  }
}

const FM_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export function parseFrontmatter<T>(raw: string, validate: (data: unknown) => T): ParsedFrontmatter<T> {
  const match = FM_RE.exec(raw);
  if (!match) {
    throw new FrontmatterError("缺少 frontmatter（文件必须以 --- 开头的 YAML 块开始）");
  }
  const yamlText = match[1] ?? "";
  let data: unknown;
  try {
    data = parseYaml(yamlText);
  } catch (err) {
    throw new FrontmatterError(
      `frontmatter YAML 解析失败：${err instanceof Error ? err.message : String(err)}`,
    );
  }
  return { data: validate(data), body: raw.slice(match[0].length) };
}
