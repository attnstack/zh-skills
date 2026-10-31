// 端到端集成测试：临时 HOME 下完整走一遍 detect → add(copy) → verify → manifest → update → remove
// 用 homeRoot 注入隔离真实用户目录；typography 样例闭环也在本文件验证（脚本与样例一致性）
import { describe, expect, it } from "vitest";
import { createAdapters, createCustomAdapter } from "../../src/adapters/registry.js";
import { loadSkillDir } from "../../src/core/skill.js";
import { readManifest } from "../../src/adapters/manifest.js";
import { execFileSync } from "node:child_process";
import { mkdtempSync, existsSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const skills = loadSkillDir(join(repoRoot, "skills"));

function tmpHome(): string {
  return mkdtempSync(join(tmpdir(), "zh-e2e-home-"));
}

function skillByName(name: string) {
  const found = skills.find((s) => s.meta.name === name);
  if (!found) throw new Error(`测试数据缺失：${name}`);
  return found;
}

describe("端到端安装流（claude-code adapter, copy 模式）", () => {
  it("detect → install → verify → manifest → update → remove 全链路", async () => {
    const home = tmpHome();
    try {
      const { adapter } = (() => {
        const map = createAdapters({ homeRoot: home });
        const a = map.get("claude-code");
        if (!a) throw new Error("claude-code adapter 未注册");
        return { adapter: a };
      })();

      // 1. 初始 detect：目录不存在，但 detect 不应报错（首次安装会创建）
      const before = await adapter.detect();
      expect(before.installed).toBe(false);

      // 2. 安装 zh-typography（copy 模式确定性最高，跨平台稳定）
      const skill = skillByName("zh-typography");
      const installResult = await adapter.install(skill.dir, skill.meta.name, "copy");
      expect(installResult.mode).toBe("copy");
      expect(existsSync(installResult.targetPath)).toBe(true);

      // 3. verify 通过
      const report = await adapter.verify([skill.meta.name]);
      expect(report.ok).toBe(true);

      // 4. manifest 记录了版本与落盘方式
      const manifest = readManifest(await adapter.skillsDir());
      expect(manifest.skills["zh-typography"]?.mode).toBe("copy");
      expect(manifest.skills["zh-typography"]?.version).toBe(skill.meta.version);

      // 5. update：版本一致 → 无需重装（needsUpdate false 路径，通过 update 不抛错体现）
      //    直接构造版本差异场景：手工改 manifest 版本后 update 应重建
      manifest.skills["zh-typography"]!.version = "0.0.1";
      const { writeManifest } = await import("../../src/adapters/manifest.js");
      writeManifest(await adapter.skillsDir(), manifest);
      const { needsUpdate } = await import("../../src/adapters/base.js");
      expect(needsUpdate(readManifest(await adapter.skillsDir()), "zh-typography", skill.meta.version)).toBe(true);
      await adapter.install(skill.dir, skill.meta.name, "copy");
      expect(readManifest(await adapter.skillsDir()).skills["zh-typography"]?.version).toBe(skill.meta.version);

      // 6. remove：目录消失 + manifest 清理
      await adapter.remove("zh-typography");
      expect(existsSync(join(await adapter.skillsDir(), "zh-typography"))).toBe(false);
      expect(readManifest(await adapter.skillsDir()).skills["zh-typography"]).toBeUndefined();
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("自定义 target adapter：目录即约定", async () => {
    const home = tmpHome();
    try {
      const target = join(home, "custom-skills");
      const adapter = createCustomAdapter(target, home);
      const skill = skillByName("zh-weekly-report");
      await adapter.install(skill.dir, skill.meta.name, "copy");
      const report = await adapter.verify([skill.meta.name]);
      expect(report.ok).toBe(true);
      expect(existsSync(join(target, "zh-weekly-report", "SKILL.md"))).toBe(true);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});

describe("zh-typography 样例闭环（脚本 ⇄ 样例一致性）", () => {
  const skillDir = skillByName("zh-typography").dir;
  // Windows checkout 可能产生 CRLF 工作区：比较按内容而非字节
  const normalizeEol = (s: string): string => s.replace(/\r\n/g, "\n");

  it("fix.mjs(input) === output.md", () => {
    const fixed = execFileSync("node", [join(skillDir, "scripts", "fix.mjs")], {
      input: readFileSync(join(skillDir, "examples", "input.md"), "utf8"),
      encoding: "utf8",
    });
    expect(normalizeEol(fixed)).toBe(
      normalizeEol(readFileSync(join(skillDir, "examples", "output.md"), "utf8")),
    );
  });

  it("check.mjs(output.md) 通过，check.mjs(input.md) 拒绝", () => {
    expect(() =>
      execFileSync("node", [join(skillDir, "scripts", "check.mjs")], {
        input: readFileSync(join(skillDir, "examples", "output.md"), "utf8"),
        stdio: ["pipe", "pipe", "pipe"],
      }),
    ).not.toThrow();
    expect(() =>
      execFileSync("node", [join(skillDir, "scripts", "check.mjs")], {
        input: readFileSync(join(skillDir, "examples", "input.md"), "utf8"),
        stdio: ["pipe", "pipe", "pipe"],
      }),
    ).toThrow();
  });
});
