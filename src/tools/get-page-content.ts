import type { Config } from '../config.js';
import type { BrowserManager } from '../browser.js';
import { navigateTo } from '../pipeline/navigate.js';
import { withPage } from '../utils/with-page.js';

export interface PageContent {
  url: string;
  title: string;
  format: 'html' | 'text' | 'both';
  html?: string;
  text?: string;
  meta: {
    description?: string;
    charset?: string;
    language?: string;
    contentLength: number;
    truncated: boolean;
  };
}

export async function getPageContentTool(
  url: string,
  browserManager: BrowserManager,
  config: Config,
  options: { format: 'html' | 'text' | 'both'; selector?: string; maxLength: number },
): Promise<PageContent> {
  return withPage(browserManager, config, 'page-content', async (page) => {
    await navigateTo(page, url, config);

    const raw = await page.evaluate(
      ({ selector, wantHtml, wantText }) => {
        const target = selector
          ? document.querySelector(selector)
          : document.documentElement;

        if (!target) {
          return { title: document.title, html: null, text: null, meta: {} };
        }

        const metaDesc = document.querySelector('meta[name="description"]')?.getAttribute('content') ?? undefined;
        const charset = document.characterSet ?? undefined;
        const language = document.documentElement.lang || undefined;

        return {
          title: document.title,
          html: wantHtml ? target.outerHTML : null,
          text: wantText ? target.innerText : null,
          meta: { description: metaDesc, charset, language },
        };
      },
      {
        selector: options.selector,
        wantHtml: options.format === 'html' || options.format === 'both',
        wantText: options.format === 'text' || options.format === 'both',
      },
    );

    if (!raw.html && !raw.text && options.selector) {
      throw new Error(`Selector "${options.selector}" matched no elements on ${url}`);
    }

    const truncate = (s: string | null): { value: string | undefined; truncated: boolean } => {
      if (!s) return { value: undefined, truncated: false };
      if (s.length <= options.maxLength) return { value: s, truncated: false };
      return { value: s.slice(0, options.maxLength), truncated: true };
    };

    const htmlResult = truncate(raw.html);
    const textResult = truncate(raw.text);
    const truncated = htmlResult.truncated || textResult.truncated;

    const contentLength = (raw.html?.length ?? 0) + (raw.text?.length ?? 0);

    return {
      url,
      title: raw.title,
      format: options.format,
      html: htmlResult.value,
      text: textResult.value,
      meta: {
        ...raw.meta,
        contentLength,
        truncated,
      },
    };
  });
}
