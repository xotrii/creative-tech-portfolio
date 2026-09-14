const year = document.querySelector('#year');
if (year) year.textContent = String(new Date().getFullYear());

const root = document.documentElement;
window.addEventListener('pointermove', (event) => {
  root.style.setProperty('--pointer-x', event.clientX + 'px');
  root.style.setProperty('--pointer-y', event.clientY + 'px');
}, { passive: true });