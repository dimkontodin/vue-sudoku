<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import { useRouter } from 'vue-router'
import { CELLS } from '@vue-sudoku/sudoku-core'
import { useBoardKeyboard } from '@vue-sudoku/sudoku-core'
import { useGridEntry } from '@vue-sudoku/sudoku-core'
import { usePuzzleAnalysis } from '@vue-sudoku/sudoku-core'
import { usePuzzleHandoff, useSolverHandoff } from '@vue-sudoku/sudoku-core'
import SudokuBoard from '@/components/SudokuBoard.vue'

const router = useRouter()
const handoff = usePuzzleHandoff()
const solverHandoff = useSolverHandoff()

const entry = useGridEntry()
const analysis = usePuzzleAnalysis(() => entry.board.value)

const EXAMPLE = '..............3.85..1.2.......5.7.....4...1...9.......5......73..2.1........4...9'
const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const
const emptyNotes = new Uint16Array(CELLS)
const NO_CELLS: ReadonlySet<number> = new Set()

// The same keys as the game, minus the ones a clue grid has no use for. Its
// own guard already ignores keystrokes aimed at the paste box.
useBoardKeyboard(entry)

const showPaste = shallowRef(false)

const parseMessage = computed(() => {
  if (entry.parseError.value === 'characters') return 'Only digits, dots and underscores, please.'
  if (entry.parseError.value === 'length') return `${entry.charCount.value} of ${CELLS} cells.`
  return ''
})

// Re-validating on every keystroke would run a solver per digit, so a check is
// only ever as current as the grid it ran on. Watching the board rather than
// clearing it from each handler catches every route in — pad, keyboard, paste.
watch(entry.board, () => analysis.reset())

function play() {
  const validation = analysis.validation.value
  if (!analysis.canPlay.value || !validation?.solution) return

  handoff.set({
    puzzle: entry.board.value.slice(),
    solution: validation.solution.slice(),
  })
  void router.push('/')
}

/** Hands the grid to the visualiser rather than answering it here. */
function watchSolver() {
  if (!analysis.canSolve.value) return
  solverHandoff.set(entry.board.value)
  void router.push('/solver')
}

function loadExample() {
  entry.text.value = EXAMPLE
}

function clear() {
  entry.clear()
}

const conflicts = computed<ReadonlySet<number>>(() =>
  analysis.validation.value?.verdict === 'conflicting'
    ? analysis.validation.value.conflicts
    : entry.conflicts.value,
)
</script>

<template>
  <section class="enter">
    <p class="enter__intro">
      Click a cell and type, or pick a digit and click every square it belongs in. Arrow keys move,
      0 or Backspace clears. Already have the puzzle as text? Paste it below.
    </p>

    <SudokuBoard
      :board="entry.board.value"
      :notes="emptyNotes"
      :puzzle="entry.board.value"
      :selected-index="entry.selectedIndex.value"
      :highlight-value="entry.highlightValue.value"
      :conflicts="conflicts"
      :incorrect="NO_CELLS"
      @select="entry.onCellTap"
    />

    <div class="pad">
      <button
        v-for="digit in DIGITS"
        :key="digit"
        type="button"
        class="pad__digit"
        :class="{
          'is-active': entry.activeDigit.value === digit,
          'is-exhausted': entry.remainingCounts.value[digit - 1] === 0,
        }"
        :aria-pressed="entry.activeDigit.value === digit"
        :aria-label="`Enter ${digit}, ${entry.remainingCounts.value[digit - 1] ?? 0} left to place`"
        @click="entry.onDigitTap(digit)"
      >
        <span class="pad__digit-value">{{ digit }}</span>
        <span class="pad__digit-count" aria-hidden="true">
          {{ entry.remainingCounts.value[digit - 1] ?? 0 }}
        </span>
      </button>

      <button type="button" class="pad__digit pad__digit--erase" @click="entry.erase()">
        Erase
      </button>
    </div>

    <div class="enter__meta">
      <span :class="{ 'is-ready': entry.clues.value > 0 }">{{ entry.clues.value }} clues</span>
      <span v-if="parseMessage" class="enter__parse">{{ parseMessage }}</span>
      <span class="enter__spacer" />
      <button type="button" class="enter__link" @click="showPaste = !showPaste">
        {{ showPaste ? 'Hide text' : 'Paste or copy' }}
      </button>
      <button type="button" class="enter__link" @click="loadExample">Load an example</button>
      <button type="button" class="enter__link" @click="clear">Clear</button>
    </div>

    <!--
      Bound straight to the grid both ways: typing here rewrites the board, and
      editing the board rewrites this. useGridEntry owns that loop.
    -->
    <textarea
      v-if="showPaste"
      v-model="entry.text.value"
      class="enter__input"
      rows="3"
      spellcheck="false"
      autocapitalize="off"
      autocomplete="off"
      aria-label="Puzzle as 81 characters"
      placeholder="..............3.85..1.2......."
    />

    <div class="enter__actions">
      <button
        type="button"
        class="enter__button"
        :disabled="entry.isEmpty.value || analysis.isChecking.value"
        @click="analysis.check()"
      >
        {{ analysis.isChecking.value ? 'Checking…' : 'Check puzzle' }}
      </button>

      <button
        type="button"
        class="enter__button"
        :disabled="!analysis.canSolve.value"
        @click="watchSolver"
      >
        Watch the solver
      </button>

      <button
        type="button"
        class="enter__button is-primary"
        :disabled="!analysis.canPlay.value"
        @click="play"
      >
        Play it
      </button>
    </div>

    <p
      v-if="analysis.validation.value"
      class="enter__verdict"
      :class="analysis.validation.value.verdict === 'unique' ? 'is-good' : 'is-bad'"
      role="status"
    >
      {{ analysis.validation.value.message }}
      <span class="enter__clues">{{ analysis.validation.value.clues }} clues</span>
    </p>

    <div v-if="analysis.grading.value" class="enter__grading">
      <p>
        Graded <strong>{{ analysis.grading.value.difficulty }}</strong>
        <template v-if="!analysis.grading.value.solved">
          — though it needs techniques beyond this solver, so it may be harder still.
        </template>
      </p>
      <p v-if="analysis.grading.value.techniques.length" class="enter__techniques">
        Techniques used: {{ analysis.grading.value.techniques.join(', ') }}
      </p>
    </div>

    <p v-else-if="analysis.canSolve.value" class="enter__techniques">
      No grade — grading needs a single solution. The solver will still search it.
    </p>
  </section>
