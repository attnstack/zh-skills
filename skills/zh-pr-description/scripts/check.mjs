// PR 描述结构校验：三节齐全（背景/改动/测试）且每节有实质内容
// 用法：node check.mjs < pr.md ；缺节或空节 exit 1（供 Agent 自检与 CI 门禁共用）

import { readFileSync } from "node:fs";

const REQUIRED_SECTIONS = ["背景", "改动", "测试"];

const text = readFileSync(0, "utf8");
const errors = [];

for (const section of REQUIRED_SECTIONS) {
  const headingRe = new RegExp(`^##\\s*${section}\\s*$`, "m");
  const match = headingRe.exec(text);
  if (!match || match.index === undefined) {
    errors.push(`缺少 "## ${section}" 节`);
    continue;
  }
  // 节内容 = 该标题之后到下一个 ## 标题之间的文本
  const rest = text.slice(match.index + match[0].length);
  const nextHeading = /^##\s/m.exec(rest);
  const body = (nextHeading ? rest.slice(0, nextHeading.index) : rest).trim();
  if (body.length === 0) {
    errors.push(`"## ${section}" 节没有内容`);
  } else if (/^(无|N\/A|na)$/i.test(body)) {
    errors.push(`"## ${section}" 节只有占位词（无/N/A），需要写实质内容或说明原因`);
  }
}

if (errors.length > 0) {
  for (const e of errors) console.error(`✗ ${e}`);
  process.exit(1);
}
console.log("OK：PR 描述三节齐全且有内容");
