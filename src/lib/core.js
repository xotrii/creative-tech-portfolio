export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function mulberry32(seed) {
  let state = seed >>> 0;
  return function random() {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeShiftData(seed = 2027, hours = 72) {
  const random = mulberry32(seed);
  const zones = ['Atrium', 'North', 'South', 'East', 'West'];
  return Array.from({ length: hours }, (_, hour) => {
    const zone = zones[hour % zones.length];
    const localHour = hour % 24;
    const peak = localHour >= 6 && localHour <= 9 ? 24 : localHour >= 16 && localHour <= 20 ? 31 : 8;
    const workload = Math.round(58 + peak + random() * 18);
    const staff = Math.round(8 + workload / 15 + (random() - 0.5) * 3);
    const coverage = clamp(Math.round((staff * 13 / workload) * 100), 52, 112);
    return {
      hour,
      zone,
      workload,
      staff,
      coverage,
      backlog: Math.max(0, Math.round((100 - coverage) / 9 + random() * 3)),
      inspection: clamp(Math.round(88 + (coverage - 80) / 5 + random() * 7), 75, 100),
      incidents: random() > 0.9 ? 1 : 0
    };
  });
}

export function movingAverage(values, windowSize = 6) {
  if (!values.length) return [];
  return values.map((_, index) => {
    const start = Math.max(0, index - windowSize + 1);
    const slice = values.slice(start, index + 1);
    return slice.reduce((sum, value) => sum + value, 0) / slice.length;
  });
}

export function scenarioProjection(records, staffDelta) {
  const currentCoverage = records.reduce((sum, row) => sum + row.coverage, 0) / Math.max(1, records.length);
  const projectedCoverage = clamp(currentCoverage + staffDelta * 4.2, 0, 120);
  return {
    currentCoverage: Math.round(currentCoverage),
    projectedCoverage: Math.round(projectedCoverage),
    backlogRisk: projectedCoverage >= 95 ? 'Low' : projectedCoverage >= 82 ? 'Moderate' : 'High',
    laborHours: staffDelta * 8,
    serviceImpact: Math.round((projectedCoverage - currentCoverage) * 0.72)
  };
}

const PHRASES = new Map([
  ['hello', 'こんにちは'],
  ['good morning', 'おはようございます'],
  ['thank you', 'ありがとうございます'],
  ['where is the train station?', '駅はどこですか？'],
  ['please speak slowly', 'ゆっくり話してください'],
  ['i need help', '助けが必要です'],
  ['こんにちは', 'Hello'],
  ['おはようございます', 'Good morning'],
  ['ありがとうございます', 'Thank you'],
  ['駅はどこですか？', 'Where is the train station?'],
  ['ゆっくり話してください', 'Please speak slowly'],
  ['助けが必要です', 'I need help']
]);

export function localTranslate(text, glossary = []) {
  const normalized = text.trim().toLowerCase();
  const exact = PHRASES.get(normalized) || PHRASES.get(text.trim());
  if (exact) return { text: exact, matched: true };
  let result = text.trim();
  let changed = false;
  for (const pair of glossary) {
    if (!pair.source || !pair.target) continue;
    const pattern = new RegExp(pair.source.replace(/[.*+?^$()|[\]{}\\]/g, '\\$&'), 'gi');
    if (pattern.test(result)) {
      result = result.replace(pattern, pair.target);
      changed = true;
    }
  }
  return {
    text: changed ? result : 'No local match. Choose a phrase or add a glossary pair.',
    matched: changed
  };
}

export function audioMetrics(samples) {
  if (!samples.length) return { peak: 0, rms: 0, zcr: 0, crest: 0 };
  let peak = 0;
  let squared = 0;
  let crossings = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const value = samples[index];
    peak = Math.max(peak, Math.abs(value));
    squared += value * value;
    if (index > 0 && Math.sign(value) !== Math.sign(samples[index - 1])) crossings += 1;
  }
  const rms = Math.sqrt(squared / samples.length);
  return {
    peak,
    rms,
    zcr: crossings / Math.max(1, samples.length - 1),
    crest: rms ? 20 * Math.log10(peak / rms) : 0
  };
}

function channelToLinear(channel) {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex) {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((part) => part + part).join('') : clean;
  if (!/^[0-9a-f]{6}$/i.test(full)) throw new Error('Invalid hex color');
  const channels = [0, 2, 4].map((index) => parseInt(full.slice(index, index + 2), 16));
  return 0.2126 * channelToLinear(channels[0]) +
    0.7152 * channelToLinear(channels[1]) +
    0.0722 * channelToLinear(channels[2]);
}

export function contrastRatio(first, second) {
  const a = relativeLuminance(first);
  const b = relativeLuminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

export function makeAltDraft({ subject, purpose, context, visibleText, decorative }) {
  if (decorative) return '';
  const parts = [subject?.trim(), context?.trim()].filter(Boolean);
  if (visibleText?.trim()) parts.push('Text: ' + visibleText.trim());
  if (purpose?.trim()) parts.push(purpose.trim());
  return parts.join('. ').replace(/\.+/g, '.').slice(0, 180);
}

export function toCsv(rows) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const quote = (value) => '"' + String(value).replaceAll('"', '""') + '"';
  return [headers.map(quote).join(','), ...rows.map((row) => headers.map((key) => quote(row[key])).join(','))].join('\n');
}