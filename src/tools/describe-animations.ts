import type { Config } from '../config.js';
import type { BrowserManager } from '../browser.js';
import type { FrameSet, AnimationCode } from '../types/index.js';
import { describeAnimations } from '../pipeline/describe.js';
import { withTimeout } from '../utils/with-timeout.js';

export async function describeAnimationsTool(
  input: { url: string } | { frames: FrameSet[]; code: AnimationCode[] },
  browserManager: BrowserManager,
  config: Config,
): Promise<string[]> {
  if (!config.anthropicApiKey) {
    throw new Error('ANTHROPIC_API_KEY is required for describe_animations');
  }

  const describeConfig = { ...config, autoDescribe: true };

  if ('url' in input) {
    const page = await browserManager.acquirePage();
    try {
      const { navigateTo } = await import('../pipeline/navigate.js');
      const { discoverAnimations } = await import('../pipeline/discover.js');
      const { captureFrames } = await import('../pipeline/capture.js');
      const { extractAnimationCode } = await import('../pipeline/extract.js');

      await withTimeout(
        () => navigateTo(page, input.url, describeConfig),
        config.timeout,
        'describe:navigate',
      );
      const inventory = await discoverAnimations(page, describeConfig);
      const { animationFrames } = await captureFrames(page, inventory, describeConfig);
      const extractResult = await extractAnimationCode(page, inventory);
      const code = Array.isArray(extractResult) ? extractResult : extractResult.code;
      const result = await describeAnimations(animationFrames, code, describeConfig);
      return result ?? ['No descriptions generated.'];
    } finally {
      await browserManager.releasePage(page);
    }
  }

  const result = await describeAnimations(input.frames, input.code, describeConfig);
  return result ?? ['No descriptions generated.'];
}
