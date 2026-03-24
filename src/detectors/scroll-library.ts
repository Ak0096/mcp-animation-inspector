import type { Page } from 'playwright';
import type { AnimationDetector } from './types.js';
import type { AnimationInfo } from '../types/index.js';

export const scrollLibraryDetector: AnimationDetector = {
  name: 'scroll-library',

  async detect(page: Page): Promise<boolean> {
    return page.evaluate(() => {
      return (
        '__lenis' in window ||
        'lenis' in window ||
        !!document.querySelector('[data-lenis-prevent]') ||
        !!document.querySelector('[data-scroll-container]') ||
        !!document.querySelector('[data-scroll]')
      );
    });
  },

  async extract(page: Page): Promise<AnimationInfo[]> {
    return page.evaluate(() => {
      const results: AnimationInfo[] = [];
      const win = (window as unknown) as Record<string, unknown>;

      if ('__lenis' in win || 'lenis' in win) {
        results.push({
          triggers: ['scroll'],
          selector: 'html',
          properties: ['smooth-scroll'],
          triggerDetails: ['Lenis smooth scroll active'],
          confidence: 0.9,
        });
      }

      const scrollElements = document.querySelectorAll('[data-scroll]');
      for (const el of scrollElements) {
        const id = el.id ? `#${el.id}` : '';
        const cls = el.classList?.length
          ? `.${Array.from(el.classList).slice(0, 2).join('.')}`
          : '';
        const selector = `${el.tagName.toLowerCase()}${id}${cls}`;
        const speed = el.getAttribute('data-scroll-speed');

        results.push({
          triggers: ['scroll', 'viewport'],
          selector,
          properties: ['transform'],
          triggerDetails: [
            'Locomotive/data-scroll element',
            speed ? `speed: ${speed}` : 'viewport-enter',
          ],
          confidence: 0.85,
        });
      }

      return results;
    });
  },
};
