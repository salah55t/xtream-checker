export interface ParsedAccount {
  ok: boolean
  error?: string
  raw?: {
    user_info?: Record<string, unknown>
    server_info?: Record<string, unknown>
  }
  meta: {
    inputUrl?: string
    host: string
    port: number
    protocol: 'http' | 'https'
    username: string
    password: string
    fetchedAt: string
    responseTimeMs: number
  }
  user: {
    username: string
    status: string
    isActive: boolean
    isTrial: boolean
    isExpired: boolean
    expDate: string | null
    expTimestamp: number | null
    daysLeft: number | null
    createdAt: string | null
    createdTimestamp: number | null
    durationDays: number | null
    maxConnections: number
    activeConnections: number
    availableConnections: number
    allowedOutputs: string[]
  }
  server: {
    url: string
    port: number
    httpsPort: number | null
    rtmpPort: number | null
    protocol: string
    serverMethod: string
    rip: string
    timezone: string
    timestampNow: number | null
  }
}

export interface ContentStats {
  liveCategories: number
  liveStreams: number
  vodCategories: number
  vodStreams: number
  seriesCategories: number
  series: number
}

export interface HistoryEntry {
  id: string
  fetchedAt: string
  meta: ParsedAccount['meta']
  user: ParsedAccount['user']
  server: ParsedAccount['server']
}

const HISTORY_KEY = 'xtream-checker-history-v1'
const MAX_HISTORY = 50

export function loadHistory(): HistoryEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as HistoryEntry[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveHistoryEntry(entry: HistoryEntry): HistoryEntry[] {
  const list = loadHistory()
  const next = [entry, ...list.filter((e) => e.id !== entry.id)].slice(0, MAX_HISTORY)
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
  } catch {
    // ignore
  }
  return next
}

export function removeHistoryEntry(id: string): HistoryEntry[] {
  const list = loadHistory().filter((e) => e.id !== id)
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list))
  } catch {
    // ignore
  }
  return list
}

export function clearHistory(): void {
  try {
    localStorage.removeItem(HISTORY_KEY)
  } catch {
    // ignore
  }
}

export function formatDateAR(iso: string | null): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export function formatDuration(days: number | null): string {
  if (days === null) return '—'
  if (days <= 0) return 'منتهٍ'
  if (days < 30) return `${days} يوم`
  const months = Math.floor(days / 30)
  const remDays = days % 30
  if (months < 12) {
    return remDays > 0 ? `${months} شهر و ${remDays} يوم` : `${months} شهر`
  }
  const years = Math.floor(months / 12)
  const remMonths = months % 12
  return remMonths > 0 ? `${years} سنة و ${remMonths} شهر` : `${years} سنة`
}

export function buildId(meta: ParsedAccount['meta']): string {
  return `${meta.host}:${meta.port}:${meta.username}`
}
