import { describe, expect, it } from 'vitest'
import { generate } from '../generator'
import { HARD_PUZZLES, parseGrid } from './fixtures'
import { TECHNIQUE_META, solveLogically } from '../logicalSolver'
import type { Difficulty } from '../types'

/**
 * Opt-in calibration report, not a test: prints how generated puzzles actually
 * grade, how long they take, and which techniques they need. Run with
 *
 *   SUDOKU_REPORT=50 npx vitest run generator.report
 *
 * Add SUDOKU_BUDGET=300 to see how often a ~5x slower device would miss the
 * target (it falls back to an easier puzzle when the budget runs out).
 *
 * (the value is the sample count per difficulty). Use it before touching the
 * grading thresholds — they must be calibrated on what the generator emits.
 */
const SAMPLES = Number(process.env.SUDOKU_REPORT ?? 0)
// Simulates a slower device: a phone ~5x slower than the dev machine gets
// about as much work done in the default 1500ms as this machine does in 300ms.
const BUDGET = process.env.SUDOKU_BUDGET ? Number(process.env.SUDOKU_BUDGET) : undefined
const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard', 'expert']

function tally<T extends string | number>(items: T[]): string {
  const counts = new Map<T, number>()
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1)
  return [...counts]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([key, n]) => `${key}:${n}`)
    .join(' ')
}

describe.runIf(SAMPLES > 0)('generator calibration report', () => {
  it('reference puzzles', () => {
    const stalledGrades: string[] = []
    for (const [name, grid] of Object.entries(HARD_PUZZLES)) {
      const r = solveLogically(parseGrid(grid), { allowUniquenessTechniques: true })
      console.log(
        `${name}: solved ${r.solved} ${r.difficulty} score ${r.score} pressure ${r.pressure} hardest ${r.hardest}`,
      )
      if (!r.solved) stalledGrades.push(r.difficulty)
    }
    // Whatever the solver manages, a stalled puzzle must not rate below expert.
    expect(stalledGrades.every((grade) => grade === 'expert')).toBe(true)
  }, 600_000)

  it.each(DIFFICULTIES)('%s', (difficulty) => {
    const times: number[] = []
    const grades: string[] = []
    const hardest: string[] = []
    const clues: number[] = []
    const scores: number[] = []
    const pressures: number[] = []
    // Steps beyond singles, and how many different techniques those were:
    // "one pointing pair and done" versus a puzzle that keeps making you think.
    const techSteps: number[] = []
    const distinct: number[] = []
    let gradeMs = 0

    for (let i = 0; i < SAMPLES; i++) {
      const start = performance.now()
      const { puzzle } = generate(difficulty, { timeBudgetMs: BUDGET })
      times.push(performance.now() - start)

      const gradeStart = performance.now()
      const result = solveLogically(puzzle, { allowUniquenessTechniques: true })
      gradeMs += performance.now() - gradeStart
      pressures.push(result.pressure)
      techSteps.push(result.steps.filter((step) => TECHNIQUE_META[step.technique].tier > 0).length)
      distinct.push([...result.used].filter((id) => TECHNIQUE_META[id].tier > 0).length)
      grades.push(result.solved ? result.difficulty : 'unsolved')
      hardest.push(result.hardest ?? 'singles')
      clues.push(puzzle.filter((v) => v !== 0).length)
      scores.push(result.score)
    }

    times.sort((a, b) => a - b)
    scores.sort((a, b) => a - b)
    pressures.sort((a, b) => a - b)
    const pp = (q: number) => pressures[Math.floor(pressures.length * q)] ?? 0
    const mean = times.reduce((a, b) => a + b, 0) / times.length
    const p95 = times[Math.floor(times.length * 0.95)] ?? 0
    const pct = (q: number) => scores[Math.floor(scores.length * q)] ?? 0

    console.log(
      [
        `== ${difficulty} (n=${SAMPLES}) ==`,
        `time    mean ${mean.toFixed(1)}ms  p95 ${p95.toFixed(1)}ms  grade ${(gradeMs / SAMPLES).toFixed(1)}ms`,
        `graded  ${tally(grades)}`,
        `hardest ${tally(hardest)}`,
        `clues   ${tally(clues)}`,
        `score   p10 ${pct(0.1)}  p50 ${pct(0.5)}  p90 ${pct(0.9)}`,
        `press   p10 ${pp(0.1)}  p50 ${pp(0.5)}  p90 ${pp(0.9)}`,
        `tsteps  ${tally(techSteps)}`,
        `techs   ${tally(distinct)}`,
      ].join('\n'),
    )

    // The generator must never emit a puzzle the hint engine cannot finish.
    expect(grades).not.toContain('unsolved')
  }, 600_000)
})
