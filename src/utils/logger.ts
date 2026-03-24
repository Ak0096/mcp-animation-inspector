const DEBUG = process.env.DEBUG?.includes('mcp-animation-inspector') ?? false;

export function debug(stage: string, ...args: unknown[]): void {
  if (DEBUG) {
    console.error(`[mcp-animation-inspector:${stage}]`, ...args);
  }
}
