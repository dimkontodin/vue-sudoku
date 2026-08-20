# vue-sudoku

A Sudoku game built with Vue 3 (`<script setup>` SFCs), TypeScript and Vite — written as a
learning project.

## Architecture

The rules of Sudoku live in plain TypeScript, not in Vue. Vue only renders state and routes input
into it.

```
src/
  core/          pure TS — no Vue imports. Solver, generator, validation. 100% unit-tested.
  workers/       puzzle generation off the main thread
  composables/   reactive state + orchestration (useSudoku, useHistory, useTimer, …)
  components/    dumb presentational SFCs — props down, events up
  views/         GameView is the only "smart" component; it wires everything together
  assets/        _variables.scss (auto-injected) + main.scss (reset & theme tokens)
```

SCSS variables from `src/assets/_variables.scss` are injected into every stylesheet and
`<style lang="scss">` block automatically (see `vite.config.ts`) — do not `@use` it manually.
Colors are CSS custom properties so light/dark can flip at runtime.

## Project Setup

```sh
pnpm install
```

### Develop

```sh
pnpm dev
```

### Type-check, build

```sh
pnpm build
```

### Unit tests ([Vitest](https://vitest.dev/))

```sh
pnpm test:unit
```

### End-to-end tests ([Playwright](https://playwright.dev))

```sh
# install browsers on first run
npx playwright install

pnpm test:e2e
```

### Lint & format

```sh
pnpm lint
pnpm format
```

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).
