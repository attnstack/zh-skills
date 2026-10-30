// Codex CLI 适配。
// 事实标注（不脑补）：OpenAI Codex CLI 的 skills 目录约定在官方文档中的表述
// 曾随版本变化（AGENTS.md 为配置主线）；本适配按社区通行约定安装到 ~/.codex/skills，
// 并标记 experimental——doctor 会提示用 `zh-skills add --target <目录>` 兜底自定义位置。
import { existsSync } from "node:fs";
import { join } from "node:path";
import { BaseAgentAdapter } from "./base.js";

export class CodexAdapter extends BaseAgentAdapter {
  constructor(homeRoot?: string) {
    super({
      id: "codex",
      pathSegments: [".codex", "skills"],
      detect: () => {
        const home = homeRoot ?? process.env.HOME ?? process.env.USERPROFILE ?? "";
        const exists = home.length > 0 && existsSync(join(home, ".codex"));
        return {
          installed: exists,
          reason: exists ? "检测到 ~/.codex" : "未检测到 ~/.codex",
        };
      },
      homeRoot,
      experimental: true,
    });
  }
}
