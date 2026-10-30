// 中英混合分词：ASCII 词元 + CJK 字符 n-gram
// 为什么用字符 n-gram 而不是分词器：
// 1) 中文分词器要带词典（几百 KB～几 MB），违背「npx 秒装、零模型依赖」；
// 2) skill 场景查询短（<30 字），n-gram 的召回鲁棒性比重分词更好——
//    「帮我写周报」对「周报生成」，分词器切出「周报」，bigram 也切出「周报」，效果相当；
// 3) n 可配置，benchmark 脚本实测 n=1/2/3 的命中率差异后定的默认值（n=2）。

const CJK_RE =
  /[\u3007\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\u3040-\u30FF\uAC00-\uD7AF]/;

/** 全角字母/数字转半角 + 转小写；全角标点不动（标点在分词里是边界，转不转都会被丢弃，
 *  但公开导出的 normalize 保持「只归一化字母数字」的窄语义，与排版脚本的规则一致） */
export function normalize(input: string): string {
  let out = "";
  for (const ch of input.toLowerCase()) {
    const code = ch.codePointAt(0) ?? 0;
    const isFullWidthAlnum =
      (code >= 0xff10 && code <= 0xff19) ||
      (code >= 0xff21 && code <= 0xff3a) ||
      (code >= 0xff41 && code <= 0xff5a);
    out += isFullWidthAlnum ? String.fromCodePoint(code - 0xfee0) : ch;
  }
  return out;
}

export interface TokenizeOptions {
  /** CJK 字符 n-gram 的 n；默认 2（benchmark 实测短文本下 bigram 优于 trigram：trigram 对 <20 字的查询太稀疏） */
  cjkN?: number;
}

/**
 * 分词规则：
 * - 连续 ASCII 字母数字 → 单个词元（api、readme、v2）
 * - 连续 CJK 字符 → 滑窗 n-gram；片段长度不足 n 时整段作为单词元（保住「站」这类单字触发词）
 */
export function tokenize(input: string, options: TokenizeOptions = {}): string[] {
  const n = options.cjkN ?? 2;
  if (n < 1) throw new RangeError(`cjkN 必须 >= 1，收到 ${n}`);
  const normalized = normalize(input);
  const tokens: string[] = [];

  let asciiBuf = "";
  let cjkBuf = "";

  const flushAscii = (): void => {
    if (asciiBuf.length > 0) {
      tokens.push(asciiBuf);
      asciiBuf = "";
    }
  };
  const flushCjk = (): void => {
    if (cjkBuf.length === 0) return;
    if (cjkBuf.length <= n) {
      // 片段比 n 短：整段一个词元，避免「站」「周」这类短触发词被丢弃
      tokens.push(cjkBuf);
    } else {
      for (let i = 0; i + n <= cjkBuf.length; i++) {
        tokens.push(cjkBuf.slice(i, i + n));
      }
    }
    cjkBuf = "";
  };

  for (const ch of normalized) {
    if (/\s/.test(ch) || /[^\p{L}\p{N}]/u.test(ch)) {
      // 标点/符号/空白都是边界
      flushAscii();
      flushCjk();
    } else if (CJK_RE.test(ch)) {
      flushAscii();
      cjkBuf += ch;
    } else {
      flushCjk();
      asciiBuf += ch;
    }
  }
  flushAscii();
  flushCjk();
  return tokens;
}
