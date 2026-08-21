# Human Solving Techniques — Implementation Reference

Reference for `src/core/techniques/`. The roadmap tracks *what* to build; this
file records *how each pattern works*, precisely enough to implement from.

Terminology used throughout:

- **unit** (a.k.a. house) — a row, a column, or a box.
- **sees** — shares a unit with.
- **strong link** on digit `d` in a unit — `d` has exactly two candidate
  positions in that unit (a *conjugate pair*).
- **bi-value cell** — a cell with exactly two candidates.

## Naming: the same techniques, three vocabularies

The sources this is drawn from disagree on names. Worth knowing, because the
docs you'll read while implementing will switch between them:

| This codebase | Simple Sudoku (Angus) | SudokuWiki | Sudopedia |
| --- | --- | --- | --- |
| Pointing | Locked Candidates 1 | Pointing Pairs | Pointing |
| Box/Line Reduction | Locked Candidates 2 | Box/Line Reduction | Claiming |
| Y-Wing | XY-Wing | Y-Wing | XY-Wing |
| Empty Rectangle | — | Rectangle Elimination | Empty Rectangle |

They also disagree on *ordering*. Sudoku Explainer rates X-Wing (3.2) easier
than Naked Triple (3.6); SudokuWiki opens its "Tough" tier with X-Wing. SE puts
Swordfish (3.8) below Y-Wing (4.2); SudokuWiki puts Y-Wing first. There is no
single correct order — pick one, document it, stay consistent.

---

## Tier 0 — Singles (these place digits)

### Naked Single
*Sole Candidate, Forced Digit, Singleton.* SE 2.3.

> If a cell has exactly one remaining candidate `d`, it is `d`.

With a bitmask candidate grid this is `popcount(mask) === 1`.

### Hidden Single
*Pinned Digit, Unique Candidate.* SE 1.2 (box) / 1.5 (row, column).

> If within a unit, digit `d` is a candidate in exactly one cell, that cell is `d`.

Run separately per box, row, column. About 48% of random puzzles need nothing
but singles.

---

## Tier 1 — Subsets and intersections (elimination only)

### Pointing
SE 2.6. **Found in a box, eliminates along a line.**

> For box `B` and digit `d`, collect the cells of `B` with candidate `d`. If they
> all lie in a single row `r` (or column), then `d` must be placed inside `B ∩ r`.
> Eliminate `d` from every cell of `r` **outside** `B`.

### Box/Line Reduction
*Claiming.* **Found in a line, eliminates inside a box.**

> For row `r` and digit `d`, collect the cells of `r` with candidate `d`. If they
> all lie within a single box `B`, then `d` must be placed inside `B ∩ r`.
> Eliminate `d` from every cell of `B` **outside** `r`.

Both look at the same 3-cell intersection. What differs is which unit confined
the digit — and you always eliminate from the *other one*:

| | Constraint found in | Digit confined to | Eliminate from |
| --- | --- | --- | --- |
| Pointing | the **box** | `B ∩ r` | rest of the **line** |
| Box/Line Reduction | the **line** | `B ∩ r` | rest of the **box** |

Neither subsumes the other; implement both directions. Pointing is the highest
frequency non-single technique in real puzzles.

### Naked Pair / Triple / Quad
SE 3.0 / 3.6 / 5.0.

> Find `N` unsolved cells in a unit whose **union** of candidates has size
> exactly `N`. Eliminate those `N` digits from every other cell in the unit.

**The trap:** individual cells need not contain all `N` candidates. A valid
naked triple may be `{3,3,3}`, `{3,3,2}`, `{3,2,2}` or `{2,2,2}` candidates per
cell. Implementations that look for *identical* candidate sets miss most
triples. Iterate combinations of size `N` and test `popcount(union) === N`.

Bonus: if all `N` cells share two units (same row *and* same box), eliminate
from both.

### Hidden Pair / Triple / Quad
SE 3.4 / 4.0 / 5.4.

> Find `N` digits in a unit whose combined candidate **positions** occupy exactly
> `N` cells. Eliminate all *other* digits from those `N` cells.

The dual of naked subsets: naked is *N cells holding N digits*; hidden is
*N digits held in N cells*. Within a unit of `U` unsolved cells, a hidden subset
of size `N` is exactly a naked subset of size `U − N`.

---

## Tier 2 — Basic fish (elimination only, single digit)

X-Wing, Swordfish and Jellyfish are **one algorithm** at `N = 2, 3, 4`. Write
`findFish(digit, n, orientation)` once.

### X-Wing (N=2)
SE 3.2.

> **Row orientation:** for digit `d`, find two rows in each of which `d` has
> exactly two candidate positions, and those positions fall in the **same** pair
> of columns. Eliminate `d` from those two columns in every other row.
>
> **Column orientation:** the mirror — two columns each with exactly two
> positions falling in the same pair of rows; eliminate from those rows.

