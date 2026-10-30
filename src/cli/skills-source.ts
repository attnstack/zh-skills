// 定位打包/仓库内的 skills 资产目录：npx 安装态与 tsx 开发态的相对深度一致（../../skills）
// env ZH_SKILLS_DIR 是测试与本地开发的第一优先覆盖
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { EnvironmentError } from "../core/errors.js";

export function bundledSkillsDir(): string {
  const override = process.env.ZH_SKILLS_DIR;
  if (override) {
    if (!existsSync(override)) {
      throw new EnvironmentError(`ZH_SKILLS_DIR 指向的目录不存在：${override}`);
    }
    return override;
  }
  // dist/cli/index.js 与 src/cli/index.ts 都在包根下两层
  const here = dirname(fileURLToPath(import.meta.url));
  const dir = join(here, "..", "..", "skills");
  if (!existsSync(dir)) {
    throw new EnvironmentError(
      `找不到内置 skills 目录（${dir}）。npm 包不完整或被裁剪，请重新安装 zh-skills。`,
    );
  }
  return dir;
}
