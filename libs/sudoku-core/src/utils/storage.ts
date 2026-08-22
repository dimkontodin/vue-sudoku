/**
 * Small wrapper around localStorage for persisted app state.
 *
 * Every read is defensive. localStorage throws in private-browsing modes and
 * when a quota is exceeded, it is absent entirely during SSR, and whatever is
 * already stored was written by an older version of this code — so a bad or
 * outdated payload must degrade to "nothing saved", never to a crash on boot.
 */

interface Versioned {
  v: number
}

function storage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage
  } catch {
    // Access itself throws when cookies/site data are blocked.
    return null
  }
}

/**
 * Reads and validates a stored value. Returns null when nothing is stored, the
 * JSON is unparseable, the version does not match, or `isValid` rejects it.
 */
export function readJson<T extends Versioned>(
  key: string,
  version: number,
  isValid: (value: unknown) => value is T,
): T | null {
  const store = storage()
  if (!store) return null

  try {
    const raw = store.getItem(key)
    if (!raw) return null

    const parsed: unknown = JSON.parse(raw)
    if (!isValid(parsed) || parsed.v !== version) return null

    return parsed
  } catch {
    return null
  }
}

/** Returns false when the write failed (quota, private mode, no storage). */
export function writeJson<T extends Versioned>(key: string, value: T): boolean {
  const store = storage()
  if (!store) return false

  try {
    store.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function removeKey(key: string): void {
  try {
    storage()?.removeItem(key)
  } catch {
    // Nothing useful to do — the value is unreachable either way.
  }
}

/** Narrowing helper: a non-null object with a numeric `v`. */
export function isVersionedObject(value: unknown): value is Versioned {
  return typeof value === 'object' && value !== null && typeof (value as Versioned).v === 'number'
}

/** True when `value` is an array of exactly `length` finite numbers. */
export function isNumberArray(value: unknown, length: number): value is number[] {
  return (
    Array.isArray(value) &&
    value.length === length &&
    value.every((entry) => typeof entry === 'number' && Number.isFinite(entry))
  )
}
