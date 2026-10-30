// 中文排版修复脚本：stdin → stdout，规则化修复（可确定性复现，样例可判分）
// 用法：node fix.mjs < input.md > output.md
// 规则集刻意保持最小且无歧义——每条规则都要能被 check.mjs 独立验证，
// 「看起来更美观但不可判分」的改写一律不做（这是排版工具与文案工具的边界）

const CJK = "[\\u3007\\u3400-\\u4DBF\\u4E00-\\u9FFF\\uF900-\\uFAFF]";
const CJK_RE = new RegExp(CJK);

function toHalfWidthLetters(text) {
  // 只转全角字母/数字区段；全角标点（，。！？在 FF01-FF5E 内）必须保留
  let out = "";
  for (const ch of text) {
    const code = ch.codePointAt(0);
    if (
      (code >= 0xff10 && code <= 0xff19) ||
      (code >= 0xff21 && code <= 0xff3a) ||
      (code >= 0xff41 && code <= 0xff5a)
    ) {
      out += String.fromCodePoint(code - 0xfee0);
    } else {
      out += ch;
    }
  }
  return out;
}

function fixHalfWidthPunct(text) {
  // 中文紧邻的半角标点转全角；时间 12:30、键值 code 场景两侧都是数字时不转
  let result = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const prev = result[result.length - 1];
    const next = text[i + 1];
    const cjkPrev = prev !== undefined && CJK_RE.test(prev);
    const cjkNext = next !== undefined && CJK_RE.test(next);
    let mapped = ch;
    if (cjkPrev || cjkNext) {
      if (ch === ",") mapped = "，";
      else if (ch === ";") mapped = "；";
      else if (ch === "!") mapped = "！";
      else if (ch === "?") mapped = "？";
      else if (ch === ":") {
        const digitsBoth = /\d/.test(prev ?? "") && /\d/.test(next ?? "");
        if (!digitsBoth) mapped = "：";
      }
    }
    result += mapped;
  }
  return result;
}

function addSpacing(text) {
  // CJK 与 ASCII 字母数字之间补一个半角空格（双向）；已有空格因 \s 不属于两类字符集而不受影响
  return text
    .replace(new RegExp(`(${CJK})([A-Za-z0-9])`, "g"), "$1 $2")
    .replace(new RegExp(`([A-Za-z0-9])(${CJK})`, "g"), "$1 $2");
}

function fixLine(line) {
  let out = toHalfWidthLetters(line);
  // 全角句点夹在半角数字之间是版本号/小数（v2．0 → v2.0），不是中文句号
  out = out.replace(/(\d)\uFF0E(\d)/g, "$1.$2");
  out = fixHalfWidthPunct(out);
  out = addSpacing(out);
  // 重复 ！/？ 压缩为单个：只压「全角开头」的重复组，
  // 这样混合的 ！! 会被归一，而纯英文语境的 !! 不受影响
  out = out.replace(/！[!！]*/g, "！").replace(/？[?？]*/g, "？");
  // 行尾空白
  out = out.replace(/[ \t]+$/, "");
  return out;
}

const raw = await new Promise((resolve, reject) => {
  let data = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => (data += chunk));
  process.stdin.on("end", () => resolve(data));
  process.stdin.on("error", reject);
});

// CRLF 免疫：Windows 下载/编辑过的文件行尾是 \r\n，先归一为 \n 再处理，
// 否则 \r 会混进行内容让规则判定与输出不可移植
const normalized = raw.replace(/\r\n/g, "\n");

process.stdout.write(
  normalized
    .split("\n")
    .map(fixLine)
    .join("\n"),
);
