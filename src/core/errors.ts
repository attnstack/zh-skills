// 错误类型：区分「用户可修复」与「环境/程序级」错误，决定 CLI 退出码
// 退出码是脚本调用的契约：0 成功 / 1 用法错误 / 2 环境错误 / 3 程序 bug

/** 用户输入或用法错误（可恢复，退出码 1） */
export class UsageError extends Error {
  override readonly name = "UsageError";
  constructor(message: string) {
    super(message);
  }
}

/** 环境/权限/外部依赖问题（用户可能可修复，退出码 2） */
export class EnvironmentError extends Error {
  override readonly name = "EnvironmentError";
  constructor(message: string) {
    super(message);
  }
}

/** 断言失败/不可能状态（不可恢复，退出码 3，属于 bug） */
export class ProgramError extends Error {
  override readonly name = "ProgramError";
  constructor(message: string) {
    super(message);
  }
}

export function exitCodeFor(err: unknown): number {
  if (err instanceof UsageError) return 1;
  if (err instanceof EnvironmentError) return 2;
  return 3;
}
