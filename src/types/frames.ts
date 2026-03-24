import type { AnimationInventory } from './inventory.js';

export interface Frame {
  image: string;
  label: string;
  timestamp?: number;
  viewport: { width: number; height: number };
}

export interface FrameSet {
  animation: AnimationInventory;
  frames: Frame[];
}
