// 平台 adapter 公共实现：目录约定是唯一平台差异，安装/校验/移除流程完全共享
// 新增平台 = 一行注册 + 一个目录常量，这行注释本身就是适配层设计的卖点

import { join } from "node:path";
import { homedir } from "node:os";
import { existsSync, mkdirSync } from "node:fs";
import { EnvironmentError } from "../core/errors.js";
import { loadSkill } from "../core/skill.js";
import { detectMode, linkSkill, removeLink, verifyInstalled } from "./linking.js";
import { readManifest, writeManifest } from "./manifest.js";
import {
  emptyManifest,
  type AgentAdapter,
  type AgentId,
  type DetectResult,
  type InstallResult,
  type LinkMode,
  type Manifest,
  type VerifyReport,
} from "./types.js";

export interface BaseAdapterOptions {
  id: AgentId;
  /** HOME 下相对 skills 目录的段，如 ['.claude', 'skills'] */
  pathSegments: string[];
  /** 直接指定 skills 绝对目录（自定义 target 用），设置后 pathSegments 被忽略 */
  absoluteDir?: string | undefined;
  /** detect 的判定函数，默认：目录存在即已安装 */
  detect?: (() => DetectResult) | undefined;
  /** 测试注入：覆盖 HOME 根（生产代码不要传） */
  homeRoot?: string | undefined;
  /** 实验性平台标记：doctor 与 README 标注「目录约定未获官方文档确认」 */
  experimental?: boolean | undefined;
}

export class BaseAgentAdapter implements AgentAdapter {
  readonly id: AgentId;
  readonly experimental: boolean;
  private readonly segments: string[];
  private readonly homeRoot: string | undefined;
  private readonly absoluteDir: string | undefined;
  private readonly detectFn: (() => DetectResult) | undefined;

  constructor(options: BaseAdapterOptions) {
    this.id = options.id;
    this.segments = options.pathSegments;
    this.homeRoot = options.homeRoot;
    this.absoluteDir = options.absoluteDir;
    this.experimental = options.experimental ?? false;
    this.detectFn = options.detect;
  }

  async detect(): Promise<DetectResult> {
    if (this.detectFn) return this.detectFn();
    const dir = this.skillsDirSync();
    const exists = existsSync(dir);
    return {
      installed: exists,
      reason: exists ? `目录存在：${dir}` : `目录不存在（首次安装会创建）：${dir}`,
    };
  }

  async skillsDir(): Promise<string> {
    return this.skillsDirSync();
  }

  private skillsDirSync(): string {
    if (this.absoluteDir) return this.absoluteDir;
    const root = this.homeRoot ?? homedir();
    return join(root, ...this.segments);
  }

  async install(skillDir: string, skillName: string, mode: LinkMode | "auto"): Promise<InstallResult> {
    const target = join(this.skillsDirSync(), skillName);
    let actualMode: LinkMode;
    try {
      actualMode = linkSkill(skillDir, target, mode);
    } catch (err) {
      if (err instanceof EnvironmentError) {
        throw new EnvironmentError(`[${this.id}] ${err.message}`);
      }
      throw err;
    }
    const manifest = readManifest(this.skillsDirSync());
    manifest.skills[skillName] = {
      version: this.readVersionOrThrow(skillDir),
      mode: actualMode,
      installedAt: new Date().toISOString(),
      source: this.sourceLabel(),
    };
    writeManifest(this.skillsDirSync(), manifest);
    return { agent: this.id, skill: skillName, mode: actualMode, targetPath: target };
  }

  async installedSkills(): Promise<Manifest> {
    const dir = this.skillsDirSync();
    if (!existsSync(dir)) return emptyManifest();
    return readManifest(dir);
  }

  async verify(skillNames: string[]): Promise<VerifyReport> {
    const issues: VerifyReport["issues"] = [];
    for (const name of skillNames) {
      const target = join(this.skillsDirSync(), name);
      const result = verifyInstalled(target);
      if (!result.ok) {
        issues.push({ skill: name, problem: result.problem ?? "未知问题" });
      }
    }
    return { agent: this.id, ok: issues.length === 0, issues };
  }

  async remove(skillName: string): Promise<void> {
    const dir = this.skillsDirSync();
    const target = join(dir, skillName);
    if (!existsSync(target)) {
      // 目标已不在：仍继续清 manifest，保证状态一致
      this.removeFromManifest(dir, skillName);
      return;
    }
    removeLink(target);
    this.removeFromManifest(dir, skillName);
  }

  private removeFromManifest(dir: string, skillName: string): void {
    const manifest = readManifest(dir);
    delete manifest.skills[skillName];
    writeManifest(dir, manifest);
  }

  private readVersionOrThrow(skillDir: string): string {
    // 版本号从源 SKILL.md 读；读不到说明源损坏，安装应当失败而不是记录空版本
    try {
      return loadSkill(skillDir).meta.version;
    } catch (err) {
      throw new EnvironmentError(
        `skill 源目录损坏（${skillDir}）：${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private sourceLabel(): string {
    return `zh-skills@${process.env.npm_package_version ?? "0.1.0"}`;
  }
}

/** 确保 skills 目录存在并返回（首次安装时创建） */
export function ensureDir(dir: string): string {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/** update 语义：copy 模式下比对已装版本与源版本，不同才覆盖重装 */
export function needsUpdate(manifest: Manifest, skillName: string, sourceVersion: string): boolean {
  const entry = manifest.skills[skillName];
  if (!entry) return true; // manifest 没记录（手工拷的）→ 重建以纳入管理
  if (entry.mode === "copy") {
    return entry.version !== sourceVersion;
  }
  // symlink/junction 永远指向源，除非源目录被挪走（verify 会报），无需覆盖
  return false;
}

export { detectMode };
