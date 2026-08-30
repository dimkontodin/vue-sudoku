<script setup lang="ts">
import { computed, onMounted, shallowRef, watch } from 'vue'
import { useRouter } from 'vue-router'
import { CELLS } from '@vue-sudoku/sudoku-core'
import { boxOf, colOf, rowOf } from '@vue-sudoku/sudoku-core'
import type { Difficulty } from '@vue-sudoku/sudoku-core'
import type { SolveSpeed } from '@vue-sudoku/sudoku-core'
import {
  usePuzzleAnalysis,
  usePuzzleHandoff,
  useSolver,
  useSolverHandoff,
} from '@vue-sudoku/sudoku-core'
import { createSudokuClient } from '@/workers/sudokuClient'

// Solver visualiser: watch the backtracking search run in the worker.
// Intentionally standalone — it renders its own bare grid rather than the
// game's components, because it shows a *search in progress*, which has no
// notion of givens, selection or conflicts.
//
// The puzzle it searches comes from the generator or straight from /enter, and
// the same analysis panel that screen offers sits under the grid here: what the
// brute-force search proves (a solution exists) and what grading explains (how
// a person would get there) are different questions about the same board.

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard', 'expert']
const SPEEDS: SolveSpeed[] = ['slow', 'medium', 'fast', 'instant']

const router = useRouter()
const solver = useSolver(createSudokuClient)
const solverHandoff = useSolverHandoff()
const playHandoff = usePuzzleHandoff()

const puzzle = shallowRef<Uint8Array | null>(null)
const difficulty = shallowRef<Difficulty>('hard')
const speed = shallowRef<SolveSpeed>('fast')
const isGenerating = shallowRef(false)
/** True while the grid on screen came from /enter rather than the generator. */
const isCustom = shallowRef(false)

const analysis = usePuzzleAnalysis(() => puzzle.value)

// A verdict belongs to the grid it was run on, so a new puzzle drops it.
watch(puzzle, () => analysis.reset())

// The live board while solving, falling back to the puzzle when idle.
const cells = computed(() => {
  const source = solver.board.value ?? puzzle.value
  if (!source) return []

  return Array.from({ length: CELLS }, (_, index) => ({
    index,
    value: source[index] ?? 0,
    isClue: (puzzle.value?.[index] ?? 0) !== 0,
    boxShade: boxOf(index) % 2 === 0,
    edgeRight: colOf(index) % 3 === 2 && colOf(index) !== 8,
    edgeBottom: rowOf(index) % 3 === 2 && rowOf(index) !== 8,
  }))
})

async function newPuzzle() {
  // reset(), not cancel(): a finished run has no active request to cancel, so
  // its solved board would otherwise stay on screen over the new puzzle.
  solver.reset()
  isGenerating.value = true
  try {
    const result = await solver.generate(difficulty.value)
    puzzle.value = result.puzzle
    isCustom.value = false
  } finally {
    isGenerating.value = false
  }
}

function startSolve() {
  if (puzzle.value) solver.solve(puzzle.value, speed.value)
}

/** Sends a graded, uniquely-solvable grid on to the game. */
function play() {
  const solution = analysis.validation.value?.solution
  if (!puzzle.value || !analysis.canPlay.value || !solution) return

  playHandoff.set({ puzzle: puzzle.value.slice(), solution: solution.slice() })
  void router.push('/')
}

onMounted(() => {
  // A grid handed over from /enter wins over generating one: the user asked
  // for this puzzle specifically, and it may well be unsolvable or ambiguous,
  // which is exactly what they came here to watch.
  const entered = solverHandoff.take()
  if (entered) {
    puzzle.value = entered
    isCustom.value = true
    return
  }
  void newPuzzle()
})
</script>

