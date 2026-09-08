<script setup lang="ts">
import { computed, onMounted, shallowRef, watch } from 'vue'
import { useRouter } from 'vue-router'
import { IonButton, IonContent, IonHeader, IonLabel, IonPage, IonSegment, IonSegmentButton, IonTitle, IonToolbar } from '@ionic/vue'
import {
  CELLS,
  boxOf,
  usePuzzleAnalysis,
  usePuzzleHandoff,
  useSolver,
  useSolverHandoff,
} from '@vue-sudoku/sudoku-core'
import type { Difficulty, SolveSpeed } from '@vue-sudoku/sudoku-core'
import { createSudokuClient } from '../../workers/sudokuClient'

// Standalone visualiser, same as the web app's SolverView: it renders a bare
// grid because it shows a search in progress, which has no givens/selection.
//
// The puzzle it searches comes from the generator or straight from the Enter
// tab, and the same analysis the Enter tab offers sits under the grid here:
// what brute force proves (a solution exists) and what grading explains (how a
// person would get there) are different questions about the same board.

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard', 'expert']
const SPEEDS: SolveSpeed[] = ['slow', 'medium', 'fast', 'instant']

const router = useRouter()
const solver = useSolver(createSudokuClient)
const solverHandoff = useSolverHandoff()
const playHandoff = usePuzzleHandoff()

const puzzle = shallowRef<Uint8Array | null>(null)
const difficulty = shallowRef<Difficulty>('hard')
const speed = shallowRef<SolveSpeed>('fast')
const isGenerating = shallowRef(false)
/** True while the grid on screen came from the Enter tab, not the generator. */
const isCustom = shallowRef(false)

const analysis = usePuzzleAnalysis(() => puzzle.value)

// A verdict belongs to the grid it was run on, so a new puzzle drops it.
watch(puzzle, () => analysis.reset())

const cells = computed(() => {
  const source = solver.board.value ?? puzzle.value
  if (!source) return []

  return Array.from({ length: CELLS }, (_, index) => ({
    index,
    value: source[index] ?? 0,
    isClue: (puzzle.value?.[index] ?? 0) !== 0,
    boxShade: boxOf(index) % 2 === 0,
  }))
})

async function newPuzzle() {
  solver.reset()
  isGenerating.value = true
  try {
    const result = await solver.generate(difficulty.value)
    puzzle.value = result.puzzle
    isCustom.value = false
  } finally {
    isGenerating.value = false
  }
}

function startSolve() {
  if (puzzle.value) solver.solve(puzzle.value, speed.value)
}

/** Sends a graded, uniquely-solvable grid on to the game. */
function play() {
  const solution = analysis.validation.value?.solution
  if (!puzzle.value || !analysis.canPlay.value || !solution) return

  playHandoff.set({
    puzzle: puzzle.value.slice(),
    solution: solution.slice(),
    difficulty: analysis.grading.value?.difficulty ?? null,
  })
  void router.push('/tabs/play')
}

onMounted(() => {
  // A grid handed over from the Enter tab wins over generating one: the user
  // asked for this puzzle specifically, and it may well be unsolvable or
  // ambiguous, which is exactly what they came here to watch.
  const entered = solverHandoff.take()
  if (entered) {
    puzzle.value = entered
    isCustom.value = true
    return
  }
  void newPuzzle()
})
</script>

