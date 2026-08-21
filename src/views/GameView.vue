<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, watch } from 'vue'
import type { Difficulty } from '@/core/types'
import { createSudokuClient } from '@/workers/sudokuClient'
import { useSudoku } from '@/composables/useSudoku'
import { useTimer } from '@/composables/useTimer'
import { useBoardKeyboard } from '@/composables/useBoardKeyboard'
import { useGameStorage } from '@/composables/useGameStorage'
import { useStats } from '@/composables/useStats'
import SudokuBoard from '@/components/SudokuBoard.vue'
import NumberPad from '@/components/NumberPad.vue'
import GameControls from '@/components/GameControls.vue'
import GameStatusBar from '@/components/GameStatusBar.vue'
import DifficultyPicker from '@/components/DifficultyPicker.vue'
import WinDialog from '@/components/WinDialog.vue'

// The only "smart" component: it owns the composables and hands plain props
// down to components that know nothing about the game.
const client = createSudokuClient()

const game = useSudoku()
const timer = useTimer()
const storage = useGameStorage()
const stats = useStats()

const difficulty = ref<Difficulty>('easy')
const isGenerating = shallowRef(false)
const hasWon = shallowRef(false)
const showWinDialog = shallowRef(false)
const instantFeedback = shallowRef(false)
// Set by the Check button and cleared by the next edit — a snapshot answer to
// "how am I doing right now", not a persistent mode.
const isChecking = shallowRef(false)
const isBestTime = shallowRef(false)

useBoardKeyboard(game, { isEnabled: () => !isGenerating.value && !hasWon.value })

const NO_CELLS: ReadonlySet<number> = new Set()

/** Wrong cells are only surfaced when the player asked — by mode or by button. */
const incorrect = computed(() =>
  instantFeedback.value || isChecking.value ? game.incorrectCells.value : NO_CELLS,
)

const canHint = computed(() => !hasWon.value && game.board.value.some((value) => value === 0))

function persist() {
  // A solved board is not worth restoring, and writing one back would undo the
  // clear() the win handler just did.
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
  showWinDialog.value = false
  isChecking.value = false
  try {
    game.load(await client.generate(difficulty.value))
    stats.recordStart(difficulty.value)
    timer.reset()
    timer.start()
    persist()
  } finally {
    isGenerating.value = false
  }
}

function restart() {
  game.reset()
  isChecking.value = false
  hasWon.value = false
  timer.reset()
  timer.start()
}

function hint() {
  const selected = game.selectedIndex.value
  // Fall back to the first empty cell so the button always does something.
  if (selected === null || game.isGiven(selected) || (game.board.value[selected] ?? 0) !== 0) {
    const firstEmpty = game.board.value.findIndex((value) => value === 0)
    if (firstEmpty === -1) return
    game.select(firstEmpty)
  }
  game.reveal()
}

// Save on every board change, debounced: a burst of keystrokes would otherwise
// serialise four 81-entry arrays per press for no benefit.
let saveTimer: ReturnType<typeof setTimeout> | null = null

function cancelPendingSave() {
  if (saveTimer === null) return
  clearTimeout(saveTimer)
  saveTimer = null
}

watch([game.board, game.notes], () => {
  isChecking.value = false
  cancelPendingSave()
  saveTimer = setTimeout(persist, 400)
})

// Win detection lives here rather than in useSudoku: stopping the clock,
// recording stats and showing a dialog are view concerns, not rules.
watch(game.isSolved, (solved) => {
  if (!solved || hasWon.value) return

  hasWon.value = true
  timer.pause()

  // Read the previous best BEFORE recording this win, or it compares to itself.
  const previousBest = stats.summaries.value.find(
    (summary) => summary.difficulty === difficulty.value,
  )?.bestMs
  isBestTime.value = previousBest === null || timer.elapsedMs.value < (previousBest ?? Infinity)

  stats.recordWin({
    difficulty: difficulty.value,
    timeMs: timer.elapsedMs.value,
    hintsUsed: game.hintsUsed.value,
    mistakes: game.mistakes.value,
    date: new Date().toISOString(),
  })

  // Drop the save the final move just scheduled, or it would land 400ms from
  // now and write the solved board straight back over this clear().
  cancelPendingSave()
  storage.clear()
  showWinDialog.value = true
})

onMounted(() => {
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
</script>

<template>
  <section class="game">
    <div class="game__toolbar">
      <DifficultyPicker v-model="difficulty" :disabled="isGenerating" />
      <button type="button" class="game__new" :disabled="isGenerating" @click="newGame">
        {{ isGenerating ? 'Generating…' : 'New game' }}
      </button>
    </div>

    <GameStatusBar
      :difficulty="difficulty"
      :elapsed="timer.formatted.value"
      :is-running="timer.isRunning.value"
      :mistakes="game.mistakes.value"
      @toggle-timer="timer.toggle()"
    />

    <SudokuBoard
      :board="game.board.value"
      :notes="game.notes.value"
      :puzzle="game.puzzle.value"
      :selected-index="game.selectedIndex.value"
      :conflicts="game.conflicts.value"
      :incorrect="incorrect"
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

    <GameControls
      :can-hint="canHint"
      :instant-feedback="instantFeedback"
      :is-checking="isChecking"
      @hint="hint"
      @check="isChecking = true"
      @toggle-instant-feedback="instantFeedback = !instantFeedback"
      @restart="restart"
    />

    <p class="game__hint">
      Arrows move · 1–9 enter · <kbd>N</kbd> notes · <kbd>Ctrl</kbd>+<kbd>Z</kbd> undo
    </p>

    <WinDialog
      :open="showWinDialog"
      :difficulty="difficulty"
      :elapsed="timer.formatted.value"
      :mistakes="game.mistakes.value"
      :hints-used="game.hintsUsed.value"
      :is-best-time="isBestTime"
      @new-game="newGame"
      @dismiss="showWinDialog = false"
    />
  </section>
</template>

<style scoped lang="scss">
.game {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $gap-md;
}

.game__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: $gap-md;
  width: 100%;
  max-width: $board-width;
}

.game__new {
  padding: $gap-xs $gap-md;
  border: 1px solid var(--color-border);
  border-radius: $radius-sm;
  background: var(--color-surface-raised);
  font-size: 0.85rem;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.game__hint {
  max-width: $board-width;
  color: var(--color-text-muted);
  font-size: 0.75rem;
  text-align: center;

  kbd {
    padding: 1px 4px;
    border: 1px solid var(--color-border);
    border-radius: 3px;
    font-family: inherit;
    font-size: 0.9em;
  }
}
</style>
