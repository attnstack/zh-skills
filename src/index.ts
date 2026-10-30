// 库模式导出：把 CLI 内部的核心能力暴露为 API，供其他 Node 程序复用
// （路由、适配层与 CLI 命令解耦，其他项目可以直接 import 而不必 spawn 子进程）
export { loadSkill, loadSkillDir, splitDescription, skillMetaSchema, SKILL_FILE } from "./core/skill.js";
export type { Skill, SkillMeta } from "./core/skill.js";
export { parseFrontmatter, FrontmatterError } from "./core/frontmatter.js";
export { UsageError, EnvironmentError, ProgramError, exitCodeFor } from "./core/errors.js";
export { SkillRouter } from "./router/index.js";
export type { RouteOptions, RouteResult, RoutedSkill } from "./router/index.js";
export { tokenize, normalize } from "./router/tokenizer.js";
export { buildBm25Index, score, idf } from "./router/bm25.js";
export type { Bm25Doc, Bm25Index, ScoredDoc } from "./router/bm25.js";
export { evaluate, loadQueries } from "./router/eval.js";
export type { EvalReport, LabeledQuery } from "./router/eval.js";
export { createAdapters, createCustomAdapter, resolveAdapters } from "./adapters/registry.js";
export { BaseAgentAdapter } from "./adapters/base.js";
export type {
  AgentAdapter,
  AgentId,
  InstallResult,
  LinkMode,
  Manifest,
  VerifyReport,
} from "./adapters/types.js";
export { AGENT_IDS, isAgentId } from "./adapters/types.js";
export { loadConfig } from "./util/config.js";
export { Logger } from "./util/logger.js";
