<script setup lang="ts">
import { computed } from 'vue'
import { CELLS, peersOf } from '@vue-sudoku/sudoku-core'
import type { Board, Notes } from '@vue-sudoku/sudoku-core'
import SudokuCell from './SudokuCell.vue'

const props = defineProps<{
  board: Board
  notes: Notes
  puzzle: Board
  selectedIndex: number | null
  conflicts: ReadonlySet<number>
  incorrect: ReadonlySet<number>
  hintPattern?: ReadonlySet<number>
  hintTargets?: ReadonlySet<number>
  /**
   * Which digit to light up across the board. Normally the selected cell's
   * value, but digit-first input overrides it with the armed digit so the
   * player can see where that digit already lives while placing it.
   */
  highlightValue?: number
}>()

const emit = defineEmits<{
  select: [index: number]
  longPress: [index: number]
}>()

const peerIndices = computed(() => {
  if (props.selectedIndex === null) return new Set<number>()
  return new Set(peersOf(props.selectedIndex))
})

const highlighted = computed(() => {
  if (props.highlightValue !== undefined) return props.highlightValue
  return props.selectedIndex === null ? 0 : (props.board[props.selectedIndex] ?? 0)
})

const cells = computed(() =>
  Array.from({ length: CELLS }, (_, index) => {
    const value = props.board[index] ?? 0
    return {
      index,
      value,
      notes: props.notes[index] ?? 0,
      isGiven: (props.puzzle[index] ?? 0) !== 0,
      isSelected: props.selectedIndex === index,
      isPeer: peerIndices.value.has(index),
      isSameValue: value !== 0 && value === highlighted.value && props.selectedIndex !== index,
      hasConflict: props.conflicts.has(index),
      isIncorrect: props.incorrect.has(index),
      isHintPattern: props.hintPattern?.has(index) ?? false,
      isHintTarget: props.hintTargets?.has(index) ?? false,
    }
  }),
)
</script>

<template>
  <div class="board" role="group" aria-label="Sudoku board">
    <SudokuCell
      v-for="cell in cells"
      :key="cell.index"
      v-bind="cell"
      @select="emit('select', $event)"
      @long-press="emit('longPress', $event)"
    />
  </div>
</template>

<style scoped>
.board {
  /* Fluid: the cells take their size from the board, not the other way round,
     so the grid always fits the width the parent gives it. The old
     `width: max-content` over a fixed --cell-size resolved to 380px and
     overflowed IonContent's padding on every phone narrower than ~410px. */
  display: grid;
  grid-template-columns: repeat(9, 1fr);
  grid-template-rows: repeat(9, 1fr);
  aspect-ratio: 1;
  width: 100%;
  gap: var(--grid-line);
  padding: var(--box-line);
  border-radius: var(--radius-sm);
  background: var(--ion-color-medium, #92949c);
}

/* Box separators without wrapper elements: widen the gap on the last cell of
   each 3-wide/tall group and paint that space with box-shadow, same trick as
   the web app's SudokuBoard. Flat selectors (no CSS nesting) to stay plain-CSS. */
.board :deep(.cell:nth-child(3n):not(:nth-child(9n))) {
  margin-right: var(--box-line);
  box-shadow: var(--box-line) 0 0 var(--ion-color-dark, #222428);
}

.board :deep(.cell:nth-child(n + 19):nth-child(-n + 27)),
.board :deep(.cell:nth-child(n + 46):nth-child(-n + 54)) {
  margin-bottom: var(--box-line);
  box-shadow: 0 var(--box-line) 0 var(--ion-color-dark, #222428);
}

.board
  :deep(.cell:nth-child(3n):not(:nth-child(9n)):is(:nth-child(n + 19):nth-child(-n + 27), :nth-child(n + 46):nth-child(-n + 54))) {
  box-shadow:
    var(--box-line) 0 0 var(--ion-color-dark, #222428),
    0 var(--box-line) 0 var(--ion-color-dark, #222428),
    var(--box-line) var(--box-line) 0 var(--ion-color-dark, #222428);
}
</style>
