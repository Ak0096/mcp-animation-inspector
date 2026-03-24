import type { Page } from 'playwright';
import type { AnimationDetector } from './types.js';
import type { AnimationInfo } from '../types/index.js';

export const cursorDetector: AnimationDetector = {
  name: 'cursor',

  async detect(page: Page): Promise<boolean> {
    return page.evaluate(() => {
      const bodyStyle = window.getComputedStyle(document.body);
      if (bodyStyle.cursor === 'none') return true;

      const htmlStyle = window.getComputedStyle(document.documentElement);
      if (htmlStyle.cursor === 'none') return true;

      // Check for custom cursor elements
      const cursorEls = document.querySelectorAll(
        '[class*="cursor" i], [id*="cursor" i]'
      );
      for (const el of cursorEls) {
        const style = window.getComputedStyle(el);
        if (style.position === 'fixed' || style.position === 'absolute') {
          return true;
        }
      }

      return false;
    });
  },

  async extract(page: Page): Promise<AnimationInfo[]> {
    return page.evaluate(() => {
      const { buildSelector } = (window as any).__mcp;

      const results: AnimationInfo[] = [];
      const cursorEls = document.querySelectorAll(
        '[class*="cursor" i], [id*="cursor" i]'
      );

      for (const el of cursorEls) {
        const style = window.getComputedStyle(el);
        if (style.position !== 'fixed' && style.position !== 'absolute') continue;

        const selector = buildSelector(el);

        results.push({
          triggers: ['hover'],
          selector,
          properties: ['transform', 'opacity', 'scale'],
          triggerDetails: ['custom cursor element follows mouse'],
          confidence: 0.75,
        });
      }

      return results;
    });
  },
};
