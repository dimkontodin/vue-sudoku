import { adaptiveMask, binarize, inkPolarity, type InkPolarity } from './image'
import type { GrayImage, Point, Quad } from './types'

/**
 * Finding the shapes in a picture that could be a board.
 *
 * Separate from `grid.ts` because picking *which* shape is the board is a
 * different question from reading one: this module only proposes, and the
 * caller decides by rectifying each proposal and looking for grid lines.
 */

/** A component has to cover this much of the frame to be a candidate board. */
const MIN_AREA_SHARE = 0.04
/** ...and be roughly square. A sudoku grid is square however it is photographed. */
const MIN_ASPECT = 0.5
const MAX_ASPECT = 2

/**
 * A quad has to fill this much of its own bounding box.
 *
 * Rejects the L-shaped and open-ended components — a page border that only
 * half survived thresholding, a margin that runs off the frame — whose corner
 * search returns three points in a line and a warp that collapses to nothing.
 * A square lying at 45 degrees fills exactly half its box, so this cannot go
 * much higher without refusing the very rotation it exists to support.
 */
const MIN_QUAD_FILL = 0.4

/** The shortest edge of a quad, relative to its longest, before it is junk. */
const MIN_SIDE_RATIO = 0.3

/** Hull vertices kept before the corner search, which is cubic in this. */
const MAX_HULL_POINTS = 32

export interface BoardCandidate {
  /** Corners in TL, TR, BR, BL order, in the coordinates of `image`. */
  quad: Quad
  /** Which tone was ink when this shape was found. */
  polarity: InkPolarity
  /** Share of the frame covered by the shape's bounding box. */
  share: number
}

function cross(o: Point, a: Point, b: Point): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
}

function triangleArea(a: Point, b: Point, c: Point): number {
  return Math.abs(cross(a, b, c)) / 2
}

/** Andrew's monotone chain. Returns the hull counter-clockwise in maths axes. */
function convexHull(points: Point[]): Point[] {
  if (points.length < 4) return points.slice()

  const sorted = points.slice().sort((a, b) => a.x - b.x || a.y - b.y)
  const build = (source: Point[]): Point[] => {
    const chain: Point[] = []
    for (const point of source) {
      while (
        chain.length >= 2 &&
        cross(chain[chain.length - 2] as Point, chain[chain.length - 1] as Point, point) <= 0
      ) {
        chain.pop()
      }
      chain.push(point)
    }
    chain.pop()
    return chain
  }

  return [...build(sorted), ...build(sorted.reverse())]
}

/** Drops the vertices that add least, so the corner search stays cheap. */
function simplifyHull(hull: Point[], limit: number): Point[] {
  const points = hull.slice()
  while (points.length > limit) {
    let victim = 0
    let smallest = Infinity
    for (let i = 0; i < points.length; i += 1) {
      const previous = points[(i - 1 + points.length) % points.length] as Point
      const next = points[(i + 1) % points.length] as Point
      const area = triangleArea(previous, points[i] as Point, next)
      if (area < smallest) {
        smallest = area
        victim = i
      }
    }
    points.splice(victim, 1)
  }
  return points
}

/**
 * The four hull points enclosing the most area.
 *
 * The obvious alternative — the extremes of x+y and x-y — is only correct for a
 * shape that is roughly square to the frame. Turn the board 40 degrees and two
 * of those extremes land on the same corner; turn it 45 and they tie outright,
 * which is how a perfectly good photograph ends up with a quad of zero area.
 * Maximising the enclosed quad asks for the corners directly and does not care
 * how the board is turned, or that perspective made one edge shorter.
 */
