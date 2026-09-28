# sudoku-core

This library was generated with [Nx](https://nx.dev).

## Running unit tests

Run `nx test sudoku-core` to execute the unit tests via [Vitest](https://vitest.dev/).

## Puzzle generation and grading

- `generate(difficulty, { timeBudgetMs })` returns a unique-solution puzzle that grades as
  `difficulty`, judged by the techniques it needs. When the budget runs out, it returns the
  closest easier puzzle instead.
- `tryGenerate(difficulty, budgetMs)` returns an exact grade only, or `null` if time runs out.
- `solveLogically(board)` / `gradeBoard(board)` grade any board: hardest technique, score, singles
  pressure and difficulty.
- `createPuzzleCache()` keeps one puzzle per difficulty ready in the background. It is meant for
  the apps' web workers, where the `prefetch` protocol message warms it.

How it works and the calibration numbers are in
[docs/solving-techniques.md](../../docs/solving-techniques.md#grading). To re-measure after a
change:

```sh
SUDOKU_REPORT=100 npx vitest run generator.report                    # per-level report
SUDOKU_REPORT=100 SUDOKU_BUDGET=300 npx vitest run generator.report  # simulate a ~5x slower device
```
