// OpenCode 适配（experimental）：目录约定以官方文档为准，安装走通用 skills 目录模式。
// 事实标注：OpenCode 的扩展机制以 plugin/agent 配置为主，skills 支持未在 MVP 阶段逐版本核实，
// 因此本适配仅保证「文件被放到约定位置且可校验」，不承诺平台一定自动触发。
import { existsSync } from "node:fs";
import { join } from "node:path";
import { BaseAgentAdapter } from "./base.js";

export class OpencodeAdapter extends BaseAgentAdapter {
  constructor(homeRoot?: string) {
    super({
      id: "opencode",
      pathSegments: [".config", "opencode", "skills"],
      detect: () => {
        const home = homeRoot ?? process.env.HOME ?? process.env.USERPROFILE ?? "";
        const exists = home.length > 0 && existsSync(join(home, ".config", "opencode"));
        return {
          installed: exists,
          reason: exists ? "检测到 ~/.config/opencode" : "未检测到 ~/.config/opencode",
        };
      },
      homeRoot,
      experimental: true,
    });
  }
}
