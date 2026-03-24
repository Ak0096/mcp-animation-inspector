import type { Page } from 'playwright';
import type { AnimationInfo } from '../types/index.js';

export interface AnimationDetector {
  name: string;
  detect(page: Page): Promise<boolean>;
  extract(page: Page): Promise<AnimationInfo[]>;
  extractCode?(page: Page, selector: string): Promise<{ library: string; config: Record<string, unknown>; rawSnippet?: string } | undefined>;
}
