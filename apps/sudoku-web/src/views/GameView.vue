<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, watch } from 'vue'
import type { Difficulty } from '@vue-sudoku/sudoku-core'
import { createSudokuClient } from '@/workers/sudokuClient'
import { useSudoku } from '@vue-sudoku/sudoku-core'
import { useTimer } from '@vue-sudoku/sudoku-core'
import { useBoardKeyboard } from '@vue-sudoku/sudoku-core'
import { useGameStorage } from '@vue-sudoku/sudoku-core'
import { useStats } from '@vue-sudoku/sudoku-core'
import { useHints } from '@vue-sudoku/sudoku-core'
import { usePuzzleHandoff } from '@vue-sudoku/sudoku-core'
import SudokuBoard from '@/components/SudokuBoard.vue'
import NumberPad from '@/components/NumberPad.vue'
import GameControls from '@/components/GameControls.vue'
import GameStatusBar from '@/components/GameStatusBar.vue'
import DifficultyPicker from '@/components/DifficultyPicker.vue'
import WinDialog from '@/components/WinDialog.vue'
import HintPanel from '@/components/HintPanel.vue'

// The only "smart" component: it owns the composables and hands plain props
// down to components that know nothing about the game.
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
const showWinDialog = shallowRef(false)
const instantFeedback = shallowRef(false)
// Set by the Check button and cleared by the next edit — a snapshot answer to
// "how am I doing right now", not a persistent mode.
const isChecking = shallowRef(false)
const isBestTime = shallowRef(false)
// A hand-entered puzzle has no meaningful generator difficulty, so it is kept
// out of the stats rather than polluting a difficulty band it never belonged to.
const isCustom = shallowRef(false)

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

/**
 * `target` defaults to the current difficulty (the "New game" button) but can
 * differ from it (switching bands). The ref is only written once generation
 * resolves, alongside `game.load()` — never eagerly — so a save that lands
 * mid-generation can't pair the new difficulty label with the old puzzle.
 */
async function newGame(target: Difficulty = difficulty.value) {
  if (isGenerating.value) return

  isGenerating.value = true
  hasWon.value = false
  showWinDialog.value = false
  isChecking.value = false
  hints.reset()
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

function restart() {
  game.reset()
  isChecking.value = false
  hints.reset()
  hasWon.value = false
  timer.reset()
  timer.start()
}

/**
 * One press names the technique, the next shows where, the third applies it.
 * Spending a hint should teach the pattern, not just fill a cell.
 */
function hint() {
  hints.next(game.board.value, game.notes.value)
}

/** Applies the hinted step through the game, so it lands in history. */
function applyHint() {
  const step = hints.step.value
  if (!step) return

  // Tell the engine first: an elimination-only step may leave the board
  // untouched, and without this the next hint would repeat it forever.
  hints.apply(step)
  suppressHintReset = true
  game.markHintUsed()

  for (const { index, digit } of step.placements) {
    game.select(index)
    game.setValue(digit, index)
  }
  for (const { index, digit } of step.eliminations) {
    if (game.notesFor(index).includes(digit)) game.toggleNote(digit, index)
  }

  // Close the panel, but keep the accumulated candidates so the run continues.
  hints.reset(false)
}

/** The old behaviour, kept as the explicit give-up button. */
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

// Save on every board change, debounced: a burst of keystrokes would otherwise
// serialise four 81-entry arrays per press for no benefit.
let saveTimer: ReturnType<typeof setTimeout> | null = null

function cancelPendingSave() {
  if (saveTimer === null) return
  clearTimeout(saveTimer)
  saveTimer = null
}

// Set while applyHint() is editing, so its own writes do not throw away the
// candidate state it just updated.
let suppressHintReset = false

watch([game.board, game.notes], () => {
  isChecking.value = false
  // A standing hint describes the board as it was, so any edit invalidates it.
  if (suppressHintReset) suppressHintReset = false
  else hints.reset()
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

  if (!isCustom.value) {
    stats.recordWin({
      difficulty: difficulty.value,
      timeMs: timer.elapsedMs.value,
      hintsUsed: game.hintsUsed.value,
      mistakes: game.mistakes.value,
      date: new Date().toISOString(),
    })
  }

  // Drop the save the final move just scheduled, or it would land 400ms from
  // now and write the solved board straight back over this clear().
  cancelPendingSave()
  storage.clear()
  showWinDialog.value = true
})

onMounted(() => {
  // A puzzle handed over from /enter wins over any saved game: the player
  // just asked for it explicitly.
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
</script>

<template>
  <section class="game">
    <div class="game__toolbar">
      <DifficultyPicker
        :model-value="difficulty"
        :disabled="isGenerating"
        @update:model-value="selectDifficulty"
      />
      <button type="button" class="game__new" :disabled="isGenerating" @click="() => newGame()">
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

    <GameControls
      :can-hint="canHint"
      :instant-feedback="instantFeedback"
      :is-checking="isChecking"
      @hint="hint"
      @check="isChecking = true"
      @toggle-instant-feedback="instantFeedback = !instantFeedback"
      @fill-notes="fillNotes"
      @restart="restart"
    />

    <HintPanel
      :stage="hints.stage.value"
      :stuck="hints.stuck.value"
      :headline="hints.headline.value"
      :detail="hints.detail.value"
      :needs-notes="(hints.step.value?.placements.length ?? 0) === 0"
      @next="hint"
      @apply="applyHint"
      @dismiss="hints.reset()"
    />

    <p class="game__hint">
      <button type="button" class="game__reveal" @click="revealCell">Reveal a cell</button>
      · Arrows move · 1–9 enter · <kbd>N</kbd> notes · <kbd>Ctrl</kbd>+<kbd>Z</kbd> undo
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

  button {
    padding: 0;
    border: 0;
    background: none;
    color: var(--color-primary);
    font: inherit;
    text-decoration: underline;
  }

  kbd {
    padding: 1px 4px;
    border: 1px solid var(--color-border);
    border-radius: 3px;
    font-family: inherit;
    font-size: 0.9em;
  }
}
</style>
