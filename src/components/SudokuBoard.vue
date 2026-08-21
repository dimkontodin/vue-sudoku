<script setup lang="ts">
import { computed } from 'vue';
import { CELLS } from '@/core/constants';
import { peersOf } from '@/core/grid';
import type { Board, Notes } from '@/core/types';
import SudokuCell from './SudokuCell.vue';

const props = defineProps<{
  board: Board;
  notes: Notes;
  /** The original clues — a non-zero entry marks a given. */
  puzzle: Board;
  selectedIndex: number | null;
  conflicts: Set<number>;
}>();

const emit = defineEmits<{ select: [index: number] }>();

// Peer highlighting is a presentation concern, so it is derived here rather
// than stored in useSudoku. A Set keeps the per-cell lookup O(1) instead of
// scanning 20 peers for each of the 81 cells.
const peerIndices = computed(() => {
  if (props.selectedIndex === null) return new Set<number>();
  return new Set(peersOf(props.selectedIndex));
});

const selectedValue = computed(() =>
  props.selectedIndex === null ? 0 : (props.board[props.selectedIndex] ?? 0),
);

const cells = computed(() =>
  Array.from({ length: CELLS }, (_, index) => {
    const value = props.board[index] ?? 0;
    return {
      index,
      value,
      notes: props.notes[index] ?? 0,
      isGiven: (props.puzzle[index] ?? 0) !== 0,
      isSelected: props.selectedIndex === index,
      isPeer: peerIndices.value.has(index),
      // Only highlight matching digits other than the selected cell itself.
      isSameValue: value !== 0 && value === selectedValue.value && props.selectedIndex !== index,
      hasConflict: props.conflicts.has(index),
    };
  }),
);
</script>

<template>
  <div class="board" role="group" aria-label="Sudoku board">
    <SudokuCell
      v-for="cell in cells"
      :key="cell.index"
      v-bind="cell"
      @select="emit('select', $event)"
    />
  </div>
</template>

<style scoped lang="scss">
.board {
  display: grid;
  grid-template-columns: repeat(9, auto);
  width: max-content;
  // The container paints the grid lines; the gap lets them show through, so
  // no cell needs a border of its own.
  gap: $grid-line;
  padding: $box-line;
  border-radius: $radius-sm;
  background: var(--color-border);
  box-shadow: var(--shadow-md);
}

// Box separators without any wrapper elements: widen the gap with a margin on
// the last cell of each 3-wide column group and 3-tall row group, then paint
// that space with box-shadow. A shadow rather than a border because a border
// would consume the cell's own width and knock the columns out of alignment.
// :deep() is required because these target the child component's root element.
.board :deep(.cell) {
  &:nth-child(3n):not(:nth-child(9n)) {
    margin-right: $box-line;
    box-shadow: $box-line 0 0 var(--color-border-strong);
  }

  // Children 19-27 and 46-54 are the bottom rows of the first two box bands.
  &:nth-child(n + 19):nth-child(-n + 27),
  &:nth-child(n + 46):nth-child(-n + 54) {
    margin-bottom: $box-line;
    box-shadow: 0 $box-line 0 var(--color-border-strong);
  }

  // Corners need both edges drawn, so the two shadows have to be combined.
  &:nth-child(3n):not(:nth-child(9n)):is(
      :nth-child(n + 19):nth-child(-n + 27),
      :nth-child(n + 46):nth-child(-n + 54)
    ) {
    box-shadow:
      $box-line 0 0 var(--color-border-strong),
      0 $box-line 0 var(--color-border-strong),
      $box-line $box-line 0 var(--color-border-strong);
  }
}
</style>
