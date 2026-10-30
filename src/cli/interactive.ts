// 交互式选择：@clack/prompts 多选 skill + 单选平台
// 仅 TTY 环境调用；Ctrl-C 取消按「用户主动退出」处理（exit 0，不报错）
import * as p from "@clack/prompts";
import { UsageError } from "../core/errors.js";
import type { Skill } from "../core/skill.js";
import { AGENT_IDS } from "../adapters/types.js";

export interface InteractivePick {
  skillNames: string[];
  agent: string;
}

export async function promptSkillAndAgents(skills: Skill[]): Promise<InteractivePick> {
  p.intro("zh-skills 安装向导");
  const skillNames = await p.multiselect({
    message: "选择要安装的 skill（空格选中，回车确认）",
    options: skills.map((s) => ({
      value: s.meta.name,
      label: `${s.meta.name} v${s.meta.version}`,
      hint: s.meta.description.split("\n")[0]?.trim() ?? "",
    })),
    required: true,
  });
  if (p.isCancel(skillNames)) {
    p.cancel("已取消");
    process.exit(0);
  }

  const agent = await p.select({
    message: "安装到哪个平台",
    options: AGENT_IDS.map((id) => ({ value: id, label: id })),
  });
  if (p.isCancel(agent)) {
    p.cancel("已取消");
    process.exit(0);
  }
  if (typeof agent !== "string") {
    throw new UsageError("平台选择返回了非字符串值（交互组件异常）");
  }
  p.outro("开始安装");
  return { skillNames, agent };
}
