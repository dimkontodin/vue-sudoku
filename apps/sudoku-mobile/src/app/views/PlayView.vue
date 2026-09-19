<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import {
  IonActionSheet,
  IonButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonPage,
  IonSpinner,
  IonToolbar,
} from '@ionic/vue'
import { chevronDown, ellipsisHorizontal, pause, play } from 'ionicons/icons'
import type { ActionSheetButton } from '@ionic/vue'
import type { Difficulty } from '@vue-sudoku/sudoku-core'
import {
  DIFFICULTIES,
  useBoardKeyboard,
  useGameStorage,
  useHints,
  usePuzzleHandoff,
  useStats,
  useSudoku,
  useTimer,
} from '@vue-sudoku/sudoku-core'
import { createSudokuClient } from '../../workers/sudokuClient'
import SudokuBoard from '../components/SudokuBoard.vue'
import NumberPad from '../components/NumberPad.vue'
import HintBanner from '../components/HintBanner.vue'
import WinModal from '../components/WinModal.vue'
import { useDigitFirst, type InputFeedback } from '../composables/useDigitFirst'
import { useGameplayPrefs } from '../composables/useGameplayPrefs'
import { useBoardFit } from '../composables/useBoardFit'
import { useHaptics } from '../composables/useHaptics'

// Same composition as the web app's GameView: this is the only "smart"
// screen, owning the composables and handing plain state to dumb components.
// What differs is the input layer — useDigitFirst turns taps into moves, and
// the pad lives in a pinned footer instead of scrolling with the content.
const client = createSudokuClient()

const game = useSudoku()
const timer = useTimer()
const storage = useGameStorage()
const stats = useStats()
const hints = useHints()
const handoff = usePuzzleHandoff()
const input = useDigitFirst(game)
const haptics = useHaptics()
const prefs = useGameplayPrefs()
const fit = useBoardFit()

const difficulty = ref<Difficulty>('easy')
const isGenerating = shallowRef(false)
const hasWon = shallowRef(false)
const showWinModal = shallowRef(false)
const showActions = shallowRef(false)
const showDifficulties = shallowRef(false)
const showRestartConfirm = shallowRef(false)
const isChecking = shallowRef(false)
const isBestTime = shallowRef(false)
const isCustom = shallowRef(false)

// Kept even though a phone has no keys: it costs one listener, is inert under
// touch, and keeps `nx serve` and keyboard-attached Android tablets playable.
useBoardKeyboard(game, { isEnabled: () => !isGenerating.value && !hasWon.value })

const NO_CELLS: ReadonlySet<number> = new Set()

const incorrect = computed(() =>
  prefs.autoCheck.value || isChecking.value ? game.incorrectCells.value : NO_CELLS,
)

const canHint = computed(() => !hasWon.value && game.board.value.some((value) => value === 0))

/**
 * Runs one board interaction and picks the matching haptic.
 *
 * The warning buzz is gated on auto-check on purpose: `mistakes` increments
 * whether or not the player asked to be told, so buzzing unconditionally would
 * quietly reveal every wrong digit the moment it was entered.
 */
function withFeedback(action: () => InputFeedback): void {
  const mistakesBefore = game.mistakes.value
  const result = action()
  if (result === 'none') return

  if (prefs.autoCheck.value && game.mistakes.value > mistakesBefore) haptics.warn()
  else haptics.tick()
}

function undo(): void {
  if (game.undo()) haptics.tick()
}

function redo(): void {
  if (game.redo()) haptics.tick()
}

function eraseSelected(): void {
  withFeedback(() => (game.erase(), 'erase'))
}

function persist() {
  if (hasWon.value) return
  storage.save({
    difficulty: difficulty.value,
    puzzle: game.puzzle.value,
    solution: game.solution.value,
    board: game.board.value,
    notes: game.notes.value,
    elapsedMs: timer.elapsedMs.value,
    mistakes: game.mistakes.value,
    hintsUsed: game.hintsUsed.value,
  })
}

/**
 * `target` defaults to the current difficulty (the header's own new-game
 * button) but can differ from it (switching bands). The ref is only written
 * once generation resolves, alongside `game.load()` — never eagerly — so a
 * save that lands mid-generation can't pair the new difficulty label with the
 * old puzzle.
 */
