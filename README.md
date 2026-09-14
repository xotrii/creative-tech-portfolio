# XOTRII Recruiter Lab

Five focused, browser-based product demos that turn creative technology, responsible AI, accessibility, audio, and operations data into tangible work.

[Open the live project hub](https://xotrii.github.io/creative-tech-portfolio/)

## Projects

| Project | What it demonstrates | Live demo |
| --- | --- | --- |
| XOTRII Hologram Lab | Three.js rendering, pointer interaction, graceful WebGL fallback, reduced-motion support | [Launch](https://xotrii.github.io/creative-tech-portfolio/projects/xotrii-hologram/) |
| VoiceBridge AI | Browser speech APIs, local-first phrase translation, glossary persistence, explicit privacy boundaries | [Launch](https://xotrii.github.io/creative-tech-portfolio/projects/voicebridge-ai/) |
| ShiftLens AI | Deterministic synthetic operations data, moving-average forecasts, staffing scenarios, CSV export | [Launch](https://xotrii.github.io/creative-tech-portfolio/projects/shiftlens-ai/) |
| SonicScope AI | Web Audio analysis, waveform and spectrum rendering, interpretable audio descriptors, JSON export | [Launch](https://xotrii.github.io/creative-tech-portfolio/projects/sonicscope-ai/) |
| DesignGuard AI | WCAG contrast checks, local palette extraction, alt-text drafting, sanitized HTML audits | [Launch](https://xotrii.github.io/creative-tech-portfolio/projects/designguard-ai/) |

## Why this repository exists

Each project is intentionally small enough to inspect in an interview and complete enough to use. The suite emphasizes product judgment: useful defaults, transparent limitations, local processing where practical, accessible interaction, deterministic demos, and clear exports.

## Stack

- Vite multi-page build with plain JavaScript modules
- Three.js, Chart.js, Meyda, axe-core, DOMPurify, Culori, and Zod
- Vitest unit coverage and ESLint quality checks
- GitHub Actions continuous integration and GitHub Pages deployment

## Run locally

~~~bash
npm install
npm run dev
~~~

Before submitting a change:

~~~bash
npm run lint
npm test
npm run build
~~~

## Architecture

The root page is a portfolio hub. Each folder under `projects/` is an independent entry point, while `src/lib/core.js` contains the deterministic logic shared with the test suite. Vite emits every route into `dist/` for static hosting.

## Responsible-demo boundaries

- ShiftLens uses synthetic records and is not a workforce decision system.
- VoiceBridge uses a deliberately small local phrase map and makes no universal translation claim.
- SonicScope descriptions are heuristic and should not be treated as authorship or copyright judgments.
- DesignGuard assists review; it does not replace testing with disabled people or expert accessibility audits.

## Author

Built by [Tristan Williams (@xotrii)](https://github.com/xotrii).

Licensed under the MIT License.