// Vitest 配置：单测 + 集成测试共用；集成测试在 Windows/Unix 都基于临时目录，不碰真实 HOME
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    // 集成测试涉及临时目录与子进程，放宽到 60s；单测毫秒级
    testTimeout: 60_000,
    environment: "node",
  },
});