The part most write-ups leave vague: **eliminations always happen in the units
perpendicular to the ones that defined the pattern.** Both orientations are
separate search passes and find different patterns.

### Swordfish (N=3) / Jellyfish (N=4)
SE 3.8 / 5.2.

> Find `N` base rows whose candidate positions for `d` are **all contained
> within** the same `N` columns. Eliminate `d` from those `N` columns in every
> other row. Mirror for the column orientation.

**The trap:** base units need `2 ≤ count ≤ N` positions, **not exactly 2**.
Generalising X-Wing's "exactly two" finds only the 2-2-2 case and misses most
Swordfish. (A base unit with 1 position is a hidden single — already handled.)

**Stop at N=4.** A 5×5 fish provably always implies a 4×4 on the complementary
digits, so Squirmbag and larger are redundant.

---

## Tier 3 — Colouring and wings

### Simple Colouring
*Singles Chains.* Rule 2 **places**; Rule 4 eliminates.

> For digit `d`, build a graph over cells having candidate `d`, with an edge
> wherever `d` has exactly two positions in a shared unit (a strong link).
> Two-colour each connected component. Within a component, one colour is
> entirely true and the other entirely false.
>
> **Rule 2 (colour wrap):** if two cells of the *same colour* share a unit, that
> colour is impossible — eliminate `d` from all of them, and **place** `d` in
> every cell of the other colour.
>
> **Rule 4 (colour trap):** if an uncoloured cell with candidate `d` sees both a
> colour-A cell and a colour-B cell, eliminate `d` from it.

This is the architectural inflection point — the first technique needing a real
graph, and the gateway to every chain technique.

### Y-Wing
*XY-Wing.* SE 4.2.

> Three bi-value cells: a **pivot** `{A,B}` and two **pincers** `{A,C}` and
> `{B,C}`, where the pivot sees both pincers. Whichever value the pivot takes,
> one pincer is forced to `C`. Eliminate `C` from every cell seeing **both**
> pincers.

### XYZ-Wing
SE 4.4.

> A **hinge** with exactly three candidates `{X,Y,Z}` seeing two bi-value wings
> `{X,Z}` and `{Y,Z}`. `Z` is guaranteed in one of the *three* cells, so
> eliminate `Z` only from cells seeing **all three** — the hinge included.

The extra condition versus Y-Wing (must also see the hinge) makes eliminations
rare; in practice they lie in the hinge's box.

### W-Wing

> Two bi-value cells with the **identical** pair `{X,Y}` that do *not* see each
> other, plus a **strong link** on `X` in some unit whose two ends see one cell
> each. Then at least one of the two cells is `Y` — eliminate `Y` from every cell
> seeing both.

The link must be **strong**, not weak.

### BUG + 1
*Bivalue Universal Grave.* SE 5.6–6.0. **Places** a digit.

> When every unsolved cell has exactly two candidates except exactly one cell
> with three: a fully bi-value grid always has an even number of solutions, so
> the tri-value cell must break the tie. Of its three candidates, exactly one
> appears **three times** in that cell's row (equivalently column or box) rather
> than twice. That digit is the answer.

~30 lines, ends the puzzle instantly. Best effort-to-value ratio in this tier.
**Assumes a unique solution** — see the gating note below.

---

## Tier 4 — Uniqueness-dependent

> [!WARNING]
> Everything here assumes the puzzle has exactly one solution. On a
> multi-solution grid these produce **wrong** eliminations. Since Phase 6 also
> adds hand-entered puzzles, these must be gated behind a confirmed
> `countSolutions(...) === 1`, not merely enabled by default.

### Unique Rectangles

> Four cells at the corners of a rectangle spanning exactly **2 rows, 2 columns
> and exactly 2 boxes**, all limited to the same two candidates `{a,b}`, would
> allow the two digits to be swapped diagonally — a second solution. So that
> configuration cannot occur.

The **"exactly 2 boxes" precondition is mandatory**; across 4 boxes the box
constraint blocks the swap and the pattern is not deadly. Omitting this check is
the classic way to produce silently wrong eliminations.

Corners already reduced to `{a,b}` are the *floor*; corners with extras the
*roof*. Type 1 (three floor cells): eliminate both `a` and `b` from the roof
cell. Types 2–5 handle two roof cells with shared or differing extras.

### Empty Rectangle
Fiddly and geometric; lowest value-per-hour in this tier. See SudokuWiki's
"Rectangle Elimination" page, which reframes it more intuitively.

---

## Tier 5 — Chains (out of scope for now)

XY-Chains, X-Cycles, 3D Medusa, Forcing Chains and Nets, ALS. All variations on
one engine: a graph of strong and weak links walked in alternation. Required by
roughly 5% of puzzles.

**Trial-and-error and guessing sit below all of these**, in Sudopedia's
"techniques of last resort" category, along with Nishio, Bowman Bingo and
templating. Brute-force backtracking — our existing `solve()` — is classified
separately as computer-oriented.

