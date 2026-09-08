<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  IonContent,
  IonHeader,
  IonIcon,
  IonPage,
  IonTextarea,
  IonTitle,
  IonToolbar,
} from '@ionic/vue'
import { backspace } from 'ionicons/icons'
import {
  CELLS,
  useBoardKeyboard,
  useGridEntry,
  usePuzzleAnalysis,
  usePuzzleHandoff,
  useSolverHandoff,
} from '@vue-sudoku/sudoku-core'
import SudokuBoard from '../components/SudokuBoard.vue'
import { useHaptics } from '../composables/useHaptics'

const router = useRouter()
const handoff = usePuzzleHandoff()
const solverHandoff = useSolverHandoff()
const haptics = useHaptics()

const entry = useGridEntry()
const analysis = usePuzzleAnalysis(() => entry.board.value)

const EXAMPLE = '..............3.85..1.2.......5.7.....4...1...9.......5......73..2.1........4...9'
const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const
const emptyNotes = new Uint16Array(CELLS)
const NO_CELLS: ReadonlySet<number> = new Set()

// Inert under touch, but it costs one listener and keeps the screen usable
// under `nx serve` and on a tablet with a keyboard attached — same reasoning as
// PlayView. Its own guard ignores keystrokes aimed at the paste box.
useBoardKeyboard(entry)

const showPaste = shallowRef(false)

const parseMessage = computed(() => {
  if (entry.parseError.value === 'characters') return 'Only digits, dots and underscores, please.'
  if (entry.parseError.value === 'length') return `${entry.charCount.value} of ${CELLS} cells.`
  return ''
})

// Re-validating on every tap would run a solver per digit, so a check is only
// ever as current as the grid it ran on. Watching the board rather than
// clearing it from each handler catches every route in — pad, keys, paste.
watch(entry.board, () => analysis.reset())

/**
 * Digit-first entry, the same rule PlayView uses: tap a digit to arm it, then
 * tap every square it belongs in. With a cell already selected, the digit goes
 * straight in. Entering a puzzle means placing the same digit many times over,
 * so this is the gesture that matters most here.
 */
function tapDigit(digit: number): void {
  entry.onDigitTap(digit)
  haptics.tick()
}

function tapCell(index: number): void {
  const before = entry.board.value[index] ?? 0
  entry.onCellTap(index)
  if ((entry.board.value[index] ?? 0) !== before) haptics.tick()
}

function eraseCell(index = entry.selectedIndex.value): void {
  if (index === null || (entry.board.value[index] ?? 0) === 0) return
  entry.erase(index)
  haptics.tick()
}

function play() {
  const validation = analysis.validation.value
  if (!analysis.canPlay.value || !validation?.solution) return

  handoff.set({
    puzzle: entry.board.value.slice(),
    solution: validation.solution.slice(),
    difficulty: analysis.grading.value?.difficulty ?? null,
  })
  void router.push('/tabs/play')
}

/** Hands the grid to the visualiser rather than answering it here. */
function watchSolver() {
  if (!analysis.canSolve.value) return
  solverHandoff.set(entry.board.value)
  void router.push('/tabs/solver')
}

function loadExample() {
  entry.text.value = EXAMPLE
}

function clear() {
  entry.clear()
}

const conflicts = computed<ReadonlySet<number>>(() =>
  analysis.validation.value?.verdict === 'conflicting'
    ? analysis.validation.value.conflicts
    : entry.conflicts.value,
)
</script>