async function newGame(target: Difficulty = difficulty.value) {
  // Guards re-entry in place of a `disabled` binding on the button.
  if (isGenerating.value) return

  isGenerating.value = true
  hasWon.value = false
  showWinModal.value = false
  isChecking.value = false
  hints.reset()
  input.disarm()
  timer.pause()
  timer.reset()
  cancelPendingSave()
  try {
    const generated = await client.generate(target)
    difficulty.value = target
    game.load(generated)
    isCustom.value = false
    stats.recordStart(target)
    timer.start()
    persist()
  } finally {
    isGenerating.value = false
  }
}

function selectDifficulty(next: Difficulty) {
  if (next === difficulty.value) return
  void newGame(next)
}

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  expert: 'Expert',
}

const difficultyLabel = computed(() => DIFFICULTY_LABELS[difficulty.value])

/**
 * Difficulty moved out of a second toolbar and into a sheet off the header.
 * An IonSegment needs a full row to itself and still truncated every label past
 * four characters at phone width ("MEDI…", "EXPE…"), and that row was the single
 * biggest reason the board did not fit a 360x640 screen.
 */
const difficultyButtons = computed<ActionSheetButton[]>(() => [
  ...DIFFICULTIES.map((value) => ({
    text: value === difficulty.value ? `${DIFFICULTY_LABELS[value]} ✓` : DIFFICULTY_LABELS[value],
    handler: () => selectDifficulty(value),
  })),
  { text: 'Cancel', role: 'cancel' },
])

function restart() {
  game.reset()
  isChecking.value = false
  hints.reset()
  input.disarm()
  hasWon.value = false
  timer.reset()
  timer.start()
}

function hint() {
  if (!canHint.value) return
  hints.next(game.board.value, game.notes.value)
}

function applyHint() {
  const step = hints.step.value
  if (!step) return

  hints.apply(step)
  suppressHintReset = true
  input.disarm()
  game.markHintUsed()

  for (const { index, digit } of step.placements) {
    game.select(index)
    game.setValue(digit, index)
  }
  for (const { index, digit } of step.eliminations) {
    if (game.notesFor(index).includes(digit)) game.toggleNote(digit, index)
  }

  hints.reset(false)
  haptics.tick()
}

function revealCell() {
  const selected = game.selectedIndex.value
  if (selected === null || game.isGiven(selected) || (game.board.value[selected] ?? 0) !== 0) {
    const firstEmpty = game.board.value.findIndex((value) => value === 0)
    if (firstEmpty === -1) return
    game.select(firstEmpty)
  }
  game.reveal()
}

function fillNotes() {
  game.fillNotes()
}

/**
 * Everything that is not digit entry. Six buttons under the board pushed the pad
 * out of thumb reach and gave setup actions the same weight as playing ones.
 */
const actionButtons = computed<ActionSheetButton[]>(() => [
  { text: 'Check now', handler: () => void (isChecking.value = true) },
  { text: 'Fill notes', handler: fillNotes },
  { text: 'Reveal a cell', handler: revealCell },
  // Opens a confirmation rather than wiping the board on the first tap. The
  // sheet has to close before the next one opens, hence the deferred flag.
  { text: 'Restart', role: 'destructive', handler: () => void (showRestartConfirm.value = true) },
  { text: 'Cancel', role: 'cancel' },
])

/** Standing preferences (auto-check, haptics, theme) now live on Settings, and
    Redo moved next to Undo on the pad — an undo-stack op belongs with Undo, not
    five items deep in an overflow menu. */
const restartButtons: ActionSheetButton[] = [
  { text: 'Restart', role: 'destructive', handler: restart },
  { text: 'Cancel', role: 'cancel' },
]

let saveTimer: ReturnType<typeof setTimeout> | null = null

function cancelPendingSave() {
  if (saveTimer === null) return
  clearTimeout(saveTimer)
  saveTimer = null
}

let suppressHintReset = false

watch([game.board, game.notes], () => {
  isChecking.value = false
  if (suppressHintReset) suppressHintReset = false
  else hints.reset()
  cancelPendingSave()
  saveTimer = setTimeout(persist, 400)
})

