# Contributing

## 新增一个 skill

1. `mkdir skills/<your-name>`（kebab-case，`zh-` 前缀），创建：

   ```
   skills/<your-name>/
   ├── SKILL.md
   ├── examples/input.md
   ├── examples/output.md
   └── references/pitfalls.md
   ```

2. **SKILL.md frontmatter 是硬约束**（CI 校验）：

   - `name`：kebab-case，与目录名一致；
   - `description`：三段式——一句话说明 + 「当用户……时使用」（正向触发）+ 「不适用于：……」（负向排除，**必写**）；
   - `version`：semver 三段式；
   - 正文 < 500 行（渐进披露：细节放 `references/`）。

3. **description 写完必须过路由调试**——description 是路由命门：

   ```bash
   npx tsx src/cli/index.ts route "<用户会怎么问>"
   ```

   确认目标 query 能命中，再补 2-4 条标注样本到 `tests/router/queries.jsonl`（`npm run bench` 验证不掉分）。

4. **样例必须可验证**：input/output 成对；如果输出能被规则判定（格式、结构），优先加 `scripts/check.mjs` 校验脚本——判定不了的（纯生成内容）在 output.md 头部注明「人工核对样例」。

5. 本地验收：`npm run validate:skills && npm test`。

## 改已有 skill 的 description

路由回归会自动跑（`tests/router/regression.test.ts`）。若 Top-3 或否定误报率越界，CI 拒绝合并。降低假阳性的优先手段是**调 description**（拆分触发词、补负向段），而不是调路由参数。

## 提交信息

遵循本仓库自产的规范：`type(scope): 中文描述`（feat/fix/docs/refactor/test/chore），可用 `skills/zh-commit-message/scripts/check.mjs` 自检。

## 经验库反例

使用中发现 skill 输出不符合预期时：把「症状 / 错误输出 / 正确处理」追加到对应 skill 的 `references/pitfalls.md`（本地用 `zh-skills learn`），并提 PR 回传——这是让 skill 越用越准的唯一闭环。
