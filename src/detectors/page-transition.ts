import type { Page } from 'playwright';
import type { AnimationDetector } from './types.js';
import type { AnimationInfo } from '../types/index.js';

export const pageTransitionDetector: AnimationDetector = {
  name: 'page-transition',

  async detect(page: Page): Promise<boolean> {
    return page.evaluate(() => {
      return (
        'startViewTransition' in document ||
        'barba' in window ||
        'swup' in window ||
        !!document.querySelector('[data-barba]') ||
        !!document.querySelector('[data-swup]')
      );
    });
  },

  async extract(page: Page): Promise<AnimationInfo[]> {
    return page.evaluate(() => {
      const results: AnimationInfo[] = [];

      if ('startViewTransition' in document) {
        results.push({
          triggers: ['click'],
          selector: 'document',
          properties: ['view-transition'],
          triggerDetails: ['View Transitions API detected'],
          confidence: 0.9,
        });
      }

      if ('barba' in window || document.querySelector('[data-barba]')) {
        results.push({
          triggers: ['click'],
          selector: '[data-barba="container"]',
          properties: ['opacity', 'transform'],
          triggerDetails: ['Barba.js page transition'],
          confidence: 0.9,
        });
      }

      if ('swup' in window || document.querySelector('[data-swup]')) {
        results.push({
          triggers: ['click'],
          selector: '[data-swup]',
          properties: ['opacity', 'transform'],
          triggerDetails: ['Swup page transition'],
          confidence: 0.9,
        });
      }

      return results;
    });
  },
};
