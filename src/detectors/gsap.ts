import type { Page } from 'playwright';
import type { AnimationDetector } from './types.js';
import type { AnimationInfo } from '../types/index.js';

export const gsapDetector: AnimationDetector = {
  name: 'gsap',

  async detect(page: Page): Promise<boolean> {
    return page.evaluate(() => 'gsap' in window);
  },

  async extract(page: Page): Promise<AnimationInfo[]> {
    return page.evaluate(() => {
      const win = (window as unknown) as Record<string, unknown>;
      if (!win.gsap) return [];
      const gsap = win.gsap as {
        version: string;
        globalTimeline: {
          getChildren: (nested: boolean, tweens: boolean, timelines: boolean) => Array<{
            targets: () => Element[];
            duration: () => number;
            delay: () => number;
            vars?: Record<string, unknown>;
          }>;
        };
      };

      const { buildSelector } = (window as any).__mcp;

      const tweens = gsap.globalTimeline.getChildren(true, true, false);
      const results: AnimationInfo[] = [];

      for (const tween of tweens) {
        const targets = tween.targets();
        for (const target of targets) {
          if (!(target instanceof Element)) continue;

          const selector = buildSelector(target);

          const properties = tween.vars
            ? Object.keys(tween.vars).filter(
                (k) => !['duration', 'delay', 'ease', 'onComplete', 'onStart', 'stagger'].includes(k)
              )
            : [];

          results.push({
            triggers: ['load'],
            selector,
            properties,
            triggerDetails: [`gsap tween, duration: ${tween.duration()}s`],
            confidence: 0.95,
          });
        }
      }

      // ScrollTrigger detection
      const ST = win.ScrollTrigger as
        | { getAll: () => Array<{ trigger?: Element; start: number; end: number }> }
        | undefined;
      if (ST) {
        for (const st of ST.getAll()) {
          if (!st.trigger) continue;
          const el = st.trigger;
          const selector = buildSelector(el);

          // Check if this selector already added via tween detection
          const existingIdx = results.findIndex((r) => r.selector === selector);
          if (existingIdx !== -1) {
            const existing = results[existingIdx]!;
            if (!existing.triggers.includes('scroll')) {
              results[existingIdx] = {
                ...existing,
                triggers: [...existing.triggers, 'scroll'],
                triggerDetails: [...existing.triggerDetails, `ScrollTrigger: ${st.start}-${st.end}`],
              };
            }
            continue;
          }

          results.push({
            triggers: ['scroll', 'viewport'],
            selector,
            properties: ['transform', 'opacity'],
            triggerDetails: [
              `ScrollTrigger: ${st.start}-${st.end}`,
              'viewport-enter',
            ],
            confidence: 0.9,
          });
        }
      }

      return results;
    });
  },

  async extractCode(page: Page, selector: string) {
    return page.evaluate((sel: string) => {
      const win = (window as unknown) as Record<string, unknown>;
      if (!win.gsap) return undefined;
      const gsap = win.gsap as {
        globalTimeline: {
          getChildren: (
            nested: boolean,
            tweens: boolean,
            timelines: boolean,
          ) => Array<{
            targets: () => Element[];
            duration: () => number;
            delay: () => number;
            vars?: Record<string, unknown>;
          }>;
        };
      };

      const el = document.querySelector(sel);
      if (!el) return undefined;

      const tweens = gsap.globalTimeline.getChildren(true, true, false);
      for (const tween of tweens) {
        const targets = tween.targets();
        if (targets.includes(el)) {
          const vars = { ...tween.vars };
          for (const key of Object.keys(vars)) {
            if (typeof vars[key] === 'function') delete vars[key];
          }
          return {
            library: 'gsap' as const,
            config: vars,
            rawSnippet: `gsap.to(${JSON.stringify(sel)}, ${JSON.stringify(vars)})`,
          };
        }
      }

      return undefined;
    }, selector);
  },
};
