<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import {
  IonButton,
  IonContent,
  IonHeader,
  IonLabel,
  IonPage,
  IonSegment,
  IonSegmentButton,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/vue'
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

// Same composition as the web app's GameView: this is the only "smart"
// screen, owning the composables and handing plain state to dumb components.
const client = createSudokuClient()

const game = useSudoku()
const timer = useTimer()
const storage = useGameStorage()
const stats = useStats()
const hints = useHints()
const handoff = usePuzzleHandoff()

const difficulty = ref<Difficulty>('easy')
const isGenerating = shallowRef(false)
const hasWon = shallowRef(false)
const showWinModal = shallowRef(false)
const instantFeedback = shallowRef(false)
const isChecking = shallowRef(false)
const isBestTime = shallowRef(false)
const isCustom = shallowRef(false)

useBoardKeyboard(game, { isEnabled: () => !isGenerating.value && !hasWon.value })

const NO_CELLS: ReadonlySet<number> = new Set()

const incorrect = computed(() =>
  instantFeedback.value || isChecking.value ? game.incorrectCells.value : NO_CELLS,
)

const canHint = computed(() => !hasWon.value && game.board.value.some((value) => value === 0))

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
  isGenerating.value = true
  hasWon.value = false
  showWinModal.value = false
  isChecking.value = false
  hints.reset()
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
  hasWon.value = false
  timer.reset()
  timer.start()
}

function hint() {
  hints.next(game.board.value, game.notes.value)
}

function applyHint() {
  const step = hints.step.value
  if (!step) return

  hints.apply(step)
  suppressHintReset = true

  for (const { index, digit } of step.placements) {
    game.select(index)
    game.setValue(digit, index)
  }
  for (const { index, digit } of step.eliminations) {
    if (game.notesFor(index).includes(digit)) game.toggleNote(digit, index)
  }

  hints.reset(false)
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
        <IonButton slot="end" fill="clear" :disabled="isGenerating" @click="newGame">
          {{ isGenerating ? 'Generating…' : 'New game' }}
        </IonButton>
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
          <SudokuBoard
            :board="game.board.value"
            :notes="game.notes.value"
            :puzzle="game.puzzle.value"
            :selected-index="game.selectedIndex.value"
            :conflicts="game.conflicts.value"
            :incorrect="incorrect"
            :hint-pattern="hints.patternCells.value"
            :hint-targets="hints.targetCells.value"
            @select="game.select($event)"
          />

          <NumberPad
            :remaining-counts="game.remainingCounts.value"
            :note-mode="game.noteMode.value"
            :can-undo="game.canUndo.value"
            :can-redo="game.canRedo.value"
            @digit="game.inputDigit($event)"
            @erase="game.erase()"
            @toggle-notes="game.toggleNoteMode()"
            @undo="game.undo()"
            @redo="game.redo()"
          />

          <div class="game__controls">
            <IonButton size="small" fill="outline" :disabled="!canHint" @click="hint">Hint</IonButton>
            <IonButton
              size="small"
              :fill="isChecking ? 'solid' : 'outline'"
              @click="isChecking = true"
            >
              Check
            </IonButton>
            <IonButton
              size="small"
              :fill="instantFeedback ? 'solid' : 'outline'"
              @click="instantFeedback = !instantFeedback"
            >
              Auto-check {{ instantFeedback ? 'on' : 'off' }}
            </IonButton>
            <IonButton size="small" fill="outline" @click="fillNotes">Fill notes</IonButton>
            <IonButton size="small" fill="outline" @click="restart">Restart</IonButton>
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

          <p class="game__reveal">
            <button type="button" @click="revealCell">Reveal a cell</button>
          </p>
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
      </div>
    </IonContent>
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

.game__controls {
  display: flex;
  flex-wrap: wrap;
  gap: var(--gap-xs);
  width: 100%;
  max-width: var(--board-width);
}

.game__controls ion-button {
  flex: 1 1 auto;
  margin: 0;
}

.game__reveal {
  font-size: 0.75rem;
  color: var(--ion-color-medium, #92949c);
}

.game__reveal button {
  border: 0;
  background: none;
  color: var(--ion-color-primary, #3880ff);
  font: inherit;
  text-decoration: underline;
}
</style>