watch(game.isSolved, (solved) => {
  if (!solved || hasWon.value) return

  hasWon.value = true
  timer.pause()
  input.disarm()
  haptics.succeed()

  const previousBest = stats.summaries.value.find(
    (summary) => summary.difficulty === difficulty.value,
  )?.bestMs
  isBestTime.value = previousBest === null || timer.elapsedMs.value < (previousBest ?? Infinity)

  if (!isCustom.value) {
    stats.recordWin({
      difficulty: difficulty.value,
      timeMs: timer.elapsedMs.value,
      hintsUsed: game.hintsUsed.value,
      mistakes: game.mistakes.value,
      date: new Date().toISOString(),
    })
  }

  cancelPendingSave()
  storage.clear()
  showWinModal.value = true
})

onMounted(() => {
  const entered = handoff.take()
  if (entered) {
    game.load(entered)
    // Ungraded verdicts (ambiguous, too-hard-to-grade) have no band to show —
    // 'hard' is a reasonable label for "harder than this solver can grade,"
    // not a stand-in for "we didn't check."
    difficulty.value = entered.difficulty ?? 'hard'
    isCustom.value = true
    timer.reset()
    timer.start()
    persist()
    return
  }

  const saved = storage.restore()
  if (saved) {
    difficulty.value = saved.difficulty
    game.restore(saved)
    timer.setElapsed(saved.elapsedMs)
    timer.start()
    return
  }
  void newGame()
})

onUnmounted(() => client.dispose())
</script>

<template>
  <IonPage>
    <IonHeader>
      <!-- One toolbar, not two. The difficulty IonSegment used to own a second
           row: 56px of permanent furniture that pushed the board off the bottom
           of a 360x640 screen, and it truncated its own labels anyway. -->
      <IonToolbar>
        <IonButtons slot="start">
          <IonButton
            :aria-label="`Difficulty: ${difficultyLabel}. Change difficulty`"
            @click="showDifficulties = true"
          >
            {{ difficultyLabel }}
            <IonIcon slot="end" :icon="chevronDown" aria-hidden="true" />
          </IonButton>
        </IonButtons>
        <IonButtons slot="end">
          <!-- No `disabled`/`aria-disabled` binding: Ionic 9 latches both onto
               its inner shadow button at hydration and never clears them, which
               left this permanently unclickable after the first generate. The
               changing label carries the state instead, and newGame() guards
               its own re-entry. -->
          <IonButton @click="() => newGame()">
            {{ isGenerating ? 'Generating…' : 'New game' }}
          </IonButton>
          <IonButton aria-label="More actions" @click="showActions = true">
            <IonIcon slot="icon-only" :icon="ellipsisHorizontal" />
          </IonButton>
        </IonButtons>
      </IonToolbar>
    </IonHeader>

    <IonContent class="ion-padding" :ref="fit.setContent">
      <div class="game">
        <div :ref="fit.setReserve" class="game__status">
          <button
            type="button"
            class="game__timer"
            :aria-label="timer.isRunning.value ? 'Pause timer' : 'Resume timer'"
            @click="timer.toggle()"
          >
            <IonIcon :icon="timer.isRunning.value ? pause : play" aria-hidden="true" />
            <span>{{ timer.formatted.value }}</span>
          </button>
          <span class="game__counts">
            <!-- The mistakes tally is withheld unless the player asked for it:
                 with highlighting off the board gives nothing away, but a
                 counter ticking up as a digit lands still says "that one was
                 wrong". Hints used carries no such signal. -->
            <span v-if="prefs.mistakesVisible.value" class="game__count">
              Mistakes <strong>{{ game.mistakes.value }}</strong>
            </span>
            <span class="game__count"
              >Hints <strong>{{ game.hintsUsed.value }}</strong></span
            >
          </span>
        </div>

        <IonSpinner v-if="isGenerating" name="crescent" />

        <template v-else>
          <div class="game__board" :style="{ '--board-fit': `${fit.available.value}px` }">
            <SudokuBoard
              :board="game.board.value"
              :notes="game.notes.value"
              :puzzle="game.puzzle.value"
              :selected-index="game.selectedIndex.value"
              :conflicts="game.conflicts.value"
              :incorrect="incorrect"
              :hint-pattern="hints.patternCells.value"
              :hint-targets="hints.targetCells.value"
              :highlight-value="input.highlightValue.value"
              @select="withFeedback(() => input.onCellTap($event))"
              @long-press="withFeedback(() => input.onCellLongPress($event))"
            />
          </div>

          <HintBanner
            :stage="hints.stage.value"
            :stuck="hints.stuck.value"
            :headline="hints.headline.value"
            :detail="hints.detail.value"
            :needs-notes="(hints.step.value?.placements.length ?? 0) === 0"
            @next="hint"
            @apply="applyHint"
            @dismiss="hints.reset()"
          />
        </template>

        <WinModal
          :open="showWinModal"
          :difficulty="difficulty"
          :elapsed="timer.formatted.value"
          :mistakes="game.mistakes.value"
          :hints-used="game.hintsUsed.value"
          :is-best-time="isBestTime"
          @new-game="newGame"
          @dismiss="showWinModal = false"
        />

        <IonActionSheet
          :is-open="showActions"
          header="Board actions"
          :buttons="actionButtons"
          @did-dismiss="showActions = false"
        />

        <IonActionSheet
          :is-open="showDifficulties"
          header="Difficulty"
          sub-header="Starts a new puzzle"
          :buttons="difficultyButtons"
          @did-dismiss="showDifficulties = false"
        />

        <IonActionSheet
          :is-open="showRestartConfirm"
          header="Restart this puzzle?"
          sub-header="Your entries are cleared. The givens stay."
          :buttons="restartButtons"
          @did-dismiss="showRestartConfirm = false"
        />
      </div>
    </IonContent>

    <!-- Pinned, so the pad is always under the thumb no matter how far the
         board or the hint banner has scrolled. -->
    <IonFooter v-if="!isGenerating" class="ion-no-border">
      <IonToolbar>
        <NumberPad
          :remaining-counts="game.remainingCounts.value"
          :note-mode="game.noteMode.value"
          :can-undo="game.canUndo.value"
          :can-redo="game.canRedo.value"
          :can-hint="canHint"
          :active-digit="input.activeDigit.value"
          @digit="withFeedback(() => input.onDigitTap($event))"
          @hold-digit="withFeedback(() => input.onDigitLongPress($event))"
          @erase="eraseSelected"
          @toggle-notes="game.toggleNoteMode()"
          @undo="undo"
          @redo="redo"
          @hint="hint"
        />
      </IonToolbar>
    </IonFooter>
  </IonPage>
