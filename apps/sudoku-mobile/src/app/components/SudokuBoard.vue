<script setup lang="ts">
import { computed } from 'vue'
import { CELLS, peersOf } from '@sudoku-web/sudoku-core'
import type { Board, Notes } from '@sudoku-web/sudoku-core'
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
}>()

const emit = defineEmits<{ select: [index: number] }>()

const peerIndices = computed(() => {
  if (props.selectedIndex === null) return new Set<number>()
  return new Set(peersOf(props.selectedIndex))
})

const selectedValue = computed(() =>
  props.selectedIndex === null ? 0 : (props.board[props.selectedIndex] ?? 0),
)

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
      isSameValue: value !== 0 && value === selectedValue.value && props.selectedIndex !== index,
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
    <SudokuCell v-for="cell in cells" :key="cell.index" v-bind="cell" @select="emit('select', $event)" />
  </div>
</template>

<style scoped>
.board {
  display: grid;
  grid-template-columns: repeat(9, auto);
  width: max-content;
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
