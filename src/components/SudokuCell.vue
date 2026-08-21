<script setup lang="ts">
import { computed } from 'vue';
import { colOf, rowOf } from '@/core/grid';
import { hasNote } from '@/core/notes';

// Deliberately knows nothing about Sudoku rules. It is told how to look and
// reports that it was clicked; every decision behind these props is made by
// useSudoku. That is what makes it reusable and trivially testable.
const props = defineProps<{
  index: number;
  value: number;
  /** Pencil-mark bitmask. A number rather than an array so nothing allocates. */
  notes: number;
  isGiven: boolean;
  isSelected: boolean;
  /** Shares a row, column or box with the selected cell. */
  isPeer: boolean;
  /** Holds the same digit as the selected cell. */
  isSameValue: boolean;
  hasConflict: boolean;
}>();

const emit = defineEmits<{ select: [index: number] }>();

const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9];

const label = computed(() => {
  const position = `Row ${rowOf(props.index) + 1}, column ${colOf(props.index) + 1}`;
  if (props.value) return `${position}, ${props.value}${props.isGiven ? ', given' : ''}`;

  const noted = digits.filter((digit) => hasNote(props.notes, digit));
  if (noted.length) return `${position}, empty, notes ${noted.join(' ')}`;
  return `${position}, empty`;
});
</script>

<template>
  <button
    type="button"
    class="cell"
    :class="{
      'is-given': isGiven,
      'is-selected': isSelected,
      'is-peer': isPeer,
      'is-same-value': isSameValue,
      'has-conflict': hasConflict,
    }"
    :aria-label="label"
    :aria-pressed="isSelected"
    :data-index="index"
    @click="emit('select', index)"
  >
    <span v-if="value" class="cell__value">{{ value }}</span>

    <span v-else-if="notes" class="cell__notes" aria-hidden="true">
      <span v-for="digit in digits" :key="digit" class="cell__note">
        {{ hasNote(notes, digit) ? digit : '' }}
      </span>
    </span>
  </button>
</template>

<style scoped lang="scss">
.cell {
  display: flex;
  align-items: center;
  justify-content: center;
  width: $cell-size;
  height: $cell-size;
  padding: 0;
  border: 0;
  background: var(--color-surface-raised);
  color: var(--color-primary);
  font-size: 1.35rem;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  transition:
    background-color 0.12s ease,
    color 0.12s ease;

  &:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: -2px;
  }

  // Order matters: later rules win, so the strongest signal (the cell the user
  // is actually on) is declared last.
  &.is-peer {
    background: var(--color-highlight);
  }

  &.is-same-value {
    background: var(--color-highlight-strong);
    font-weight: 600;
  }

  &.has-conflict {
    background: color-mix(in srgb, var(--color-danger) 18%, var(--color-surface-raised));
    color: var(--color-danger);
  }

  &.is-selected {
    background: color-mix(in srgb, var(--color-primary) 22%, var(--color-surface-raised));
  }

  &.is-given {
    color: var(--color-text);
    font-weight: 600;
    cursor: default;
  }
}

.cell__notes {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  width: 100%;
  height: 100%;
  padding: 2px;
  color: var(--color-text-muted);
  font-size: 0.55rem;
  font-weight: 500;
}

.cell__note {
  display: flex;
  align-items: center;
  justify-content: center;
}

@media (max-width: $bp-sm) {
  .cell {
    width: $cell-size-sm;
    height: $cell-size-sm;
    font-size: 1.1rem;
  }
}
</style>
