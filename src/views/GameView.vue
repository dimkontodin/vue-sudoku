<script setup lang="ts">
import { computed, onMounted, shallowRef } from 'vue';
import { CELLS } from '@/core/constants';
import { boxOf, colOf, rowOf } from '@/core/grid';
import type { Difficulty } from '@/core/types';
import type { SolveSpeed } from '@/workers/protocol';
import { useSolver } from '@/composables/useSolver';

// Phase 2 harness: enough UI to watch the worker stream a solve.
// Phase 4 replaces this with real SudokuBoard / SudokuCell components.

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard', 'expert'];
const SPEEDS: SolveSpeed[] = ['slow', 'medium', 'fast', 'instant'];

const solver = useSolver();

const puzzle = shallowRef<Uint8Array | null>(null);
const difficulty = shallowRef<Difficulty>('hard');
const speed = shallowRef<SolveSpeed>('fast');
const isGenerating = shallowRef(false);

// The live board while solving, falling back to the puzzle when idle.
const cells = computed(() => {
  const source = solver.board.value ?? puzzle.value;
  if (!source) return [];

  return Array.from({ length: CELLS }, (_, index) => ({
    index,
    value: source[index] ?? 0,
    isClue: (puzzle.value?.[index] ?? 0) !== 0,
    boxShade: boxOf(index) % 2 === 0,
    edgeRight: colOf(index) % 3 === 2 && colOf(index) !== 8,
    edgeBottom: rowOf(index) % 3 === 2 && rowOf(index) !== 8,
  }));
});

async function newPuzzle() {
  solver.cancel();
  isGenerating.value = true;
  try {
    const result = await solver.generate(difficulty.value);
    puzzle.value = result.puzzle;
  } finally {
    isGenerating.value = false;
  }
}

function startSolve() {
  if (puzzle.value) solver.solve(puzzle.value, speed.value);
}

onMounted(newPuzzle);
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

.error {
  color: var(--color-danger);
}
</style>
