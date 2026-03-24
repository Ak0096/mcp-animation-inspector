export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), timeoutMs);
  try {
    return await Promise.race([
      fn(),
      new Promise<never>((_, reject) => {
        abort.signal.addEventListener('abort', () =>
          reject(new Error(`${label} timeout: exceeded ${timeoutMs}ms`))
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
