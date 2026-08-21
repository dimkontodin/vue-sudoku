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

## Phase 1 — The engine (`src/core/`), test-first ✅

No Vue. No `.vue` files. This is where Vitest earns its place.

- [x] `core/constants.ts` — `SIZE`, `BOX_SIZE`, `CELLS`, `DIFFICULTY_CLUES`
- [x] `core/types.ts` — `Difficulty`, `Board`, `Notes`, `Puzzle`
- [x] `core/grid.ts` — `rowOf`/`colOf`/`boxOf`/`indexAt`, precomputed `PEERS`
- [x] `core/notes.ts` — bitmask helpers (`toggleNote`, `hasNote`, `notesToArray`)
- [x] `core/validate.ts` — `conflictsIn(board): Set<number>`, `isComplete(board)`
- [x] `core/solver.ts` — backtracking + MRV; `countSolutions(board, limit, nodeBudget)`
- [x] `core/generator.ts` — dig-holes generation with uniqueness checking
- [x] Remove `passWithNoTests` from `vitest.config.ts`

**Gate:** ✅ 54 tests green in ~260ms, no `.vue` files involved.

### Things learned the hard way

- **The solver assumed valid input.** `findMrvCell` only derives candidates for
  *empty* cells, so it could not see two identical clues in the same row. On a
  contradictory board it explored the entire space before failing — turning a
  ~1ms rejection into a multi-minute hang that looked like a broken test runner.
  Fixed with an up-front `conflictsIn()` guard in both `solve()` and
  `countSolutions()`; there is a regression test asserting it returns in <100ms.
- **Vitest was defaulting to `jsdom`** for pure-TS specs, costing ~60s of
  environment startup. Now `environment: 'node'`; component specs will opt in
  per-file with a `// @vitest-environment jsdom` docblock.
- **`noUncheckedIndexedAccess` is on** in `tsconfig.app.json`, so every indexed
  read is `T | undefined`. Worth keeping — it caught real gaps.

---

## Phase 2 — Web Worker + live progress streaming ✅

Pulled forward, and scoped up: the worker does not just keep the UI unblocked,
it *streams the search* so it can be watched.

- [x] `core/solver.ts` — `solveSteps()`, a generator yielding `place`/`backtrack`
      steps via `yield*` delegation. Kept separate from the fast `solve()`, which
      pays nothing for instrumentation.
- [x] `workers/protocol.ts` — typed `WorkerRequest`/`WorkerResponse` + speed presets
- [x] `workers/solveRunner.ts` — paced batch loop, shared by worker and fallback
- [x] `workers/sudoku.worker.ts` — thin dispatcher over `core/`
- [x] `workers/sudokuClient.ts` — `new URL(..., import.meta.url)`, `requestId`
      matching, cancellation, and a main-thread fallback when `Worker` is absent
- [x] `composables/useRafCoalesced.ts` — one commit per animation frame
- [x] `composables/useSolver.ts` — reactive `board`/`steps`/`backtracks`/`depth`/rate
- [x] `views/GameView.vue` — temporary harness to watch it run (Phase 4 replaces it)

**Gate:** ✅ measured across speeds on one expert puzzle — identical search
(267 steps, 105 backtracks) at every speed, with the message rate bounded by
the preset rather than by solver speed:

| speed | progress msgs | elapsed | avg gap |
| --- | --- | --- | --- |
| `slow` | 133 | 5410ms | 41ms |
| `fast` | 1 | 17ms | — |
| `instant` | 0 | 0ms | — |

### The throttling design (the RxJS question)

Two independent stages, because they solve different problems:

1. **Worker side — emit rate.** `SPEED_PRESETS` sets `stepsPerTick` (batch size)
   and `tickMs` (pause between batches). Posting per step would mean millions of
   structured clones a second; the clone alone would dwarf the solving.
2. **Main thread — commit rate.** `useRafCoalesced` keeps only the newest value
   per animation frame. The screen cannot show more than one state per frame, so
   anything beyond that is reactivity and re-rendering thrown away.

RxJS mapping, for reference:

| RxJS | here |
| --- | --- |
| `Observable` | worker messages |
| `BehaviorSubject` | `ref` / `shallowRef` |
| `subscribe()` | `push()` in the message handler |
| `auditTime(0, animationFrameScheduler)` | `useRafCoalesced` |
| `map()` | `computed()` |
| `takeUntil(destroy$)` | `onScopeDispose()` |

Note `requestAnimationFrame` is paused entirely while a tab is hidden (verified:
0 frames/sec). That is why terminal events call `flush()` — otherwise a solve
finishing in a background tab would never show its result.

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
2. [x] `feat(core): sudoku types, grid helpers, validation + tests`
3. [x] `feat(core): backtracking solver and unique-puzzle generator + tests`
4. [x] `feat(workers): offload generation to a web worker`
5. [ ] `feat(composables): useSudoku, useHistory, useTimer, keyboard`
6. [ ] `feat(ui): board, cell, number pad, game view`
7. [ ] `feat: hints, auto-check, persistence, stats`
8. [ ] `refactor(state): move game state into a pinia store`
