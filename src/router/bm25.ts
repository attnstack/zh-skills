// BM25（Okapi BM25）：12 个文档规模的暴力打分，不需要索引结构
// 为什么这个规模不用 ANN / 向量检索——
// 12 docs × ~40 tokens，暴力扫描 ~500 次乘加，比加载一个 30MB embedding 模型便宜五个数量级；
// 什么时候该换：文档数上千或同义改写查询占比高（BM25 词面匹配失效）时，才是向量路由的合理时机。

const K1 = 1.5;
const B = 0.75;

export interface Bm25Doc {
  id: string;
  tokens: string[];
}

export interface Bm25Index {
  docs: Bm25Doc[];
  /** token -> 出现该 token 的文档数 */
  df: Map<string, number>;
  avgLen: number;
}

export function buildBm25Index(docs: Bm25Doc[]): Bm25Index {
  const df = new Map<string, number>();
  let totalLen = 0;
  for (const doc of docs) {
    totalLen += doc.tokens.length;
    const unique = new Set(doc.tokens);
    for (const t of unique) {
      df.set(t, (df.get(t) ?? 0) + 1);
    }
  }
  return {
    docs,
    df,
    avgLen: docs.length === 0 ? 0 : totalLen / docs.length,
  };
}

/** 逆文档频率：BM25+ 变体（分子分母各 +1），保证 df=N 时 idf 仍 > 0 */
export function idf(index: Bm25Index, term: string): number {
  const n = index.docs.length;
  const df = index.df.get(term) ?? 0;
  return Math.log(1 + (n - df + 0.5) / (df + 0.5));
}

export interface ScoredDoc {
  id: string;
  score: number;
}

/** 对单个查询打分，返回 score > 0 的文档，降序 */
export function score(index: Bm25Index, queryTokens: string[]): ScoredDoc[] {
  const results: ScoredDoc[] = [];
  for (const doc of index.docs) {
    if (doc.tokens.length === 0) continue;
    const tf = new Map<string, number>();
    for (const t of doc.tokens) {
      tf.set(t, (tf.get(t) ?? 0) + 1);
    }
    let score = 0;
    for (const term of queryTokens) {
      const f = tf.get(term);
      if (f === undefined) continue;
      const denom = f + K1 * (1 - B + B * (doc.tokens.length / index.avgLen));
      score += (idf(index, term) * f * (K1 + 1)) / denom;
    }
    if (score > 0) {
      results.push({ id: doc.id, score });
    }
  }
  results.sort((a, b) => b.score - a.score);
  return results;
}
