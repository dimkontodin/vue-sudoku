<script setup lang="ts">
import { IonIcon } from '@ionic/vue'
import { arrowRedo, arrowUndo, backspace, bulb, pencil } from 'ionicons/icons'
import { useLongPress } from '../composables/useLongPress'

// Dumb like every other component here: it is told which digit is armed and
// reports taps and holds. The rule deciding what a tap *means* lives in
// useDigitFirst, not in the pad.
defineProps<{
  remainingCounts: number[]
  noteMode: boolean
  canUndo: boolean
  canRedo: boolean
  canHint: boolean
  /** The digit currently armed for digit-first entry, or null. */
  activeDigit: number | null
}>()

const emit = defineEmits<{
  digit: [digit: number]
  holdDigit: [digit: number]
  erase: []
  toggleNotes: []
  undo: []
  redo: []
  hint: []
}>()

const press = useLongPress<number>({
  tap: (digit) => emit('digit', digit),
  longPress: (digit) => emit('holdDigit', digit),
})

const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const
</script>

<template>
  <div class="pad">
    <div class="pad__digits">
      <button
        v-for="digit in digits"
        :key="digit"
        type="button"
        class="pad__key"
        :class="{
          'is-exhausted': remainingCounts[digit - 1] === 0,
          'is-active': activeDigit === digit,
          'is-note': activeDigit === digit && noteMode,
          'is-holding': press.isHolding(digit),
        }"
        :aria-label="`Enter ${digit}, ${remainingCounts[digit - 1] ?? 0} remaining. Hold to add as a note.`"
        :aria-pressed="activeDigit === digit"
        @pointerdown="press.onPointerdown($event, digit)"
        @pointermove="press.onPointermove"
        @pointerup="press.onPointerup"
        @pointercancel="press.onPointercancel"
        @contextmenu="press.onContextmenu"
        @click="press.onClick(digit)"
      >
        <span class="pad__key-value">{{ digit }}</span>
        <span class="pad__key-count" aria-hidden="true">{{ remainingCounts[digit - 1] ?? 0 }}</span>
      </button>

      <button
        type="button"
        class="pad__key pad__key--action"
        aria-label="Erase"
        @click="emit('erase')"
      >
        <IonIcon :icon="backspace" aria-hidden="true" />
      </button>
    </div>

    <!--
      Native <button>s, not IonButton, for the same reason the digit keys are:
      Ionic 9 copies `disabled`/`aria-*` onto its inner shadow button once at
      hydration and never syncs them again, so a binding that flips back to
      false leaves the control permanently dead. Undo is the most-used key here
      after the digits — it cannot be subject to that.
    -->
    <div class="pad__actions">
      <button
        type="button"
        class="pad__action"
        :class="{ 'is-on': noteMode }"
        :aria-pressed="noteMode"
        @click="emit('toggleNotes')"
      >
        <IonIcon :icon="pencil" aria-hidden="true" />
        Notes {{ noteMode ? 'on' : 'off' }}
      </button>
      <button
        type="button"
        class="pad__action pad__action--icon"
        aria-label="Undo"
        :disabled="!canUndo"
        @click="emit('undo')"
      >
        <IonIcon :icon="arrowUndo" aria-hidden="true" />
      </button>
      <!-- Redo sits with Undo rather than five items deep in the overflow
           sheet: it is the other half of one control, and the web app has
           always had it on the pad. -->
      <button
        type="button"
        class="pad__action pad__action--icon"
        aria-label="Redo"
        :disabled="!canRedo"
        @click="emit('redo')"
      >
        <IonIcon :icon="arrowRedo" aria-hidden="true" />
      </button>
      <button type="button" class="pad__action" :disabled="!canHint" @click="emit('hint')">
        <IonIcon :icon="bulb" aria-hidden="true" />
        Hint
      </button>
    </div>
  </div>
</template>

