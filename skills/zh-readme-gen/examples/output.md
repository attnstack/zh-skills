# md2confluence

<!-- 数字均为占位，实测后填入：转换速度、支持的文件量级 -->

把中文 Markdown 文档批量发布到 Confluence 的命令行工具。保留表格与代码块，一条命令同步整个 docs 目录。

## 30 秒上手

```bash
npm install -g md2confluence
export CONFLUENCE_BASE_URL=https://your-site.atlassian.net
export CONFLUENCE_TOKEN=xxx
md2confluence push ./docs/*.md
# 预期输出：逐文件打印 上传成功/失败 与页面链接
```

## 特性

| 特性 | 说明 |
|---|---|
| 表格保留 | GFM 表格完整映射为 Confluence 表格宏 |
| 代码高亮 | 语言标记自动映射（ts → TypeScript） |
| frontmatter | 文件头指定 space / parent page，不用改命令 |

## 原理

解析 Markdown AST → 逐节点映射 Confluence 存储格式（XHTML 宏）→ REST API 逐页 upsert。

## License

MIT
