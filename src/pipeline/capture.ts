import type { Page } from 'playwright';
import type { Config } from '../config.js';
import type { AnimationInventory, Frame, FrameSet } from '../types/index.js';

interface CaptureResult {
  scrollFrames: Frame[];
  animationFrames: FrameSet[];
}

export async function captureFrames(
  page: Page,
  inventory: AnimationInventory[],
  config: Config,
): Promise<CaptureResult> {
  const viewport = page.viewportSize() ?? config.viewport;
  const scrollFrames = await captureScrollPositions(page, config, viewport);
  const animationFrames = await captureAnimationStates(page, inventory, config, viewport);

  // 2MB payload guard — reduce quality or drop frames if too large
  const allFrames = [...scrollFrames, ...animationFrames.flatMap((fs) => fs.frames)];
  const totalBytes = allFrames.reduce((sum, f) => sum + f.image.length, 0);
  const MAX_PAYLOAD = 2 * 1024 * 1024; // 2MB in base64 chars (~1.5MB actual)

  if (totalBytes > MAX_PAYLOAD) {
    // Drop lowest-confidence animation frames first
    const sortedSets = [...animationFrames].sort(
      (a, b) => a.animation.confidence - b.animation.confidence,
    );
    while (
      sortedSets.length > 0 &&
      [...scrollFrames, ...sortedSets.flatMap((fs) => fs.frames)]
        .reduce((s, f) => s + f.image.length, 0) > MAX_PAYLOAD
    ) {
      sortedSets.shift(); // drop lowest confidence
    }
    return { scrollFrames, animationFrames: sortedSets };
  }

  return { scrollFrames, animationFrames };
}

async function captureScrollPositions(
  page: Page,
  config: Config,
  viewport: { width: number; height: number },
): Promise<Frame[]> {
  const frames: Frame[] = [];

  for (const pct of config.scrollPositions) {
    await page.evaluate((percent) => {
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      const target = (maxScroll * percent) / 100;
      window.scrollTo({ top: target, behavior: 'instant' as ScrollBehavior });
      return target;
    }, pct);

    await page.waitForTimeout(150);

    const buffer = await page.screenshot({
      type: config.imageFormat === 'png' ? 'png' : 'jpeg',
      quality: config.imageFormat === 'jpeg' ? config.imageQuality : undefined,
    });

    frames.push({
      image: buffer.toString('base64'),
      label: `scroll-${pct}%`,
      viewport,
    });
  }

  return frames;
}

async function captureAnimationStates(
  page: Page,
  inventory: AnimationInventory[],
  config: Config,
  viewport: { width: number; height: number },
): Promise<FrameSet[]> {
  const frameSets: FrameSet[] = [];
  let totalFrames = 0;

  // Sort by confidence descending — high-confidence animations get frames first
  const sorted = [...inventory].sort((a, b) => b.confidence - a.confidence);

  for (const anim of sorted) {
    if (totalFrames >= config.maxTotalFrames) break;

    const frames: Frame[] = [];

    // Hover states
    if (config.captureHoverStates && anim.triggers.includes('hover')) {
      const hoverFrames = await captureHoverState(page, anim, config, viewport);
      frames.push(...hoverFrames);
    }

    // Element crop at current state
    if (config.elementCrop && frames.length === 0) {
      const cropFrame = await captureElementCrop(page, anim, config, viewport);
      if (cropFrame) frames.push(cropFrame);
    }

    const trimmed = frames.slice(0, Math.min(frames.length, config.maxFramesPerAnimation));

    if (trimmed.length > 0) {
      frameSets.push({ animation: anim, frames: trimmed });
      totalFrames += trimmed.length;
    }
  }

  return frameSets;
}

async function captureHoverState(
  page: Page,
  anim: AnimationInventory,
  config: Config,
  viewport: { width: number; height: number },
): Promise<Frame[]> {
  const frames: Frame[] = [];

  try {
    const locator = page.locator(anim.selector).first();
    if (!(await locator.isVisible({ timeout: 1000 }))) return frames;

    // Before hover
    const beforeBuffer = config.elementCrop
      ? await locator.screenshot({
          type: config.imageFormat === 'png' ? 'png' : 'jpeg',
          quality: config.imageFormat === 'jpeg' ? config.imageQuality : undefined,
        })
      : await page.screenshot({
          type: config.imageFormat === 'png' ? 'png' : 'jpeg',
          quality: config.imageFormat === 'jpeg' ? config.imageQuality : undefined,
        });

    frames.push({
      image: beforeBuffer.toString('base64'),
      label: `${anim.selector}-hover-before`,
      viewport,
    });

    // Hover
    await locator.hover();
    await page.waitForTimeout(400);

    const afterBuffer = config.elementCrop
      ? await locator.screenshot({
          type: config.imageFormat === 'png' ? 'png' : 'jpeg',
          quality: config.imageFormat === 'jpeg' ? config.imageQuality : undefined,
        })
      : await page.screenshot({
          type: config.imageFormat === 'png' ? 'png' : 'jpeg',
          quality: config.imageFormat === 'jpeg' ? config.imageQuality : undefined,
        });

    frames.push({
      image: afterBuffer.toString('base64'),
      label: `${anim.selector}-hover-after`,
      viewport,
    });

    // Reset mouse
    await page.mouse.move(0, 0);
  } catch {
    // Element not interactable — skip
  }

  return frames;
}

async function captureElementCrop(
  page: Page,
  anim: AnimationInventory,
  config: Config,
  viewport: { width: number; height: number },
): Promise<Frame | null> {
  try {
    const locator = page.locator(anim.selector).first();
    if (!(await locator.isVisible({ timeout: 1000 }))) return null;

    const buffer = await locator.screenshot({
      type: config.imageFormat === 'png' ? 'png' : 'jpeg',
      quality: config.imageFormat === 'jpeg' ? config.imageQuality : undefined,
    });

    return {
      image: buffer.toString('base64'),
      label: `${anim.selector}-current`,
      viewport,
    };
  } catch {
    return null;
  }
}
