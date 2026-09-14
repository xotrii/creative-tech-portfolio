import axe from 'axe-core';
import DOMPurify from 'dompurify';
import { parse } from 'culori';
import { z } from 'zod';
import { contrastRatio, makeAltDraft } from '../../src/lib/core.js';

const status = document.querySelector('#guard-status');
const foreground = document.querySelector('#foreground');
const background = document.querySelector('#background');
const ratioOutput = document.querySelector('#ratio');
const contrastResults = document.querySelector('#contrast-results');
const preview = document.querySelector('#contrast-preview');
const report = { contrast: null, palette: [], altText: '', audit: [] };

function setStatus(message, tone = '') {
  status.textContent = message;
  status.className = 'live-status ' + tone;
}

function renderContrast() {
  if (!parse(foreground.value) || !parse(background.value)) return;
  const ratio = contrastRatio(foreground.value, background.value);
  const normalAA = ratio >= 4.5;
  const largeAA = ratio >= 3;
  const normalAAA = ratio >= 7;
  ratioOutput.textContent = ratio.toFixed(2) + ':1';
  contrastResults.textContent = 'Normal AA ' + (normalAA ? 'PASS' : 'FAIL') + ' · Large AA ' + (largeAA ? 'PASS' : 'FAIL') + ' · Normal AAA ' + (normalAAA ? 'PASS' : 'FAIL');
  contrastResults.className = normalAA ? 'success' : 'failure';
  preview.style.color = foreground.value;
  preview.style.background = background.value;
  report.contrast = { foreground: foreground.value, background: background.value, ratio, normalAA, largeAA, normalAAA };
  const url = new URL(window.location.href);
  url.searchParams.set('fg', foreground.value.slice(1));
  url.searchParams.set('bg', background.value.slice(1));
  history.replaceState({}, '', url);
  setStatus('Contrast calculation updated.');
}

const params = new URLSearchParams(location.search);
const colorSchema = z.string().regex(/^[0-9a-f]{6}$/i);
if (colorSchema.safeParse(params.get('fg')).success) foreground.value = '#' + params.get('fg');
if (colorSchema.safeParse(params.get('bg')).success) background.value = '#' + params.get('bg');

document.querySelectorAll('[role="tab"]').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('[role="tab"]').forEach((item) => {
      const selected = item === tab;
      item.setAttribute('aria-selected', String(selected));
      document.querySelector('#' + item.getAttribute('aria-controls')).hidden = !selected;
    });
    setStatus(tab.textContent + ' tool ready.');
  });
});

foreground.addEventListener('input', renderContrast);
background.addEventListener('input', renderContrast);
document.querySelector('#swap-colors').addEventListener('click', () => {
  const value = foreground.value;
  foreground.value = background.value;
  background.value = value;
  renderContrast();
});
document.querySelector('#copy-link').addEventListener('click', async () => {
  await navigator.clipboard.writeText(location.href);
  setStatus('Shareable contrast URL copied.');
});

function rgbToHex(red, green, blue) {
  return '#' + [red, green, blue].map((value) => value.toString(16).padStart(2, '0')).join('');
}

document.querySelector('#image-file').addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 8 * 1024 * 1024 || !['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) {
    setStatus('Choose a PNG, JPEG, WebP, or GIF no larger than 8 MB.', 'failure');
    return;
  }
  const image = new Image();
  const url = URL.createObjectURL(file);
  image.onload = () => {
    const canvas = document.querySelector('#image-canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const width = Math.min(900, image.naturalWidth);
    const height = Math.round(width * image.naturalHeight / image.naturalWidth);
    canvas.width = width;
    canvas.height = height;
    context.drawImage(image, 0, 0, width, height);
    const pixels = context.getImageData(0, 0, width, height).data;
    const buckets = new Map();
    const step = Math.max(4, Math.floor((width * height) / 8000) * 4);
    for (let index = 0; index < pixels.length; index += step) {
      if (pixels[index + 3] < 150) continue;
      const red = Math.round(pixels[index] / 32) * 32;
      const green = Math.round(pixels[index + 1] / 32) * 32;
      const blue = Math.round(pixels[index + 2] / 32) * 32;
      const key = rgbToHex(Math.min(255, red), Math.min(255, green), Math.min(255, blue));
      buckets.set(key, (buckets.get(key) || 0) + 1);
    }
    report.palette = [...buckets.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([color]) => color);
    const palette = document.querySelector('#palette');
    palette.replaceChildren();
    report.palette.forEach((color) => {
      const swatch = document.createElement('div');
      swatch.className = 'swatch';
      const sample = document.createElement('i');
      sample.style.background = color;
      const label = document.createElement('span');
      label.textContent = color;
      swatch.append(sample, label);
      palette.append(swatch);
    });
    URL.revokeObjectURL(url);
    setStatus('Eight dominant local color buckets extracted.');
  };
  image.onerror = () => {
    URL.revokeObjectURL(url);
    setStatus('The browser could not decode this image.', 'failure');
  };
  image.src = url;
});

document.querySelector('#draft-alt').addEventListener('click', () => {
  const draft = makeAltDraft({
    subject: document.querySelector('#subject').value,
    context: document.querySelector('#context').value,
    visibleText: document.querySelector('#visible-text').value,
    purpose: document.querySelector('#purpose').value,
    decorative: document.querySelector('#decorative').checked
  });
  document.querySelector('#alt-output').value = draft;
  report.altText = draft;
  setStatus(draft ? 'Structured alt-text draft created.' : 'Decorative image selected: use an empty alt attribute.');
});
document.querySelector('#copy-alt').addEventListener('click', async () => {
  await navigator.clipboard.writeText(document.querySelector('#alt-output').value);
  setStatus('Alt-text draft copied.');
});

document.querySelector('#run-audit').addEventListener('click', async () => {
  const raw = document.querySelector('#html-snippet').value;
  if (raw.length > 10000) {
    setStatus('Keep the HTML snippet under 10,000 characters.', 'failure');
    return;
  }
  const sanitized = DOMPurify.sanitize(raw, { FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed'], FORBID_ATTR: ['onerror', 'onclick', 'onload'] });
  const target = document.querySelector('#audit-preview');
  target.innerHTML = sanitized;
  setStatus('Running automated checks…');
  try {
    const result = await axe.run(target);
    report.audit = result.violations.map((violation) => ({ id: violation.id, impact: violation.impact, help: violation.help, nodes: violation.nodes.length }));
    const output = document.querySelector('#audit-results');
    output.replaceChildren();
    if (!report.audit.length) output.textContent = 'No automated violations found in this small sanitized snippet. Manual review is still required.';
    else {
      const list = document.createElement('ul');
      report.audit.forEach((item) => {
        const li = document.createElement('li');
        li.textContent = item.impact + ' · ' + item.help + ' (' + item.nodes + ' node' + (item.nodes === 1 ? '' : 's') + ')';
        list.append(li);
      });
      output.append(list);
    }
    setStatus(report.audit.length + ' automated issue groups found.', report.audit.length ? 'warning' : 'success');
  } catch {
    setStatus('The automated audit could not run on this snippet.', 'failure');
  }
});

document.querySelector('#export-report').addEventListener('click', () => {
  const payload = {
    generatedAt: new Date().toISOString(),
    disclaimer: 'Guidance only; not a WCAG conformance certification.',
    ...report,
    altText: document.querySelector('#alt-output').value
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'designguard-report.json';
  link.click();
  URL.revokeObjectURL(url);
  setStatus('Accessibility guidance report exported.');
});

renderContrast();