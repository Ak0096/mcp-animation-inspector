import type { Page } from 'playwright';
import type { Config } from '../config.js';
import type { AnimationInventory, InspectionError } from '../types/index.js';
import { getDetectors } from '../detectors/index.js';
import { debug } from '../utils/logger.js';

const DETECTOR_TIMEOUT_MS = 5_000;

export interface DiscoverResult {
  inventory: AnimationInventory[];
  detectorsRun: string[];
  errors: InspectionError[];
}

function deduplicateInventory(items: AnimationInventory[]): AnimationInventory[] {
  const bySelector = new Map<string, AnimationInventory>();
  for (const item of items) {
    const existing = bySelector.get(item.selector);
    if (existing) {
      bySelector.set(item.selector, {
        ...existing,
        detector: `${existing.detector}+${item.detector}`,
        triggers: [...new Set([...existing.triggers, ...item.triggers])],
        properties: [...new Set([...existing.properties, ...item.properties])],
        triggerDetails: [...existing.triggerDetails, ...item.triggerDetails],
        confidence: Math.max(existing.confidence, item.confidence),
      });
    } else {
      bySelector.set(item.selector, { ...item });
    }
  }
  return Array.from(bySelector.values());
}

export async function discoverAnimations(
  page: Page,
  config: Config,
): Promise<AnimationInventory[]> {
  const result = await discoverWithMeta(page, config);
  return result.inventory;
}

export async function discoverWithMeta(
  page: Page,
  config: Config,
): Promise<DiscoverResult> {
  const filter =
    config.enabledDetectors === 'all' ? undefined : config.enabledDetectors;
  const detectors = getDetectors(filter);

  const inventory: AnimationInventory[] = [];
  const detectorsRun: string[] = [];
  const errors: InspectionError[] = [];

  const detectorResults = await Promise.allSettled(
    detectors.map(async (detector) => {
      detectorsRun.push(detector.name);

      const detected = await Promise.race([
        detector.detect(page),
        new Promise<boolean>((_, reject) =>
          setTimeout(() => reject(new Error('Detector timeout')), DETECTOR_TIMEOUT_MS)
        ),
      ]);
      debug('discover', detector.name + ': detected=' + String(detected));

      if (!detected) return [];

      const animations = await Promise.race([
        detector.extract(page),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Extract timeout')), DETECTOR_TIMEOUT_MS)
        ),
      ]);

      return animations.map(anim => ({
        detector: detector.name,
        ...anim,
      }));
    })
  );

  for (let i = 0; i < detectorResults.length; i++) {
    const result = detectorResults[i]!;
    if (result.status === 'fulfilled') {
      inventory.push(...result.value);
    } else {
      errors.push({
        stage: 'discover',
        detector: detectors[i]!.name,
        error: result.reason instanceof Error ? result.reason.message : String(result.reason),
      });
    }
  }

  const deduped = deduplicateInventory(inventory);
  return { inventory: deduped, detectorsRun, errors };
}
