// 故障复盘结构校验：四个必备节齐全且有实质内容（与 pr-description 的校验同一模式）
// 用法：node check.mjs < 复盘.md ；缺节或空节 exit 1
import { readFileSync } from "node:fs";

const REQUIRED_SECTIONS = ["事故概述", "时间线", "根因分析", "行动项"];

const text = readFileSync(0, "utf8");
const errors = [];

// 标题允许带注记后缀（如「## 时间线（UTC+8）」），前缀匹配即可
for (const section of REQUIRED_SECTIONS) {
  const headingRe = new RegExp(`^##\\s*${section}.*$`, "m");
  const match = headingRe.exec(text);
  if (!match || match.index === undefined) {
    errors.push(`缺少 "## ${section}" 节`);
    continue;
  }
  // 节内容 = 该标题行之后到下一个 ## 标题之间的文本
  const headingEnd = match.index + match[0].length;
  const rest = text.slice(headingEnd);
  const nextHeading = /^##\s/m.exec(rest);
  const body = (nextHeading ? rest.slice(0, nextHeading.index) : rest).trim();
  if (body.length === 0) {
    errors.push(`"## ${section}" 节没有内容`);
  } else if (/^(无|N\/A|na)$/i.test(body)) {
    errors.push(`"## ${section}" 节只有占位词（无/N/A），需要写实质内容`);
  }
}

// 行动项节必须出现表格或列表结构——纯一段话的行动项不可跟踪
const rest = text;
const actionMatch = /^##\s*行动项\s*$/m.exec(rest);
if (actionMatch && actionMatch.index !== undefined) {
  const after = rest.slice(actionMatch.index + actionMatch[0].length);
  const nextHeading = /^##\s/m.exec(after);
  const body = nextHeading ? after.slice(0, nextHeading.index) : after;
  if (!/^\s*\|/m.test(body) && !/^\s*[-*]\s/m.test(body)) {
    errors.push('"行动项" 节应使用表格或列表逐条列出（每条需 Owner/期限/验证方式）');
  }
}

if (errors.length > 0) {
  for (const e of errors) console.error(`✗ ${e}`);
  process.exit(1);
}
console.log("OK：复盘结构完整（概述/时间线/根因/行动项）");
