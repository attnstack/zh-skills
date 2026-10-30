// 配置管理：默认值全部内聚在这里，允许 ~/.zh-skills/config.json 覆盖，env 再覆盖一层
// 优先级：代码默认 < 用户配置文件 < 环境变量

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";

const configSchema = z.object({
  /** 默认安装模式；auto 表示按平台能力选择（Unix symlink / Windows junction / 兜底 copy） */
  defaultMode: z.enum(["auto", "symlink", "junction", "copy"]).default("auto"),
  /** 限定可操作的 Agent 平台，空数组表示全部启用 */
  agents: z.array(z.string()).default([]),
  /** 路由默认返回的 skill 数量 */
  routeTopK: z.number().int().min(1).max(12).default(3),
});

export type Config = z.infer<typeof configSchema>;

function configFilePath(): string {
  const override = process.env.ZH_SKILLS_CONFIG;
  if (override) return override;
  return join(homedir(), ".zh-skills", "config.json");
}

/**
 * 加载配置。配置文件损坏或字段非法时抛错而非静默用默认值——
 * 错误配置被吞掉会让用户以为配置生效了，排查成本远高于启动失败。
 */
export function loadConfig(): Config {
  const file = configFilePath();
  if (!existsSync(file)) {
    return configSchema.parse({});
  }
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, "utf8"));
  } catch (err) {
    throw new Error(
      `配置文件 ${file} 不是合法 JSON：${err instanceof Error ? err.message : String(err)}`,
    );
  }
  const parsed = configSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`配置文件 ${file} 字段非法：${issues}`);
  }
  return parsed.data;
}

export function configPath(): string {
  return configFilePath();
}
