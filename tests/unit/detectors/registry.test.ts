import { describe, it, expect } from 'vitest';
import { getDetectors, getDetectorByName } from '../../../src/detectors/index.js';

describe('Detector Registry', () => {
  it('returns all built-in detectors', () => {
    const detectors = getDetectors();
    expect(detectors.length).toBe(8);
    const names = detectors.map((d) => d.name);
    expect(names).toContain('css');
    expect(names).toContain('gsap');
    expect(names).toContain('framer-motion');
    expect(names).toContain('lottie');
    expect(names).toContain('webgl');
    expect(names).toContain('scroll-library');
    expect(names).toContain('cursor');
    expect(names).toContain('page-transition');
  });

  it('filters detectors by name', () => {
    const detectors = getDetectors(['css', 'gsap']);
    expect(detectors).toHaveLength(2);
  });

  it('retrieves single detector by name', () => {
    const detector = getDetectorByName('css');
    expect(detector).toBeDefined();
    expect(detector!.name).toBe('css');
  });

  it('returns undefined for unknown detector', () => {
    expect(getDetectorByName('nonexistent')).toBeUndefined();
  });
});
