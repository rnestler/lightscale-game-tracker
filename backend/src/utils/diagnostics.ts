export function recordRuntimeError(scope: string, error: unknown): void {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  const line = `[runtime-error] ${new Date().toISOString()} ${scope}: ${message}`;
  console.error(line);
}
