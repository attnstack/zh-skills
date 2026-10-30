// Cursor 适配：Cursor 已采纳 Agent Skills 开放标准（skills 目录约定）。
// 事实标注：目录以官方文档为准，doctor 的 detect 会给出实际检测依据；
// 约定变化时只需改这里一个常量（适配表即数据）。
import { existsSync } from "node:fs";
import { join } from "node:path";
import { BaseAgentAdapter } from "./base.js";

export class CursorAdapter extends BaseAgentAdapter {
  constructor(homeRoot?: string) {
    super({
      id: "cursor",
      pathSegments: [".cursor", "skills"],
      detect: () => {
        const home = homeRoot ?? process.env.HOME ?? process.env.USERPROFILE ?? "";
        const exists = home.length > 0 && existsSync(join(home, ".cursor"));
        return {
          installed: exists,
          reason: exists ? "检测到 ~/.cursor" : "未检测到 ~/.cursor",
        };
      },
      homeRoot,
    });
  }
}
