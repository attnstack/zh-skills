表：orders(id BIGINT PK, user_id BIGINT, status TINYINT, created_at DATETIME, amount DECIMAL)
现有索引：PRIMARY(id), idx_user(user_id)
慢查询（1.2s，返回 43 行）：
SELECT id, amount FROM orders
WHERE user_id = 10086 AND status = 2
ORDER BY created_at DESC
LIMIT 20;

EXPLAIN 输出：
type=ALL, rows=8500000, Extra=Using where; Using filesort
