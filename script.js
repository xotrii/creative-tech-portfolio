const terminalOutput = document.querySelector('#terminalOutput');

const lines = [
    '> xotrii creative-tech system initiated',
    '> loading portfolio modules...',
    '> front-end development: online',
    '> ui/ux design system: online',
    '> creative technology: online',
    '> internship readiness: active',
    '> status: open to remote opportunities'
];

let lineIndex = 0;
let charIndex = 0;
let renderedText = '';

function typeTerminal() {
    if (!terminalOutput) {
        return;
    }

    if (lineIndex >= lines.length) {
        terminalOutput.textContent = `${renderedText}\n> awaiting connection...`;
        return;
    }

    const currentLine = lines[lineIndex];

    if (charIndex < currentLine.length) {
        renderedText += currentLine.charAt(charIndex);
        terminalOutput.textContent = renderedText;
        charIndex += 1;
        window.setTimeout(typeTerminal, 32);
        return;
    }

    renderedText += '\n';
    lineIndex += 1;
    charIndex = 0;
    window.setTimeout(typeTerminal, 240);
}

const cards = document.querySelectorAll('.project-card');

cards.forEach((card) => {
    card.addEventListener('pointermove', (event) => {
        const rect = card.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        card.style.background = `radial-gradient(circle at ${x}px ${y}px, rgba(57, 255, 20, 0.22), rgba(8, 18, 12, 0.86) 40%)`;
    });

    card.addEventListener('pointerleave', () => {
        card.style.background = 'rgba(8, 18, 12, 0.86)';
    });
});

typeTerminal();
