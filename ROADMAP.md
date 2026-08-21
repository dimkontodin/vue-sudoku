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

## Phase 3 — Composables ✅

- [x] `composables/useHistory.ts` — generic `push`/`undo`/`redo`/`canUndo`/`canRedo`,
      opaque entries, capped at 200 by default
- [x] `composables/useSudoku.ts` — `board`, `notes`, `puzzle`, `solution`,
      `selectedIndex`, `noteMode`
  - [x] `setValue`, `toggleNote`, `inputDigit`, `erase`, `reveal`, `select`, `moveSelection`
  - [x] computed `conflicts`, `isSolved`, `remainingCounts`, `selectedValue`
  - [x] given cells immutable — enforced by one `isGiven()` check per action
  - [x] every mutation routed through a single `commit()`
- [x] `composables/useTimer.ts` — `elapsedMs`, `formatted`, start/pause/reset/toggle,
      `setElapsed` for restoring a saved game, auto-pause on tab hide
- [x] `composables/useBoardKeyboard.ts` — arrows, `1-9`, `Backspace`/`Delete`/`0`,
      `n`, `Escape`, `Ctrl+Z` / `Ctrl+Shift+Z` / `Ctrl+Y`
- [x] tests: 105 total, a full generated puzzle played to solved with nothing rendered

**Gate:** ✅ 105 tests green in ~810ms. Only the keyboard spec loads jsdom
(via a `// @vitest-environment jsdom` docblock) and it accounts for ~530ms of
that on its own — the per-file opt-in from Phase 1 paying off.

### Design decisions worth remembering

- **A `Move` is an array of cell changes, not one change.** Placing a digit also
  strips that digit from the notes of all 20 peers; undo has to revert the whole
  batch atomically. Hints reuse the same shape, and so will anything else that
  touches several cells at once.
- **`shallowRef` + clone-on-write, never `reactive()`.** Vue's deep reactivity
  proxies objects, and a proxied `Uint8Array` breaks outright — its methods rely
  on internal slots a `Proxy` does not forward. `shallowRef` never proxies its
  value, so cloning 81 bytes per keystroke is what makes reactivity work at all
  here. This is the reactivity caveat the plan warned about, met head-on.
- **State is returned as `Readonly<ShallowRef<T>>` by cast only**, with no runtime
  `readonly()` — wrapping the board at runtime would reintroduce exactly the
  proxy problem above.
- **`useHistory` stays a plain composable and stores opaque entries.** It hands
  a `Move` back and lets the caller apply or revert it, which is what keeps it
  reusable for anything. Contrast with Phase 6, where shared game state moves
  into a store but this does not.
- **The timer derives elapsed time from wall-clock timestamps**, not by counting
  ticks, so a throttled interval changes only the refresh rate, never the value.
- **`Array.prototype.at()` is unavailable**: `tsconfig.vitest.json` sets
  `lib: []`, so ES2022 methods are out of scope for anything reachable from a
  spec. Plain indexing plus `noUncheckedIndexedAccess` gives the same result.

Not yet wired into the UI — `GameView.vue` is still the Phase 2 solver harness.
That is Phase 4's job; the gate here was proven by tests instead.

### Fixed after Phase 3

- **Stale solved board.** Solving once then pressing "New puzzle" kept the old
  solved grid on screen. `useSolver` held the final `progress` forever, and
  `cancel()` returns early when no request is active, so nothing cleared it.
  Added `useSolver.reset()` and called it from `newPuzzle()`. Three regression
  tests in `useSolver.spec.ts` cover it (verified failing before the fix).
- **Fallback could call back synchronously.** With no `Worker`, a fast solve
  finished inside the first batch before `runSolve` hit any `await`, so
  completion nulled `activeRequestId` *before* `solve()` returned its id. The
  fallback now defers to a microtask, matching worker semantics exactly.
- **Modern JS enabled.** `tsconfig.app.json` and `tsconfig.vitest.json` now set
  `lib: ["ESNext", "DOM", "DOM.Iterable"]`. @vue/tsconfig pins ES2022 and
  create-vue left the vitest config at `lib: []`, which silently dropped
  ES2022+ built-ins from any file a spec imported.
- **Dev server port.** `.claude/launch.json` sets `autoPort: true` and
  `vite.config.ts` honours `process.env.PORT`, so a busy 5173 is no longer fatal.

---

## Phase 4 — Components & first playable ✅

Built bottom-up.

- [x] `components/SudokuCell.vue` — dumb: `value`, `notes`, `isGiven`, `isSelected`,
      `isPeer`, `isSameValue`, `hasConflict` in, `select` out
  - [x] notes render as a 3×3 mini-grid
