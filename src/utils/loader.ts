import type { Page } from 'playwright';
import { debug } from './logger.js';

/**
 * Common selectors for full-screen loading overlays / splash screens.
 */
const LOADER_SELECTORS = [
  // Webflow preloaders
  '.w--redirecting-preloader-bg',
  '.preloader',

  // Generic patterns
  '[class*="preloader" i]',
  '[class*="page-loader" i]',
  '[class*="page-loading" i]',
  '[class*="site-loader" i]',
  '[class*="loading-screen" i]',
  '[class*="splash-screen" i]',
  '[class*="intro-overlay" i]',
  '[class*="loader-wrapper" i]',
  '[id*="preloader" i]',
  '[id*="page-loader" i]',
  '[id*="loader-wrapper" i]',
  '[id*="loading-screen" i]',
];

const LOADER_WAIT_MS = 5_000;
const POLL_INTERVAL_MS = 200;

interface LoaderMatch {
  selector: string;
  method: string;
}

/**
 * Detects and waits for loading overlays to disappear.
 *
 * Detection strategies (in order):
 * 1. Known selectors matching common loader class/id patterns
 * 2. Any viewport-covering element containing "loading" text
 * 3. Any fixed/absolute element covering >80% of viewport with high z-index
 * 4. Any element covering the viewport that is the first/early child of body
 */
export async function waitForLoaderDismiss(page: Page): Promise<boolean> {
  const match = await page.evaluate((selectors: string[]): LoaderMatch | null => {
    function isElementVisible(el: HTMLElement): boolean {
      const style = getComputedStyle(el);
      return style.display !== 'none'
        && style.visibility !== 'hidden'
        && parseFloat(style.opacity) > 0.1;
    }

    function coversViewport(el: HTMLElement): boolean {
      const rect = el.getBoundingClientRect();
      return rect.width >= window.innerWidth * 0.8
        && rect.height >= window.innerHeight * 0.8;
    }

    function buildSelector(el: HTMLElement): string | null {
      if (el.id) return `#${el.id}`;
      if (el.className && typeof el.className === 'string') {
        const cls = el.className.trim().split(/\s+/).filter(Boolean).slice(0, 3).join('.');
        if (cls) return `${el.tagName.toLowerCase()}.${cls}`;
      }
      // Webflow IX2 elements use data-w-id
      const wid = el.getAttribute('data-w-id');
      if (wid) return `[data-w-id="${wid}"]`;
      // Fallback: nth-child selector from body
      const parent = el.parentElement;
      if (parent) {
        const idx = Array.from(parent.children).indexOf(el);
        const parentSel = parent === document.body ? 'body' : null;
        if (parentSel !== null) return `body > ${el.tagName.toLowerCase()}:nth-child(${idx + 1})`;
      }
      return null;
    }

    // Strategy 1: Known selectors
    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel);
        if (el instanceof HTMLElement && coversViewport(el) && isElementVisible(el)) {
          return { selector: sel, method: 'known-selector' };
        }
      } catch { /* invalid selector — skip */ }
    }

    // Strategy 2: Find smallest viewport-covering element with "loading" text
    // (smallest = least children, most specific to the loader itself)
    const allDivs = document.querySelectorAll('div, section');
    let bestLoaderMatch: { el: HTMLElement; childCount: number } | null = null;
    for (const el of allDivs) {
      if (!(el instanceof HTMLElement)) continue;
      if (!coversViewport(el) || !isElementVisible(el)) continue;

      const text = el.textContent?.toLowerCase() ?? '';
      if (text.includes('loading') || text.includes('please wait')) {
        const childCount = el.querySelectorAll('*').length;
        if (!bestLoaderMatch || childCount < bestLoaderMatch.childCount) {
          bestLoaderMatch = { el, childCount };
        }
      }
    }
    if (bestLoaderMatch) {
      const sel = buildSelector(bestLoaderMatch.el);
      if (sel) return { selector: sel, method: 'loading-text' };
    }

    // Strategy 3: Fixed/absolute positioned overlay with high z-index
    for (const el of allDivs) {
      if (!(el instanceof HTMLElement)) continue;
      const style = getComputedStyle(el);
      if (style.position !== 'fixed' && style.position !== 'absolute') continue;
      if (!coversViewport(el) || !isElementVisible(el)) continue;

      const z = parseInt(style.zIndex, 10);
      if (z >= 10 || (style.zIndex === 'auto' && style.position === 'fixed')) {
        const sel = buildSelector(el);
        if (sel) return { selector: sel, method: 'fixed-overlay' };
      }
    }

    // Strategy 4: Early body child covering viewport (common for splash screens)
    const bodyChildren = document.body.children;
    for (let i = 0; i < Math.min(bodyChildren.length, 5); i++) {
      const el = bodyChildren[i];
      if (!(el instanceof HTMLElement)) continue;
      if (!coversViewport(el) || !isElementVisible(el)) continue;

      // Check if this element obscures later siblings (likely an overlay)
      const style = getComputedStyle(el);
      const hasBackground = style.backgroundColor !== 'rgba(0, 0, 0, 0)'
        && style.backgroundColor !== 'transparent';

      if (hasBackground) {
        const text = el.textContent?.toLowerCase() ?? '';
        const looksLikeLoader = text.includes('loading') || text.includes('please wait')
          || el.querySelector('[class*="spinner" i], [class*="loader" i], [class*="dots" i]');

        if (looksLikeLoader) {
          const sel = buildSelector(el);
          if (sel) return { selector: sel, method: 'body-child-loader' };
        }
      }
    }

    return null;
  }, LOADER_SELECTORS);

  if (!match) return false;

  debug('loader', `Detected loader [${match.method}]: ${match.selector}, waiting for dismiss...`);

  const start = Date.now();
  while (Date.now() - start < LOADER_WAIT_MS) {
    const isGone = await page.evaluate((sel: string) => {
      const el = document.querySelector(sel);
      if (!el || !(el instanceof HTMLElement)) return true;
      const style = getComputedStyle(el);
      return style.display === 'none'
        || style.visibility === 'hidden'
        || parseFloat(style.opacity) <= 0.1
        || el.offsetParent === null;
    }, match.selector);

    if (isGone) {
      debug('loader', `Loader dismissed after ${Date.now() - start}ms`);
      await page.waitForTimeout(500);
      return true;
    }

    await page.waitForTimeout(POLL_INTERVAL_MS);
  }

  debug('loader', `Loader still visible after ${LOADER_WAIT_MS}ms, force-removing from DOM`);
  await page.evaluate((sel: string) => {
    // Remove from DOM entirely — CSS can be overridden by JS, but removal can't
    const el = document.querySelector(sel);
    if (el) el.remove();
  }, match.selector);
  await page.waitForTimeout(500);
  return true;
}
