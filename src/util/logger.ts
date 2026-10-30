// 统一日志：数据走 stdout、日志走 stderr，保证 stdout 可被管道/JSON 消费

export type LogLevel = "silent" | "error" | "warn" | "info" | "debug";

const LEVEL_ORDER: Record<LogLevel, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
};

export class Logger {
  constructor(
    private readonly level: LogLevel = "info",
    private readonly err: NodeJS.WriteStream = process.stderr,
  ) {}

  static fromEnv(): Logger {
    const raw = process.env.ZH_SKILLS_LOG;
    const level = (["silent", "error", "warn", "info", "debug"] as const).find(
      (l) => l === raw,
    );
    return new Logger(level ?? "info");
  }

  /** 面向用户的正常输出（结果），永远走 stdout */
  out(message: string): void {
    process.stdout.write(message + "\n");
  }

  error(message: string): void {
    if (LEVEL_ORDER[this.level] >= LEVEL_ORDER.error) this.err.write(`[error] ${message}\n`);
  }

  warn(message: string): void {
    if (LEVEL_ORDER[this.level] >= LEVEL_ORDER.warn) this.err.write(`[warn] ${message}\n`);
  }

  info(message: string): void {
    if (LEVEL_ORDER[this.level] >= LEVEL_ORDER.info) this.err.write(`[info] ${message}\n`);
  }

  debug(message: string): void {
    if (LEVEL_ORDER[this.level] >= LEVEL_ORDER.debug) this.err.write(`[debug] ${message}\n`);
  }

  isEnabled(level: LogLevel): boolean {
    return LEVEL_ORDER[this.level] >= LEVEL_ORDER[level];
  }
}
