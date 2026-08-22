<script setup lang="ts">
import { onMounted, onUnmounted, shallowRef } from 'vue'
import { IonButton, IonSelect, IonSelectOption, IonSpinner } from '@ionic/vue'
import type { Difficulty } from '@sudoku-web/sudoku-core'
import { useSudoku, useTimer } from '@sudoku-web/sudoku-core'
import { createSudokuClient } from '../workers/sudokuClient'

// Deliberately its own small screen, not a port of the web app's GameView:
// same shared engine (useSudoku/useTimer/createSudokuClient), a distinct,
// Ionic-native UI. Proves the lib boundary rather than reusing web markup.

const client = createSudokuClient()
const game = useSudoku()
const timer = useTimer()

const difficulty = shallowRef<Difficulty>('easy')
const isGenerating = shallowRef(false)

async function newGame(): Promise<void> {
  isGenerating.value = true
  timer.reset()
  try {
    const puzzle = await client.generate(difficulty.value)
    game.load(puzzle)
    timer.start()
  } finally {
    isGenerating.value = false
  }
}

onMounted(newGame)
onUnmounted(() => client.dispose())

function cellClass(index: number): string {
  const classes = ['cell']
  if (game.isGiven(index)) classes.push('cell--given')
  if (game.selectedIndex.value === index) classes.push('cell--selected')
  if (game.incorrectCells.value.has(index)) classes.push('cell--incorrect')
  return classes.join(' ')
}
</script>

<template>
  <div class="game">
    <div class="game__toolbar">
      <IonSelect v-model="difficulty" interface="popover" label="Difficulty">
        <IonSelectOption value="easy">Easy</IonSelectOption>
        <IonSelectOption value="medium">Medium</IonSelectOption>
        <IonSelectOption value="hard">Hard</IonSelectOption>
        <IonSelectOption value="expert">Expert</IonSelectOption>
      </IonSelect>
      <span class="game__timer">{{ timer.formatted.value }}</span>
      <IonButton size="small" :disabled="isGenerating" @click="newGame">New game</IonButton>
    </div>

    <IonSpinner v-if="isGenerating" name="crescent" />

    <div v-else class="board" role="grid" aria-label="Sudoku board">
      <button
        v-for="(value, index) in game.board.value"
        :key="index"
        type="button"
        :class="cellClass(index)"
        :disabled="game.isGiven(index)"
        @click="game.select(index)"
      >
        {{ value || '' }}
      </button>
    </div>

    <div class="numpad">
      <IonButton
        v-for="digit in 9"
        :key="digit"
        size="small"
        fill="outline"
        @click="game.inputDigit(digit)"
      >
        {{ digit }}
      </IonButton>
      <IonButton size="small" fill="outline" @click="game.erase()">⌫</IonButton>
    </div>
  </div>
</template>

<style scoped>
.game {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.game__toolbar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.game__timer {
  font-variant-numeric: tabular-nums;
  min-width: 3.5em;
}

.board {
  display: grid;
  grid-template-columns: repeat(9, minmax(0, 1fr));
  gap: 1px;
  width: min(100%, 28rem);
  aspect-ratio: 1;
  background: var(--ion-color-medium, #92949c);
}

.cell {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: clamp(0.9rem, 3.5vw, 1.2rem);
  background: var(--ion-background-color, #fff);
  border: none;
  padding: 0;
}

.cell--given {
  font-weight: 700;
}

.cell--selected {
  background: var(--ion-color-primary-tint, #cce4ff);
}

.cell--incorrect {
  color: var(--ion-color-danger, #c00);
}

.numpad {
  display: grid;
  grid-template-columns: repeat(5, auto);
  gap: 0.4rem;
}
</style>
