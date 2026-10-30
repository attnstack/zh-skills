// Conventional Commits（中文 subject）格式校验：传入一条或多条提交信息，全部合法 exit 0
// 用法：node check.mjs "feat(api): 支持批量导出"  或  node check.mjs < commit-msg-file
// 把格式硬规则做成脚本：Agent 生成后自检与 CI 校验共用同一份判定，不靠人眼

import { readFileSync, existsSync } from "node:fs";

const TYPES = ["feat", "fix", "docs", "refactor", "perf", "test", "chore", "revert"];
const SUBJECT_LIMIT = 50;
const BODY_LINE_LIMIT = 72;

const errors = [];

function checkMessage(message) {
  const lines = message.split(/\r?\n/);
  const subject = lines[0] ?? "";
  const headerRe = /^(\w+)(\([^)]*\))?(!)?: (.+)$/;
  const match = headerRe.exec(subject);

  if (!match) {
    errors.push(`subject 不符合 "type(scope): 描述" 格式：${subject}`);
    return;
  }
  const type = match[1] ?? "";
  const desc = match[4] ?? "";

  if (!TYPES.includes(type)) {
    errors.push(`未知 type "${type}"，允许：${TYPES.join("/")}`);
  }
  if (desc.length > SUBJECT_LIMIT) {
    errors.push(`subject 超过 ${SUBJECT_LIMIT} 字符（当前 ${desc.length}）`);
  }
  // 中文 subject 约定：描述部分含 CJK；纯英文说明用户可能想用上游规范，提醒而非报错
  if (!/[\u4E00-\u9FFF]/.test(desc)) {
    errors.push("subject 描述应使用中文（zh-skills 约定）");
  }
  if (/[.。！？!?]$/.test(desc)) {
    errors.push("subject 结尾不加句号/标点");
  }

  const body = lines.slice(1).join("\n").trim();
  for (const line of body.split(/\r?\n/)) {
    if (line.length > BODY_LINE_LIMIT) {
      errors.push(`body 行超过 ${BODY_LINE_LIMIT} 字符：${line.slice(0, 20)}…`);
      break;
    }
  }
}

const argv = process.argv.slice(2);
if (argv.length > 0) {
  for (const arg of argv) {
    if (existsSync(arg)) {
      checkMessage(readFileSync(arg, "utf8").trim());
    } else {
      checkMessage(arg);
    }
  }
} else {
  checkMessage(readFileSync(0, "utf8").trim());
}

if (errors.length > 0) {
  for (const e of errors) console.error(`✗ ${e}`);
  process.exit(1);
}
console.log("OK：提交信息符合规范");
