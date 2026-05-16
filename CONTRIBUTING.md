# Contributing to Neon Pong

Thanks for your interest in this project! This guide covers how to set up your environment, write code, and submit changes.

## Getting Started

1. **Fork** the repository on GitHub
2. **Clone** your fork locally
3. **Install** dependencies:

```bash
npm install
```

4. **Run** the dev server:

```bash
npm run dev
```

The game will be available at `http://localhost:3000`.

## Development Workflow

- Create a feature branch from `main`
- Make your changes
- Ensure the project builds without errors:

```bash
npm run build
```

- Open a pull request with a clear description of what changed and why

## Code Style

- TypeScript strict mode is enabled — no implicit any
- Use `const` and `let`; avoid `var`
- Prefer named exports over default exports
- Keep functions focused and small
- Use explicit types on public APIs
- Follow the existing project structure when adding new files

## Testing

There is no automated test suite. Changes should be verified by:

1. Running `npm run build` — this runs the TypeScript compiler and Vite build
2. Playing the game manually to confirm:
   - Paddle movement feels smooth (keyboard, touch)
   - Ball physics are consistent
   - AI behaves appropriately at each difficulty level
   - Power-ups spawn and apply correctly
   - Visual effects render properly
   - Audio plays on hits, scores, and power-ups
   - **Portrait mode**: on-screen controls appear correctly, keyboard switches to left/right
   - **Background wave**: flows with ball direction, freezes during pauses

### Testing Portrait Mode

When testing mobile/portrait features:
- Use browser dev tools device emulation or a real mobile device
- Verify on-screen buttons appear on left/right edges, vertically centered
- Verify keyboard controls switch to A/D or Arrow Left/Right
- Verify UI text adapts (e.g., "paddle at the BOTTOM" instead of "on the LEFT")
- Verify scores are positioned at top/bottom centers without overlapping paddles

## Reporting Issues

If you find a bug or have a feature request, please open an issue with:

- A clear description of the problem or idea
- Steps to reproduce (for bugs)
- Expected vs actual behavior (for bugs)
- Browser and OS version (for bugs)
- Device orientation if relevant (landscape vs portrait)

## License

By contributing to this project, you agree that your contributions will be licensed under the same license as the project: [CC BY-NC 4.0](./LICENSE).
