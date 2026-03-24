import type { Page } from 'playwright';
import type { Config } from '../config.js';
import type { AnimationInventory, InspectionError } from '../types/index.js';
import { getDetectors } from '../detectors/index.js';

const DETECTOR_TIMEOUT_MS = 5_000;

export interface DiscoverResult {
  inventory: AnimationInventory[];
  detectorsRun: string[];
  errors: InspectionError[];
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

  for (const detector of detectors) {
    detectorsRun.push(detector.name);

    try {
      const detected = await Promise.race([
        detector.detect(page),
        new Promise<boolean>((_, reject) =>
          setTimeout(() => reject(new Error('Detector timeout')), DETECTOR_TIMEOUT_MS)
        ),
      ]);

      if (!detected) continue;

      const animations = await Promise.race([
        detector.extract(page),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Extract timeout')), DETECTOR_TIMEOUT_MS)
        ),
      ]);

      for (const anim of animations) {
        inventory.push({
          detector: detector.name,
          ...anim,
        });
      }
    } catch (err) {
      errors.push({
        stage: 'discover',
        detector: detector.name,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { inventory, detectorsRun, errors };
}
