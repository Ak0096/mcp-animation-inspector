import type { AnimationInventory } from './inventory.js';

export interface AnimationCode {
  animation: AnimationInventory;
  css?: {
    keyframes?: string;
    transitions?: string;
    computedStyles?: Record<string, string>;
  };
  js?: {
    library:
      | 'gsap'
      | 'framer-motion'
      | 'lottie'
      | 'webgl'
      | 'scroll-library'
      | (string & {});
    config: Record<string, unknown>;
    rawSnippet?: string;
  };
  timing: {
    duration?: number;
    delay?: number;
    easing?: string;
    repeat?: number | 'infinite';
  };
}
