import * as THREE from 'three';
import { clamp } from '../../src/lib/core.js';

const frame = document.querySelector('#hologram-frame');
const status = document.querySelector('#scene-status');
const fallback = document.querySelector('#fallback');
const spinInput = document.querySelector('#spin');
const glitchInput = document.querySelector('#glitch');
const glowInput = document.querySelector('#glow');
const scanInput = document.querySelector('#scan');
const qualityInput = document.querySelector('#quality');
const audioButton = document.querySelector('#audio-toggle');
const fullscreenButton = document.querySelector('#fullscreen');
const resetButton = document.querySelector('#reset');
const scanBeam = document.querySelector('#scan-beam');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

let renderer;
let scene;
let camera;
let wordGroup;
let particles;
let pointerX = 0;
let pointerY = 0;
let analyser;
let audioContext;
let stream;
let audioData;
let demoPhase = 0;

function makeWordTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 512;
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = '900 300px Arial Black, Arial, sans-serif';
  context.letterSpacing = '30px';
  context.strokeStyle = '#39ff14';
  context.lineWidth = 9;
  context.shadowColor = '#39ff14';
  context.shadowBlur = 38;
  context.strokeText('XOTRII', 1024, 260);
  context.fillStyle = '#07150a';
  context.fillText('XOTRII', 1024, 260);
  return new THREE.CanvasTexture(canvas);
}

function buildScene() {
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x020504, 0.055);
  camera = new THREE.PerspectiveCamera(42, frame.clientWidth / frame.clientHeight, 0.1, 100);
  camera.position.set(0, 0, 11);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x020504, 1);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, Number(qualityInput.value)));
  renderer.setSize(frame.clientWidth, frame.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  frame.prepend(renderer.domElement);

  const texture = makeWordTexture();
  wordGroup = new THREE.Group();
  const geometry = new THREE.PlaneGeometry(9.2, 2.3);
  [
    { color: 0x39ff14, opacity: 0.82, z: 0 },
    { color: 0x61f7ff, opacity: 0.22, z: -0.13 },
    { color: 0xffffff, opacity: 0.14, z: 0.13 }
  ].forEach((layer) => {
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      color: layer.color,
      transparent: true,
      opacity: layer.opacity,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.z = layer.z;
    wordGroup.add(mesh);
  });
  scene.add(wordGroup);

  const grid = new THREE.GridHelper(22, 26, 0x39ff14, 0x10351a);
  grid.position.set(0, -2.2, 0);
  grid.rotation.x = Math.PI * 0.02;
  scene.add(grid);

  const particleGeometry = new THREE.BufferGeometry();
  const positions = new Float32Array(900);
  for (let index = 0; index < positions.length; index += 3) {
    positions[index] = (Math.random() - 0.5) * 18;
    positions[index + 1] = (Math.random() - 0.5) * 9;
    positions[index + 2] = (Math.random() - 0.5) * 9;
  }
  particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  particles = new THREE.Points(
    particleGeometry,
    new THREE.PointsMaterial({ color: 0x39ff14, size: 0.025, transparent: true, opacity: 0.58 })
  );
  scene.add(particles);
  status.textContent = reducedMotion.matches ? 'Static accessibility mode active.' : 'Renderer online. Move your pointer to inspect depth.';
}

function resize() {
  if (!renderer) return;
  const width = frame.clientWidth;
  const height = frame.clientHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}

function currentLevel() {
  if (analyser && audioData) {
    analyser.getByteTimeDomainData(audioData);
    let squared = 0;
    for (const value of audioData) {
      const normalized = (value - 128) / 128;
      squared += normalized * normalized;
    }
    return clamp(Math.sqrt(squared / audioData.length) * 4.5, 0, 1);
  }
  demoPhase += 0.035;
  return 0.1 + (Math.sin(demoPhase) + 1) * 0.055;
}

function render(time) {
  if (!renderer || document.hidden) return;
  const seconds = time * 0.001;
  const level = currentLevel();
  const spin = Number(spinInput.value) / 9000;
  const glitch = Number(glitchInput.value) / 100;
  const glow = Number(glowInput.value) / 100;

  if (!reducedMotion.matches) {
    wordGroup.rotation.y += spin;
    wordGroup.rotation.x += (pointerY * 0.09 - wordGroup.rotation.x) * 0.035;
    wordGroup.rotation.y += (pointerX * 0.13 - wordGroup.rotation.y) * 0.012;
    wordGroup.position.y = Math.sin(seconds * 0.72) * 0.12;
    const trigger = Math.sin(seconds * 4.7) > 0.985 ? glitch : 0;
    wordGroup.position.x = trigger ? (Math.random() - 0.5) * trigger : 0;
    particles.rotation.y = seconds * 0.025;
  }
  wordGroup.scale.setScalar(1 + level * 0.075);
  wordGroup.children[0].material.opacity = 0.48 + glow * 0.46 + level * 0.08;
  renderer.render(scene, camera);
}

async function toggleAudio() {
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    stream = undefined;
    analyser = undefined;
    if (audioContext) await audioContext.close();
    audioContext = undefined;
    audioButton.textContent = 'Enable mic pulse';
    status.textContent = 'Microphone stopped. Deterministic demo pulse active.';
    return;
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    audioData = new Uint8Array(analyser.fftSize);
    source.connect(analyser);
    audioButton.textContent = 'Disable mic pulse';
    status.textContent = 'Local microphone level active. Nothing is recorded or uploaded.';
  } catch {
    status.textContent = 'Microphone unavailable or denied. Demo pulse remains active.';
  }
}

try {
  buildScene();
  renderer.setAnimationLoop(render);
  window.addEventListener('resize', resize);
  frame.addEventListener('pointermove', (event) => {
    const bounds = frame.getBoundingClientRect();
    pointerX = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
    pointerY = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
  }, { passive: true });
} catch {
  fallback.hidden = false;
  scanBeam.hidden = true;
  status.textContent = 'WebGL is unavailable. Accessible CSS hologram fallback active.';
}

qualityInput.addEventListener('change', () => {
  if (renderer) renderer.setPixelRatio(Math.min(window.devicePixelRatio, Number(qualityInput.value)));
  resize();
});
scanInput.addEventListener('input', () => {
  scanBeam.style.animationDuration = String(11 - Number(scanInput.value)) + 's';
});
audioButton.addEventListener('click', toggleAudio);
fullscreenButton.addEventListener('click', async () => {
  if (!document.fullscreenElement) await frame.requestFullscreen();
  else await document.exitFullscreen();
});
resetButton.addEventListener('click', () => {
  spinInput.value = '34';
  glitchInput.value = '18';
  glowInput.value = '72';
  scanInput.value = '4';
  qualityInput.value = '1.5';
  pointerX = 0;
  pointerY = 0;
  if (wordGroup) {
    wordGroup.rotation.set(0, 0, 0);
    wordGroup.position.set(0, 0, 0);
  }
  status.textContent = 'Signal controls reset.';
});