#!/usr/bin/env node
// zh-skills CLI 入口：命令注册与顶层错误→退出码映射
// 命令只做参数解析与编排，业务逻辑全部在 lib 层：
// 集成测试直接调 lib，CLI 层只需要少量冒烟用例
import { defineCommand, runCommand, showUsage } from "citty";
import { exitCodeFor } from "../core/errors.js";
import { Logger } from "../util/logger.js";

import add from "./commands/add.js";
import list from "./commands/list.js";
import update from "./commands/update.js";
import remove from "./commands/remove.js";
import route from "./commands/route.js";
import doctor from "./commands/doctor.js";
import learn from "./commands/learn.js";
import lint from "./commands/lint.js";
import feedback from "./commands/feedback.js";

const main = defineCommand({
  meta: {
    name: "zh-skills",
    version: "0.1.0",
    description:
      "面向中文场景的 Agent Skills 包与安装 CLI：把 12 个中文工作流 skill 一条命令装进主流 Agent",
  },
  // 顶层 run 仅在「没给子命令」时兜底输出 usage。
  // 注意 citty 的调度语义：子命令执行完后主 run 仍会被调用，
  // 所以这里必须判断 rawArgs 里是否真有子命令，否则每个子命令跑完都会多打一次 usage
  run: (ctx) => {
    const hasSubCommand = ctx.rawArgs.some((arg) => !arg.startsWith("-"));
    if (!hasSubCommand) {
      showUsage(main);
    }
  },
  subCommands: {
    add,
    list,
    update,
    remove,
    route,
    doctor,
    learn,
    lint,
    feedback,
  },
});

async function main2(): Promise<void> {
  await runCommand(main, { rawArgs: process.argv.slice(2) });
}

main2().catch((err: unknown) => {
  const logger = Logger.fromEnv();
  const message = err instanceof Error ? err.message : String(err);
  logger.error(message);
  if (logger.isEnabled("debug") && err instanceof Error && err.stack) {
    logger.debug(err.stack);
  }
  process.exit(exitCodeFor(err));
});
