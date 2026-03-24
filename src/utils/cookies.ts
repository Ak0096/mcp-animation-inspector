import type { Page } from 'playwright';

const ACCEPT_SELECTORS = [
  '#onetrust-accept-btn-handler',
  '.onetrust-close-btn-handler',
  '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
  '#CybotCookiebotDialogBodyButtonAccept',
  // Quantcast
  '.qc-cmp2-summary-buttons button[mode="primary"]',
  '#qc-cmp2-ui button.css-47sehv',
  'button[id*="accept" i]',
  'button[class*="accept" i]',
  'button[data-consent="accept"]',
  '[aria-label*="Accept" i]',
  '[aria-label*="Agree" i]',
  'button:has-text("Accept all")',
  'button:has-text("Accept All")',
  'button:has-text("Accept cookies")',
  'button:has-text("Agree")',
  'button:has-text("I Accept")',
  'button:has-text("OK")',
];

const BANNER_HIDE_CSS = `
  [id*="cookie" i], [class*="cookie-banner" i],
  [id*="consent" i], [class*="consent" i],
  [id*="gdpr" i], [class*="gdpr" i],
  .cc-window, .cc-banner,
  #cookielaw-info-bar, .cookie-notice, #cookie-notice {
    display: none !important;
    visibility: hidden !important;
    pointer-events: none !important;
  }
`;

export async function dismissCookieBanners(page: Page): Promise<void> {
  for (const selector of ACCEPT_SELECTORS) {
    try {
      const btn = page.locator(selector).first();
      if (await btn.isVisible({ timeout: 300 })) {
        const urlBefore = page.url();
        await btn.click();
        await page.waitForTimeout(300);
        if (page.url() !== urlBefore) {
          await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => {});
        }
        return;
      }
    } catch {
      // Not found — try next
    }
  }

  // Fallback: hide banners via CSS
  await page.addStyleTag({ content: BANNER_HIDE_CSS });
}
