import { describe, it, expect } from 'vitest';
import { buildReport } from '../../../src/pipeline/report.js';

describe('buildReport', () => {
  it('builds a valid InspectionReport', () => {
    const report = buildReport({
      url: 'https://example.com',
      techStack: ['GSAP 3.12'],
      inventory: [],
      scrollFrames: [],
      animationFrames: [],
      code: [],
      descriptions: undefined,
      detectorsRun: ['css', 'gsap'],
      errors: [],
      startTime: Date.now() - 5000,
    });

    expect(report.schemaVersion).toBe('1.0.0');
    expect(report.url).toBe('https://example.com');
    expect(report.techStack).toEqual(['GSAP 3.12']);
    expect(report.meta.detectorsRun).toEqual(['css', 'gsap']);
    expect(report.meta.inspectionDuration).toBeGreaterThan(0);
  });
});
