// manifest 读写单测：roundtrip / 损坏 / 字段非法
import { describe, expect, it } from "vitest";
import { readManifest, writeManifest, manifestPath } from "../../src/adapters/manifest.js";
import { emptyManifest } from "../../src/adapters/types.js";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function makeDir(): string {
  return mkdtempSync(join(tmpdir(), "zh-manifest-test-"));
}

describe("manifest", () => {
  it("不存在时返回空表", () => {
    const dir = makeDir();
    try {
      expect(readManifest(dir)).toEqual(emptyManifest());
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("写入后读回一致（roundtrip）", () => {
    const dir = makeDir();
    try {
      const manifest = emptyManifest();
      manifest.skills["zh-demo"] = {
        version: "1.0.0",
        mode: "copy",
        installedAt: "2026-10-30T00:00:00.000Z",
        source: "zh-skills@0.1.0",
      };
      writeManifest(dir, manifest);
      expect(readManifest(dir)).toEqual(manifest);
      // 落盘文件是合法 JSON 且带版本号
      const raw = JSON.parse(readFileSync(manifestPath(dir), "utf8"));
      expect(raw.version).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("损坏的 JSON 抛错而非静默清空", () => {
    const dir = makeDir();
    try {
      mkdirSync(join(dir, ".zh-skills"));
      writeFileSync(join(dir, ".zh-skills", "manifest.json"), "{oops", "utf8");
      expect(() => readManifest(dir)).toThrow(/损坏/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("字段非法抛错", () => {
    const dir = makeDir();
    try {
      mkdirSync(join(dir, ".zh-skills"));
      writeFileSync(
        join(dir, ".zh-skills", "manifest.json"),
        JSON.stringify({ version: 99, skills: {} }),
        "utf8",
      );
      expect(() => readManifest(dir)).toThrow(/非法/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
