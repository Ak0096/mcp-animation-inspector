import type { Page } from 'playwright';
import type { AnimationDetector } from './types.js';
import type { AnimationInfo } from '../types/index.js';

export const framerMotionDetector: AnimationDetector = {
  name: 'framer-motion',

  async detect(page: Page): Promise<boolean> {
    return page.evaluate(() => {
      return (
        !!document.querySelector('[data-framer-component-type]') ||
        !!document.querySelector('[data-motion]') ||
        '__framer_importFromPackage' in window
      );
    });
  },

  async extract(page: Page): Promise<AnimationInfo[]> {
    return page.evaluate(() => {
      const { buildSelector } = (window as any).__mcp;

      const results: AnimationInfo[] = [];
      const elements = document.querySelectorAll(
        '[data-framer-component-type], [data-motion], [data-framer-name]'
      );

      for (const el of elements) {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;

        const selector = buildSelector(el);
        const isMotion = el.hasAttribute('data-motion');

        results.push({
          triggers: isMotion ? ['load', 'viewport'] : ['load'],
          selector,
          properties: ['transform', 'opacity'],
          triggerDetails: isMotion
            ? ['framer-motion component', 'viewport-enter']
            : ['framer component'],
          confidence: el.hasAttribute('data-framer-component-type') ? 0.9 : 0.6,
        });
      }

      return results;
    });
  },
};