function largestQuad(hull: Point[]): Quad | null {
  if (hull.length < 4) return null

  let best: Quad | null = null
  let bestArea = 0

  for (let i = 0; i < hull.length; i += 1) {
    for (let j = i + 2; j < hull.length; j += 1) {
      const a = hull[i] as Point
      const c = hull[j] as Point

      let b: Point | null = null
      let bArea = 0
      for (let k = i + 1; k < j; k += 1) {
        const area = triangleArea(a, hull[k] as Point, c)
        if (area > bArea) {
          bArea = area
          b = hull[k] as Point
        }
      }

      let d: Point | null = null
      let dArea = 0
      for (let k = j + 1; k < hull.length + i; k += 1) {
        const point = hull[k % hull.length] as Point
        const area = triangleArea(a, point, c)
        if (area > dArea) {
          dArea = area
          d = point
        }
      }

      if (!b || !d || bArea + dArea <= bestArea) continue
      bestArea = bArea + dArea
      best = [a, b, c, d]
    }
  }

  return best
}

/**
 * Puts corners in TL, TR, BR, BL order.
 *
 * Winding first, so the sequence is a ring rather than four loose points, then
 * the ring is rotated to start at the corner nearest the origin. That last step
 * is the only part that assumes anything about orientation, and it holds until
 * the board is turned past 45 degrees — at which point "the top of the board"
 * is genuinely ambiguous from the pixels alone, and is settled later by reading
 * the digits at each of the four turns.
 */
function orderCorners(quad: Quad): Quad {
  const cx = (quad[0].x + quad[1].x + quad[2].x + quad[3].x) / 4
  const cy = (quad[0].y + quad[1].y + quad[2].y + quad[3].y) / 4

  // Clockwise on screen, where y grows downwards.
  const ring = quad
    .slice()
    .sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx))

  let first = 0
  let smallest = Infinity
  for (let i = 0; i < 4; i += 1) {
    const point = ring[i] as Point
    const sum = point.x + point.y
    if (sum < smallest) {
      smallest = sum
      first = i
    }
  }

  return [
    ring[first] as Point,
    ring[(first + 1) % 4] as Point,
    ring[(first + 2) % 4] as Point,
    ring[(first + 3) % 4] as Point,
  ]
}

function sideLengths(quad: Quad): number[] {
  return quad.map((point, i) => {
    const next = quad[(i + 1) % 4] as Point
    return Math.hypot(next.x - point.x, next.y - point.y)
  })
}

function quadArea(quad: Quad): number {
  return triangleArea(quad[0], quad[1], quad[2]) + triangleArea(quad[0], quad[2], quad[3])
}

/** Rejects the shapes whose corners cannot describe a board. */
function isPlausible(quad: Quad, boxArea: number): boolean {
  const sides = sideLengths(quad)
  const longest = Math.max(...sides)
  const shortest = Math.min(...sides)
  if (longest <= 0 || shortest / longest < MIN_SIDE_RATIO) return false
  return quadArea(quad) >= boxArea * MIN_QUAD_FILL
}

/** Corner-to-corner distance, used to tell two proposals apart. */
function quadDistance(a: Quad, b: Quad): number {
  let worst = 0
  for (let i = 0; i < 4; i += 1) {
    const pa = a[i] as Point
    const pb = b[i] as Point
    worst = Math.max(worst, Math.hypot(pa.x - pb.x, pa.y - pb.y))
  }
  return worst
}

