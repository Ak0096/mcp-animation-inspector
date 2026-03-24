import type { Page } from 'playwright';
import type { AnimationDetector } from './types.js';
import type { AnimationInfo } from '../types/index.js';

export const lottieDetector: AnimationDetector = {
  name: 'lottie',

  async detect(page: Page): Promise<boolean> {
    return page.evaluate(() => {
      return (
        'lottie' in window ||
        'bodymovin' in window ||
        !!document.querySelector('lottie-player, dotlottie-player')
      );
    });
  },

  async extract(page: Page): Promise<AnimationInfo[]> {
    return page.evaluate(() => {
      const results: AnimationInfo[] = [];
      const players = document.querySelectorAll('lottie-player, dotlottie-player');

      for (const el of players) {
        const id = el.id ? `#${el.id}` : '';
        const selector = `${el.tagName.toLowerCase()}${id}`;

        results.push({
          triggers: ['load', 'loop'],
          selector,
          properties: ['lottie-animation'],
          triggerDetails: ['lottie-player element'],
          confidence: 0.95,
        });
      }

      return results;
    });
  },
};
