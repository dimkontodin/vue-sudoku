import { computed, shallowRef } from 'vue'
import { CELLS } from '../core/constants'
import { computeCandidates } from '../core/candidates'
import { findNextStep } from '../core/logicalSolver'
import { noteMask } from '../core/notes'
import { TECHNIQUE_META } from '../core/techniques/types'
import type { TechniqueStep } from '../core/techniques/types'
import type { Board, Notes } from '../core/types'

/**
 * How much of a hint the player has asked for. Each press reveals one more
 * level rather than jumping straight to the answer, so a hint can teach the
 * pattern instead of just spending it.
 *
 * There is no 'applied' stage: applying changes the board, and any board change
 * invalidates the hint, so the panel closes. Modelling it as a stage meant
 * racing the board watcher for who got to clear it first.
 */
export type HintStage = 'none' | 'technique' | 'located'

const EMPTY: ReadonlySet<number> = new Set()

/**
 * The candidate state hints reason about.
 *
 * Legal candidates from the board, narrowed by the player's pencil marks
 * wherever they have any. Notes and candidates are the same bitmask type by
 * design, and this is why: a note the player has rubbed out IS an elimination
 * they made, and the hint engine has to honour it.
 *
 * Without this, elimination-only techniques loop forever — the engine offers
 * "Pointing removes 4 from r2c7", applying it touches only the notes, the
 * engine recomputes from the board alone, and offers the very same step again.
 */
function seedCandidates(board: Board, notes: Notes | null): Notes {
  const candidates = computeCandidates(board)
  if (!notes) return candidates

  for (let index = 0; index < CELLS; index++) {
    const noted = notes[index] ?? 0
    if (noted !== 0) candidates[index] = (candidates[index] ?? 0) & noted
  }

  return candidates
}

export function useHints() {
  const step = shallowRef<TechniqueStep | null>(null)
  const stage = shallowRef<HintStage>('none')
  /** Set when no implemented technique applies to the current board. */
  const stuck = shallowRef(false)

  // Accumulates eliminations between board changes, so a run of
  // elimination-only hints makes progress instead of repeating itself.
  let candidates: Notes | null = null

  const meta = computed(() => (step.value ? TECHNIQUE_META[step.value.technique] : null))

  const patternCells = computed<ReadonlySet<number>>(() =>
    step.value && stage.value === 'located' ? new Set(step.value.pattern) : EMPTY,
  )

  const targetCells = computed<ReadonlySet<number>>(() =>
    step.value && stage.value === 'located' ? new Set(step.value.targets) : EMPTY,
  )

  const headline = computed(() => {
    if (stuck.value) return 'No pattern found that this solver knows.'
    if (!step.value || !meta.value) return ''
    if (stage.value === 'technique') return `Look for a ${meta.value.name}.`
    return meta.value.name
  })

  /** The full sentence, withheld until the player asks to be shown where. */
  const detail = computed(() =>
    step.value && stage.value !== 'technique' ? (step.value.explanation ?? '') : '',
  )

  /**
   * Advances one stage, finding a fresh step on the first press so the hint
   * always describes the board as it is now.
   */
  function next(board: Board, notes: Notes | null = null): void {
    if (stage.value === 'none' || step.value === null) {
      candidates ??= seedCandidates(board, notes)

      const found = findNextStep(board, candidates)
      step.value = found
      stuck.value = found === null
      stage.value = found ? 'technique' : 'none'
      return
    }

    if (stage.value === 'technique') stage.value = 'located'
  }

  /**
   * Records that a step was carried out, so the next hint moves on. The caller
   * applies it to the game; this only keeps the engine's own view in step.
   */
  function apply(applied: TechniqueStep): void {
    if (!candidates) return

    for (const { index } of applied.placements) candidates[index] = 0
    for (const { index, digit } of applied.eliminations) {
      candidates[index] = (candidates[index] ?? 0) & ~noteMask(digit)
    }
  }

  /** Drops the current hint. Pass false to keep the accumulated candidates. */
  function reset(reseed = true): void {
    step.value = null
    stage.value = 'none'
    stuck.value = false
    if (reseed) candidates = null
  }

  return {
    step,
    stage,
    stuck,
    meta,
    patternCells,
    targetCells,
    headline,
    detail,
    next,
    apply,
    reset,
  }
}

export type Hints = ReturnType<typeof useHints>
