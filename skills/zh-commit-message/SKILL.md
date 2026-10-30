---
name: zh-commit-message
description: >
  Git 提交信息生成：按 Conventional Commits 规范生成中文 subject 的 commit message。
  当用户要求写提交信息、commit message、规范化 git 提交、拆分提交时使用。
  不适用于：PR 描述（用 zh-pr-description）、changelog 汇总、代码评审。
allowed-tools: [Read, Bash]
version: 1.0.0
tags: [git, chinese, conventional-commits]
---

# Git 提交信息（Conventional Commits 中文版）

从 diff 或改动说明生成规范提交信息。格式：`type(scope): 中文描述`。

## 工作流程

1. 收集变更：`git diff --staged` 或用户提供的需求描述；
2. 判断 type（见下表），有多个不相关变更时建议拆分提交而不是塞进一个；
3. 生成 1 条 subject + 可选 body；
4. 用本 skill 的校验脚本自检：`node scripts/check.mjs "feat(api): 支持批量导出"`，exit 0 才交付。

## type 对照表

| type | 用途 |
|---|---|
| feat | 新功能 |
| fix | 缺陷修复 |
| docs | 文档 |
| refactor | 不改行为的重构 |
| perf | 性能优化 |
| test | 测试 |
| chore | 构建/工具链/依赖 |
| revert | 回滚 |

## 硬性规则

1. subject 一行，≤ 50 字符，用**中文**描述「做了什么」，不加句号；
2. scope 是模块名（英文小写），不知道就省略，不要编造；
3. body 说明「为什么」，每行 ≤ 72 字符；只改一行配置时不需要 body；
4. 破坏性变更：type 后加 `!`，body 末尾加 `BREAKING CHANGE: <迁移说明>`；
5. 禁止 `update code` / `修改一些东西` 这类无信息量描述。

## 输出格式

只输出可直接使用的提交信息本身（含 body），不要加解释、不要包代码围栏以外的文字。
用户要求多条时按提交顺序编号，每条之间空一行。

## 常见错误

先读 `references/pitfalls.md`。特别注意：subject 用英文、把多件事塞进一个 feat、
revert 时没有引用被回滚的提交号。
