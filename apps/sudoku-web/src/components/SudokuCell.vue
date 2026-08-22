<script setup lang="ts">
import { computed } from 'vue'
import { colOf, rowOf } from '@vue-sudoku/sudoku-core'
import { hasNote } from '@vue-sudoku/sudoku-core'

// Deliberately knows nothing about Sudoku rules. It is told how to look and
// reports that it was clicked; every decision behind these props is made by
// useSudoku. That is what makes it reusable and trivially testable.
const props = defineProps<{
  index: number
  value: number
  /** Pencil-mark bitmask. A number rather than an array so nothing allocates. */
  notes: number
  isGiven: boolean
  isSelected: boolean
  /** Shares a row, column or box with the selected cell. */
  isPeer: boolean
  /** Holds the same digit as the selected cell. */
  isSameValue: boolean
  hasConflict: boolean
  /** Disagrees with the solution. Only surfaced when the user asked to check. */
  isIncorrect: boolean
  /** Part of the pattern a hint is pointing at. */
  isHintPattern: boolean
  /** A cell the hint's step would act on. */
  isHintTarget: boolean
}>()

const emit = defineEmits<{ select: [index: number] }>()

const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9]

const label = computed(() => {
  type KProps = { [P in keyof typeof props]: (typeof props)[P] }
  const position = `Row ${rowOf(props.index) + 1}, column ${colOf(props.index) + 1}`
  if (props.value) {
    const marksToShow = ['isGiven', 'isIncorrect'] satisfies Array<keyof KProps>
    const marks = marksToShow
      .map((key) => (props[key] ? key.replace(/^is/, '').toLowerCase() : null))
      .filter(Boolean)
    return [position, String(props.value), ...marks].join(', ')
  }

  const noted = digits.filter((digit) => hasNote(props.notes, digit))
  if (noted.length) return `${position}, empty, notes ${noted.join(' ')}`
  return `${position}, empty`
})
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
      'is-incorrect': isIncorrect,
      'is-hint-pattern': isHintPattern,
      'is-hint-target': isHintTarget,
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

  // Hint highlights sit above the passive states but below selection, so the
  // player never loses track of where their cursor is.
  &.is-hint-pattern {
    background: color-mix(in srgb, #f0b429 32%, var(--color-surface-raised));
  }

  &.is-hint-target {
    background: color-mix(in srgb, #f0b429 55%, var(--color-surface-raised));
    box-shadow: inset 0 0 0 2px #f0b429;
  }

  // Declared after .is-selected so a wrong answer stays visible even while
  // the cell is the active one.
  &.is-incorrect {
    background: color-mix(in srgb, var(--color-danger) 22%, var(--color-surface-raised));
    color: var(--color-danger);
    text-decoration: underline;
    text-decoration-thickness: 2px;
    text-underline-offset: 3px;
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
