import type { Config } from '../config.js';
import type { BrowserManager } from '../browser.js';
import { navigateTo } from '../pipeline/navigate.js';
import { discoverWithMeta } from '../pipeline/discover.js';
import type { AnimationInventory } from '../types/index.js';

export async function discoverAnimationsTool(
  url: string,
  browserManager: BrowserManager,
  config: Config,
): Promise<{ inventory: AnimationInventory[]; techStack: string[] }> {
  const page = await browserManager.acquirePage();

  try {
    const { techStack } = await navigateTo(page, url, config);
    const { inventory } = await discoverWithMeta(page, config);
    return { inventory, techStack };
  } finally {
    await browserManager.releasePage(page);
  }
}
