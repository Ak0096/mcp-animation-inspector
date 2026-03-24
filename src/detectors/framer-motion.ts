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
      const results: AnimationInfo[] = [];
      const elements = document.querySelectorAll(
        '[data-framer-component-type], [data-motion], [style*="transform"]'
      );

      for (const el of elements) {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;

        const id = el.id ? `#${el.id}` : '';
        const cls = el.classList?.length
          ? `.${Array.from(el.classList).slice(0, 2).join('.')}`
          : '';
        const selector = `${el.tagName.toLowerCase()}${id}${cls}`;
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
