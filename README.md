# vue-sudoku

A Sudoku game built with Vue 3 (`<script setup>` SFCs), TypeScript and Vite — written as a
learning project. Now an Nx monorepo: the same core engine and reactive state power both a Vue
web app and an Ionic Vue mobile app.

## Architecture

The rules of Sudoku live in plain TypeScript, not in Vue. Vue only renders state and routes input
into it.

```
apps/
  sudoku-web/          the original Vue web app
    src/
      workers/         puzzle generation off the main thread (app-specific glue)
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

SCSS variables from `apps/sudoku-web/src/assets/_variables.scss` are injected into every
stylesheet and `<style lang="scss">` block automatically (see `apps/sudoku-web/vite.config.mts`)
— do not `@use` it manually. Colors are CSS custom properties so light/dark can flip at runtime.

## Project Setup

```sh
pnpm install
```

### Develop

```sh
npx nx serve sudoku-web
npx nx serve sudoku-mobile
```

### Type-check, build

```sh
npx nx run-many -t build
```

### Unit tests ([Vitest](https://vitest.dev/))

```sh
npx nx run-many -t test
```

### End-to-end tests ([Playwright](https://playwright.dev))

```sh
# install browsers on first run
npx playwright install

npx nx run-many -t e2e
```

### Lint & format

```sh
npx nx run-many -t lint
pnpm format
```

### Mobile: open in Android Studio

```sh
npx nx run sudoku-mobile:open:android
```

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur) + [Nx Console](https://nx.dev/getting-started/editor-setup).
