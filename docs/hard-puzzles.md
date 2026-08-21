# Hard Puzzle Fixtures & Solver Benchmarks

Named puzzles for `src/core/__tests__/fixtures.ts`, and what they cost **our**
solver. Every grid below is 81 chars and was verified to have exactly one
solution by `countSolutions(grid, 2)`.

## The two axes of "hard"

These are independent, and conflating them is the usual mistake.

**Hard for a human** means the logical solution path needs long inference chains.
Measured by Sudoku Explainer rating; the practical ceiling is ~11.9.

**Hard for naive backtracking** is almost cosmetic. It is an attack on *cell
ordering and value ordering*, not on logical depth:

1. The solver scans row-major and tries digits 1→9 ascending.
2. Clues are stripped from the **top-left**, so the first cells it touches are
   maximally unconstrained — 9 candidates each.
3. The true values there are **high digits** — the classic grid's first row
   solves to `987654321`, the worst case for ascending enumeration.
4. The surviving clues sit bottom-right, so contradictions only surface deep in
   the tree and every wrong high-level guess costs an enormous subtree.

The clearest evidence that these are different axes: **AI Escargot (SE 11.0,
brutal for humans) costs a naive solver 8,970 nodes — less than a newspaper
puzzle. The "anti-backtracking" grid, which a human solves with singles alone,
costs 69 million.**

## Measured against our solver

`ourMRV` is `findMrvCell` from [solver.ts](../src/core/solver.ts) exactly as
shipped, including its early break on a single-candidate cell. `in-order` is a
naive row-major picker. Nodes = placements attempted.

| puzzle | clues | our MRV | ms | in-order | ms |
| --- | --- | --- | --- | --- | --- |
| anti-backtracking | 17 | 58,234 | 133 | **69,175,317** | 35,193 |
| AI Escargot | 23 | 220 | 0 | 8,970 | 5 |
| Inkala 2012 | 21 | 13,811 | 34 | 49,559 | 25 |
| Platinum Blonde | 21 | 2,886 | 5 | 1,114,772 | 536 |
| Golden Nugget | 21 | 14,713 | 29 | 304,054 | 169 |
| Easter Monster | 21 | 6,274 | 16 | 262,015 | 183 |
| **Fata Morgana** | 21 | **74,020** | **177** | 1,984,466 | 1,116 |
| Red Dwarf | 22 | 10,428 | 24 | 138,496 | 80 |
| Norvig grid2 | 17 | 719 | 2 | 9,727,397 | 4,988 |

For scale, generated puzzles need a median of 42 (easy) to 204 (expert) nodes
under the same solver.

Two things worth noting:

- **Our worst case is Fata Morgana, not the anti-backtracking grid.** MRV
  already defuses the ordering attack (1,188× on that grid); what remains
  expensive is genuine logical depth.
- Everything here solves in under 180 ms, so none of it threatens the UI. These
  are regression fixtures, not performance problems.

## What singles alone achieve

Naked + hidden singles run to fixpoint, no search:

| puzzle | solved by singles? | placed |
| --- | --- | --- |
| anti-backtracking | **yes** | 64 / 64 (40 naked, 24 hidden) |
| AI Escargot | no | 1 / 64 |
| Fata Morgana | no | 1 / 64 |
| Platinum Blonde | no | 1 / 64 |
| Norvig grid2 | no | 3 / 64 |

This is the two-axis point in one table. The grid famous for defeating brute
force **falls entirely to the two easiest techniques in the game** — it would
rate ~SE 2.3, an easy newspaper puzzle. The genuinely hard ones stall after a
single placement.

It also sets a concrete target for Phase 6: **wiring singles propagation into
the backtracking solver should take the anti-backtracking grid from 58,234 nodes
to 0.** It will do almost nothing for Fata Morgana.

## The grids

`.` = empty.

