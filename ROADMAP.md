# Sudoku — Build Roadmap

Progress tracker. Tick boxes as you go. Each phase ends with a **Gate** — don't move on until it
passes.

**Guiding rule:** the rules of Sudoku live in `src/core/` as plain TypeScript with zero Vue
imports. Vue only renders that state and routes input into it.

---

## Phase 0 — Cleanup ✅

- [x] Delete demo components (`HelloWorld`, `TheWelcome`, `WelcomeItem`, `icons/`, demo spec)
- [x] Delete `logo.svg`, `HomeView.vue`, `AboutView.vue`, `base.css`, `main.css`
- [x] Rewrite `App.vue` as a shell (title + nav + `<RouterView>`)
- [x] Rewrite `router/index.ts` — `/` → GameView, `/stats` → lazy StatsView
- [x] New `assets/main.scss` (reset + light/dark CSS custom properties)
- [x] Extend `assets/_variables.scss` with structural tokens
- [x] `index.html` — title + `lang="en"`
- [x] Replace `e2e/vue.spec.ts` with `e2e/game.spec.ts`
- [x] Rewrite `README.md`
- [x] Remove `@vitejs/plugin-vue-jsx` from `package.json` + `vite.config.ts`
- [x] `passWithNoTests: true` in `vitest.config.ts` (temporary — remove once phase 1 lands)

**Gate:** ✅ `type-check`, `build`, `lint`, `test:unit` pass; dev server boots with a clean console.

---

## Phase 1 — The engine (`src/core/`), test-first

No Vue. No `.vue` files. This is where Vitest earns its place.

- [ ] `core/constants.ts` — `SIZE = 9`, `BOX = 3`, `CELLS = 81`, `DIFFICULTY_CLUES`
- [ ] `core/types.ts` — `Difficulty`, `Board`, `Puzzle`, `GameSnapshot`
- [ ] `core/grid.ts` — `rowOf`/`colOf`/`boxOf`, precomputed `PEERS: number[][]`
  - [ ] test: every cell has exactly 20 peers
  - [ ] test: peer relationships are symmetric
- [ ] `core/notes.ts` — bitmask helpers (`toggleNote`, `hasNote`, `notesToArray`)
  - [ ] test: round-trip toggle, multiple notes per cell
- [ ] `core/validate.ts` — `conflictsIn(board): Set<number>`, `isComplete(board)`
  - [ ] test: hand-written boards with row / column / box conflicts
- [ ] `core/solver.ts` — backtracking + MRV heuristic; `countSolutions(board, limit = 2)`
  - [ ] test: solves a known puzzle to its known solution
  - [ ] test: detects a multi-solution board (returns 2)
  - [ ] test: returns 0 for an unsolvable board
- [ ] `core/generator.ts` — randomized fill, then remove clues while `countSolutions === 1`
  - [ ] test: output always has a unique solution
  - [ ] test: puzzle is a subset of its solution
  - [ ] test: clue count matches the requested difficulty band
- [ ] Remove `passWithNoTests` from `vitest.config.ts`

**Gate:** `pnpm test:unit` green with real coverage of `core/`, without a single `.vue` file.

---

## Phase 2 — Web Worker

- [ ] `workers/sudoku.worker.ts` — `{ type: 'generate', difficulty, requestId }` in, puzzle out
- [ ] `workers/generatorClient.ts` — `new Worker(new URL('./sudoku.worker.ts', import.meta.url), { type: 'module' })`
- [ ] Match responses by `requestId`; expose `generatePuzzle(difficulty): Promise<Puzzle>`
- [ ] Synchronous fallback when `Worker` is unavailable (also keeps jsdom tests painless)
- [ ] Loading spinner in `GameView` while generating

**Gate:** generating an expert puzzle never freezes the UI — the spinner keeps animating throughout.

---

## Phase 3 — Composables

- [ ] `composables/useSudoku.ts` — `board`, `puzzle`, `solution`, `notes`, `selectedIndex`
  - [ ] `setValue`, `toggleNote`, `erase`, `select`
  - [ ] computed `conflicts`, `isSolved`, `remainingCounts`
  - [ ] given cells are immutable — enforced in exactly one place
  - [ ] ⚠️ typed arrays aren't deeply reactive — use `shallowRef` + reassign
