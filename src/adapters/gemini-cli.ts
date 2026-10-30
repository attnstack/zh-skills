// Gemini CLI 适配（experimental）：Gemini CLI 的扩展机制是 extensions（自带 manifest 格式），
// 与 Agent Skills 的目录约定不同。v0.1 采用最小可用策略：直接落到 ~/.gemini/skills，
// 由用户在 GEMINI.md/system instruction 里引用；正式的 extensions 包装器是 v0.2 的工作
// （见 docs/mcp-design.md 的路线图）。
import { existsSync } from "node:fs";
import { join } from "node:path";
import { BaseAgentAdapter } from "./base.js";

export class GeminiCliAdapter extends BaseAgentAdapter {
  constructor(homeRoot?: string) {
    super({
      id: "gemini-cli",
      pathSegments: [".gemini", "skills"],
      detect: () => {
        const home = homeRoot ?? process.env.HOME ?? process.env.USERPROFILE ?? "";
        const exists = home.length > 0 && existsSync(join(home, ".gemini"));
        return {
          installed: exists,
          reason: exists ? "检测到 ~/.gemini" : "未检测到 ~/.gemini",
        };
      },
      homeRoot,
      experimental: true,
    });
  }
}
