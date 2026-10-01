# vue-sudoku

A free, ad-free Sudoku game built with Vue 3 and TypeScript. It runs in the browser and as an
Android app (Ionic + Capacitor), and everything happens on your device: no backend, no accounts,
no tracking.

**Play it:** <https://dimkontodin.github.io/vue-sudoku/>

## Features

- Puzzles graded by the solving techniques they actually need, not by how many clues they have
- Hints, undo/redo and a timer
- Enter your own puzzle and have it solved and graded
- A solver view that shows how a puzzle is solved
- Stats, and light and dark themes
- Web app and a native-feeling Android app sharing the same engine

## Free and ad-free, forever

This is a hobby project. It will never have ads, trackers or paywalls. The code is MIT licensed,
so you are welcome to read it, learn from it or fork it. Suggestions and pull requests are
welcome too, see [CONTRIBUTING.md](CONTRIBUTING.md).

## How it works

The rules of Sudoku live in plain TypeScript, not in Vue. Vue only renders state and routes input
into it. It is an Nx monorepo:

```
apps/
  sudoku-web/          the Vue web app
    src/
      workers/         puzzle generation off the main thread, with the next puzzle
                       per difficulty prefetched in the background (app-specific glue)
      components/      dumb presentational SFCs — props down, events up
      views/           GameView is the only "smart" component; it wires everything together
      assets/          _variables.scss (auto-injected) + main.scss (reset & theme tokens)
  sudoku-web-e2e/       Playwright tests for sudoku-web
  sudoku-mobile/        Ionic Vue app — same engine, native-feeling tab-based UI
  sudoku-mobile-e2e/    Playwright tests for sudoku-mobile
libs/
  sudoku-core/          pure TS core (solver, generator, validation, 100% unit-tested) +
                         composables (useSudoku, useHistory, useTimer, …) + the worker protocol,
                         shared by both apps
```

Difficulty is judged by the solving techniques a puzzle needs. The generator digs clues under
each level's technique ceiling and keeps only puzzles that grade at the requested level. See
[docs/solving-techniques.md](docs/solving-techniques.md#grading) for the grading model and
generator, and [docs/hard-puzzles.md](docs/hard-puzzles.md) for the brute-force side of "hard".

SCSS variables from `apps/sudoku-web/src/assets/_variables.scss` are injected into every
stylesheet and `<style lang="scss">` block automatically (see `apps/sudoku-web/vite.config.mts`),
so do not `@use` it manually. Colors are CSS custom properties so light/dark can flip at runtime.

## Development

Install dependencies once:

```sh
pnpm install
```

Run an app:

```sh
pnpm nx serve sudoku-web
pnpm nx serve sudoku-mobile
```

Type-check and build:

```sh
pnpm nx run-many -t build
```

Unit tests ([Vitest](https://vitest.dev/)):

```sh
pnpm nx run-many -t test
```

End-to-end tests ([Playwright](https://playwright.dev)):

```sh
# install browsers on first run
pnpm exec playwright install

pnpm nx run-many -t e2e
```

Lint and format:

```sh
pnpm nx run-many -t lint
pnpm format
```

Open the mobile app in Android Studio:

```sh
pnpm nx run sudoku-mobile:open:android
```

## Deployment

Every push to `main` runs the tests, builds `sudoku-web` and publishes it to GitHub Pages
(see [.github/workflows/deploy-pages.yml](.github/workflows/deploy-pages.yml)). Pages serves the
app from `/vue-sudoku/`, so the workflow sets the `VITE_BASE` environment variable, which
`apps/sudoku-web/vite.config.mts` uses as the base path. To build for Pages locally:

```sh
VITE_BASE=/vue-sudoku/ pnpm nx build sudoku-web
```

## License

[MIT](LICENSE) © Dimitris Kontodinas. The name "vue-sudoku" and the app icon are not licensed
for reuse: if you publish a fork, please give it its own name and icon.

## Recommended IDE setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur) + [Nx Console](https://nx.dev/getting-started/editor-setup).