For grading, **never fall back to guessing to produce a grade.** If the logical
solver stalls, report "beyond technique set" and regenerate. We control
generation, so we never have to grade a puzzle we cannot solve logically.

---

## Redundancy — what NOT to build

| Skip | Subsumed by |
| --- | --- |
| Full House, Last Digit | Naked / Hidden Single |
| Remote Pairs | Simple Colouring, XY-Chains (deprecated by SudokuWiki) |
| Multi-Colouring | 3D Medusa (deprecated by SudokuWiki) |
| Squirmbag (5×5 fish) and larger | provably implies a 4×4 |
| Hidden Quad | usually already found as a naked subset |
| SE's "Direct ..." variants | scoring artefacts, not distinct logic |

**But keep the logically-redundant ones that are *explainable*.** Every X-Wing
elimination is also a Simple Colouring elimination, and Y-Wing/W-Wing/XYZ-Wing
all fall out of XY-Chains. Build them anyway: a hint saying *"X-Wing on 7s in
rows 2 and 6"* teaches something, while *"alternating inference chain"* does not.
Redundant as logic ≠ redundant as a hint tier.

---

## Two API decisions that matter

**1. Return a structured step, never a boolean.**

```ts
interface TechniqueStep {
  technique: TechniqueId
  placements: { index: number; digit: number }[]
  eliminations: { index: number; digit: number }[]
  highlight: { pivot?: number[]; pincers?: number[]; units?: number[] }
  explanation: string
}
```

The `highlight` field is what makes a graded hint usable — you want to light up
the pivot and pincers on the board, not just print a name.

**2. Restart the cascade from the top after every successful step.**

Apply the cheapest technique that fires, then loop back to Naked Single. This is
what a human does, and it is what makes "hardest technique required" meaningful
— otherwise you attribute eliminations to advanced techniques that a re-run of
singles would have found anyway.

---

## Grading

Three models in the wild:

- **Sudoku Explainer** — puzzle rating = *max* over steps. Numeric 1.0–12.7, the
  de-facto standard. Hardest known ≈ 11.9.
- **Simple Sudoku** — by hardest technique required, with Expert vs Extreme
  distinguished by *how many times* advanced patterns fire, not just the peak.
- **HoDoKu** — hybrid: sum the per-step scores, but floor the grade at the tier
  of the hardest technique used; if the total exceeds the tier's threshold, the
  score promotes it.

**Use the HoDoKu hybrid.** Pure max-technique grading produces the familiar
complaint that an "Expert" needing one lucky X-Wing feels easier than a "Hard"
needing forty steps. Summing captures total work; the floor stops a long easy
puzzle being mislabelled hard.

Rough SE anchors for our four labels: Easy 1.0–1.5, Medium 1.5–2.5,
Hard 2.6–4.4, Expert 4.5+.

---

## Sources

- [Simple Sudoku techniques (Angus Johnson)](http://angusj.com/sudoku/hints.php)
- [Sudopedia: SSTS](https://sudopedia.sudocue.net/index.php/SSTS) — the frozen 15-technique Simple Sudoku set
- [SudokuWiki: Strategy Families](https://www.sudokuwiki.org/Strategy_Families)
- [SudokuWiki: Naked Candidates](https://www.sudokuwiki.org/Naked_Candidates) · [Intersection Removal](https://www.sudokuwiki.org/Intersection_Removal) · [X-Wing](https://www.sudokuwiki.org/X_Wing_Strategy) · [Swordfish](https://www.sudokuwiki.org/Sword_Fish_Strategy) · [Singles Chains](https://www.sudokuwiki.org/Singles_Chains) · [Y-Wing](https://www.sudokuwiki.org/Y_Wing_Strategy) · [XYZ-Wing](https://www.sudokuwiki.org/XYZ_Wing) · [W-Wing](https://www.sudokuwiki.org/W_Wing_Strategy) · [Unique Rectangles](https://www.sudokuwiki.org/Unique_Rectangles) · [BUG](https://www.sudokuwiki.org/BUG)
- [SudokuWiki: Relative Incidence of Strategies](https://www.sudokuwiki.org/The_Relative_Incidence_of_Sudoku_Strategies) — how often each actually fires
- [Sudoku Explainer difficulty ratings](https://github.com/SudokuMonster/SukakuExplainer/wiki/Difficulty-ratings-in-Sudoku-Explainer-v1.2.1)
- [HoDoKu: rating and difficulty levels](https://hodoku.sourceforge.net/en/docs_cre.php)

Two confidence caveats carried over from the research: the Simple Sudoku
grade→technique mapping is a third-party reconstruction (Angus never published
thresholds), and HoDoKu's per-technique score table lives in the app's
preferences dialog rather than its online manual — the *method* above is
documented, the numbers are not.
