import Meyda from 'meyda';
import { audioMetrics, clamp } from '../../src/lib/core.js';

const fileInput = document.querySelector('#audio-file');
const player = document.querySelector('#player');
const status = document.querySelector('#audio-status');
const exportButton = document.querySelector('#export');
const waveform = document.querySelector('#waveform');
const spectrum = document.querySelector('#spectrum');
const tags = document.querySelector('#tags');
let currentUrl;
let report;

function setMetric(id, value) {
  document.querySelector('#' + id).textContent = value;
}

function setupCanvas(canvas) {
  const width = Math.max(320, Math.round(canvas.getBoundingClientRect().width));
  const height = 260;
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  const context = canvas.getContext('2d');
  context.scale(ratio, ratio);
  return { context, width, height };
}

function drawWave(samples) {
  const view = setupCanvas(waveform);
  view.context.clearRect(0, 0, view.width, view.height);
  view.context.strokeStyle = '#39ff14';
  view.context.lineWidth = 1.5;
  view.context.shadowColor = '#39ff14';
  view.context.shadowBlur = 8;
  view.context.beginPath();
  const step = Math.max(1, Math.floor(samples.length / view.width));
  for (let x = 0; x < view.width; x += 1) {
    let min = 1;
    let max = -1;
    for (let index = x * step; index < Math.min(samples.length, (x + 1) * step); index += 1) {
      min = Math.min(min, samples[index]);
      max = Math.max(max, samples[index]);
    }
    const y1 = (1 - max) * view.height * 0.5;
    const y2 = (1 - min) * view.height * 0.5;
    view.context.moveTo(x, y1);
    view.context.lineTo(x, y2);
  }
  view.context.stroke();
}

function frequencyBins(samples, binCount = 80) {
  const size = Math.min(1024, samples.length);
  const bins = [];
  for (let bin = 0; bin < binCount; bin += 1) {
    let real = 0;
    let imaginary = 0;
    for (let index = 0; index < size; index += 1) {
      const phase = (2 * Math.PI * bin * index) / size;
      const windowed = samples[index] * (0.5 - 0.5 * Math.cos((2 * Math.PI * index) / Math.max(1, size - 1)));
      real += windowed * Math.cos(phase);
      imaginary -= windowed * Math.sin(phase);
    }
    bins.push(Math.sqrt(real * real + imaginary * imaginary) / size);
  }
  return bins;
}

function drawSpectrum(samples) {
  const view = setupCanvas(spectrum);
  const bins = frequencyBins(samples);
  const max = Math.max(...bins, 0.001);
  view.context.clearRect(0, 0, view.width, view.height);
  const barWidth = view.width / bins.length;
  bins.forEach((value, index) => {
    const height = clamp(value / max, 0, 1) * (view.height - 24);
    const gradient = view.context.createLinearGradient(0, view.height, 0, view.height - height);
    gradient.addColorStop(0, '#16451e');
    gradient.addColorStop(1, '#39ff14');
    view.context.fillStyle = gradient;
    view.context.fillRect(index * barWidth, view.height - height, Math.max(1, barWidth - 2), height);
  });
}

function estimateBpm(samples, sampleRate) {
  const frame = 1024;
  const hop = 512;
  const energies = [];
  for (let index = 0; index + frame < samples.length; index += hop) {
    let energy = 0;
    for (let point = index; point < index + frame; point += 1) energy += samples[point] * samples[point];
    energies.push(energy / frame);
  }
  const mean = energies.reduce((sum, value) => sum + value, 0) / Math.max(1, energies.length);
  const peaks = [];
  for (let index = 1; index < energies.length - 1; index += 1) {
    if (energies[index] > mean * 1.6 && energies[index] > energies[index - 1] && energies[index] >= energies[index + 1]) peaks.push(index);
  }
  const intervals = peaks.slice(1).map((peak, index) => ((peak - peaks[index]) * hop) / sampleRate).filter((value) => value > 0.28 && value < 1.2);
  if (intervals.length < 2) return null;
  intervals.sort((a, b) => a - b);
  let bpm = 60 / intervals[Math.floor(intervals.length / 2)];
  while (bpm < 70) bpm *= 2;
  while (bpm > 180) bpm /= 2;
  return Math.round(bpm);
}

function estimateKey(samples, sampleRate) {
  const length = Math.min(samples.length, 12000);
  if (length < 2048) return null;
  let bestLag = 0;
  let best = 0;
  let zero = 0;
  for (let index = 0; index < length; index += 1) zero += samples[index] * samples[index];
  for (let lag = Math.floor(sampleRate / 1000); lag <= Math.floor(sampleRate / 70); lag += 1) {
    let correlation = 0;
    for (let index = 0; index < length - lag; index += 1) correlation += samples[index] * samples[index + lag];
    if (correlation > best) {
      best = correlation;
      bestLag = lag;
    }
  }
  const confidence = zero ? best / zero : 0;
  if (!bestLag || confidence < 0.22) return null;
  const frequency = sampleRate / bestLag;
  const midi = Math.round(69 + 12 * Math.log2(frequency / 440));
  const notes = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
  return { note: notes[((midi % 12) + 12) % 12], confidence: Math.round(confidence * 100) };
}

