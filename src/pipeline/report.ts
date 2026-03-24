import type {
  AnimationInventory,
  FrameSet,
  AnimationCode,
  InspectionReport,
  InspectionError,
  Frame,
} from '../types/index.js';

interface ReportInput {
  url: string;
  techStack: string[];
  inventory: AnimationInventory[];
  scrollFrames: Frame[];
  animationFrames: FrameSet[];
  code: AnimationCode[];
  descriptions?: string[];
  detectorsRun: string[];
  errors: InspectionError[];
  startTime: number;
}

export function buildReport(input: ReportInput): InspectionReport {
  return {
    schemaVersion: '1.0.0',
    url: input.url,
    timestamp: new Date().toISOString(),
    techStack: input.techStack,
    inventory: input.inventory,
    frames: input.animationFrames,
    scrollFrames: input.scrollFrames.length > 0 ? input.scrollFrames : undefined,
    code: input.code,
    descriptions: input.descriptions,
    meta: {
      inspectionDuration: Date.now() - input.startTime,
      detectorsRun: input.detectorsRun,
      errors: input.errors,
    },
  };
}
