import type { Config } from '../config.js';
import type { BrowserManager } from '../browser.js';
import type { FrameSet, AnimationCode } from '../types/index.js';
import { inspectAnimation } from './inspect-animation.js';
import { describeAnimations } from '../pipeline/describe.js';

export async function describeAnimationsTool(
  input: { url: string } | { frames: FrameSet[]; code: AnimationCode[] },
  browserManager: BrowserManager,
  config: Config,
): Promise<string[]> {
  if (!config.anthropicApiKey) {
    throw new Error('ANTHROPIC_API_KEY is required for describe_animations');
  }

  const describeConfig = { ...config, autoDescribe: true };

  if ('url' in input) {
    const report = await inspectAnimation(input.url, browserManager, describeConfig);
    return report.descriptions ?? ['No descriptions generated.'];
  }

  const result = await describeAnimations(input.frames, input.code, describeConfig);
  return result ?? ['No descriptions generated.'];
}
