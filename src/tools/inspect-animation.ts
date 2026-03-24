import type { Config } from '../config.js';
import type { BrowserManager } from '../browser.js';
import { navigateTo } from '../pipeline/navigate.js';
import { discoverWithMeta } from '../pipeline/discover.js';
import { captureFrames } from '../pipeline/capture.js';
import { extractAnimationCode } from '../pipeline/extract.js';
import { describeAnimations } from '../pipeline/describe.js';
import { buildReport } from '../pipeline/report.js';
import type { InspectionReport } from '../types/index.js';

export async function inspectAnimation(
  url: string,
  browserManager: BrowserManager,
  config: Config,
): Promise<InspectionReport> {
  const startTime = Date.now();

  // Wall-clock timeout — spec requires hard abort at config.timeout
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), config.timeout);

  const page = await browserManager.acquirePage();

  try {
    const pipeline = async (): Promise<InspectionReport> => {
      const { techStack } = await navigateTo(page, url, config);
      if (abort.signal.aborted) throw new Error('Pipeline timeout exceeded');

      const { inventory, detectorsRun, errors } = await discoverWithMeta(page, config);
      if (abort.signal.aborted) throw new Error('Pipeline timeout exceeded');

      const { scrollFrames, animationFrames } = await captureFrames(page, inventory, config);
      if (abort.signal.aborted) throw new Error('Pipeline timeout exceeded');

      const code = await extractAnimationCode(page, inventory);
      const descriptions = await describeAnimations(animationFrames, code, config);

      return buildReport({
        url,
        techStack,
        inventory,
        scrollFrames,
        animationFrames,
        code,
        descriptions,
        detectorsRun,
        errors,
        startTime,
      });
    };

    const timeoutPromise = new Promise<never>((_, reject) => {
      abort.signal.addEventListener('abort', () =>
        reject(new Error(`Pipeline timeout: exceeded ${config.timeout}ms`))
      );
    });

    return await Promise.race([pipeline(), timeoutPromise]);
  } finally {
    clearTimeout(timer);
    await browserManager.releasePage(page);
  }
}
