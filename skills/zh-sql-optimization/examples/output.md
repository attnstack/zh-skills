## 慢 SQL 分析报告

### 主要瓶颈

`type=ALL`：850 万行全表扫描，且 `Using filesort` 表示排序在内存/磁盘完成。
`status` 与 `created_at` 完全没有索引支撑，`idx_user` 只覆盖了第一个条件。

### 建议 1：联合索引（预期消除全表扫描与 filesort）

```sql
ALTER TABLE orders ADD INDEX idx_user_status_created (user_id, status, created_at);
-- 验证：EXPLAIN 应变为 type=ref, key=idx_user_status_created, Extra 不再有 filesort
-- 回滚：ALTER TABLE orders DROP INDEX idx_user_status_created;
-- 代价：写入时多维护一个索引，orders 日增量约 X 万行（TODO 实测后填入）
```

列顺序依据：等值条件在前（user_id, status），排序列收尾（created_at），
这样 ORDER BY 直接沿索引顺序读取，filesort 消失。

### 建议 2：返回列已可覆盖，可省回表

查询只取 `id, amount`。上述索引不含 amount，仍需回表 43 行（可接受，不再加宽索引）。

### 待确认

- 前后耗时对比：TODO(实测后填入)（用同一数据集各跑 3 次取中位数）。