/** Every shape in one mask that could be a board, largest box first. */
function candidatesFromMask(
  mask: Uint8Array,
  width: number,
  height: number,
  polarity: InkPolarity,
): BoardCandidate[] {
  const seen = new Uint8Array(mask.length)
  const stack = new Int32Array(mask.length)
  // Per-row extremes are enough for a convex hull: any hull vertex is the
  // first or last ink pixel of its row. Keeping only those is what makes it
  // affordable to hull every component rather than just the biggest.
  const rowMin = new Int32Array(height)
  const rowMax = new Int32Array(height)
  const found: BoardCandidate[] = []

  for (let start = 0; start < mask.length; start += 1) {
    if (mask[start] === 0 || seen[start] === 1) continue

    seen[start] = 1
    stack[0] = start
    let top = 1

    let minX = width
    let maxX = -1
    let minY = height
    let maxY = -1

    while (top > 0) {
      top -= 1
      const index = stack[top] as number
      const x = index % width
      const y = (index / width) | 0

      if (y < minY || y > maxY) {
        if (y < minY) minY = y
        if (y > maxY) maxY = y
        rowMin[y] = x
        rowMax[y] = x
      } else {
        if (x < (rowMin[y] as number)) rowMin[y] = x
        if (x > (rowMax[y] as number)) rowMax[y] = x
      }
      if (x < minX) minX = x
      if (x > maxX) maxX = x

      if (x > 0 && mask[index - 1] === 1 && seen[index - 1] === 0) {
        seen[index - 1] = 1
        stack[top] = index - 1
        top += 1
      }
      if (x < width - 1 && mask[index + 1] === 1 && seen[index + 1] === 0) {
        seen[index + 1] = 1
        stack[top] = index + 1
        top += 1
      }
      if (y > 0 && mask[index - width] === 1 && seen[index - width] === 0) {
        seen[index - width] = 1
        stack[top] = index - width
        top += 1
      }
      if (y < height - 1 && mask[index + width] === 1 && seen[index + width] === 0) {
        seen[index + width] = 1
        stack[top] = index + width
        top += 1
      }
    }

    const boxWidth = maxX - minX + 1
    const boxHeight = maxY - minY + 1
    const aspect = boxWidth / boxHeight
    const share = (boxWidth * boxHeight) / (width * height)
    if (share < MIN_AREA_SHARE || aspect < MIN_ASPECT || aspect > MAX_ASPECT) continue

    const outline: Point[] = []
    for (let y = minY; y <= maxY; y += 1) {
      // A row the fill never reached keeps a stale extreme; the row range is
      // contiguous for a connected shape, so this only skips rows outside it.
      outline.push({ x: rowMin[y] as number, y }, { x: rowMax[y] as number, y })
    }

    const quad = largestQuad(simplifyHull(convexHull(outline), MAX_HULL_POINTS))
    if (!quad || !isPlausible(quad, boxWidth * boxHeight)) continue

    found.push({ quad: orderCorners(quad), polarity, share })
  }

  return found.sort((a, b) => b.share - a.share)
}

/**
 * Shapes worth testing as the board, best-looking first.
 *
 * Three masks, because no single one is right for every source: a local mean
 * for each polarity — print on paper, and light digits on a dark page — and the
 * global split, which is the better reading of a clean screenshot where the
 * local mean has nothing to add. Proposals from all three compete, so a mask
 * that misreads one picture costs nothing as long as another does not.
 */
export function boardCandidates(image: GrayImage, limit = 6): BoardCandidate[] {
  const { width, height } = image
  const global = inkPolarity(image)
  const proposals = [
    ...candidatesFromMask(adaptiveMask(image, 'dark'), width, height, 'dark'),
    ...candidatesFromMask(adaptiveMask(image, 'light'), width, height, 'light'),
    ...candidatesFromMask(binarize(image), width, height, global),
  ].sort((a, b) => b.share - a.share)

  const kept: BoardCandidate[] = []
  for (const candidate of proposals) {
    const duplicate = kept.some(
      (other) =>
        other.polarity === candidate.polarity &&
        quadDistance(other.quad, candidate.quad) < Math.max(width, height) * 0.01,
    )
    if (duplicate) continue

    kept.push(candidate)
    if (kept.length >= limit) break
  }

  return kept
}

/** The whole frame, for a screenshot cropped so tightly it has no border. */
export function frameQuad(width: number, height: number): Quad {
  return [
    { x: 0, y: 0 },
    { x: width - 1, y: 0 },
    { x: width - 1, y: height - 1 },
    { x: 0, y: height - 1 },
  ]
}
