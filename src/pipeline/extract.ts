import type { Page } from 'playwright';
import type { AnimationInventory, AnimationCode, InspectionError } from '../types/index.js';
import { debug } from '../utils/logger.js';
import { getDetectorByName } from '../detectors/index.js';

export interface ExtractResult {
  code: AnimationCode[];
  errors: InspectionError[];
}

export async function extractAnimationCode(
  page: Page,
  inventory: AnimationInventory[],
): Promise<ExtractResult> {
  const results: AnimationCode[] = [];
  const errors: InspectionError[] = [];

  for (const anim of inventory) {
    try {
      const code = await extractForAnimation(page, anim);
      if (code) results.push(code);
    } catch (err) {
      debug('extract', 'Failed extraction for ' + anim.selector + ': ' + (err instanceof Error ? err.message : String(err)));
      errors.push({
        stage: 'extract',
        selector: anim.selector,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { code: results, errors };
}

async function extractForAnimation(
  page: Page,
  anim: AnimationInventory,
): Promise<AnimationCode | null> {
  const extracted = await page.evaluate((selector: string) => {
    const el = document.querySelector(selector);
    if (!el) return null;

    const { parseDurationMs } = (window as any).__mcp;
    const style = window.getComputedStyle(el);

    // CSS data
    const css: {
      keyframes?: string;
      transitions?: string;
      computedStyles?: Record<string, string>;
    } = {};

    if (style.animationName !== 'none') {
      css.computedStyles = {
        animationName: style.animationName,
        animationDuration: style.animationDuration,
        animationTimingFunction: style.animationTimingFunction,
        animationDelay: style.animationDelay,
        animationIterationCount: style.animationIterationCount,
        animationDirection: style.animationDirection,
        animationFillMode: style.animationFillMode,
      };

      // Try to find @keyframes definition
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules ?? [])) {
            if (
              rule instanceof CSSKeyframesRule &&
              rule.name === style.animationName
            ) {
              css.keyframes = rule.cssText;
            }
          }
        } catch {
          // Cross-origin stylesheet
        }
      }
    }

    if (
      style.transitionProperty !== 'none' &&
      style.transitionDuration !== '0s'
    ) {
      css.transitions = style.transition;
    }

    // Timing data
    const durationStr = style.animationDuration || style.transitionDuration;
    const durationMs = parseDurationMs(durationStr);
    const delayStr = style.animationDelay || style.transitionDelay;
    const delayMs = parseDurationMs(delayStr);
    const easing =
      style.animationTimingFunction || style.transitionTimingFunction;
    const iterCount = style.animationIterationCount;

    return {
      css,
      timing: {
        duration: isNaN(durationMs) ? undefined : durationMs,
        delay: isNaN(delayMs) || delayMs === 0 ? undefined : delayMs,
        easing: easing || undefined,
        repeat:
          iterCount === 'infinite'
            ? 'infinite'
            : iterCount
              ? parseInt(iterCount, 10)
              : undefined,
      },
    };
  }, anim.selector);

  if (!extracted) return null;

  // Detector-based JS extraction
  let js: AnimationCode['js'] | undefined;
  const detector = getDetectorByName(anim.detector);
  if (detector?.extractCode) {
    js = await detector.extractCode(page, anim.selector);
  }

  return {
    animation: anim,
    css:
      Object.keys(extracted.css).length > 0 ? extracted.css : undefined,
    js,
    timing: {
      duration: extracted.timing.duration,
      delay: extracted.timing.delay,
      easing: extracted.timing.easing,
      repeat: extracted.timing.repeat as number | 'infinite' | undefined,
    },
  };
}
