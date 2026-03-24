import type { AnimationInventory } from './inventory.js';
import type { FrameSet } from './frames.js';
import type { AnimationCode } from './code.js';

export interface PageStructure {
  title: string;
  sections: {
    selector: string;
    tag: string;
    text?: string;
    children: number;
  }[];
  interactiveElements: {
    selector: string;
    type: string;
    text?: string;
  }[];
  landmarks: {
    role: string;
    selector: string;
    label?: string;
  }[];
}

export interface InspectionError {
  stage: string;
  detector?: string;
  selector?: string;
  error: string;
}

export interface InspectionReport {
  schemaVersion: string;
  url: string;
  timestamp: string;
  techStack: string[];
  inventory: AnimationInventory[];
  frames: FrameSet[];
  code: AnimationCode[];
  descriptions?: string[];
  meta: {
    inspectionDuration: number;
    detectorsRun: string[];
    errors: InspectionError[];
  };
}
