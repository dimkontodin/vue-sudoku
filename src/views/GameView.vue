<script setup lang="ts">
import { onMounted, ref, shallowRef, watch } from 'vue';
import type { Difficulty } from '@/core/types';
import { createSudokuClient } from '@/workers/sudokuClient';
import { useSudoku } from '@/composables/useSudoku';
import { useTimer } from '@/composables/useTimer';
import { useBoardKeyboard } from '@/composables/useBoardKeyboard';
import SudokuBoard from '@/components/SudokuBoard.vue';
import NumberPad from '@/components/NumberPad.vue';
import GameStatusBar from '@/components/GameStatusBar.vue';
import DifficultyPicker from '@/components/DifficultyPicker.vue';

// The only "smart" component: it owns the composables and hands plain props
// down to components that know nothing about the game.
const client = createSudokuClient();

const game = useSudoku();
const timer = useTimer();

const difficulty = ref<Difficulty>('easy');
const isGenerating = shallowRef(false);
const hasWon = shallowRef(false);

useBoardKeyboard(game, { isEnabled: () => !isGenerating.value && !hasWon.value });

async function newGame() {
  isGenerating.value = true;
  hasWon.value = false;
  try {
    game.load(await client.generate(difficulty.value));
    timer.reset();
    timer.start();
  } finally {
    isGenerating.value = false;
  }
}

// Win detection lives here rather than in useSudoku: stopping the clock and
// showing a banner are view concerns, not rules.
watch(game.isSolved, (solved) => {
  if (!solved) return;
  hasWon.value = true;
  timer.pause();
});

onMounted(newGame);
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
      @toggle-timer="timer.toggle()"
    />

    <SudokuBoard
      :board="game.board.value"
      :notes="game.notes.value"
      :puzzle="game.puzzle.value"
      :selected-index="game.selectedIndex.value"
      :conflicts="game.conflicts.value"
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

    <Transition name="win">
      <p v-if="hasWon" class="game__win" role="status">Solved in {{ timer.formatted.value }}</p>
    </Transition>

    <p class="game__hint">
      Arrows move · 1–9 enter · <kbd>N</kbd> notes · <kbd>Ctrl</kbd>+<kbd>Z</kbd> undo
    </p>
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

.game__win {
  padding: $gap-sm $gap-lg;
  border-radius: $radius-md;
  background: color-mix(in srgb, var(--color-primary) 18%, var(--color-surface));
  color: var(--color-primary);
  font-weight: 600;
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

.win-enter-active {
  transition:
    opacity 0.25s ease,
    transform 0.25s ease;
}

.win-enter-from {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
