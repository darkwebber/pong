# Neon Pong — A Game of Light and Speed

A modern, neon-soaked take on the classic Pong arcade game. Built with TypeScript, HTML5 Canvas, and the Web Audio API, featuring particle effects, screen shake, time dilation, power-ups, and an AI opponent with three difficulty levels.

## Features

- **Smooth paddle control** — responsive keyboard, mouse, and touch input
- **Dynamic AI opponent** — three difficulty levels (Easy, Medium, Hard) with trajectory prediction
- **Power-ups** — expand, shrink, multiball, magnet, and time warp
- **Visual effects** — particle bursts, screen shake, neon glow, CRT scanlines, time dilation
- **Animated background wave** — flows in the direction of the ball, freezes during pauses and countdowns
- **Rainbow mode** — unlockable via the classic Konami code
- **Web Audio** — synthesized sound effects generated in real time
- **Fully responsive** — adapts to any screen size
- **Mobile portrait mode** — side-mounted on-screen controls, orientation-aware keyboard bindings, dynamic UI text

## Tech Stack

- TypeScript
- Vite
- HTML5 Canvas 2D
- Web Audio API
- No external game engine — pure hand-rolled physics and rendering

## Getting Started

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## How to Play

### Controls

| Input | Landscape Action | Portrait Action |
|-------|-----------------|-----------------|
| `W` / `Arrow Up` | Move paddle up | — |
| `S` / `Arrow Down` | Move paddle down | — |
| `A` / `Arrow Left` | — | Move paddle left |
| `D` / `Arrow Right` | — | Move paddle right |
| `Touch` | Drag to move paddle (mobile) | On-screen buttons or drag |
| `ESC` / `P` | Pause | Pause |

### Portrait Mode (Mobile)

- Rotate your device vertically for an optimized experience
- On-screen directional buttons appear on the left and right edges of the screen
- Keyboard controls automatically switch to left/right (A/D or Arrow keys)
- UI text and tutorials adapt to describe your paddle position correctly

### Game Rules

- Be the first to reach the target score (default: 7)
- Hit the ball past the AI opponent to score
- The ball speeds up with every rally
- Long rallies trigger visual effects and milestones

### Power-ups

| Orb | Effect |
|-----|--------|
| **Expand** (Green) | Enlarge your paddle |
| **Shrink** (Red) | Shrink the opponent's paddle |
| **Multiball** (Yellow) | Spawn two extra balls |
| **Magnet** (Purple) | Next hit sticks the ball to your paddle |
| **Time Warp** (Cyan) | Slow the opponent's paddle |

### Easter Egg

Enter the Konami code during gameplay to unlock **Rainbow Mode**.

## Project Structure

```
├── src/
│   ├── main.ts                 # Entry point
│   ├── style.css               # Global styles and neon UI
│   ├── game/
│   │   ├── engine.ts           # Main game loop and state machine
│   │   ├── input.ts            # Keyboard, mouse, and touch input
│   │   ├── audio.ts            # Web Audio sound engine
│   │   ├── constants.ts        # Game constants
│   │   ├── types.ts            # TypeScript interfaces
│   │   ├── powerups.ts         # Power-up manager
│   │   ├── entities/
│   │   │   ├── paddle.ts       # Paddle physics and rendering
│   │   │   ├── ball.ts         # Ball physics and trail rendering
│   │   │   └── ai.ts           # AI controller with trajectory prediction
│   │   └── effects/
│   │       ├── particles.ts    # Particle system
│   │       ├── screenEffects.ts # Screen shake and time dilation
│   │       └── background.ts   # Animated grid background with directional wave
│   └── ui/
│       └── uiManager.ts        # HUD, menus, overlays (DOM-based)
├── public/
│   ├── favicon.svg
│   └── icons.svg
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── README.md
├── CONTRIBUTING.md
└── LICENSE
```

## Configuration

Settings are available from the in-game menu:

- Difficulty (Easy / Medium / Hard)
- Target Score (3 / 5 / 7 / 11)
- Sound, Music, Particles, Screen Shake, Time Dilation, Power-ups, CRT Effect

Settings are saved to `localStorage`.

## License

This work is licensed under a
[Creative Commons Attribution-NonCommercial 4.0 International License](https://creativecommons.org/licenses/by-nc/4.0/).

You are free to:

- **Share** — copy and redistribute the material in any medium or format
- **Adapt** — remix, transform, and build upon the material

Under the following terms:

- **Attribution** — You must give appropriate credit
- **NonCommercial** — You may not use the material for commercial purposes

See the [LICENSE](./LICENSE) file for details.