```
anti-backtracking  ..............3.85..1.2.......5.7.....4...1...9.......5......73..2.1........4...9
AI Escargot        1....7.9..3..2...8..96..5....53..9...1..8...26....4...3......1..4......7..7...3..
Inkala 2012        8..........36......7..9.2...5...7.......457.....1...3...1....68..85...1..9....4..
Platinum Blonde    .......12........3..23..4....18....5.6..7.8.......9.....85.....9...4.5..47...6...
Golden Nugget      .......39.....1..5..3.5.8....8.9...6.7...2...1..4.......9.8..5..2....6..4..7.....
Easter Monster     1.......2.9.4...5...6...7...5.9.3.......7.......85..4.7.....6...3...9.8...2.....1
Cheese             .2..5.7..4..1....68....3...2....8..3.4..2.5.....6...1...2.9.....9......57.4...9..
Fata Morgana       ........3..1..56...9..4..7......9.5.7.......8.5.4.2....8..2..9...35..1..6........
Red Dwarf          12.3....435....1....4........54..2..6...7.........8.9...31..5.......9.7.....6...8
Norvig grid2       4.....8.5.3..........7......2.....6.....8.4......1.......6.3.7.5..2.....1.4......
```

## Orientation matters

The same anti-backtracking puzzle under its 8 symmetries, naive in-order:

| transform | nodes |
| --- | --- |
| identity | 69,175,316 |
| transpose | 52,481,621 |
| rot90 | 36,008,464 |
| rot90 + T | 1,486,304 |
| rot180 | 518,274 |
| rot180 + T | 832,873 |
| rot270 | 1,659,701 |
| rot270 + T | **43,222** |

A 1,600× spread from rotating one puzzle. **Any "hardest for brute force" claim
that does not state the orientation is meaningless.**

## Suggested fixture groups

- **Adversarial-to-ordering** — the anti-backtracking grid, ideally with its 8
  symmetries. Use as a regression test that the cell-selection heuristic is
  actually engaged: if the node count reaches millions, MRV is broken or is not
  being applied.
- **Genuinely search-hard** — Fata Morgana, Platinum Blonde, Golden Nugget,
  Easter Monster, Inkala 2012. These stay expensive under any heuristic.
- **Singles-only regression** — the anti-backtracking grid must need zero
  guesses once hidden singles are implemented.

## Provenance and caveats

- The anti-backtracking grid is corroborated character-for-character by two
  independent transcriptions; Wikipedia describes it in prose but only ships it
  as an image. Sometimes attributed to forum user *tarek* (2007) — unconfirmed.
- **Cheese, Fata Morgana and Red Dwarf** come from a *single* transcription. The
  names are independently attested but the name↔grid binding is unverified. The
  grids themselves are valid unique-solution puzzles.
- **"Discrepancy"** exists (gsf-q1 ≈ 99529) but no reachable source carried its
  digits. Not included — better absent than invented.
- **"champagne 2010"** from one collection has **two** solutions; it is corrupt
  or improper. Excluded.
- **"Inkala 2010" is widely misattributed.** The grid usually captioned as such
  is puzzle #2 in Norvig's 2006 `hardest.txt`, so the 2010 date cannot be right.
  Platinum Blonde is likewise a community forum puzzle, not Inkala's.
- Clue counts here were measured, not copied. Press coverage commonly reports
  Inkala 2012 as 23 clues; it has 21.
- Wikipedia's "six hours on a 2008 computer" is uncited and orientation-
  unspecified. Our own run does it in 35 seconds. Do not treat it as a target.

## Sources

- [Sudoku solving algorithms — Wikipedia](https://en.wikipedia.org/wiki/Sudoku_solving_algorithms)
- [Norvig — Solving Every Sudoku Puzzle](https://norvig.com/sudoku.html)
- [SudokuWiki — Escargot](https://www.sudokuwiki.org/Escargot) · [Arto Inkala Sudoku](https://www.sudokuwiki.org/Arto_Inkala_Sudoku)
- [Sudoku Explainer 1.2.1 ratings](https://github.com/SudokuMonster/SukakuExplainer/wiki/Difficulty-ratings-in-Sudoku-Explainer-v1.2.1)
- [t-dillon/tdoku benchmark suite](https://github.com/t-dillon/tdoku) — what stays hard under strong propagation
- [The Chaos Within Sudoku](https://pmc.ncbi.nlm.nih.gov/articles/PMC3468838/) — the η metric; Platinum Blonde hardest at η = 3.5789
- [denis-berthier/Sudoku-classif](https://github.com/denis-berthier/Sudoku-classif) — thousands of pre-rated puzzles