</template>

<style scoped lang="scss">
.enter {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $gap-md;
  width: 100%;
  max-width: $board-width;
}

.enter__intro {
  color: var(--color-text-muted);
  font-size: 0.82rem;
  line-height: 1.5;
}

.enter__input {
  width: 100%;
  padding: $gap-sm;
  border: 1px solid var(--color-border);
  border-radius: $radius-sm;
  background: var(--color-surface-raised);
  color: var(--color-text);
  font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  font-size: 0.8rem;
  line-height: 1.6;
  resize: vertical;

  &:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: -1px;
  }
}

// Ten keys on one row: the nine digits plus Erase, sized off the board width
// so the pad lines up with the grid above it.
.pad {
  display: grid;
  grid-template-columns: repeat(10, 1fr);
  gap: $gap-xs;
  width: 100%;
}

.pad__digit {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  padding: $gap-xs 0;
  border: 1px solid var(--color-border);
  border-radius: $radius-sm;
  background: var(--color-surface-raised);
  font-variant-numeric: tabular-nums;

  &:hover {
    border-color: var(--color-primary);
  }

  // Armed for digit-first entry: every cell clicked now takes this digit.
  &.is-active {
    border-color: var(--color-primary);
    background: var(--color-primary);
    color: var(--color-primary-contrast);
    font-weight: 600;
  }

  // All nine placed. Still clickable — it is a legal way to take one back out.
  &.is-exhausted:not(.is-active) {
    opacity: 0.45;
  }
}

.pad__digit--erase {
  justify-content: center;
  font-size: 0.7rem;
  letter-spacing: 0.02em;
}

.pad__digit-value {
  font-size: 1.2rem;
  line-height: 1;
}

.pad__digit-count {
  color: var(--color-text-muted);
  font-size: 0.6rem;
  line-height: 1;
}

.pad__digit.is-active .pad__digit-count {
  color: inherit;
  opacity: 0.8;
}

.enter__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: $gap-sm;
  width: 100%;
  color: var(--color-text-muted);
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;

  .is-ready {
    color: var(--color-primary);
    font-weight: 600;
  }
}

.enter__spacer {
  flex: 1;
}

.enter__parse {
  color: var(--color-danger);
}

.enter__link {
  border: 0;
  background: none;
  color: var(--color-primary);
  font: inherit;
  text-decoration: underline;
}

.enter__actions {
  display: flex;
  gap: $gap-sm;
  width: 100%;
}

.enter__button {
  flex: 1;
  padding: $gap-sm;
  border: 1px solid var(--color-border);
  border-radius: $radius-sm;
  background: var(--color-surface-raised);
  font-size: 0.85rem;

  &.is-primary:not(:disabled) {
    border-color: var(--color-primary);
    background: var(--color-primary);
    color: var(--color-primary-contrast);
    font-weight: 600;
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}

.enter__verdict {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: $gap-sm;
  width: 100%;
  padding: $gap-sm $gap-md;
  border-radius: $radius-sm;
  font-size: 0.85rem;

  &.is-good {
    background: color-mix(in srgb, var(--color-primary) 14%, var(--color-surface));
    color: var(--color-primary);
  }

  &.is-bad {
    background: color-mix(in srgb, var(--color-danger) 14%, var(--color-surface));
    color: var(--color-danger);
  }
}

.enter__clues {
  margin-left: auto;
  opacity: 0.75;
  font-variant-numeric: tabular-nums;
}

.enter__grading {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  font-size: 0.8rem;

  strong {
    text-transform: capitalize;
  }
}

.enter__techniques {
  width: 100%;
  color: var(--color-text-muted);
  font-size: 0.75rem;
}
</style>
