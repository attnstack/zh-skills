# zh-skills

[![stars](https://img.shields.io/github/stars/attnstack/zh-skills)](https://github.com/attnstack/zh-skills/stargazers)
[![CI](https://github.com/attnstack/zh-skills/actions/workflows/ci.yml/badge.svg)](https://github.com/attnstack/zh-skills/actions)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![node](https://img.shields.io/badge/node-%3E%3D20-blue.svg)](./package.json)

给 Claude Code、Cursor 这些 Agent 用的中文 skills 合集，附带一个安装 CLI。一条命令把 12 个中文工作流 skill（周报、代码评审、技术方案、排版校对……）装进 Agent，另外认真解决了两个麻烦事：Windows 上怎么把 skill 装进去，以及怎么在装之前就知道一句 description 写得能不能被触发。

## 实际运行效果

```text
$ npx github:attnstack/zh-skills route "帮我写周报"
zh-weekly-report  score=5.756
  matched: 写周 / 周报

$ npx github:attnstack/zh-skills route "把这段话翻译成英文"
「把这段话翻译成英文」没有命中任何 skill（可能是 query 与所有 description 无词面重叠，或全被负向惩罚压掉）。

$ npx github:attnstack/zh-skills add zh-typography zh-weekly-report --agent claude-code --mode copy
✓ claude-code: 2 个 skill 校验通过
完成。共安装 2 个（平台 × skill）。Agent 新会话中生效。

$ npx github:attnstack/zh-skills doctor
✓ Node >= 20 — 当前 24.13.0
✓ 内置 skills — 12 个
! symlink 能力 — symlink 不可用（EPERM…），将自动降级 junction/copy
✓ 平台 claude-code — 检测到 ~/.claude
✓ 已装校验 claude-code — 2 个 skill 完整
环境正常。
```

## 快速开始

```bash
# 全部装到检测到的平台
npx github:attnstack/zh-skills add --all

# 只装一个，指定平台
npx github:attnstack/zh-skills add zh-typography --agent claude-code

# 环境体检
npx github:attnstack/zh-skills doctor
```

> 经 GitHub 安装首次要克隆和构建（一分钟左右）。之后在 Agent 里直接说「帮我写周报」「校对这段文档的排版」就能触发对应 skill。

## 里面有什么

12 个 skill，每个都是 `SKILL.md`（主指令）+ `examples/`（输入输出样例）+ `references/pitfalls.md`（踩坑记录）：

zh-tech-writing（技术方案）· zh-pr-description · zh-readme-gen · zh-api-doc · zh-sql-optimization · zh-code-review · zh-typography · zh-test-case-gen · zh-log-analysis · zh-weekly-report · zh-commit-message · zh-requirement-breakdown

其中 zh-typography、zh-commit-message、zh-pr-description 带校验脚本，输出能不能过规范是脚本说了算，不是靠感觉。zh-typography 的样例 output.md 就是 `fix.mjs` 跑出来的，CI 里逐行比对。

## 几个设计决定

**description 按「正向触发 + 不适用于」写，路由把负向文本单独扣分。** skill 能不能被触发，几乎完全取决于 description 的写法。只写「什么时候用」不够——比如写作 skill 的 description 里写了「不适用于：营销文案」，用户真的说「帮我写个营销文案」时，全文检索反而会因为它词面对上而路由过去，把排除场景当成了触发条件。所以每个 skill 的 description 必须带「不适用于」段，路由器对命中的负向词按 idf 全额扣分。这个坑是被测试抓出来的，不是想出来的。

**路由用字符 bigram + BM25，不上模型。** 12 个 skill 的规模，暴力打分 0.05ms 就完事，为此引入几十 MB 的 embedding 模型不划算，中文分词器也要带词典。粒度是实测出来的：单字（n=1）否定样本误报率 78.9%，三字（n=3）在短查询下太稀疏只剩 66.7% 命中，bigram 两头都行。

**Windows 上 symlink → junction → copy 降级。** Windows 建 symlink 要管理员权限或开发者模式，npx 场景指望不上。实际顺序是：Unix 直接 symlink；Windows 先试 junction（NTFS 目录重解析点，免提权，但只对目录、目标必须绝对路径），再不行就 copy。实际用了哪种记进 manifest，`update` 靠它区分语义——链接天然跟随源头，copy 才需要版本比对覆盖。

**skill 装进去之后平台自己会触发，CLI 的 `route` 命令是给你调 description 用的。** 写完描述跑一下 `route "<用户会怎么说>"`，立即看到命中谁、命中词是什么，不用等 Agent 里试错。这 67 条标注 query 同时是 CI 回归：改 description 必须跑。

## Benchmark

口径：测试集是 `tests/router/queries.jsonl`（48 条正向 = 24 直接指令 + 24 间接描述，19 条负向不应触发任何 skill）；基线是不做路由、12 个 skill 全量注入；结果是确定性计算，同输入同输出。延迟在本机测的（Windows 11 / Node 24），换机器跑 `npm run bench` 自取。

| cjkN | 负向惩罚 | Top-1 | Top-3 | 否定样本误报率 |
|---|---|---|---|---|
| 1 | 0 | 95.8% | 100.0% | 78.9% |
| 2（默认） | 1.0 | 95.8% | 100.0% | 0.0% |
| 2 | 0 | 97.9% | 100.0% | 0.0% |
| 3 | 0 | 64.6% | 66.7% | 0.0% |

单次路由延迟 mean ~0.05ms / p99 ~0.2ms（1000 次采样）。上下文方面，Top-3 注入平均 2,699 bytes，对比全量 23,576 bytes，省 88.5%。

两点说明：负向惩罚开着会让 Top-1 掉 2.1 个百分点（1 条 query），留着它是因为排除场景误报比这一点损失更难受；命中率是词面检索的结果，同义改写能力有限，见下面的局限。

## 测试

```bash
npm test                 # 53 用例：单测 + 路由回归 + 端到端安装流
npm run validate:skills  # skill 资产门禁：schema / 样例 / 脚本一致性
npm run bench            # 命中率矩阵 + 延迟 + 上下文对比，写 bench/results.json
```

CI 在 ubuntu / windows / macos 三平台跑。路由回归阈值卡死：Top-3 ≥ 85%、否定误报 ≤ 10%。

## 已知局限

- 词面路由，同义改写（「周五要交的东西」→ 周报）只有评测集里恰好有该说法才能命中。上 embedding 能解决，但这个规模下不值得付出安装体积，v0.3 会做成可选项。
- codex / opencode / gemini-cli 的 skills 目录按社区通行约定实现，没有逐版本核对官方文档，标了 experimental，`--target <目录>` 可以兜底。
- 评测集是自己标的，有自证循环的风险；否定样本和分层报告能缓解一部分，缺一个第三方标注集。
- `learn` 写的是安装副本，npx 升级会丢，反例沉淀最终要靠提 PR 回传。

## 路线图

- v0.2：MCP Server（中文互联网结构化读取，设计稿见 [docs/mcp-design.md](docs/mcp-design.md)）；experimental 平台的目录约定核实。
- v0.3：可选向量路由；skills 数量往中文高频场景扩（公文、飞书文档等）。

## Contributing

见 [CONTRIBUTING.md](CONTRIBUTING.md)。核心是 description 质量：写完先 `route` 调试，再补回归样本。

## License

[MIT](./LICENSE)
