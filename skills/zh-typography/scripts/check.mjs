// 中文排版检查脚本：报告违规行，不修改文本（与 fix.mjs 共享同一规则集的判定侧）
// 用法：node check.mjs < file.md ；有违规 exit 1（CI 可直接当门禁），干净 exit 0
import { readFileSync } from "node:fs";

const CJK = "[\\u3007\\u3400-\\u4DBF\\u4E00-\\u9FFF\\uF900-\\uFAFF]";
const CJK_RE = new RegExp(CJK);

const violations = [];

function checkLine(line, lineNo) {
  // 内联代码替换成空格再判定：与 fix.mjs 的跳过范围一致；
  // 用空格而不是删掉，避免两侧文字拼接后凭空制造「缺空格」误报
  const text = line.replace(/`[^`]*`/g, " ");
  if (/[\uFF10-\uFF19\uFF21-\uFF3A\uFF41-\uFF5A]/.test(text)) {
    violations.push(`${lineNo}: 存在全角字母/数字`);
  }
  // 中文紧邻的半角标点
  const halfNext = new RegExp(`(${CJK})[,;!?]`).exec(text);
  const halfPrev = new RegExp(`[,;!?](${CJK})`).exec(text);
  if (halfNext || halfPrev) {
    violations.push(`${lineNo}: 中文语境存在半角标点（,;!?）`);
  }
  // CJK 与 ASCII 无空格（跳过已由空格分隔的情况）
  const noSpaceCjkFirst = new RegExp(`(${CJK})[A-Za-z0-9]`).test(text);
  const noSpaceAsciiFirst = new RegExp(`[A-Za-z0-9](${CJK})`).test(text);
  if (noSpaceCjkFirst || noSpaceAsciiFirst) {
    violations.push(`${lineNo}: 中英文/数字之间缺空格`);
  }
  // 重复 ！/？：全角开头的重复组，或 CJK 紧邻的重复（与 fix.mjs 的压缩范围一致）
  const repeatCJK = new RegExp(`${CJK}[!！]{2,}`).test(text);
  const repeatFullWidth = /！[!！]+|？[?？]+/.test(text);
  if (repeatCJK || repeatFullWidth) {
    violations.push(`${lineNo}: 存在重复的 ！/？`);
  }
  if (/[ \t]+$/.test(line)) {
    violations.push(`${lineNo}: 行尾空白`);
  }
}

const raw = readFileSync(0, "utf8");
// CRLF 免疫：先归一，避免行尾 \r 干扰行号定位与行尾空白判定
const lines = raw.replace(/\r\n/g, "\n").split("\n");
// 围栏代码块整块不检查（围栏行本身也跳过），规则与 fix.mjs 相同
let inFence = false;
lines.forEach((line, idx) => {
  if (/^\s*(```|~~~)/.test(line)) {
    inFence = !inFence;
    return;
  }
  if (!inFence) checkLine(line, idx + 1);
});

if (violations.length === 0) {
  console.log("OK：未发现排版违规");
  process.exit(0);
}
for (const v of violations) {
  console.error(v);
}
console.error(`共 ${violations.length} 处违规`);
process.exit(1);
