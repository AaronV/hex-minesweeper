export function getStoredValue<TStored, TResult = TStored>(
  key: string,
  fallback: TResult,
  revive?: (value: TStored) => TResult,
): TResult {
  if (typeof window === 'undefined') return fallback

  try {
    const raw = window.localStorage.getItem(key)
    if (raw === null) return fallback
    const parsed = JSON.parse(raw) as TStored
    return revive ? revive(parsed) : (parsed as unknown as TResult)
  } catch {
    return fallback
  }
}

export function setStoredValue<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Ignore persistence failures so callers do not need their own storage guards.
  }
}

export function removeStoredValue(key: string): void {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.removeItem(key)
  } catch {
    // Ignore persistence failures so callers do not need their own storage guards.
  }
}