<template>
  <section class="game">
    <div class="game__controls">
      <label>
        Difficulty
        <select v-model="difficulty" :disabled="solver.isSolving.value">
          <option v-for="option in DIFFICULTIES" :key="option" :value="option">{{ option }}</option>
        </select>
      </label>

      <label>
        Speed
        <select v-model="speed" :disabled="solver.isSolving.value">
          <option v-for="option in SPEEDS" :key="option" :value="option">{{ option }}</option>
        </select>
      </label>

      <button :disabled="isGenerating || solver.isSolving.value" @click="newPuzzle">
        {{ isGenerating ? 'Generating…' : 'New puzzle' }}
      </button>

      <button v-if="!solver.isSolving.value" :disabled="!puzzle" @click="startSolve">Solve</button>
      <button v-else @click="solver.cancel()">Cancel</button>
    </div>

    <p v-if="isCustom" class="game__source">
      Searching the puzzle you entered.
      <RouterLink to="/enter">Back to editing</RouterLink>
    </p>

    <div class="board" role="grid" aria-label="Sudoku board">
      <div
        v-for="cell in cells"
        :key="cell.index"
        class="board__cell"
        :class="{
          'is-clue': cell.isClue,
          'is-shaded': cell.boxShade,
          'is-edge-right': cell.edgeRight,
          'is-edge-bottom': cell.edgeBottom,
        }"
      >
        {{ cell.value || '' }}
      </div>
    </div>

    <dl class="stats">
      <div>
        <dt>Status</dt>
        <dd>{{ solver.status.value }}</dd>
      </div>
      <div>
        <dt>Steps</dt>
        <dd>{{ solver.steps.value.toLocaleString() }}</dd>
      </div>
      <div>
        <dt>Backtracks</dt>
        <dd>{{ solver.backtracks.value.toLocaleString() }}</dd>
      </div>
      <div>
        <dt>Depth</dt>
        <dd>{{ solver.depth.value }}</dd>
      </div>
      <div>
        <dt>Steps/sec</dt>
        <dd>{{ solver.stepsPerSecond.value.toLocaleString() }}</dd>
      </div>
      <div>
        <dt>Elapsed</dt>
        <dd>{{ Math.round(solver.elapsedMs.value) }} ms</dd>
      </div>
    </dl>

    <p v-if="solver.errorMessage.value" class="error">{{ solver.errorMessage.value }}</p>

    <!--
      The same checks the enter screen offers, on whatever grid is loaded here:
      is it valid, does it have exactly one solution, and which techniques would
      a person need? Brute force answers none of those.
    -->
    <div class="analysis">
      <div class="analysis__actions">
        <button
          type="button"
          :disabled="!puzzle || analysis.isChecking.value"
          @click="analysis.check()"
        >
          {{ analysis.isChecking.value ? 'Analysing…' : 'Analyse puzzle' }}
        </button>
        <button type="button" :disabled="!analysis.canPlay.value" @click="play">Play it</button>
      </div>

      <p
        v-if="analysis.validation.value"
        class="analysis__verdict"
        :class="analysis.validation.value.verdict === 'unique' ? 'is-good' : 'is-bad'"
        role="status"
      >
        {{ analysis.validation.value.message }}
        <span class="analysis__clues">{{ analysis.validation.value.clues }} clues</span>
      </p>

      <div v-if="analysis.grading.value" class="analysis__grading">
        <p>
          Graded <strong>{{ analysis.grading.value.difficulty }}</strong>
          <template v-if="!analysis.grading.value.solved">
            — though it needs techniques beyond this solver, so it may be harder still.
          </template>
        </p>
        <p v-if="analysis.grading.value.techniques.length" class="analysis__techniques">
          Techniques used: {{ analysis.grading.value.techniques.join(', ') }}
        </p>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.game {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $gap-lg;
}

.game__controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: $gap-md;

  label {
    display: flex;
    align-items: center;
    gap: $gap-xs;
    font-size: 0.85rem;
    color: var(--color-text-muted);
  }

  select,
  button {
    padding: $gap-xs $gap-sm;
    border: 1px solid var(--color-border);
    border-radius: $radius-sm;
    background: var(--color-surface-raised);
    color: var(--color-text);
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.game__source {
  margin: -$gap-md 0 0;
  color: var(--color-text-muted);
  font-size: 0.8rem;

  a {
    color: var(--color-primary);
  }
}

.board {
  display: grid;
  grid-template-columns: repeat(9, $cell-size);
  border: $box-line solid var(--color-border-strong);
  background: var(--color-border);
  gap: $grid-line;
}

.board__cell {
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 1;
  background: var(--color-surface-raised);
  font-variant-numeric: tabular-nums;
  font-size: 1.1rem;
  color: var(--color-primary);

  &.is-shaded {
    background: var(--color-surface);
  }

  &.is-clue {
    color: var(--color-text);
    font-weight: 600;
  }

  &.is-edge-right {
    margin-right: $grid-line;
    box-shadow: $grid-line 0 0 var(--color-border-strong);
  }

  &.is-edge-bottom {
    margin-bottom: $grid-line;
    box-shadow: 0 $grid-line 0 var(--color-border-strong);
  }
}

.stats {
  display: flex;
  flex-wrap: wrap;
  gap: $gap-md;
  margin: 0;
  font-size: 0.85rem;

  div {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }

  dt {
    color: var(--color-text-muted);
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  dd {
    margin: 0;
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }
}

.analysis {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $gap-sm;
  width: 100%;
  max-width: $board-width;
}

.analysis__actions {
  display: flex;
  gap: $gap-sm;

  button {
    padding: $gap-xs $gap-md;
    border: 1px solid var(--color-border);
    border-radius: $radius-sm;
    background: var(--color-surface-raised);
    color: var(--color-text);
    font-size: 0.85rem;
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.analysis__verdict {
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

.analysis__clues {
  margin-left: auto;
  opacity: 0.75;
  font-variant-numeric: tabular-nums;
}

.analysis__grading {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  font-size: 0.8rem;

  strong {
    text-transform: capitalize;
  }
}

.analysis__techniques {
  color: var(--color-text-muted);
  font-size: 0.75rem;
}

.error {
  color: var(--color-danger);
}
</style>
