---
name: zh-readme-gen
description: >
  README 生成与优化：为开源仓库或内部项目写 README、项目主页、快速上手指南。
  当用户要求写 README、生成项目文档首页、优化仓库介绍、写 Quick Start 时使用。
  不适用于：接口文档（用 zh-api-doc）、技术方案、代码评审。
allowed-tools: [Read, Write, Glob]
version: 1.0.0
tags: [writing, chinese, readme, docs]
---

# README 生成

README 的唯一使命：让陌生读者在 60 秒内判断「这东西和我有关、我知道怎么跑起来」。

## 工作流程

1. 收集事实：读 package.json/pyproject/go.mod（拿真实安装命令）、入口文件（拿真实用法）、LICENSE；
2. 按下方骨架生成；命令必须从配置文件里核实，禁止编造；
3. 自检三问：陌生人能跑起来吗？关键卖点在前 50 词吗？所有数字有来源吗？

## 文档骨架

```markdown
# <项目名>
<一句话定位，前 50 词包含核心搜索关键词>
<徽章：CI / license / 最新版本>
## 30 秒上手（可复制粘贴的命令序列 + 预期输出）
## 特性（表格，每行一个可验证的能力）
## 原理（一段话 + 架构图）
## FAQ / 常见问题
## License
```

## 硬性规则

1. Quick Start 的每条命令必须真实可执行——写了 `npm run dev` 就必须存在这个 script；
2. 性能数字未经 benchmark 实测一律写 `TODO(实测后填入)`，禁止编造；
3. 首屏不放大段原理——原理放二级标题之后；
4. 中英混排遵循 zh-typography 规范（全角标点、CJK 与 ASCII 间空格）。

## 常见错误

先读 `references/pitfalls.md`。特别注意：安装命令写了 pnpm 但仓库只有 npm 锁文件、
特性表里全是形容词（「高性能」「易用」）没有可验证内容。
