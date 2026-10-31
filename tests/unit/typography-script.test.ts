// zh-typography 脚本行为单测：围栏代码块与内联代码原样保留，正文照常修复；check 与 fix 判定范围一致
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "skills",
  "zh-typography",
  "scripts",
);

function fix(input: string): string {
  return execFileSync("node", [join(scriptsDir, "fix.mjs")], { input, encoding: "utf8" });
}

function passesCheck(input: string): boolean {
  try {
    execFileSync("node", [join(scriptsDir, "check.mjs")], {
      input,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return true;
  } catch {
    return false;
  }
}

describe("fix.mjs", () => {
  it("修复正文的标点与重复叹号", () => {
    expect(fix("你好,世界!!")).toBe("你好，世界！");
  });

  it("围栏代码块（含围栏行）原样保留", () => {
    const input = ["说明,如下", "```js", 'console.log("你好,world")', "```", "结束!!"].join("\n");
    const expected = ["说明，如下", "```js", 'console.log("你好,world")', "```", "结束！"].join(
      "\n",
    );
    expect(fix(input)).toBe(expected);
  });

  it("~~~ 围栏同样生效", () => {
    const input = ["~~~", "a,中b", "~~~", "好,的"].join("\n");
    expect(fix(input)).toBe(["~~~", "a,中b", "~~~", "好，的"].join("\n"));
  });

  it("内联代码原样保留，两侧正文照常修复", () => {
    expect(fix("运行`a,b中`命令,好")).toBe("运行`a,b中`命令，好");
  });

  it("内联代码前后的空格不被吞掉", () => {
    expect(fix("使用 `npm` 安装")).toBe("使用 `npm` 安装");
  });

  it("行尾空白只在整行末尾删除", () => {
    expect(fix("你好 `x`   ")).toBe("你好 `x`");
  });

  it("未闭合的围栏：其后内容视为代码不改动", () => {
    expect(fix(["好,的", "```", "a,中"].join("\n"))).toBe(["好，的", "```", "a,中"].join("\n"));
  });
});

describe("check.mjs", () => {
  it("代码区域里的「违规」不报", () => {
    const text = ["正文没问题。", "```", "a,中", "```", "看 `x,中` 这里"].join("\n");
    expect(passesCheck(text)).toBe(true);
  });

  it("正文违规照常报", () => {
    expect(passesCheck("你好,世界")).toBe(false);
  });

  it("fix 的输出必然通过 check（含代码块的文档）", () => {
    const input = ["说明,如下:", "```", "x = 1,中", "```", "完成!!使用`npm`安装Node.js"].join("\n");
    expect(passesCheck(fix(input))).toBe(true);
  });
});
