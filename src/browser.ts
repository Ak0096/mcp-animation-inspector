import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import type { Config } from './config.js';
import { applyStealthScripts } from './utils/stealth.js';
import { BROWSER_HELPERS_INIT_SCRIPT } from './utils/browser-fns.js';

const MAX_CONCURRENT_PAGES = 3;
const MAX_QUEUE_DEPTH = 10;
const QUEUE_TIMEOUT_MS = 15_000;
const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

interface QueuedRequest {
  resolve: (page: Page) => void;
  reject: (error: Error) => void;
}

export class ServerBusyError extends Error {
  readonly retryAfterMs: number;
  constructor(message: string, retryAfterMs = 5000) {
    super(message);
    this.name = 'ServerBusyError';
    this.retryAfterMs = retryAfterMs;
  }
}

export class BrowserManager {
  private browser: Browser | null = null;
  private activePages = new Map<Page, BrowserContext>();
  private queue: QueuedRequest[] = [];
  private config: Config;
  private queueTimeoutMs: number;
  private reserved = 0;
  private launchPromise: Promise<Browser> | null = null;

  constructor(config: Config, queueTimeoutMs = QUEUE_TIMEOUT_MS) {
    this.config = config;
    this.queueTimeoutMs = queueTimeoutMs;
  }

  private async ensureBrowser(): Promise<Browser> {
    if (this.browser?.isConnected()) {
      return this.browser;
    }

    if (this.launchPromise) {
      return this.launchPromise;
    }

    this.launchPromise = (async () => {
      this.browser = null;
      this.activePages.clear();

      this.browser = await chromium.launch({
        headless: this.config.headless,
        executablePath: process.env.BROWSER_PATH || undefined,
      });

      this.browser.on('disconnected', () => {
        this.browser = null;
        this.activePages.clear();
        const pending = [...this.queue];
        this.queue = [];
        for (const q of pending) {
          q.reject(new Error('Browser disconnected — retry request'));
        }
      });

      return this.browser;
    })();

    try {
      return await this.launchPromise;
    } finally {
      this.launchPromise = null;
    }
  }

  private async createContextAndPage(browser: Browser): Promise<{ page: Page; context: BrowserContext }> {
    const context = await browser.newContext({
      viewport: this.config.viewport,
      userAgent: this.config.userAgent ?? DEFAULT_USER_AGENT,
      reducedMotion: this.config.prefersReducedMotion ? 'reduce' : 'no-preference',
    });
    await applyStealthScripts(context);
    await context.addInitScript(BROWSER_HELPERS_INIT_SCRIPT);
    const page = await context.newPage();
    return { page, context };
  }

  async acquirePage(): Promise<Page> {
    if ((this.activePages.size + this.reserved) < MAX_CONCURRENT_PAGES) {
      this.reserved++;
      try {
        const browser = await this.ensureBrowser();
        const { page, context } = await this.createContextAndPage(browser);
        this.activePages.set(page, context);
        return page;
      } finally {
        this.reserved--;
      }
    }

    if (this.queue.length >= MAX_QUEUE_DEPTH) {
      throw new ServerBusyError('Server busy: page pool and queue are full');
    }

    return new Promise<Page>((resolve, reject) => {
      const entry: QueuedRequest = { resolve, reject };
      this.queue.push(entry);

      const timer = setTimeout(() => {
        const idx = this.queue.indexOf(entry);
        if (idx !== -1) {
          this.queue.splice(idx, 1);
          reject(new ServerBusyError('Server busy: queue timeout exceeded'));
        }
      }, this.queueTimeoutMs);

      const originalResolve = entry.resolve;
      entry.resolve = (page: Page) => {
        clearTimeout(timer);
        originalResolve(page);
      };

      const originalReject = entry.reject;
      entry.reject = (error: Error) => {
        clearTimeout(timer);
        originalReject(error);
      };
    });
  }

  async releasePage(page: Page): Promise<void> {
    const context = this.activePages.get(page);
    this.activePages.delete(page);

    // Close the entire context for full isolation
    if (context) {
      await context.close().catch(() => {});
    } else if (!page.isClosed()) {
      await page.close().catch(() => {});
    }

    // Serve queued request
    if (this.queue.length > 0) {
      const next = this.queue.shift()!;
      this.reserved++;
      try {
        const browser = await this.ensureBrowser();
        const { page: newPage, context: newContext } = await this.createContextAndPage(browser);
        this.activePages.set(newPage, newContext);
        next.resolve(newPage);
      } catch (err) {
        next.reject(err instanceof Error ? err : new Error(String(err)));
      } finally {
        this.reserved--;
      }
    }
  }

  async shutdown(): Promise<void> {
    for (const [, context] of this.activePages) {
      await context.close().catch(() => {});
    }
    this.activePages.clear();
    this.queue.forEach((q) => q.reject(new Error('Server shutting down')));
    this.queue = [];
    await this.browser?.close().catch(() => {});
    this.browser = null;
  }
}
