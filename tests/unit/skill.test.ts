// skill 加载与 frontmatter 校验单测：合法 / 非法 / 损坏三类
import { describe, expect, it } from "vitest";
import { loadSkill, splitDescription, loadSkillDir } from "../../src/core/skill.js";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function makeSkillDir(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "zh-skill-test-"));
  for (const [name, content] of Object.entries(files)) {
    const filePath = join(dir, name);
    mkdirSync(join(filePath, ".."), { recursive: true });
    writeFileSync(filePath, content, "utf8");
  }
  return dir;
}

const validMeta = `---
name: zh-demo
description: 测试用 skill，当用户要求演示时使用。不适用于：生产环境。
version: 1.0.0
allowed-tools: [Read]
tags: [demo]
---
正文内容`;

describe("loadSkill", () => {
  it("合法 skill 加载成功", () => {
    const dir = makeSkillDir({ "SKILL.md": validMeta });
    try {
      const skill = loadSkill(dir);
      expect(skill.meta.name).toBe("zh-demo");
      expect(skill.body).toContain("正文内容");
      expect(skill.bodyLines).toBeGreaterThan(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("缺 frontmatter 报错（对外统一为 SkillError）", () => {
    const dir = makeSkillDir({ "SKILL.md": "没有 frontmatter 的正文" });
    try {
      expect(() => loadSkill(dir)).toThrow(/缺少 frontmatter/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("name 非法（大写/下划线）报错", () => {
    const dir = makeSkillDir({
      "SKILL.md": validMeta.replace("name: zh-demo", "name: Zh_Demo"),
    });
    try {
      expect(() => loadSkill(dir)).toThrow(/name/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("description 缺失报错", () => {
    const dir = makeSkillDir({
      "SKILL.md": validMeta.split("description")[0]!.replace("---\n", "---\n") + "---\n正文",
    });
    try {
      expect(() => loadSkill(dir)).toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("目录不存在抛 SkillError", () => {
    expect(() => loadSkill(join(tmpdir(), "zh-not-exist-dir-xyz"))).toThrow(/无法读取/);
  });
});

describe("loadSkillDir", () => {
  it("单个损坏 skill 不拖垮整体", () => {
    const root = mkdtempSync(join(tmpdir(), "zh-root-test-"));
    try {
      mkdirSync(join(root, "good"));
      writeFileSync(join(root, "good", "SKILL.md"), validMeta, "utf8");
      mkdirSync(join(root, "bad"));
      writeFileSync(join(root, "bad", "SKILL.md"), "坏的");
      const errors: string[] = [];
      const skills = loadSkillDir(root, (_dir, err) => errors.push(err.message));
      expect(skills).toHaveLength(1);
      expect(skills[0]?.meta.name).toBe("zh-demo");
      expect(errors).toHaveLength(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("跳过隐藏目录与非目录项", () => {
    const root = mkdtempSync(join(tmpdir(), "zh-root-test-"));
    try {
      mkdirSync(join(root, ".hidden"));
      writeFileSync(join(root, ".hidden", "SKILL.md"), validMeta, "utf8");
      writeFileSync(join(root, "afile.txt"), "not a dir", "utf8");
      const skills = loadSkillDir(root);
      expect(skills).toHaveLength(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("splitDescription", () => {
  it("按「不适用于」切分正负段", () => {
    const { positive, negative } = splitDescription("A 技能。当用户 X 时使用。不适用于：Y。");
    expect(positive).toContain("A 技能");
    expect(negative).toContain("Y");
  });

  it("无负向段返回 null", () => {
    const { negative } = splitDescription("只有正向描述");
    expect(negative).toBeNull();
  });
});
