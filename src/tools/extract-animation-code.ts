import type { Config } from '../config.js';
import type { BrowserManager } from '../browser.js';
import type { AnimationInventory, AnimationCode } from '../types/index.js';
import { navigateTo } from '../pipeline/navigate.js';
import { discoverAnimations } from '../pipeline/discover.js';
import { extractAnimationCode } from '../pipeline/extract.js';
import { withPage } from '../utils/with-page.js';

export async function extractAnimationCodeTool(
  url: string,
  browserManager: BrowserManager,
  config: Config,
  inventory?: AnimationInventory[],
): Promise<AnimationCode[]> {
  return withPage(browserManager, config, 'extract', async (page) => {
    await navigateTo(page, url, config);
    const inv = inventory ?? (await discoverAnimations(page, config));
    const { code } = await extractAnimationCode(page, inv);
    return code;
  });
}
