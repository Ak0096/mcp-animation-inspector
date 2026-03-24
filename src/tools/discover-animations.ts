import type { Config } from '../config.js';
import type { BrowserManager } from '../browser.js';
import { navigateTo } from '../pipeline/navigate.js';
import { discoverWithMeta } from '../pipeline/discover.js';
import type { AnimationInventory } from '../types/index.js';
import { withPage } from '../utils/with-page.js';

export async function discoverAnimationsTool(
  url: string,
  browserManager: BrowserManager,
  config: Config,
): Promise<{ inventory: AnimationInventory[]; techStack: string[] }> {
  return withPage(browserManager, config, 'discover', async (page) => {
    const { techStack } = await navigateTo(page, url, config);
    const { inventory } = await discoverWithMeta(page, config);
    return { inventory, techStack };
  });
}
