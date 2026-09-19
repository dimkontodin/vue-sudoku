<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, shallowRef, watch } from 'vue'
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
import { backspace, camera, image as imageIcon } from 'ionicons/icons'
import {
  CELLS,
  imageFrom,
  useBoardKeyboard,
  useGridEntry,
  usePuzzleAnalysis,
  useImageImport,
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
  image.reset()
}

function clear() {
  entry.clear()
  image.reset()
}

// Reading a puzzle out of a picture of one. The pipeline lives in core and is
// shared with the web app; the only thing that differs here is where the image
// comes from — a phone has a camera, so it gets one more way in.
const image = useImageImport()
const fileInput = shallowRef<HTMLInputElement | null>(null)
const cameraInput = shallowRef<HTMLInputElement | null>(null)

/** What OCR read, kept so a cell stops being flagged once it has been corrected. */
const recognisedText = shallowRef('')
const flagged = shallowRef<readonly number[]>([])

const lowConfidence = computed<ReadonlySet<number>>(() => {
  const unresolved = new Set<number>()
  for (const index of flagged.value) {
    const current = entry.board.value[index] ?? 0
    const asRead = recognisedText.value[index] ?? ''
    if (asRead === (current === 0 ? '.' : String(current))) unresolved.add(index)
  }
  return unresolved
})

async function readImage(blob: Blob | null | undefined) {
  if (!blob) return

  const recognised = await image.read(blob)
  if (!recognised) {
    haptics.warn()
    return
  }

  entry.text.value = recognised.text
  // After the board has taken the new text, so the watch above does not wipe
  // the flags we are about to set.
  await nextTick()
  recognisedText.value = recognised.text
  flagged.value = recognised.lowConfidence
  haptics.tick()
}

function onFilePicked(event: Event) {
  const input = event.target as HTMLInputElement
  void readImage(input.files?.[0])
  // Cleared so picking the same file again still fires a change.
  input.value = ''
}

/**
 * A screenshot pasted from the clipboard, which is how this gets used on a
 * tablet or under `nx serve`. A text paste still belongs to the textarea, so
 * anything without an image in it is left alone.
 */
function onPaste(event: ClipboardEvent) {
  const file = imageFrom(event.clipboardData)
  if (!file) return

  event.preventDefault()
  void readImage(file)
}

onMounted(() => window.addEventListener('paste', onPaste))
onUnmounted(() => window.removeEventListener('paste', onPaste))

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
          :hint-pattern="lowConfidence"
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
          capture="environment" opens the back camera directly in mobile Safari,
          Chrome and inside Capacitor's WebView — no native plugin needed. The
          plain picker beside it covers a screenshot already in the gallery.
        -->
        <div class="enter__sources">
          <button type="button" class="enter__source" @click="cameraInput?.click()">
            <IonIcon :icon="camera" aria-hidden="true" />
            Photo
          </button>
          <button type="button" class="enter__source" @click="fileInput?.click()">
            <IonIcon :icon="imageIcon" aria-hidden="true" />
            From image
          </button>
          <input
            ref="cameraInput"
            type="file"
            accept="image/*"
            capture="environment"
            class="enter__file"
            aria-label="Photograph a puzzle"
            @change="onFilePicked"
          />
          <input
            ref="fileInput"
            type="file"
            accept="image/*"
            class="enter__file"
            aria-label="Read a puzzle from an image"
            @change="onFilePicked"
          />
        </div>

        <p v-if="image.status.value === 'reading'" class="enter__scan" role="status">
          Reading the image…
        </p>
        <p v-else-if="image.errorMessage.value" class="enter__scan is-bad" role="status">
          {{ image.errorMessage.value }}
        </p>
        <p v-else-if="lowConfidence.size" class="enter__scan is-warn" role="status">
          {{ lowConfidence.size }} highlighted
          {{ lowConfidence.size === 1 ? 'cell is' : 'cells are' }} worth checking before you play.
        </p>
        <p v-else-if="image.status.value === 'done'" class="enter__scan is-good" role="status">
          Read from the image. Check it against the picture before you play.
        </p>

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
  color: var(--text-muted);
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
  color: var(--text-muted);
  font-size: 0.7rem;
  line-height: 1;
}

.pad__key.is-active .pad__key-count {
  color: inherit;
  opacity: 0.8;
}

.pad__key--action {
  font-size: 1.3rem;
}

/* Same 44px floor and the same look as the meta buttons beside them. */
.enter__sources {
  display: flex;
  gap: var(--gap-sm);
  width: 100%;
}

.enter__source {
  display: flex;
  flex: 1 1 0;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 44px;
  border: 1px solid var(--ion-color-light-shade, #d7d8da);
  border-radius: var(--radius-md);
  background: var(--ion-color-light, #f4f5f8);
  color: var(--ion-color-primary, #0054e9);
  font: inherit;
  font-size: 0.85rem;
}

.enter__source:active {
  background: var(--ion-color-light-shade, #d7d8da);
}

/* Driven by the buttons above; a bare file input has no styling worth keeping. */
.enter__file {
  display: none;
}

.enter__scan {
  width: 100%;
  color: var(--text-muted);
  font-size: 0.85rem;
}

.enter__scan.is-good {
  color: var(--ion-color-success-shade, #1f7a3d);
}

.enter__scan.is-warn {
  color: var(--hint-accent);
}

.enter__scan.is-bad {
  color: var(--ion-color-danger, #c5000f);
}

.enter__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--gap-sm);
  width: 100%;
  color: var(--text-muted);
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

/* Were 18px-tall underlined text links about 30-47px wide — the worst targets
   in the app. Same job, sized like buttons. */
.enter__meta button {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 0 var(--gap-sm);
  border: 1px solid var(--ion-color-light-shade, #d7d8da);
  border-radius: var(--radius-md);
  background: var(--ion-color-light, #f4f5f8);
  color: var(--ion-color-primary, #0054e9);
  font: inherit;
  font-size: 0.8rem;
}

.enter__meta button:active {
  background: var(--ion-color-light-shade, #d7d8da);
}

.enter__actions {
  display: flex;
  gap: var(--gap-sm);
  width: 100%;
}

.enter__btn {
  flex: 1;
  /* Was 36px, under both platform minimums. */
  min-height: 44px;
  padding: 0 var(--gap-md);
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
  background: color-mix(in srgb, var(--ion-color-success, #2dd55b) 18%, transparent);
  color: var(--ion-color-success-shade, #1f7a3d);
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
  color: var(--text-muted);
  font-size: 0.75rem;
}
</style>