- [x] `components/SudokuBoard.vue` — CSS Grid; box separators via `nth-child`, no wrappers
- [x] Cell state classes: `.is-given`, `.is-selected`, `.is-peer`, `.is-same-value`, `.has-conflict`
- [x] `components/NumberPad.vue` — 1-9 with remaining counts, notes toggle, undo/redo, erase
- [x] `components/GameStatusBar.vue` — difficulty, click-to-pause timer, (mistakes in Phase 5)
- [x] `components/DifficultyPicker.vue` — `defineModel`, so the parent just writes `v-model`
- [x] `views/GameView.vue` — the only smart component; wires composables to components
- [x] Accessibility: cells are real buttons with positional `aria-label`s and `aria-pressed`
- [x] `SudokuCell.spec.ts` — 19 tests covering state classes, notes, aria and emits

The Phase 2 solver harness moved to `views/SolverView.vue` at `/solver` rather than
being deleted — it visualises a *search*, which has no notion of givens or selection,
so it keeps its own bare grid.

**Gate:** ✅ verified in the browser — 81 cells, 40 givens on easy, exactly 20 peers
highlighted, conflicts flagged live, notes render, undo/redo work, arrow keys move,
and solving the grid shows "Solved in 0:22" with the timer stopped. New game after a
win clears the banner and resets the clock. 133 tests green.

### Things learned the hard way

- **Sass cannot add `rem` and `px`.** `$cell-size * 9 + $grid-line * 8` hard-errors,
  and the dev server kept serving stale CSS instead of surfacing it — the measurement
  simply did not change. Only `pnpm build` showed the error. `$board-width` now uses
  `calc()` so the browser resolves the mixed units.
- **Width alone does not separate the boxes.** With gap-painted grid lines every line
  is the same colour, so a 3px box line next to a 1px grid line is nearly invisible.
  The separators are now drawn with `box-shadow` in `--color-border-strong`; a border
  would have eaten into the cell's own width and misaligned the columns.
- **Parent scoped styles need `:deep()` to reach a child component's root.**
  `.board :deep(.cell)` is what makes the `nth-child` box rules apply to `SudokuCell`.
- **The cell stays dumb even about givens.** It emits `select` when a given is clicked
  and lets `useSudoku` refuse the edit, rather than knowing the rule itself. There is a
  test asserting exactly that.

---

## Phase 5 — Remaining features ✅

- [x] **Undo/redo** — buttons plus `Ctrl+Z` / `Ctrl+Shift+Z` / `Ctrl+Y` (logic from Phase 3)
- [x] **Hints** — `reveal()` fills the correct digit, counts toward `hintsUsed`,
      and is undoable like any other move
- [x] **Auto-check** — a Check button for a one-off look, plus a persistent
      Auto-check mode; `mistakes` counts every wrong digit entered
- [x] **Persistence** — `useGameStorage`, debounced 400ms, versioned payload,
      restored on mount
- [x] **Stats** — `useStats` records `{ difficulty, timeMs, hintsUsed, mistakes, date }`
- [x] `views/StatsView.vue` — totals, per-difficulty table, recent wins, clear
- [x] `components/WinDialog.vue` — `<Teleport to="body">` + `<Transition>`, focus moved
      into the dialog on open, reduced-motion respected
- [x] `components/GameControls.vue` — hint, check, auto-check, restart
- [x] `utils/storage.ts` — defensive JSON localStorage shared by both composables

**Gate:** ✅ verified in the browser with a real page reload — board, notes,
mistakes, hints and difficulty all restored; timer restore confirmed separately
by injecting a known elapsed time (2:05 in, 2:10 after ~5s running). Stats
showed 4 started / 3 won / 75% after winning three and abandoning one.
170 tests green.

### Things learned the hard way

- **The debounced save raced the win handler.** Winning called `storage.clear()`,
  then the save scheduled by that same final move landed 400ms later and wrote
  the solved board straight back. The completed-board guard in `restore()` hid it
  from the user entirely — the only symptom was stale data sitting in storage
  forever. Fixed by cancelling the pending timer and by refusing to persist once
  `hasWon` is set. **A debounced write needs an explicit cancel on every path
  that invalidates it.**
- **`winRate` clamped a nonsense value instead of fixing it.** With wins but no
  recorded starts (win a restored game after clearing stats) it reported
  "2 wins, 0%". The denominator is now `max(started, won)`, so the rate is ≤ 1
  by construction rather than by `Math.min`.
- **Storage validation is not optional.** Every field is checked on read —
  wrong version, wrong array length, unknown difficulty and missing keys all
  degrade to "no saved game". A stored payload is untrusted input written by an
  older version of your own code.
- **History is deliberately not persisted.** A move stack only means something
  against the board it was recorded on; restoring it would let undo run past
  the point the save was taken.
- **The console errors during development were HMR artifacts**, not runtime bugs
  — verified by reloading clean and repeating every navigation, including
  unmounting the teleported dialog mid-route-change. Zero errors.

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
5. [x] `feat(composables): useSudoku, useHistory, useTimer, keyboard`
6. [x] `feat(ui): board, cell, number pad, game view`
7. [x] `feat: hints, auto-check, persistence, stats`
8. [ ] `refactor(state): move game state into a pinia store`
