<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import { useRouter } from 'vue-router'
import { CELLS } from '@sudoku-web/sudoku-core'
import { parseBoard, validatePuzzle, type Validation } from '@sudoku-web/sudoku-core'
import { solveLogically } from '@sudoku-web/sudoku-core'
import { TECHNIQUE_META } from '@sudoku-web/sudoku-core'
import { usePuzzleHandoff } from '@sudoku-web/sudoku-core'
import SudokuBoard from '@/components/SudokuBoard.vue'

const router = useRouter()
const handoff = usePuzzleHandoff()

const text = ref('')
const validation = shallowRef<Validation | null>(null)
const isChecking = shallowRef(false)

const parsed = computed(() => parseBoard(text.value))

const board = computed(() => parsed.value.board ?? new Uint8Array(CELLS))
const emptyNotes = new Uint16Array(CELLS)
const NO_CELLS: ReadonlySet<number> = new Set()

const charCount = computed(() => text.value.replace(/\s/g, '').length)

const parseMessage = computed(() => {
  if (text.value.trim() === '') return ''
  if (parsed.value.error === 'characters') return 'Only digits, dots and underscores, please.'
  if (parsed.value.error === 'length') return `${charCount.value} of ${CELLS} cells.`
  return ''
})

/** Grades an accepted puzzle by which techniques it actually needs. */
const grading = computed(() => {
  if (validation.value?.verdict !== 'unique' || !parsed.value.board) return null

  const result = solveLogically(parsed.value.board, { allowUniquenessTechniques: true })
  const names = [...result.used]
    .map((id) => TECHNIQUE_META[id])
    .sort((a, b) => a.tier - b.tier || a.score - b.score)
    .map((meta) => meta.name)

  return { difficulty: result.difficulty, solved: result.solved, names }
})

// Re-validating on every keystroke would run a solver per character.
watch(text, () => {
  validation.value = null
})

function check() {
  if (!parsed.value.board) return
  isChecking.value = true
  try {
    validation.value = validatePuzzle(parsed.value.board)
  } finally {
    isChecking.value = false
  }
}

function play() {
  if (validation.value?.verdict !== 'unique' || !parsed.value.board || !validation.value.solution) {
    return
  }

  handoff.set({
    puzzle: parsed.value.board.slice(),
    solution: validation.value.solution.slice(),
  })
  void router.push('/')
}

function loadExample() {
  text.value = '..............3.85..1.2.......5.7.....4...1...9.......5......73..2.1........4...9'
}

function clear() {
  text.value = ''
  validation.value = null
}

const conflicts = computed<ReadonlySet<number>>(() => validation.value?.conflicts ?? NO_CELLS)
</script>

<template>
  <section class="enter">
    <p class="enter__intro">
      Paste or type a puzzle: 81 cells, row by row, using a dot or zero for blanks. Whitespace and
      line breaks are ignored, so a grid copied from anywhere should work.
    </p>

    <textarea
      v-model="text"
      class="enter__input"
      rows="4"
      spellcheck="false"
      autocapitalize="off"
      autocomplete="off"
      aria-label="Puzzle as 81 characters"
      placeholder="..............3.85..1.2......."
    />

    <div class="enter__meta">
      <span :class="{ 'is-ready': charCount === CELLS }">{{ charCount }} / {{ CELLS }}</span>
      <span v-if="parseMessage" class="enter__parse">{{ parseMessage }}</span>
      <span class="enter__spacer" />
      <button type="button" class="enter__link" @click="loadExample">Load an example</button>
      <button type="button" class="enter__link" @click="clear">Clear</button>
    </div>

    <SudokuBoard
      :board="board"
      :notes="emptyNotes"
      :puzzle="board"
      :selected-index="null"
      :conflicts="conflicts"
      :incorrect="NO_CELLS"
    />

    <div class="enter__actions">
      <button
        type="button"
        class="enter__button"
        :disabled="parsed.error !== null || isChecking"
        @click="check"
      >
        {{ isChecking ? 'Checking…' : 'Check puzzle' }}
      </button>

      <button
        type="button"
        class="enter__button is-primary"
        :disabled="validation?.verdict !== 'unique'"
        @click="play"
      >
        Play it
      </button>
    </div>

    <p
      v-if="validation"
      class="enter__verdict"
      :class="validation.verdict === 'unique' ? 'is-good' : 'is-bad'"
      role="status"
    >
      {{ validation.message }}
      <span class="enter__clues">{{ validation.clues }} clues</span>
    </p>

    <div v-if="grading" class="enter__grading">
      <p>
        Graded <strong>{{ grading.difficulty }}</strong>
        <template v-if="!grading.solved">
          — though it needs techniques beyond this solver, so it may be harder still.
        </template>
      </p>
      <p v-if="grading.names.length" class="enter__techniques">
        Techniques used: {{ grading.names.join(', ') }}
      </p>
    </div>
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

.enter__meta {
  display: flex;
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
  color: var(--color-text-muted);
  font-size: 0.75rem;
}
</style>
