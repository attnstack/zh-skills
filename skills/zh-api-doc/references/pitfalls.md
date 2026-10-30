# Pitfalls：zh-api-doc

## [2026-10] GraphQL schema 被当 REST 展开

- 症状：把 mutation/query 字段逐层铺成 REST 字段表，结构完全失真。
- 正确处理：先识别 schema 类型（有 query/mutation/type 关键字即 GraphQL），按 GraphQL 文档结构输出。

## [2026-10] 嵌套对象只写 object

- 症状：`data: object` 三个字打发，调用方还得去读源码。
- 正确处理：嵌套对象递归展开为子表，深度 > 3 层时折叠并给出跳转锚点。

## [2026-10] 编造必填与默认值

- 症状：文档写「remark 必填」，实际代码没有该校验，调用方白做兜底。
- 正确处理：必填与默认值只从 schema/校验代码取，取不到标「待确认」。
