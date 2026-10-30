// 路由入口：正向 BM25 打分 + 负向文本惩罚，输出 Top-K
// 负向惩罚：description 里的「不适用于：营销文案」若参与正向索引，
// query「写个营销文案」会因为词面命中反而路由到写作 skill——把排除场景当成了触发器。
// 解法：负向文本单独建索引，命中的负向词按 idf 扣分。
// 阈值设计：BM25 分数无上界，绝对阈值不可移植；
// 这里用「相对最高分的比例」过滤，K 随语料自适应。

import { buildBm25Index, idf, score, type Bm25Index, type Bm25Doc } from "./bm25.js";
import { splitDescription, type Skill } from "../core/skill.js";
import { tokenize, type TokenizeOptions } from "./tokenizer.js";

export interface RouteOptions extends TokenizeOptions {
  /** 最多返回几个 skill */
  topK?: number;
  /** 相对最高分的最低保留比例（0-1），低于的候选丢弃 */
  minScoreRatio?: number;
  /** 每命中一个负向词元扣除的分数权重（乘以该词元的 idf） */
  negativePenalty?: number;
}

export interface RoutedSkill {
  name: string;
  score: number;
  /** 命中的正向词元（调试 route 输出用） */
  matchedTerms: string[];
}

export interface RouteResult {
  items: RoutedSkill[];
  /** 被负向惩罚压掉的候选（调试可见） */
  suppressed: RoutedSkill[];
}

const DEFAULTS: Required<RouteOptions> = {
  cjkN: 2,
  topK: 3,
  minScoreRatio: 0.3,
  // 负向惩罚 = 1.0 表示命中的负向词按其 idf 全额扣分（等权于正向命中）：
  // 语义上「排除场景」与「触发场景」的证据强度应当对等；实测 0.6 压不住词面重叠型假阳性
  negativePenalty: 1.0,
};

interface SkillDoc {
  name: string;
  positive: Bm25Doc;
  negative: Bm25Doc;
}

export class SkillRouter {
  private docs: SkillDoc[] = [];
  private positiveIndex: Bm25Index | null = null;
  private negativeIndex: Bm25Index | null = null;

  constructor(
    skills: Skill[],
    private readonly options: Partial<RouteOptions> = {},
  ) {
    this.docs = skills.map((skill) => {
      const { positive, negative } = splitDescription(skill.meta.description);
      const tagText = skill.meta.tags.join(" ");
      return {
        name: skill.meta.name,
        // 索引内容 = name + tags + 正向描述。name 与 tags 是强信号，权重自然由词频体现
        positive: { id: skill.meta.name, tokens: tokenize(`${skill.meta.name} ${tagText} ${positive}`, options) },
        negative: { id: skill.meta.name, tokens: negative ? tokenize(negative, options) : [] },
      };
    });
    this.positiveIndex = buildBm25Index(this.docs.map((d) => d.positive));
    this.negativeIndex = buildBm25Index(this.docs.map((d) => d.negative));
  }

  get size(): number {
    return this.docs.length;
  }

  route(query: string, overrides: Partial<RouteOptions> = {}): RouteResult {
    if (!this.positiveIndex || !this.negativeIndex) {
      throw new Error("router 未初始化");
    }
    const opts = { ...DEFAULTS, ...this.options, ...overrides };
    const queryTokens = tokenize(query, opts);
    if (queryTokens.length === 0) {
      return { items: [], suppressed: [] };
    }

    const positives = score(this.positiveIndex, queryTokens);
    const negativeScores = new Map<string, number>();
    for (const neg of score(this.negativeIndex, queryTokens)) {
      negativeScores.set(neg.id, neg.score);
    }

    // 每个候选的 matchedTerms 单独计算：查询词元的 idf 与文档词频共同决定贡献
    const candidates: RoutedSkill[] = [];
    for (const pos of positives) {
      const doc = this.docs.find((d) => d.name === pos.id);
      if (!doc) continue;
      const negScore = negativeScores.get(pos.id) ?? 0;
      const adjusted = pos.score - opts.negativePenalty * negScore;
      const matchedTerms = dedupe(queryTokens.filter((t) => doc.positive.tokens.includes(t)));
      candidates.push({
        name: pos.id,
        score: adjusted,
        matchedTerms,
      });
    }

    // 调整后分数 <= 0 的候选视为被负向惩罚压掉（或正向分本身极低），移入 suppressed 供调试
    const kept = candidates.filter((c) => c.score > 0).sort((a, b) => b.score - a.score);
    const suppressed = candidates
      .filter((c) => c.score <= 0)
      .sort((a, b) => b.score - a.score);

    const top = kept[0];
    if (!top) {
      return { items: [], suppressed };
    }
    // 相对阈值：分数不足最高分 minScoreRatio 的候选不注入，避免「硬凑满 K 个」
    const filtered = kept.filter((c) => c.score >= top.score * opts.minScoreRatio);
    return { items: filtered.slice(0, opts.topK), suppressed };
  }
}

function dedupe(tokens: string[]): string[] {
  return [...new Set(tokens)];
}

export { idf };
