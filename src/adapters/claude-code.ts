// Claude Code 适配：skills 是其原生约定（~/.claude/skills/<name>/SKILL.md），
// 平台自带基于 description 的自动触发，本工具只负责把资产放到位
import { existsSync } from "node:fs";
import { join } from "node:path";
import { BaseAgentAdapter } from "./base.js";

export class ClaudeCodeAdapter extends BaseAgentAdapter {
  constructor(homeRoot?: string) {
    super({
      id: "claude-code",
      pathSegments: [".claude", "skills"],
      detect: () => {
        // Claude Code 的安装标志是 ~/.claude 目录（配置/会话都在里面）
        const home = homeRoot ?? process.env.HOME ?? process.env.USERPROFILE ?? "";
        const exists = home.length > 0 && existsSync(join(home, ".claude"));
        return {
          installed: exists,
          reason: exists ? "检测到 ~/.claude" : "未检测到 ~/.claude（未安装也能装 skills，首次会创建目录）",
        };
      },
      homeRoot,
    });
  }
}
