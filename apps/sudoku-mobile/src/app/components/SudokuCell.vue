<script setup lang="ts">
import { computed } from 'vue'
import { colOf, hasNote, rowOf } from '@vue-sudoku/sudoku-core'
import { useLongPress } from '../composables/useLongPress'

// Deliberately knows nothing about Sudoku rules — same split as the web app's
// SudokuCell: it is told how to look and reports that it was tapped.
const props = defineProps<{
  index: number
  value: number
  notes: number
  isGiven: boolean
  isSelected: boolean
  isPeer: boolean
  isSameValue: boolean
  hasConflict: boolean
  isIncorrect: boolean
  isHintPattern: boolean
  isHintTarget: boolean
}>()

const emit = defineEmits<{
  select: [index: number]
  longPress: [index: number]
}>()

const press = useLongPress<number>({
  tap: (index) => emit('select', index),
  longPress: (index) => emit('longPress', index),
})

const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9]

const label = computed(() => {
  const position = `Row ${rowOf(props.index) + 1}, column ${colOf(props.index) + 1}`
  if (props.value) {
    const marks = [props.isGiven && 'given', props.isIncorrect && 'incorrect'].filter(Boolean)
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
    @pointerdown="press.onPointerdown($event, index)"
    @pointermove="press.onPointermove"
    @pointerup="press.onPointerup"
    @pointercancel="press.onPointercancel"
    @contextmenu="press.onContextmenu"
    @click="press.onClick(index)"
  >
    <span v-if="value" class="cell__value">{{ value }}</span>
    <span v-else-if="notes" class="cell__notes" aria-hidden="true">
      <span v-for="digit in digits" :key="digit" class="cell__note">
        {{ hasNote(notes, digit) ? digit : '' }}
      </span>
    </span>
  </button>
</template>

<style scoped>
.cell {
  display: flex;
  align-items: center;
  justify-content: center;
  /* Sized by the board's 9x9 grid, so it scales with the screen. */
  width: 100%;
  height: 100%;
  padding: 0;
  border: 0;
  background: var(--ion-background-color, #fff);
  color: var(--ion-color-primary, #3880ff);
  font-size: clamp(1rem, 5.5vw, 1.6rem);
  font-variant-numeric: tabular-nums;
  line-height: 1;
  /* Long-press is ours: no double-tap zoom delay, no text selection, and no
     platform callout menu stealing the gesture. */
  touch-action: manipulation;
  -webkit-touch-callout: none;
  user-select: none;
}

.cell.is-peer {
  background: var(--ion-color-light, #f4f5f8);
}

.cell.is-same-value {
  background: var(--ion-color-light-shade, #e0e0e0);
  font-weight: 600;
}

.cell.has-conflict {
  background: color-mix(in srgb, var(--ion-color-danger, #eb445a) 18%, var(--ion-background-color, #fff));
  color: var(--ion-color-danger, #eb445a);
}

.cell.is-hint-pattern {
  background: color-mix(in srgb, #f0b429 32%, var(--ion-background-color, #fff));
}

.cell.is-hint-target {
  background: color-mix(in srgb, #f0b429 55%, var(--ion-background-color, #fff));
  box-shadow: inset 0 0 0 2px #f0b429;
}

.cell.is-incorrect {
  background: color-mix(in srgb, var(--ion-color-danger, #eb445a) 22%, var(--ion-background-color, #fff));
  color: var(--ion-color-danger, #eb445a);
  text-decoration: underline;
  text-decoration-thickness: 2px;
  text-underline-offset: 3px;
}

.cell.is-selected {
  background: color-mix(in srgb, var(--ion-color-primary, #3880ff) 22%, var(--ion-background-color, #fff));
}

.cell.is-given {
  color: var(--ion-text-color, #000);
  font-weight: 600;
}

.cell__notes {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  width: 100%;
  height: 100%;
  padding: 2px;
  color: var(--ion-color-medium, #92949c);
  font-size: clamp(0.4rem, 1.9vw, 0.6rem);
  font-weight: 500;
}

.cell__note {
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
