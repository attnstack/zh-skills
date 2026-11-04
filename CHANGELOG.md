# Changelog

## 0.2.0 (2026-11-05)

- 新增 2 个技能：zh-postmortem（故障复盘，带结构校验脚本）、zh-gongwen（公文写作），共 14 个
- 新增 `zh-skills lint`：校验任意技能目录（frontmatter / 样例对 / 坑记录 / 行数约束），与仓库 CI 共用同一套判定（src/core/validate.ts）
- 新增 `add --route "<需求描述>"`：按查询路由安装 Top-K，不必知道技能名
- 新增 `route --label <技能名>` 与 `feedback` 命令：记录真实误判，离线重放算命中率（反馈存 ~/.zh-skills/feedback.jsonl）
- 新增英文版 README；仓库门禁脚本改用共享校验核心
- 路由回归集扩到 73 条标注 query（14 技能口径实测：Top-1 96.3% / Top-3 100% / 否定误报 0%）
- 测试增至 70 个，新增 CLI 进程级冒烟（真实子进程验证参数解析与退出码）

## 0.1.1 (2026-11-01)

- bin 路径去掉 `./` 前缀，适配 npm 新版发布校验（旧写法发布时 bin 被静默删除，npx 失效）
- README 切换 `npx zh-skills` 主路径，加 npm 徽章
- zh-typography 1.0.1：fix/check 脚本跳过围栏代码块与内联代码，不再改坏代码

## 0.1.0 (2026-10-31)

- 首个版本：12 个中文技能、安装 CLI（add/list/update/remove/route/doctor/learn）、
  5 平台适配（symlink/junction/copy 降级）、BM25 + 负向惩罚路由、67 条回归集、三平台 CI
