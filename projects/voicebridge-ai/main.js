import { z } from 'zod';
import { localTranslate } from '../../src/lib/core.js';

const source = document.querySelector('#source-text');
const output = document.querySelector('#output');
const status = document.querySelector('#voice-status');
const language = document.querySelector('#source-language');
const listenButton = document.querySelector('#listen');
const translateButton = document.querySelector('#translate');
const swapButton = document.querySelector('#swap');
const speakButton = document.querySelector('#speak');
const copyButton = document.querySelector('#copy');
const clearButton = document.querySelector('#clear');
const clearDataButton = document.querySelector('#clear-data');
const addGlossaryButton = document.querySelector('#add-glossary');
const glossarySource = document.querySelector('#glossary-source');
const glossaryTarget = document.querySelector('#glossary-target');
const glossaryList = document.querySelector('#glossary-list');
const schema = z.string().trim().min(1, 'Enter or speak a message first.').max(500, 'Keep the message under 500 characters.');
const storageKey = 'voicebridge-glossary-v1';
let glossary = loadGlossary();
let translatedText = '';
let recognition;

function loadGlossary() {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) || '[]');
    return Array.isArray(value) ? value.filter((pair) => pair && pair.source && pair.target) : [];
  } catch {
    return [];
  }
}

function setStatus(message, tone = '') {
  status.textContent = message;
  status.className = 'live-status ' + tone;
}

function renderGlossary() {
  glossaryList.replaceChildren();
  glossary.forEach((pair, index) => {
    const item = document.createElement('li');
    item.textContent = pair.source + ' → ' + pair.target + ' ';
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'button ghost';
    remove.textContent = 'Remove';
    remove.addEventListener('click', () => {
      glossary.splice(index, 1);
      localStorage.setItem(storageKey, JSON.stringify(glossary));
      renderGlossary();
    });
    item.append(remove);
    glossaryList.append(item);
  });
}

async function runTranslation() {
  const parsed = schema.safeParse(source.value);
  if (!parsed.success) {
    setStatus(parsed.error.issues[0].message, 'failure');
    source.focus();
    return;
  }
  setStatus('Transcribing complete → translating locally…');
  translateButton.disabled = true;
  await new Promise((resolve) => window.setTimeout(resolve, 420));
  const result = localTranslate(parsed.data, glossary);
  translatedText = result.text;
  output.textContent = translatedText;
  speakButton.disabled = !result.matched;
  copyButton.disabled = false;
  translateButton.disabled = false;
  setStatus(result.matched ? 'Local demo match complete.' : 'No verified local match.', result.matched ? 'success' : 'warning');
}

function swapLanguages() {
  language.value = language.value === 'en-US' ? 'ja-JP' : 'en-US';
  if (translatedText && !translatedText.startsWith('No local match')) {
    const previous = source.value;
    source.value = translatedText;
    translatedText = previous;
    output.textContent = translatedText || 'Your translated phrase will appear here.';
  }
  setStatus(language.value === 'en-US' ? 'Input set to English.' : 'Input set to Japanese.');
}

function startListening() {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    setStatus('Speech recognition is unsupported here. Type or choose a phrase instead.', 'warning');
    return;
  }
  try {
    recognition = new Recognition();
    recognition.lang = language.value;
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onstart = () => {
      listenButton.textContent = 'Listening…';
      setStatus('Listening locally through the browser…');
    };
    recognition.onresult = (event) => {
      source.value = Array.from(event.results).map((result) => result[0].transcript).join(' ');
      setStatus(event.results[event.results.length - 1].isFinal ? 'Transcript ready.' : 'Transcribing…');
    };
    recognition.onerror = (event) => setStatus('Recognition stopped: ' + event.error + '.', 'failure');
    recognition.onend = () => {
      listenButton.textContent = 'Listen';
      if (source.value.trim()) runTranslation();
    };
    recognition.start();
  } catch {
    setStatus('Unable to start recognition. Check browser permission and try again.', 'failure');
  }
}

function speak() {
  if (!translatedText || !('speechSynthesis' in window)) {
    setStatus('Speech synthesis is unavailable in this browser.', 'warning');
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(translatedText);
  utterance.lang = language.value === 'en-US' ? 'ja-JP' : 'en-US';
  utterance.onstart = () => setStatus('Speaking output…');
  utterance.onend = () => setStatus('Playback complete.');
  window.speechSynthesis.speak(utterance);
}

translateButton.addEventListener('click', runTranslation);
listenButton.addEventListener('click', startListening);
swapButton.addEventListener('click', swapLanguages);
speakButton.addEventListener('click', speak);
copyButton.addEventListener('click', async () => {
  await navigator.clipboard.writeText(translatedText);
  setStatus('Output copied.');
});
clearButton.addEventListener('click', () => {
  if (recognition) recognition.abort();
  window.speechSynthesis?.cancel();
  source.value = '';
  translatedText = '';
  output.textContent = 'Your translated phrase will appear here.';
  speakButton.disabled = true;
  copyButton.disabled = true;
  setStatus('Cleared.');
});
document.querySelector('#phrases').addEventListener('click', (event) => {
  const button = event.target.closest('[data-phrase]');
  if (!button) return;
  language.value = 'en-US';
  source.value = button.dataset.phrase;
  runTranslation();
});
addGlossaryButton.addEventListener('click', () => {
  const pairSchema = z.object({ source: z.string().trim().min(1).max(60), target: z.string().trim().min(1).max(60) });
  const parsed = pairSchema.safeParse({ source: glossarySource.value, target: glossaryTarget.value });
  if (!parsed.success) {
    setStatus('Enter both glossary terms.', 'failure');
    return;
  }
  glossary.push(parsed.data);
  localStorage.setItem(storageKey, JSON.stringify(glossary));
  glossarySource.value = '';
  glossaryTarget.value = '';
  renderGlossary();
  setStatus('Glossary pair saved locally.');
});
clearDataButton.addEventListener('click', () => {
  localStorage.removeItem(storageKey);
  glossary = [];
  renderGlossary();
  setStatus('Local glossary data removed.');
});

renderGlossary();