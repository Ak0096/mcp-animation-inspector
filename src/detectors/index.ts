import type { AnimationDetector } from './types.js';
import { cssDetector } from './css.js';
import { gsapDetector } from './gsap.js';
import { framerMotionDetector } from './framer-motion.js';
import { lottieDetector } from './lottie.js';
import { webglDetector } from './webgl.js';
import { scrollLibraryDetector } from './scroll-library.js';
import { cursorDetector } from './cursor.js';
import { pageTransitionDetector } from './page-transition.js';

const ALL_DETECTORS: AnimationDetector[] = [
  cssDetector,
  gsapDetector,
  framerMotionDetector,
  lottieDetector,
  webglDetector,
  scrollLibraryDetector,
  cursorDetector,
  pageTransitionDetector,
];

export function getDetectors(filter?: string[]): AnimationDetector[] {
  if (!filter) return [...ALL_DETECTORS];
  const validNames = ALL_DETECTORS.map(d => d.name);
  const unknown = filter.filter(f => !validNames.includes(f));
  if (unknown.length > 0) {
    console.error(`[mcp-animation-inspector] Unknown detector names: ${unknown.join(', ')}. Available: ${validNames.join(', ')}`);
  }
  return ALL_DETECTORS.filter((d) => filter.includes(d.name));
}

export function getDetectorByName(name: string): AnimationDetector | undefined {
  return ALL_DETECTORS.find((d) => d.name === name);
}

export { type AnimationDetector } from './types.js';
