import type { Page } from 'playwright';
import type { AnimationDetector } from './types.js';
import type { AnimationInfo } from '../types/index.js';

export const pageTransitionDetector: AnimationDetector = {
  name: 'page-transition',

  async detect(page: Page): Promise<boolean> {
    return page.evaluate(() => {
      const hasBarba =
        'barba' in window || !!document.querySelector('[data-barba]');
      const hasSwup =
        'swup' in window || !!document.querySelector('[data-swup]');

      // Only detect View Transitions API if the page explicitly opts in via CSS
      // or calls startViewTransition — not just because the browser supports it.
      const hasViewTransitionCss = Array.from(document.styleSheets).some(
        (sheet) => {
          try {
            return Array.from(sheet.cssRules).some(
              (rule) =>
                rule.cssText.includes('@view-transition') ||
                rule.cssText.includes('view-transition-name'),
            );
          } catch {
            return false;
          }
        },
      );

      return hasBarba || hasSwup || hasViewTransitionCss;
    });
  },

  async extract(page: Page): Promise<AnimationInfo[]> {
    return page.evaluate(() => {
      const results: AnimationInfo[] = [];

      const hasViewTransitionCss = Array.from(document.styleSheets).some(
        (sheet) => {
          try {
            return Array.from(sheet.cssRules).some(
              (rule) =>
                rule.cssText.includes('@view-transition') ||
                rule.cssText.includes('view-transition-name'),
            );
          } catch {
            return false;
          }
        },
      );

      if (hasViewTransitionCss) {
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
