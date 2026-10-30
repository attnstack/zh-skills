# Pitfalls：zh-commit-message

## [2026-10] revert 提交没有引用原提交

- 症状：`revert: 撤销上次改动`，三个月后没人知道回滚的是什么。
- 正确处理：`revert: feat(api): 批量导出`，body 里带上被回滚提交的完整 hash。

## [2026-10] 把三件事写进一个 feat

- 症状：`feat(core): 新增导出功能并修复登录 bug 和升级依赖`——无法被 cherry-pick、无法被定位回滚。
- 正确处理：按「能不能独立回滚」拆分提交；不能拆时 body 分点列出。

## [2026-10] scope 编造

- 症状：`fix(maybe-auth): ...`，scope 拼错了模块名，检索失效。
- 正确处理：不确定 scope 就省略；scope 必须来自真实目录名或包名。
