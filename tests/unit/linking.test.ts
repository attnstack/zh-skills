// 落盘策略单测：copy 全平台可用；symlink/junction 按平台能力验证
import { describe, expect, it } from "vitest";
import { linkSkill, detectMode, removeLink, verifyInstalled, readInstalledVersion } from "../../src/adapters/linking.js";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync, readFileSync, lstatSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const IS_WINDOWS = process.platform === "win32";

function makeSkill(): { source: string; cleanup: () => void } {
  const base = mkdtempSync(join(tmpdir(), "zh-link-test-"));
  const source = join(base, "source-skill");
  mkdirSync(source);
  writeFileSync(
    join(source, "SKILL.md"),
    "---\nname: zh-demo\ndescription: 测试用 skill，当演示时使用。不适用于：无。\nversion: 1.0.0\n---\n正文",
    "utf8",
  );
  return { source, cleanup: () => rmSync(base, { recursive: true, force: true }) };
}

describe("linkSkill", () => {
  it("copy 模式：目标内容一致且 detectMode=copy", () => {
    const { source, cleanup } = makeSkill();
    try {
      const target = join(source, "..", "target-copy");
      const mode = linkSkill(source, target, "copy");
      expect(mode).toBe("copy");
      expect(detectMode(target)).toBe("copy");
      expect(readFileSync(join(target, "SKILL.md"), "utf8")).toContain("zh-demo");
    } finally {
      cleanup();
    }
  });

  it("auto 模式在无权限环境降级 copy 而不是失败", () => {
    const { source, cleanup } = makeSkill();
    try {
      const target = join(source, "..", "target-auto");
      const mode = linkSkill(source, target, "auto");
      expect(["symlink", "junction", "copy"]).toContain(mode);
      expect(verifyInstalled(target).ok).toBe(true);
    } finally {
      cleanup();
    }
  });

  it("重复安装幂等（先清旧再落新）", () => {
    const { source, cleanup } = makeSkill();
    try {
      const target = join(source, "..", "target-idem");
      const first = linkSkill(source, target, "copy");
      const second = linkSkill(source, target, "copy");
      expect(first).toBe(second);
      expect(verifyInstalled(target).ok).toBe(true);
    } finally {
      cleanup();
    }
  });

  (IS_WINDOWS ? it : it.skip)("Windows: junction 免提权可用且指向绝对路径", () => {
    const { source, cleanup } = makeSkill();
    try {
      const target = join(source, "..", "target-junction");
      const mode = linkSkill(source, target, "junction");
      expect(mode).toBe("junction");
      expect(lstatSync(target).isSymbolicLink()).toBe(true);
      expect(verifyInstalled(target).ok).toBe(true);
    } finally {
      cleanup();
    }
  });

  (IS_WINDOWS ? it.skip : it)("Unix: symlink 可用", () => {
    const { source, cleanup } = makeSkill();
    try {
      const target = join(source, "..", "target-symlink");
      const mode = linkSkill(source, target, "symlink");
      expect(mode).toBe("symlink");
      expect(lstatSync(target).isSymbolicLink()).toBe(true);
    } finally {
      cleanup();
    }
  });
});

describe("verifyInstalled", () => {
  it("悬空链接报「目标不存在」", async () => {
    const base = mkdtempSync(join(tmpdir(), "zh-verify-test-"));
    try {
      const dangling = join(base, "dangling");
      const { symlinkSync } = await import("node:fs");
      if (IS_WINDOWS) {
        mkdirSync(join(base, "real"));
        // Windows 上先建后删目标制造悬空 junction
        symlinkSync(join(base, "real"), dangling, "junction");
        rmSync(join(base, "real"), { recursive: true, force: true });
      } else {
        symlinkSync(join(base, "nowhere"), dangling, "dir");
      }
      const result = verifyInstalled(dangling);
      expect(result.ok).toBe(false);
      expect(result.problem).toContain("不存在");
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });
});

describe("removeLink / readInstalledVersion", () => {
  it("copy 目录整删；版本号读取", () => {
    const { source, cleanup } = makeSkill();
    try {
      const target = join(source, "..", "target-rm");
      linkSkill(source, target, "copy");
      expect(readInstalledVersion(target)).toBe("1.0.0");
      removeLink(target);
      expect(existsSync(target)).toBe(false);
    } finally {
      cleanup();
    }
  });
});
