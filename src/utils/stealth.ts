import type { BrowserContext } from 'playwright';

export async function applyStealthScripts(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

    Object.defineProperty(navigator, 'plugins', {
      get: () => {
        const arr = [
          { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format', length: 1 },
          { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '', length: 1 },
          { name: 'Native Client', filename: 'internal-nacl-plugin', description: '', length: 1 },
        ];
        Object.defineProperty(arr, 'length', { value: 3 });
        return arr;
      },
    });

    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
    });

    ((window as unknown) as Record<string, unknown>).chrome = {
      runtime: {},
      loadTimes: () => ({}),
      csi: () => ({}),
    };
  });
}
