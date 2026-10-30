---
name: zh-pr-description
description: >
  PR 描述生成：为 Pull Request 写结构化中文说明（背景/改动/测试三段式）。
  当用户要求写 PR 描述、合并请求说明、MR 说明、变更说明文档时使用。
  不适用于：单条 git commit message（用 zh-commit-message）、代码评审意见（用 zh-code-review）。
allowed-tools: [Read, Bash]
version: 1.0.0
tags: [git, chinese, pull-request]
---

# PR 描述（中文三段式）

把一次代码变更讲清楚：为什么改、改了什么、怎么验证。

## 工作流程

1. 收集上下文：`git log` / `git diff <base>...HEAD` / 关联 issue；
2. 按下方模板生成，三节缺一不可；
3. 自检：`node scripts/check.mjs < pr.md`（校验三节齐全），exit 0 才交付。

## 输出模板（严格遵守）

```markdown
## 背景

为什么做这个改动。一句话问题 + 必要的上下文（关联 issue 用 #N 引用）。

## 改动

- 用 bullet 列出关键改动点，每条一句话，按重要性排序；
- 不罗列文件清单——reviewer 自己会看 diff。

## 测试

- 如何验证：跑了什么测试 / 手动步骤；
- 未覆盖的部分如实说明，不写「已充分测试」这种空话。
```

## 硬性规则

1. 三节标题固定：`## 背景`、`## 改动`、`## 测试`；
2. 每节至少一行实质内容，禁止 `无` / `N/A`（真没有就写明原因）；
3. 破坏性变更放在「背景」开头，加 `**BREAKING**` 标记与迁移说明；
4. 不粘贴大段代码——reviewer 看 diff，描述里只写思路。

## 常见错误

先读 `references/pitfalls.md`。特别注意：把 diff 逐文件复述一遍（应该讲变更意图）、
测试节写「本地跑过」（要写清跑了什么命令、什么环境）。