<template>
  <IonPage>
    <IonHeader>
      <IonToolbar><IonTitle>Enter</IonTitle></IonToolbar>
    </IonHeader>

    <IonContent class="ion-padding">
      <div class="enter">
        <p class="enter__intro">
          Tap a digit, then tap every square it belongs in. Or tap a square first and the next digit
          goes straight into it.
        </p>

        <SudokuBoard
          :board="entry.board.value"
          :notes="emptyNotes"
          :puzzle="entry.board.value"
          :selected-index="entry.selectedIndex.value"
          :highlight-value="entry.highlightValue.value"
          :conflicts="conflicts"
          :incorrect="NO_CELLS"
          @select="tapCell"
          @long-press="eraseCell"
        />

        <!--
          Native <button>s throughout, not IonButton: Ionic 9 copies
          `disabled`/`aria-*` onto its inner shadow button once at hydration and
          never syncs them again, so a binding that flips back to false leaves
          the control permanently dead (verified live; see NumberPad.vue).
        -->
        <div class="pad">
          <button
            v-for="digit in DIGITS"
            :key="digit"
            type="button"
            class="pad__key"
            :class="{
              'is-active': entry.activeDigit.value === digit,
              'is-exhausted': entry.remainingCounts.value[digit - 1] === 0,
            }"
            :aria-pressed="entry.activeDigit.value === digit"
            :aria-label="`Enter ${digit}, ${entry.remainingCounts.value[digit - 1] ?? 0} left to place`"
            @click="tapDigit(digit)"
          >
            <span class="pad__key-value">{{ digit }}</span>
            <span class="pad__key-count" aria-hidden="true">
              {{ entry.remainingCounts.value[digit - 1] ?? 0 }}
            </span>
          </button>

          <button
            type="button"
            class="pad__key pad__key--action"
            aria-label="Erase"
            @click="eraseCell()"
          >
            <IonIcon :icon="backspace" aria-hidden="true" />
          </button>
        </div>

        <div class="enter__meta">
          <span :class="{ 'is-ready': entry.clues.value > 0 }">{{ entry.clues.value }} clues</span>
          <span v-if="parseMessage" class="enter__parse">{{ parseMessage }}</span>
          <span class="enter__spacer" />
          <button type="button" @click="showPaste = !showPaste">
            {{ showPaste ? 'Hide text' : 'Paste' }}
          </button>
          <button type="button" @click="loadExample">Example</button>
          <button type="button" @click="clear">Clear</button>
        </div>

        <!--
          Bound straight to the grid both ways: typing here rewrites the board,
          and editing the board rewrites this. useGridEntry owns that loop.
        -->
        <IonTextarea
          v-if="showPaste"
          v-model="entry.text.value"
          class="enter__input"
          :rows="3"
          placeholder="..............3.85..1.2......."
          aria-label="Puzzle as 81 characters"
        />

        <div class="enter__actions">
          <button
            type="button"
            class="enter__btn enter__btn--outline"
            :disabled="entry.isEmpty.value || analysis.isChecking.value"
            @click="analysis.check()"
          >
            {{ analysis.isChecking.value ? 'Checking…' : 'Check puzzle' }}
          </button>
          <button
            type="button"
            class="enter__btn enter__btn--solid"
            :disabled="!analysis.canPlay.value"
            @click="play"
          >
            Play it
          </button>
        </div>

        <button
          type="button"
          class="enter__btn enter__btn--outline enter__btn--wide"
          :disabled="!analysis.canSolve.value"
          @click="watchSolver"
        >
          Watch the solver
        </button>

        <p
          v-if="analysis.validation.value"
          class="enter__verdict"
          :class="analysis.validation.value.verdict === 'unique' ? 'is-good' : 'is-bad'"
          role="status"
        >
          {{ analysis.validation.value.message }} — {{ analysis.validation.value.clues }} clues
        </p>

        <div v-if="analysis.grading.value" class="enter__grading">
          <p>
            Graded <strong>{{ analysis.grading.value.difficulty }}</strong>
            <template v-if="!analysis.grading.value.solved">
              — though it needs techniques beyond this solver, so it may be harder still.
            </template>
          </p>
          <p v-if="analysis.grading.value.techniques.length" class="enter__techniques">
            Techniques used: {{ analysis.grading.value.techniques.join(', ') }}
          </p>
        </div>

        <p v-else-if="analysis.canSolve.value" class="enter__techniques">
          No grade — grading needs a single solution. The solver will still search it.
        </p>
      </div>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.enter {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--gap-md);
  width: 100%;
  max-width: var(--board-width);
  margin: 0 auto;
}