<style scoped>
.pad {
  display: flex;
  flex-direction: column;
  gap: var(--gap-sm);
  width: 100%;
  max-width: var(--board-width);
  margin: 0 auto;
}

/* Five columns, two rows — nine digits plus erase. One row of nine gave ~36px
   targets on a phone, well under the 44/48px minimum; this gets them to ~70px. */
.pad__digits {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: var(--gap-xs);
}

.pad__key {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-height: 52px;
  padding: var(--gap-xs) 0;
  /* Keyboard focus was invisible app-wide — these are native <button>s, so
     they get none of Ionic's focus ring. */
  outline-offset: -2px;
  border: 1px solid var(--ion-color-light-shade, #d7d8da);
  border-radius: var(--radius-md);
  background: var(--ion-color-light, #f4f5f8);
  color: inherit;
  font-variant-numeric: tabular-nums;
  /* Same reasoning as .cell — the hold gesture is ours. */
  touch-action: manipulation;
  -webkit-touch-callout: none;
  user-select: none;
}

.pad__key:active {
  background: var(--ion-color-light-shade, #d7d8da);
}

.pad__key.is-exhausted {
  opacity: 0.4;
}

/* Armed for digit-first entry: every cell tap now places this digit. */
.pad__key.is-active {
  border-color: var(--ion-color-primary, #3880ff);
  background: var(--ion-color-primary, #3880ff);
  color: var(--ion-color-primary-contrast, #fff);
  opacity: 1;
}

.pad__key.is-active .pad__key-count {
  color: inherit;
  opacity: 0.75;
}

/* A hold is under way — see the same class on .cell. */
.pad__key.is-holding {
  border-color: var(--ion-color-primary, #0054e9);
  background: var(--ion-color-light-shade, #d7d8da);
  transform: scale(0.96);
}

/* Armed as a note — visually distinct so "placing" and "pencilling" never blur.
   Keeps the primary fill (and so the contrast of the label on it) and carries
   the difference in the dashed edge, rather than dropping to a grey that left
   white text at ~2.6:1. */
.pad__key.is-note {
  border-style: dashed;
  border-width: 2px;
  background: var(--ion-color-primary-shade, #3171e0);
}

.pad__key--action {
  font-size: 1.25rem;
}

.pad__key-value {
  font-size: 1.35rem;
  line-height: 1;
}

.pad__key-count {
  /* Was 0.6rem — 9.6px, small enough that the remaining count read as noise. */
  color: var(--text-muted);
  font-size: 0.7rem;
  line-height: 1;
}

.pad__actions {
  display: flex;
  gap: var(--gap-xs);
}

.pad__action {
  display: flex;
  flex: 1 1 0;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 48px;
  padding: 0 var(--gap-xs);
  border: 1px solid var(--ion-color-light-shade, #d7d8da);
  border-radius: var(--radius-md);
  background: var(--ion-color-light, #f4f5f8);
  color: inherit;
  font: inherit;
  font-size: 0.8rem;
  touch-action: manipulation;
  user-select: none;
}

/* Undo/Redo are icon-only, so they do not need an equal share of the row. */
.pad__action--icon {
  flex: 0 0 auto;
  min-width: 56px;
  font-size: 1.1rem;
}

.pad__action:disabled {
  opacity: 0.4;
}

.pad__action:not(:disabled):active {
  background: var(--ion-color-light-shade, #d7d8da);
}

/* On a short screen the pad and the board are competing for the same pixels,
   and the board is the thing you have to read. The keys stay above the 44px
   minimum; they just stop being generous. */
@media (max-height: 700px) {
  .pad {
    gap: var(--gap-xs);
  }

  .pad__key {
    min-height: 46px;
  }

  .pad__action {
    min-height: 44px;
  }
}

/* Notes mode is on — the one piece of state the player must never lose track of. */
.pad__action.is-on {
  border-color: var(--ion-color-primary, #3880ff);
  background: var(--ion-color-primary, #3880ff);
  color: var(--ion-color-primary-contrast, #fff);
}
</style>
