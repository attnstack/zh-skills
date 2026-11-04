// CLI 进程级冒烟：真实子进程跑 CLI（tsx 直跑源码），验证参数解析、退出码与 JSON 输出契约
// 库层测试覆盖不了 bin/shebang/exitCode 这类「进程边界」的问题
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const TSX = join(repoRoot, "node_modules", "tsx", "dist", "cli.mjs");
const ENTRY = join(repoRoot, "src", "cli", "index.ts");

interface FailResult {
  status: number;
  stdout: string;
  stderr: string;
}

function run(args: string[]): string {
  return execFileSync(process.execPath, [TSX, ENTRY, ...args], {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    timeout: 60_000,
  });
}

function runExpectFail(args: string[]): FailResult {
  try {
    run(args);
  } catch (err) {
    const e = err as FailResult;
    if (typeof e.status !== "number") throw err;
    return e;
  }
  throw new Error(`命令应失败但成功退出：${args.join(" ")}`);
}

describe("CLI 冒烟", () => {
  it("list --json 输出可解析且覆盖全部注册平台", () => {
    const rows: Array<{ skill: string; agent: string; state: string }> = JSON.parse(
      run(["list", "--json"]),
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(new Set(rows.map((r) => r.agent))).toEqual(
      new Set(["claude-code", "cursor", "codex", "opencode", "gemini-cli"]),
    );
  }, 30_000);

  it("route --json 命中周报并返回分数", () => {
    const data: { query: string; items: Array<{ name: string; score: number }> } = JSON.parse(
      run(["route", "帮我写周报", "--json"]),
    );
    expect(data.query).toBe("帮我写周报");
    expect(data.items[0]?.name).toBe("zh-weekly-report");
    expect(data.items[0]?.score).toBeGreaterThan(0);
  }, 30_000);

  it("未知技能退出码 1（用法错误契约）", () => {
    const e = runExpectFail(["add", "no-such-skill", "--agent", "claude-code"]);
    expect(e.status).toBe(1);
    expect(e.stderr).toContain("no-such-skill");
  }, 30_000);

  it("lint 校验内置技能目录并输出通过", () => {
    const out = run(["lint"]);
    expect(out).toContain("个技能全部通过校验");
  }, 30_000);
});
