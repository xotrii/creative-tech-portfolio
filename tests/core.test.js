import { describe, expect, it } from 'vitest';
import {
  audioMetrics,
  contrastRatio,
  localTranslate,
  makeAltDraft,
  makeShiftData,
  movingAverage,
  scenarioProjection,
  toCsv
} from '../src/lib/core.js';

describe('shared portfolio logic', () => {
  it('generates deterministic synthetic shift data', () => {
    expect(makeShiftData(42, 4)).toEqual(makeShiftData(42, 4));
    expect(makeShiftData(42, 4)).toHaveLength(4);
  });

  it('calculates a trailing moving average', () => {
    expect(movingAverage([3, 6, 9], 2)).toEqual([3, 4.5, 7.5]);
  });

  it('shows improved coverage when staffing increases', () => {
    const rows = makeShiftData(7, 24);
    const baseline = scenarioProjection(rows, 0);
    const staffed = scenarioProjection(rows, 2);
    expect(staffed.projectedCoverage).toBeGreaterThan(baseline.projectedCoverage);
    expect(staffed.laborHours).toBe(16);
  });

  it('translates supported phrases and glossary terms locally', () => {
    expect(localTranslate('Thank you').text).toBe('ありがとうございます');
    expect(localTranslate('Meet at the gate', [{ source: 'gate', target: '搭乗口' }])).toMatchObject({
      text: 'Meet at the 搭乗口',
      matched: true
    });
  });

  it('computes bounded audio descriptors', () => {
    const result = audioMetrics(new Float32Array([-1, 0, 1, 0]));
    expect(result.peak).toBe(1);
    expect(result.rms).toBeCloseTo(Math.sqrt(0.5));
    expect(result.zcr).toBeGreaterThanOrEqual(0);
  });

  it('matches the WCAG black-on-white contrast ratio', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21);
  });

  it('keeps decorative alt text empty and drafts contextual alt text', () => {
    expect(makeAltDraft({ decorative: true })).toBe('');
    expect(makeAltDraft({ subject: 'Transit map', context: 'Downtown routes', purpose: 'Shows service changes' })).toContain('Transit map');
  });

  it('escapes quotes in CSV exports', () => {
    expect(toCsv([{ note: 'Say "hello"' }])).toBe('"note"\n"Say ""hello"""');
  });
});