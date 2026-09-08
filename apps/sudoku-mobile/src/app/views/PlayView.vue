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
  IonLabel,
  IonPage,
  IonSegment,
  IonSegmentButton,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/vue'
import { ellipsisHorizontal } from 'ionicons/icons'
import type { ActionSheetButton } from '@ionic/vue'
import type { Difficulty } from '@vue-sudoku/sudoku-core'
import {
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

const difficulty = ref<Difficulty>('easy')
const isGenerating = shallowRef(false)
const hasWon = shallowRef(false)
const showWinModal = shallowRef(false)
const showActions = shallowRef(false)
const instantFeedback = shallowRef(false)
const isChecking = shallowRef(false)
const isBestTime = shallowRef(false)
const isCustom = shallowRef(false)

// Kept even though a phone has no keys: it costs one listener, is inert under
// touch, and keeps `nx serve` and keyboard-attached Android tablets playable.
useBoardKeyboard(game, { isEnabled: () => !isGenerating.value && !hasWon.value })

const NO_CELLS: ReadonlySet<number> = new Set()

const incorrect = computed(() =>
  instantFeedback.value || isChecking.value ? game.incorrectCells.value : NO_CELLS,
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

  if (instantFeedback.value && game.mistakes.value > mistakesBefore) haptics.warn()
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

async function newGame() {
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
  try {
    game.load(await client.generate(difficulty.value))
    isCustom.value = false
    stats.recordStart(difficulty.value)
    timer.start()
    persist()
  } finally {
    isGenerating.value = false
  }
}

function selectDifficulty(next: Difficulty) {
  if (next === difficulty.value) return
  difficulty.value = next
  void newGame()
}

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
  {
    text: `Auto-check ${instantFeedback.value ? 'off' : 'on'}`,
    handler: () => void (instantFeedback.value = !instantFeedback.value),
  },
  { text: 'Fill notes', handler: fillNotes },
  { text: 'Redo', disabled: !game.canRedo.value, handler: redo },
  { text: `Haptics ${haptics.isEnabled.value ? 'off' : 'on'}`, handler: () => haptics.toggle() },
  { text: 'Reveal a cell', handler: revealCell },
  { text: 'Restart', role: 'destructive', handler: restart },
  { text: 'Cancel', role: 'cancel' },
])

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
    difficulty.value = 'hard'
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
      <IonToolbar>
        <IonTitle>Play</IonTitle>
        <IonButtons slot="end">
          <!-- No `disabled`/`aria-disabled` binding: Ionic 9 latches both onto
               its inner shadow button at hydration and never clears them, which
               left this permanently unclickable after the first generate. The
               changing label carries the state instead, and newGame() guards
               its own re-entry. -->
          <IonButton @click="newGame">
            {{ isGenerating ? 'Generating…' : 'New game' }}
          </IonButton>
          <IonButton aria-label="More actions" @click="showActions = true">
            <IonIcon slot="icon-only" :icon="ellipsisHorizontal" />
          </IonButton>
        </IonButtons>
      </IonToolbar>
      <IonToolbar>
        <IonSegment
          :value="difficulty"
          @ion-change="selectDifficulty(($event.detail.value ?? 'easy') as Difficulty)"
        >
          <IonSegmentButton value="easy"><IonLabel>Easy</IonLabel></IonSegmentButton>
          <IonSegmentButton value="medium"><IonLabel>Medium</IonLabel></IonSegmentButton>
          <IonSegmentButton value="hard"><IonLabel>Hard</IonLabel></IonSegmentButton>
          <IonSegmentButton value="expert"><IonLabel>Expert</IonLabel></IonSegmentButton>
        </IonSegment>
      </IonToolbar>
    </IonHeader>

    <IonContent class="ion-padding">
      <div class="game">
        <div class="game__status">
          <button type="button" class="game__timer" @click="timer.toggle()">
            {{ timer.formatted.value }} {{ timer.isRunning.value ? '❚❚' : '▶' }}
          </button>
          <span class="game__mistakes">Mistakes <strong>{{ game.mistakes.value }}</strong></span>
        </div>

        <IonSpinner v-if="isGenerating" name="crescent" />

        <template v-else>
          <div class="game__board">
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
          :can-hint="canHint"
          :active-digit="input.activeDigit.value"
          @digit="withFeedback(() => input.onDigitTap($event))"
          @hold-digit="withFeedback(() => input.onDigitLongPress($event))"
          @erase="eraseSelected"
          @toggle-notes="game.toggleNoteMode()"
          @undo="undo"
          @hint="hint"
        />
      </IonToolbar>
    </IonFooter>
  </IonPage>
</template>

<style scoped>
.game {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--gap-md);
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

.game__timer {
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.game__mistakes {
  color: var(--ion-color-medium, #92949c);
}

/* The board sizes itself from this wrapper — see --board-width in styles.css. */
.game__board {
  width: 100%;
  max-width: var(--board-width);
}

ion-footer ion-toolbar {
  --padding-start: var(--gap-sm);
  --padding-end: var(--gap-sm);
  --padding-top: var(--gap-sm);
  --padding-bottom: var(--gap-sm);
}
</style>
