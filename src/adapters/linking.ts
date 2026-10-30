// 落盘策略：symlink → (Windows) junction → copy 降级链
// Windows 兼容是必须做对的路径（中文用户一半在 Windows）：
// - Windows 的 fs.symlink 需要开发者模式或管理员权限，npx 场景不成立；
// - junction 是 NTFS 目录级重解析点，Node 以 'junction' 类型创建时免提权，
//   但只对目录生效且目标必须是绝对路径——这两个约束代码里都有显式处理；
// - copy 永远可行，代价是 update 要覆盖写、且用户改不了安装副本里的内容。

import { existsSync, mkdirSync, cpSync, lstatSync, readFileSync, rmSync, symlinkSync, unlinkSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { EnvironmentError, ProgramError } from "../core/errors.js";
import { loadSkill } from "../core/skill.js";
import type { LinkMode } from "./types.js";

const IS_WINDOWS = process.platform === "win32";

export interface LinkAttempt {
  mode: LinkMode;
  ok: boolean;
  error?: string;
}

/**
 * 按降级链尝试落盘，返回实际成功的 mode。
 * 请求 symlink 在 Windows 上直接跳过（权限失败是常态而非意外），
 * 请求 junction 在非 Windows 上直接跳过（NTFS 专属）。
 */
export function linkSkill(sourceDir: string, targetDir: string, mode: LinkMode | "auto"): LinkMode {
  if (mode !== "copy" && existsSync(targetDir)) {
    // 目标已存在：幂等重建。先删旧链接/目录再落新的，避免 junction 套 junction
    removeLink(targetDir);
  }
  ensureParent(targetDir);

  const attempts: LinkMode[] =
    mode === "auto"
      ? IS_WINDOWS
        ? ["junction", "symlink", "copy"]
        : ["symlink", "copy"]
      : [mode];

  const failures: string[] = [];
  for (const attempt of attempts) {
    try {
      switch (attempt) {
        case "symlink":
          symlinkSync(sourceDir, targetDir, IS_WINDOWS ? "dir" : "dir");
          return "symlink";
        case "junction": {
          if (!IS_WINDOWS) {
            throw new ProgramError("junction 仅在 Windows 上可用（应被跳过）");
          }
          // junction 要求目标是绝对路径；相对路径会创建出坏链
          const absoluteSource = resolve(sourceDir);
          if (!isAbsolute(absoluteSource)) throw new ProgramError("resolve 后仍非绝对路径");
          symlinkSync(absoluteSource, targetDir, "junction");
          return "junction";
        }
        case "copy":
          cpSync(sourceDir, targetDir, { recursive: true });
          return "copy";
      }
    } catch (err) {
      failures.push(`${attempt}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  throw new EnvironmentError(
    `安装 ${skillBasename(sourceDir)} 失败，降级链全部不可用（${failures.join(" | ")}）`,
  );
}

/** 读回实际 mode：判断目标是链接还是目录（update/remove 语义依赖它） */
export function detectMode(targetDir: string): LinkMode {
  const stat = lstatSync(targetDir);
  if (stat.isSymbolicLink()) {
    // Windows junction 也表现为 symbolic link；用 stats 目标是否为目录 + 平台区分
    return IS_WINDOWS ? "junction" : "symlink";
  }
  if (stat.isDirectory()) return "copy";
  throw new EnvironmentError(`${targetDir} 既不是链接也不是目录，无法识别安装方式`);
}

/** remove：链接只 unlink 自身；copy 目录整个删除 */
export function removeLink(targetDir: string): void {
  const stat = lstatSync(targetDir);
  if (stat.isSymbolicLink()) {
    unlinkSync(targetDir);
    return;
  }
  if (stat.isDirectory()) {
    rmSync(targetDir, { recursive: true, force: true });
    return;
  }
  throw new EnvironmentError(`${targetDir} 是普通文件，拒绝删除（不是本工具创建的结构）`);
}

function ensureParent(dir: string): void {
  const parent = join(dir, "..");
  if (!existsSync(parent)) {
    mkdirSync(parent, { recursive: true });
  }
}

function skillBasename(dir: string): string {
  const parts = dir.split(/[\\/]/);
  return parts[parts.length - 1] ?? dir;
}

/** 装后校验：目标存在 + SKILL.md 可读 + frontmatter 可解析（链接断了会在这里暴露） */
export function verifyInstalled(targetDir: string): { ok: boolean; problem?: string } {
  if (!existsSync(targetDir)) {
    return { ok: false, problem: `目标不存在：${targetDir}（可能是悬空链接）` };
  }
  try {
    loadSkill(targetDir);
    return { ok: true };
  } catch (err) {
    return { ok: false, problem: err instanceof Error ? err.message : String(err) };
  }
}

/** update 用：读已安装副本的版本号（copy 模式才能本地改，链接模式读到的是源头） */
export function readInstalledVersion(targetDir: string): string | null {
  try {
    return loadSkill(targetDir).meta.version;
  } catch {
    return null;
  }
}

export function readManifestFile(file: string): unknown {
  return JSON.parse(readFileSync(file, "utf8"));
}
