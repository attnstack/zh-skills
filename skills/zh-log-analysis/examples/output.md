## 日志分析报告

### 四要素

- 错误：`TypeError: Cannot read properties of undefined (reading 'id')`，触发点 `order.js:88`；
- 时间线：最近一次发版（2 小时前）之后开始出现；
- 影响面：约 5% 请求，全部是**游客身份**；
- 变更：发版为唯一已知变更（待确认是否同时改过配置）。

### 根因假设（按性价比排序）

1.【高度怀疑】`req.user` 为空时未做判空：游客请求没有 user 对象，`attachUser` 内读 `user.id` 崩溃。
  验证：查看 order.js:88 前后是否有 `if (!req.user)` 分支；对比 git diff 该函数。
  证据吻合度：与「仅游客触发」完全一致。
2.【待排除】发版引入的中间件顺序变化导致游客上下文未挂载。
  验证：`git diff HEAD~1 -- middleware/`；回滚版本观察 10 分钟。

### 排查清单

1. `git show HEAD~1..HEAD -- dist/services/order.js`（源码 services/order.ts）确认 88 行是否新增；
2. 本地以游客身份复现：`curl -H "Accept: application/json" /orders`（不带登录 cookie）；
3. 临时止血：网关对该路由降级或回滚版本；
4. 修复后补充回归用例：游客请求订单列表（当前用例大概率只覆盖了登录态）。

确定性标注：根因结论为「高度怀疑」，待第 1 步证据确认。
