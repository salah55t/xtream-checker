/**
 * Persistent speed test history in localStorage.
 * Stores the latest N speed tests per host:port for trend analysis.
 */

export interface SpeedHistoryEntry {
  id: string
  host: string
  port: number
  username: string
  testedAt: string
  score: number
  letter: string
  label: string
  color: string
  avgRtt: number | null
  jitter: number | null
  successRate: number
  samplesCount: number
  streamSpeedMbps?: number | null
  streamQuality?: string
}

const KEY = 'xtream-speed-history-v1'
const MAX_ENTRIES = 100
const MAX_PER_HOST = 20

export function loadSpeedHistory(): SpeedHistoryEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as SpeedHistoryEntry[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveSpeedHistoryEntry(entry: SpeedHistoryEntry): SpeedHistoryEntry[] {
  const list = loadSpeedHistory()
  // Keep at most MAX_PER_HOST entries for this host:port
  const sameHost = list.filter(
    (e) => e.host === entry.host && e.port === entry.port
  )
  const others = list.filter(
    (e) => !(e.host === entry.host && e.port === entry.port)
  )
  const updatedSameHost = [entry, ...sameHost].slice(0, MAX_PER_HOST)
  const next = [...updatedSameHost, ...others].slice(0, MAX_ENTRIES)
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // ignore quota errors
  }
  return next
}

export function getSpeedHistoryForHost(host: string, port: number): SpeedHistoryEntry[] {
  return loadSpeedHistory().filter((e) => e.host === host && e.port === port)
}

export function clearSpeedHistory(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}

export function removeSpeedHistoryEntry(id: string): SpeedHistoryEntry[] {
  const list = loadSpeedHistory().filter((e) => e.id !== id)
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    // ignore
  }
  return list
}

/**
 * Threshold configuration for alerts.
 */
export interface SpeedThresholds {
  minScore: number // alert if score below this
  maxAvgRtt: number // alert if avg RTT above this
  minSuccessRate: number // alert if success rate below this
}

const DEFAULT_THRESHOLDS: SpeedThresholds = {
  minScore: 50,
  maxAvgRtt: 800,
  minSuccessRate: 0.8,
}

const THRESHOLDS_KEY = 'xtream-speed-thresholds-v1'

export function loadThresholds(): SpeedThresholds {
  if (typeof window === 'undefined') return DEFAULT_THRESHOLDS
  try {
    const raw = localStorage.getItem(THRESHOLDS_KEY)
    if (!raw) return DEFAULT_THRESHOLDS
    return { ...DEFAULT_THRESHOLDS, ...(JSON.parse(raw) as Partial<SpeedThresholds>) }
  } catch {
    return DEFAULT_THRESHOLDS
  }
}

export function saveThresholds(t: SpeedThresholds): void {
  try {
    localStorage.setItem(THRESHOLDS_KEY, JSON.stringify(t))
  } catch {
    // ignore
  }
}

export interface SpeedAlert {
  level: 'warning' | 'critical'
  message: string
}

export function checkAlerts(
  score: number,
  avgRtt: number | null,
  successRate: number,
  thresholds: SpeedThresholds = loadThresholds()
): SpeedAlert[] {
  const alerts: SpeedAlert[] = []
  if (score < thresholds.minScore) {
    alerts.push({
      level: score < 25 ? 'critical' : 'warning',
      message: `التقييم منخفض (${score}/100) — أقل من الحد المقبول (${thresholds.minScore})`,
    })
  }
  if (avgRtt !== null && avgRtt > thresholds.maxAvgRtt) {
    alerts.push({
      level: avgRtt > 1500 ? 'critical' : 'warning',
      message: `زمن الاستجابة مرتفع (${avgRtt}ms) — أعلى من الحد المقبول (${thresholds.maxAvgRtt}ms)`,
    })
  }
  if (successRate < thresholds.minSuccessRate) {
    alerts.push({
      level: successRate < 0.5 ? 'critical' : 'warning',
      message: `نسبة النجاح منخفضة (${Math.round(successRate * 100)}%) — أقل من الحد المقبول (${Math.round(thresholds.minSuccessRate * 100)}%)`,
    })
  }
  return alerts
}
