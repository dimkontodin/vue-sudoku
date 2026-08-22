<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  IonButton,
  IonContent,
  IonHeader,
  IonPage,
  IonTextarea,
  IonTitle,
  IonToolbar,
} from '@ionic/vue'
import { CELLS, parseBoard, solveLogically, TECHNIQUE_META, usePuzzleHandoff, validatePuzzle } from '@vue-sudoku/sudoku-core'
import type { Validation } from '@vue-sudoku/sudoku-core'
import SudokuBoard from '../components/SudokuBoard.vue'

const router = useRouter()
const handoff = usePuzzleHandoff()

const text = ref('')
const validation = shallowRef<Validation | null>(null)
const isChecking = shallowRef(false)

const parsed = computed(() => parseBoard(text.value))
const board = computed(() => parsed.value.board ?? new Uint8Array(CELLS))
const emptyNotes = new Uint16Array(CELLS)
const NO_CELLS: ReadonlySet<number> = new Set()

const charCount = computed(() => text.value.replace(/\s/g, '').length)

const parseMessage = computed(() => {
  if (text.value.trim() === '') return ''
  if (parsed.value.error === 'characters') return 'Only digits, dots and underscores, please.'
  if (parsed.value.error === 'length') return `${charCount.value} of ${CELLS} cells.`
  return ''
})

const grading = computed(() => {
  if (validation.value?.verdict !== 'unique' || !parsed.value.board) return null

  const result = solveLogically(parsed.value.board, { allowUniquenessTechniques: true })
  const names = [...result.used]
    .map((id) => TECHNIQUE_META[id])
    .sort((a, b) => a.tier - b.tier || a.score - b.score)
    .map((meta) => meta.name)

  return { difficulty: result.difficulty, solved: result.solved, names }
})

watch(text, () => {
  validation.value = null
})

function check() {
  if (!parsed.value.board) return
  isChecking.value = true
  try {
    validation.value = validatePuzzle(parsed.value.board)
  } finally {
    isChecking.value = false
  }
}

function play() {
  if (validation.value?.verdict !== 'unique' || !parsed.value.board || !validation.value.solution) {
    return
  }
  handoff.set({
    puzzle: parsed.value.board.slice(),
    solution: validation.value.solution.slice(),
  })
  void router.push('/tabs/play')
}

function loadExample() {
  text.value = '..............3.85..1.2.......5.7.....4...1...9.......5......73..2.1........4...9'
}

function clear() {
  text.value = ''
  validation.value = null
}

const conflicts = computed<ReadonlySet<number>>(() => validation.value?.conflicts ?? NO_CELLS)
</script>

<template>
  <IonPage>
    <IonHeader>
      <IonToolbar><IonTitle>Enter</IonTitle></IonToolbar>
    </IonHeader>

    <IonContent class="ion-padding">
      <div class="enter">
        <p class="enter__intro">
          Paste or type a puzzle: 81 cells, row by row, using a dot or zero for blanks.
        </p>

        <IonTextarea
          v-model="text"
          class="enter__input"
          :rows="4"
          placeholder="..............3.85..1.2......."
          aria-label="Puzzle as 81 characters"
        />

        <div class="enter__meta">
          <span :class="{ 'is-ready': charCount === CELLS }">{{ charCount }} / {{ CELLS }}</span>
          <span v-if="parseMessage" class="enter__parse">{{ parseMessage }}</span>
          <span class="enter__spacer" />
          <button type="button" @click="loadExample">Example</button>
          <button type="button" @click="clear">Clear</button>
        </div>

        <SudokuBoard
          :board="board"
          :notes="emptyNotes"
          :puzzle="board"
          :selected-index="null"
          :conflicts="conflicts"
          :incorrect="NO_CELLS"
        />

        <div class="enter__actions">
          <IonButton fill="outline" :disabled="parsed.error !== null || isChecking" @click="check">
            {{ isChecking ? 'Checking…' : 'Check puzzle' }}
          </IonButton>
          <IonButton :disabled="validation?.verdict !== 'unique'" @click="play">Play it</IonButton>
        </div>

        <p
          v-if="validation"
          class="enter__verdict"
          :class="validation.verdict === 'unique' ? 'is-good' : 'is-bad'"
          role="status"
        >
          {{ validation.message }} — {{ validation.clues }} clues
        </p>

        <div v-if="grading" class="enter__grading">
          <p>
            Graded <strong>{{ grading.difficulty }}</strong>
            <template v-if="!grading.solved">
              — though it needs techniques beyond this solver, so it may be harder still.
            </template>
          </p>
          <p v-if="grading.names.length" class="enter__techniques">
            Techniques used: {{ grading.names.join(', ') }}
          </p>
        </div>
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

.enter__input {
  width: 100%;
  border: 1px solid var(--ion-color-light-shade, #d7d8da);
  border-radius: var(--radius-sm);
  font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  font-size: 0.8rem;
}

.enter__meta {
  display: flex;
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

.enter__actions ion-button {
  flex: 1;
  margin: 0;
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
  color: var(--ion-color-medium, #92949c);
  font-size: 0.75rem;
}
</style>