function descriptiveTags(metrics, meydaFeatures) {
  const output = [];
  output.push(metrics.crest > 12 ? 'dynamic' : 'dense');
  output.push(metrics.zcr > 0.12 ? 'percussive' : 'smooth');
  output.push((meydaFeatures?.spectralCentroid || 0) > 18 ? 'bright' : 'dark-leaning');
  output.push(metrics.peak > 0.98 ? 'possible clipping' : 'headroom present');
  return output;
}

async function analyzeBuffer(buffer, label, url) {
  const samples = buffer.getChannelData(0);
  const metrics = audioMetrics(samples);
  const segment = samples.slice(0, Math.min(2048, samples.length));
  let features;
  try {
    Meyda.bufferSize = segment.length >= 2048 ? 2048 : 512;
    features = segment.length >= 512 ? Meyda.extract(['rms', 'zcr', 'spectralCentroid'], segment.slice(0, Meyda.bufferSize)) : null;
  } catch {
    features = null;
  }
  const bpm = estimateBpm(samples, buffer.sampleRate);
  const key = estimateKey(samples, buffer.sampleRate);
  const labels = descriptiveTags(metrics, features);

  setMetric('peak', metrics.peak.toFixed(3));
  setMetric('rms', metrics.rms.toFixed(3));
  setMetric('crest', metrics.crest.toFixed(1) + ' dB');
  setMetric('zcr', (metrics.zcr * 100).toFixed(1) + '%');
  setMetric('bpm', bpm ? bpm + ' est.' : 'uncertain');
  setMetric('key', key ? key.note + ' · ' + key.confidence + '%' : 'uncertain');
  setMetric('sample-rate', Math.round(buffer.sampleRate / 1000) + ' kHz');
  setMetric('channels', String(buffer.numberOfChannels));
  tags.textContent = labels.join(' · ');
  drawWave(samples);
  drawSpectrum(samples);
  report = {
    file: label,
    privacy: 'Analyzed locally in the browser',
    durationSeconds: Number(buffer.duration.toFixed(2)),
    sampleRate: buffer.sampleRate,
    channels: buffer.numberOfChannels,
    metrics,
    bpmEstimate: bpm,
    keyEstimate: key,
    descriptiveTags: labels,
    limitations: 'BPM and key are educational estimates, not mastering-grade measurements.'
  };
  exportButton.disabled = false;
  if (currentUrl) URL.revokeObjectURL(currentUrl);
  currentUrl = url;
  player.src = url;
  status.textContent = label + ' analyzed locally.';
}

async function decodeArrayBuffer(arrayBuffer, label, url) {
  status.textContent = 'Decoding and analyzing locally…';
  const context = new AudioContext();
  try {
    const buffer = await context.decodeAudioData(arrayBuffer.slice(0));
    await analyzeBuffer(buffer, label, url);
  } finally {
    await context.close();
  }
}

function makeDemoWav() {
  const sampleRate = 44100;
  const seconds = 6;
  const samples = new Float32Array(sampleRate * seconds);
  for (let index = 0; index < samples.length; index += 1) {
    const time = index / sampleRate;
    const beat = time % 0.5;
    const kick = Math.exp(-beat * 20) * Math.sin(2 * Math.PI * (82 - beat * 35) * time);
    const tone = Math.sin(2 * Math.PI * 261.63 * time) * 0.17;
    samples[index] = clamp(kick * 0.58 + tone, -1, 1);
  }
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const write = (offset, text) => [...text].forEach((character, index) => view.setUint8(offset + index, character.charCodeAt(0)));
  write(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  write(8, 'WAVE');
  write(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((sample, index) => view.setInt16(44 + index * 2, sample < 0 ? sample * 32768 : sample * 32767, true));
  return new Blob([buffer], { type: 'audio/wav' });
}

fileInput.addEventListener('change', async () => {
  const file = fileInput.files[0];
  if (!file) return;
  if (!file.type.startsWith('audio/') || file.size > 30 * 1024 * 1024) {
    status.textContent = 'Choose a supported audio file no larger than 30 MB.';
    status.className = 'live-status failure';
    return;
  }
  try {
    const url = URL.createObjectURL(file);
    await decodeArrayBuffer(await file.arrayBuffer(), file.name, url);
  } catch {
    status.textContent = 'The browser could not decode this audio file.';
    status.className = 'live-status failure';
  }
});
document.querySelector('#demo').addEventListener('click', async () => {
  const blob = makeDemoWav();
  await decodeArrayBuffer(await blob.arrayBuffer(), 'Generated C4 rhythm demo', URL.createObjectURL(blob));
});
document.querySelector('#reset').addEventListener('click', () => {
  if (currentUrl) URL.revokeObjectURL(currentUrl);
  currentUrl = undefined;
  report = undefined;
  player.removeAttribute('src');
  player.load();
  fileInput.value = '';
  ['peak', 'rms', 'crest', 'zcr', 'bpm', 'key', 'sample-rate', 'channels'].forEach((id) => setMetric(id, '—'));
  setupCanvas(waveform).context.clearRect(0, 0, waveform.width, waveform.height);
  setupCanvas(spectrum).context.clearRect(0, 0, spectrum.width, spectrum.height);
  tags.textContent = 'Load audio to generate descriptive thresholds.';
  exportButton.disabled = true;
  status.textContent = 'Audio removed from the local session.';
});
exportButton.addEventListener('click', () => {
  if (!report) return;
  const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'sonicscope-analysis.json';
  link.click();
  URL.revokeObjectURL(url);
});