<template>
  <IonPage>
    <IonHeader>
      <IonToolbar><IonTitle>Solver</IonTitle></IonToolbar>
      <IonToolbar>
        <IonSegment
          :value="difficulty"
          @ion-change="difficulty = (($event.detail.value ?? 'hard') as Difficulty)"
        >
          <IonSegmentButton v-for="option in DIFFICULTIES" :key="option" :value="option">
            <IonLabel>{{ option }}</IonLabel>
          </IonSegmentButton>
        </IonSegment>
      </IonToolbar>
    </IonHeader>

    <IonContent class="ion-padding">
      <div class="solver">
        <div class="solver__controls">
          <IonSegment
            :value="speed"
            @ion-change="speed = (($event.detail.value ?? 'fast') as SolveSpeed)"
          >
            <IonSegmentButton v-for="option in SPEEDS" :key="option" :value="option">
              <IonLabel>{{ option }}</IonLabel>
            </IonSegmentButton>
          </IonSegment>

          <!--
            "New puzzle" and "Solve" use native <button>s, not IonButton:
            Ionic 9 copies `disabled`/`aria-*` onto its inner shadow button
            once at hydration and never syncs them again, so a binding that
            flips back to false leaves the control permanently dead (verified
            live; see NumberPad.vue for the same fix). Cancel is unaffected —
            it is freshly mounted each time it appears, never toggled in place.
          -->
          <div class="solver__buttons">
            <button
              type="button"
              class="solver__btn solver__btn--outline"
              :disabled="isGenerating || solver.isSolving.value"
              @click="newPuzzle"
            >
              {{ isGenerating ? 'Generating…' : 'New puzzle' }}
            </button>
            <button
              v-if="!solver.isSolving.value"
              type="button"
              class="solver__btn solver__btn--solid"
              :disabled="!puzzle"
              @click="startSolve"
            >
              Solve
            </button>
            <IonButton v-else size="small" color="danger" @click="solver.cancel()">Cancel</IonButton>
          </div>
        </div>

        <p v-if="isCustom" class="solver__source">
          Searching the puzzle you entered.
          <RouterLink to="/tabs/enter">Back to editing</RouterLink>
        </p>

        <div class="board" role="grid" aria-label="Sudoku board">
          <div
            v-for="cell in cells"
            :key="cell.index"
            class="board__cell"
            :class="{ 'is-clue': cell.isClue, 'is-shaded': cell.boxShade }"
          >
            {{ cell.value || '' }}
          </div>
        </div>

        <dl class="stats">
          <div><dt>Status</dt><dd>{{ solver.status.value }}</dd></div>
          <div><dt>Steps</dt><dd>{{ solver.steps.value.toLocaleString() }}</dd></div>
          <div><dt>Backtracks</dt><dd>{{ solver.backtracks.value.toLocaleString() }}</dd></div>
          <div><dt>Depth</dt><dd>{{ solver.depth.value }}</dd></div>
          <div><dt>Steps/sec</dt><dd>{{ solver.stepsPerSecond.value.toLocaleString() }}</dd></div>
          <div><dt>Elapsed</dt><dd>{{ Math.round(solver.elapsedMs.value) }} ms</dd></div>
        </dl>

        <p v-if="solver.errorMessage.value" class="error">{{ solver.errorMessage.value }}</p>

        <!--
          The same checks the Enter tab offers, on whatever grid is loaded here:
          is it valid, does it have exactly one solution, and which techniques
          would a person need? Brute force answers none of those.
        -->
        <div class="analysis">
          <div class="analysis__buttons">
            <button
              type="button"
              class="analysis__btn analysis__btn--outline"
              :disabled="!puzzle || analysis.isChecking.value"
              @click="analysis.check()"
            >
              {{ analysis.isChecking.value ? 'Analysing…' : 'Analyse' }}
            </button>
            <button
              type="button"
              class="analysis__btn analysis__btn--solid"
              :disabled="!analysis.canPlay.value"
              @click="play"
            >
              Play it
            </button>
          </div>

          <p
            v-if="analysis.validation.value"
            class="analysis__verdict"
            :class="analysis.validation.value.verdict === 'unique' ? 'is-good' : 'is-bad'"
            role="status"
          >
            {{ analysis.validation.value.message }} — {{ analysis.validation.value.clues }} clues
          </p>

          <div v-if="analysis.grading.value" class="analysis__grading">
            <p>
              Graded <strong>{{ analysis.grading.value.difficulty }}</strong>
              <template v-if="!analysis.grading.value.solved">
                — though it needs techniques beyond this solver, so it may be harder still.
              </template>
            </p>
            <p v-if="analysis.grading.value.techniques.length" class="analysis__techniques">
              Techniques used: {{ analysis.grading.value.techniques.join(', ') }}
            </p>
          </div>
        </div>
      </div>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.solver {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--gap-lg);
}

.solver__controls {
  display: flex;
  flex-direction: column;
  gap: var(--gap-sm);
  width: 100%;
}

.solver__buttons {
  display: flex;
  gap: var(--gap-xs);
}

.solver__buttons ion-button {
  margin: 0;
}

.solver__source {
  width: 100%;
  margin: calc(var(--gap-lg) * -1 + var(--gap-xs)) 0 0;
  color: var(--ion-color-medium, #92949c);
  font-size: 0.8rem;
}

.solver__source a {
  color: var(--ion-color-primary, #3880ff);
}

.solver__btn,
.analysis__btn {
  height: 27.3px;
  padding: 0 12px;
  border-radius: var(--radius-sm);
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  touch-action: manipulation;
  user-select: none;
}

.solver__btn--outline,
.analysis__btn--outline {
  border: 1.6px solid var(--ion-color-primary, #3880ff);
  background: transparent;
  color: var(--ion-color-primary, #3880ff);
}

.solver__btn--solid,
.analysis__btn--solid {
  border: 0;
  background: var(--ion-color-primary, #3880ff);
  color: var(--ion-color-primary-contrast, #fff);
}

.solver__btn:disabled,
.analysis__btn:disabled {
  opacity: 0.5;
  pointer-events: none;
}

.board {
  display: grid;
  grid-template-columns: repeat(9, var(--cell-size));
  border: var(--box-line) solid var(--ion-color-dark, #222428);
  background: var(--ion-color-medium, #92949c);
  gap: var(--grid-line);
}

.board__cell {
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 1;
  background: var(--ion-background-color, #fff);
  font-variant-numeric: tabular-nums;
  font-size: 1.05rem;
  color: var(--ion-color-primary, #3880ff);
}

.board__cell.is-shaded {
  background: var(--ion-color-light, #f4f5f8);
}

.board__cell.is-clue {
  color: var(--ion-text-color, #000);
  font-weight: 600;
}

.stats {
  display: flex;
  flex-wrap: wrap;
  gap: var(--gap-md);
  margin: 0;
  font-size: 0.85rem;
}

.stats div {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.stats dt {
  color: var(--ion-color-medium, #92949c);
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.stats dd {
  margin: 0;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.analysis {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--gap-sm);
  width: 100%;
}

.analysis__buttons {
  display: flex;
  gap: var(--gap-xs);
}

.analysis__verdict {
  width: 100%;
  padding: var(--gap-sm) var(--gap-md);
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
}

.analysis__verdict.is-good {
  background: color-mix(in srgb, var(--ion-color-primary, #3880ff) 14%, transparent);
  color: var(--ion-color-primary, #3880ff);
}

.analysis__verdict.is-bad {
  background: color-mix(in srgb, var(--ion-color-danger, #eb445a) 14%, transparent);
  color: var(--ion-color-danger, #eb445a);
}

.analysis__grading {
  width: 100%;
  font-size: 0.8rem;
}

.analysis__grading strong {
  text-transform: capitalize;
}

.analysis__techniques {
  color: var(--ion-color-medium, #92949c);
  font-size: 0.75rem;
}

.error {
  color: var(--ion-color-danger, #eb445a);
}
</style>
