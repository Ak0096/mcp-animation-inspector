import type { Config } from '../config.js';
import type { BrowserManager } from '../browser.js';
import type { AnimationInventory, FrameSet, Frame } from '../types/index.js';
import { navigateTo } from '../pipeline/navigate.js';
import { discoverAnimations } from '../pipeline/discover.js';
import { captureFrames } from '../pipeline/capture.js';
import { withPage } from '../utils/with-page.js';

export async function captureFramesTool(
  url: string,
  browserManager: BrowserManager,
  config: Config,
  inventory?: AnimationInventory[],
): Promise<{ scrollFrames: Frame[]; animationFrames: FrameSet[] }> {
  return withPage(browserManager, config, 'capture', async (page) => {
    await navigateTo(page, url, config);
    const inv = inventory ?? (await discoverAnimations(page, config));
    return captureFrames(page, inv, config);
  });
}