</template>

<style scoped>
/* Ionic's toolbar buttons default to 32px tall. Difficulty and New game are
   primary controls now that the second toolbar is gone, so they get a real
   target instead of a text-sized one. */
ion-header ion-button {
  min-height: 44px;
  --padding-start: var(--gap-sm);
  --padding-end: var(--gap-sm);
}

.game {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--gap-md);
  min-height: 100%;
}

.game__status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--gap-md);
  width: 100%;
  max-width: var(--board-width);
  font-size: 0.85rem;
}

/* This is the pause/resume control, so it is sized like one. It used to be a
   20px-tall run of text whose only affordance was a ❚❚ glyph. */
.game__timer {
  display: flex;
  align-items: center;
  gap: var(--gap-xs);
  min-height: 44px;
  padding: 0 var(--gap-sm) 0 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.game__counts {
  display: flex;
  gap: var(--gap-md);
}

.game__count {
  color: var(--text-muted);
}

/* Two constraints, both real: the width the screen allows (--board-width) and
   the height IonContent actually has left, measured by useBoardFit. The height
   one is what stops the bottom row hiding behind the pinned pad. */
.game__board {
  width: 100%;
  max-width: min(var(--board-width), var(--board-fit, 100vmax));
  /* On a tall phone the board is limited by width, not height, so there is
     slack underneath it. Splitting that slack centres the board between the
     status row and the pad instead of leaving ~100px of dead space above the
     pad. Collapses to nothing when height is the binding constraint. */
  margin-block: auto;
}

ion-footer ion-toolbar {
  --padding-start: var(--gap-sm);
  --padding-end: var(--gap-sm);
  --padding-top: var(--gap-sm);
  /* The pad is the bottom-most thing on screen, so it is the one control that
     has to clear the home indicator itself — index.html asks for
     viewport-fit=cover and nothing was consuming the inset. */
  --padding-bottom: calc(var(--gap-sm) + env(safe-area-inset-bottom, 0px));
}
</style>
