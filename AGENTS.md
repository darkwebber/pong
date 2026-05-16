# Agent Notes — Neon Pong

## Build & Dev

- `npm run dev` — dev server on **port 3000** (hardcoded in `vite.config.ts`)
- `npm run build` — runs **`tsc && vite build`**. The TypeScript compiler is a required first step; do not skip it.
- `npm run preview` — serves the production build from `dist/`
- `dist/` is in `.gitignore`; do not commit build artifacts.

## TypeScript Quirks

- **Strict mode with extra linting**: `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`, and `verbatimModuleSyntax` are all enabled.
- **Import extensions**: source files import each other with **`.js`** extensions (e.g., `import { Foo } from './bar.js'`). This is required by the `bundler` module resolution + `allowImportingTsExtensions` config.
- `noEmit: true` — TSC only type-checks; Vite handles all emission.

## Project Architecture

- **No external game engine** — all rendering is hand-rolled HTML5 Canvas 2D and all audio is synthesized via the Web Audio API.
- Entry point: `src/main.ts` → instantiates `Game` from `src/game/engine.ts`.
- `src/game/engine.ts` is the main state machine and game loop; it owns all subsystems (input, audio, particles, screen effects, power-ups, AI, background).
- UI is **DOM-based** (`src/ui/uiManager.ts`) overlaid on the canvas, not rendered within the canvas.
- `src/game/constants.ts` contains tunable gameplay values (speeds, sizes, AI reaction times, effect parameters).

## Code Style

- Prefer **named exports** over default exports.
- Use explicit types on public APIs.
- Keep functions focused and small.

## Testing

- **There is no automated test suite.** All verification is manual.
- After any change, run `npm run build` to confirm it passes the TypeScript compiler.
- When testing gameplay changes, verify:
  - Landscape and **portrait** modes (use dev tools device emulation)
  - Touch / on-screen controls in portrait
  - Keyboard controls switch to left/right (A/D) in portrait
  - Background wave direction and freeze behavior during pauses
  - Power-up spawn, collection, and expiration
  - AI behavior at all three difficulty levels
  - Audio on hits, scores, and power-ups

## Mobile / Portrait Gotchas

- Portrait mode is a first-class orientation, not just responsive scaling. It has:
  - Different on-screen control layout (buttons on left/right edges)
  - Different keyboard bindings (left/right instead of up/down)
  - Different UI text positioning and copy
  - Score positions at top/bottom center instead of left/right
- Always test portrait changes with actual device emulation or a real device; window resizing alone does not cover orientation-specific logic.

## License Reminder

- The project is under **CC BY-NC 4.0**. Do not suggest or add commercial-use licensing changes.
