# AGENTS.md

## Cursor Cloud specific instructions

This is a **Turbo Kart** — a browser-based 3D kart/F1 racing game built as a single-page React app on the Base44 platform. It is frontend-only; there is no backend or database in this repo.

### Running the app

- **`npm run dev:local`** — starts Vite on port 5180 without the Base44 plugin. Best for local/cloud development without Base44 credentials.
- **`npm run dev`** — starts Vite with the Base44 plugin (requires `VITE_BASE44_APP_ID` and `VITE_BASE44_APP_BASE_URL` env vars).

### Lint / Typecheck / Build

- **`npm run lint`** — ESLint (flat config). Scoped to `src/components/**` and `src/pages/**` only (excludes `src/lib/`, `src/components/ui/`).
- **`npm run typecheck`** — TypeScript via `tsc -p jsconfig.json` with `checkJs`. Pre-existing type errors from Three.js library types are expected and not regressions.
- **`npm run build`** — Vite production build.

### Known cloud environment caveats

- **WebGL requires software rendering** in the cloud VM (no GPU). To enable WebGL for the Three.js game engine, install Mesa EGL libraries and launch Chrome with SwiftShader:
  ```
  sudo apt-get install -y libegl1 libegl-mesa0 libgbm1
  google-chrome --enable-unsafe-swiftshader --use-gl=angle --use-angle=swiftshader --enable-webgl --ignore-gpu-blocklist <url>
  ```
  This enables full 3D rendering (car selection, race scene, HUD) via software WebGL. Performance is adequate for testing but slower than GPU-accelerated rendering.
