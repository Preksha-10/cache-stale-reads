// src/logger/CacheLogger.ts
export type LogLevel = "hit" | "miss" | "mutation" | "invalidate" | "info";

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: number;
}

export class CacheLogger {
  private readonly logs: LogEntry[] = [];
  private readonly listeners: Array<(entry: LogEntry) => void> = [];

  log(level: LogLevel, message: string): void {
    const entry: LogEntry = { level, message, timestamp: Date.now() };
    this.logs.push(entry);
    this.listeners.forEach((fn) => fn(entry));
    console.log(`[${new Date(entry.timestamp).toISOString()}] [${level.toUpperCase()}] ${message}`);
  }

  onLog(fn: (entry: LogEntry) => void): void {
    this.listeners.push(fn);
  }

  history(): LogEntry[] {
    return [...this.logs];
  }
}
