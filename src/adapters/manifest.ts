// manifest 读写：记录每个 skill 的版本/落盘方式/来源，支撑 update / remove / doctor
// copy 模式下 update 的语义完全由 manifest 定义：
// 没有「装的时候是什么版本」的记录，update 就只能盲目覆盖，做不了「有更新才写」。

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { z } from "zod";
import { emptyManifest, type Manifest } from "./types.js";

export const manifestSchema = z.object({
  version: z.literal(1),
  skills: z.record(
    z.string(),
    z.object({
      version: z.string(),
      mode: z.enum(["symlink", "junction", "copy"]),
      installedAt: z.string(),
      source: z.string(),
    }),
  ),
});

export const MANIFEST_DIR = ".zh-skills";
export const MANIFEST_FILE = "manifest.json";

export function manifestPath(skillsDir: string): string {
  return `${skillsDir.replace(/[\\/]+$/, "")}/${MANIFEST_DIR}/${MANIFEST_FILE}`;
}

/** 读 manifest；不存在返回空表，损坏抛错（静默清空会丢失 remove 所需的全部信息） */
export function readManifest(skillsDir: string): Manifest {
  const file = manifestPath(skillsDir);
  if (!existsSync(file)) {
    return emptyManifest();
  }
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, "utf8"));
  } catch (err) {
    throw new Error(
      `manifest 损坏（${file}）：${err instanceof Error ? err.message : String(err)}。` +
        `如确认放弃已装记录，可删除该文件后重装。`,
    );
  }
  const parsed = manifestSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`manifest 字段非法（${file}）：${issues}`);
  }
  return parsed.data as Manifest;
}

export function writeManifest(skillsDir: string, manifest: Manifest): void {
  const file = manifestPath(skillsDir);
  mkdirSync(dirname(file), { recursive: true });
  const parsed = manifestSchema.parse(manifest); // 写前再校验一次，防止内部状态被污染后落盘
  writeFileSync(file, JSON.stringify(parsed, null, 2) + "\n", "utf8");
}