.enter__intro {
  color: var(--ion-color-medium, #92949c);
  font-size: 0.8rem;
  line-height: 1.5;
}

.enter__input {
  width: 100%;
  border: 1px solid var(--ion-color-light-shade, #d7d8da);
  border-radius: var(--radius-sm);
  font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  font-size: 0.8rem;
}

/* Five columns, two rows — nine digits plus erase, same shape and target size
   as the play pad, so the two screens feel like the same keyboard. */
.pad {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: var(--gap-xs);
  width: 100%;
}

.pad__key {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-height: 52px;
  padding: var(--gap-xs) 0;
  border: 1px solid var(--ion-color-light-shade, #d7d8da);
  border-radius: var(--radius-md);
  background: var(--ion-color-light, #f4f5f8);
  color: inherit;
  font-variant-numeric: tabular-nums;
  touch-action: manipulation;
  -webkit-touch-callout: none;
  user-select: none;
}

.pad__key:active {
  background: var(--ion-color-light-shade, #d7d8da);
}

/* Armed for digit-first entry: every square tapped now takes this digit. */
.pad__key.is-active {
  border-color: var(--ion-color-primary, #3880ff);
  background: var(--ion-color-primary, #3880ff);
  color: var(--ion-color-primary-contrast, #fff);
  font-weight: 600;
}

/* All nine placed. Still tappable — it is a legal way to take one back out. */
.pad__key.is-exhausted:not(.is-active) {
  opacity: 0.45;
}

.pad__key-value {
  font-size: 1.35rem;
  line-height: 1;
}

.pad__key-count {
  color: var(--ion-color-medium, #92949c);
  font-size: 0.65rem;
  line-height: 1;
}

.pad__key.is-active .pad__key-count {
  color: inherit;
  opacity: 0.8;
}

.pad__key--action {
  font-size: 1.3rem;
}

.enter__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--gap-sm);
  width: 100%;
  color: var(--ion-color-medium, #92949c);
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
}

.enter__meta .is-ready {
  color: var(--ion-color-primary, #3880ff);
  font-weight: 600;
}

.enter__spacer {
  flex: 1;
}

.enter__parse {
  color: var(--ion-color-danger, #eb445a);
}

.enter__meta button {
  border: 0;
  background: none;
  color: var(--ion-color-primary, #3880ff);
  font: inherit;
  text-decoration: underline;
}

.enter__actions {
  display: flex;
  gap: var(--gap-sm);
  width: 100%;
}

.enter__btn {
  flex: 1;
  height: 36px;
  padding: 0 15px;
  border-radius: var(--radius-sm);
  font: inherit;
  font-size: 0.875rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  touch-action: manipulation;
  user-select: none;
}

.enter__btn--wide {
  width: 100%;
  flex: none;
}

.enter__btn--outline {
  border: 1.6px solid var(--ion-color-primary, #3880ff);
  background: transparent;
  color: var(--ion-color-primary, #3880ff);
}

.enter__btn--solid {
  border: 0;
  background: var(--ion-color-primary, #3880ff);
  color: var(--ion-color-primary-contrast, #fff);
}

.enter__btn:disabled {
  opacity: 0.5;
  pointer-events: none;
}

.enter__verdict {
  width: 100%;
  padding: var(--gap-sm) var(--gap-md);
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
}

.enter__verdict.is-good {
  background: color-mix(in srgb, var(--ion-color-primary, #3880ff) 14%, transparent);
  color: var(--ion-color-primary, #3880ff);
}

.enter__verdict.is-bad {
  background: color-mix(in srgb, var(--ion-color-danger, #eb445a) 14%, transparent);
  color: var(--ion-color-danger, #eb445a);
}

.enter__grading {
  width: 100%;
  font-size: 0.8rem;
}

.enter__grading strong {
  text-transform: capitalize;
}

.enter__techniques {
  width: 100%;
  color: var(--ion-color-medium, #92949c);
  font-size: 0.75rem;
}
</style>
