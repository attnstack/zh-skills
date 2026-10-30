PR 背景：新增批量导出用户列表接口。

diff 片段（Node.js/Express）：
```js
router.get("/users/export", async (req, res) => {
  const users = await db.query("SELECT id, name FROM users LIMIT 100000");
  for (const u of users) {
    u.vip = await db.query("SELECT level FROM vip WHERE user_id = ?", [u.id]);
  }
  res.json(users);
});
```