- [ ] `composables/useHistory.ts` — generic `push`/`undo`/`redo`/`canUndo`/`canRedo`, diff-based
- [ ] Route every mutation in `useSudoku` through one internal `applyChange()`
- [ ] `composables/useTimer.ts` — `elapsed`, `start`/`pause`/`reset`, cleanup in `onScopeDispose`
  - [ ] auto-pause on `visibilitychange`
- [ ] `composables/useBoardKeyboard.ts` — arrows, `1-9`, `Backspace`/`Delete`, `n` for note mode
- [ ] tests: drive a full game through the composables with zero rendering

**Gate:** a complete game can be played in tests without mounting a single component.

---

## Phase 4 — Components & first playable

Build bottom-up.

- [ ] `components/SudokuCell.vue` — dumb: `value`, `notes`, `isGiven`, `isSelected`, `hasConflict` → emits `select`
  - [ ] notes render as a 3×3 mini-grid
- [ ] `components/SudokuBoard.vue` — CSS Grid; 3×3 box borders via `nth-child`, no wrapper divs
- [ ] Cell state classes: `.is-given`, `.is-selected`, `.is-peer`, `.is-same-value`, `.has-conflict`
- [ ] `components/NumberPad.vue` — 1-9, erase, notes toggle
- [ ] `components/GameStatusBar.vue` — difficulty, timer, mistakes
- [ ] `components/DifficultyPicker.vue`
- [ ] `views/GameView.vue` — wire the composables to the components
- [ ] Accessibility: `role="grid"`, focusable cells, positional `aria-label`s
- [ ] component test: `SudokuCell` renders the right state classes

**Gate:** fully playable — generate, click/type, notes, conflict highlighting, win detection.

---

## Phase 5 — Remaining features

- [ ] **Undo/redo** — buttons + `Ctrl+Z` / `Ctrl+Y` (logic already exists from phase 3)
- [ ] **Hints** — reveal correct digit from `solution`, count hints, push through history
- [ ] **Auto-check** — "check" button + optional instant feedback; mistake counter
- [ ] **Persistence** — `useGameStorage`, debounced `watch` → `localStorage`, restore on mount
  - [ ] version the payload (`{ v: 1, ... }`) so format changes don't crash old saves
- [ ] **Stats** — `useStats` records `{ difficulty, timeMs, hintsUsed, date }` per win
- [ ] `views/StatsView.vue` — games played, win rate, best time per difficulty
- [ ] `components/WinDialog.vue` — `<Teleport to="body">` + `<Transition>`
- [ ] `components/GameControls.vue` — new game, undo/redo, hint, check

**Gate:** reload mid-game restores the board, notes and timer exactly.

---

## Phase 6 — The Pinia exercise

Only after the game is complete and green.

- [ ] `pnpm add pinia`, register in `main.ts`
- [ ] Move `useSudoku` + `useTimer` into `stores/game.ts` (setup-store style)
- [ ] Keep `useHistory` a plain composable — the contrast *is* the lesson
- [ ] Update tests: import changes + `setActivePinia(createPinia())`
- [ ] Confirm `src/core/` needed zero changes — that's the payoff for phase 1's discipline

---

## Verification

```bash
pnpm lint && pnpm type-check && pnpm test:unit --run && pnpm build
```

- [ ] `pnpm dev` — play a full game on each difficulty: keyboard + mouse, notes, undo/redo, hint, check, win
- [ ] Reload mid-game — board and timer restore
- [ ] `pnpm test:e2e` — 81 cells render, typing a digit shows it, invalid entry gets a conflict class
- [ ] Perf: expert generation stays off the main thread (no long tasks in the Performance tab)

---

## Commit sequence

1. [x] `chore: strip create-vue demo scaffold`
2. [ ] `feat(core): sudoku types, grid helpers, validation + tests`
3. [ ] `feat(core): backtracking solver and unique-puzzle generator + tests`
4. [ ] `feat(workers): offload generation to a web worker`
5. [ ] `feat(composables): useSudoku, useHistory, useTimer, keyboard`
6. [ ] `feat(ui): board, cell, number pad, game view`
7. [ ] `feat: hints, auto-check, persistence, stats`
8. [ ] `refactor(state): move game state into a pinia store`
