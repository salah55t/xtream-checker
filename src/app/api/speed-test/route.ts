import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

interface SpeedSample {
  attempt: number
  rtt: number // round-trip time in ms
  ok: boolean
  error?: string
  timestamp: number
}

export interface SpeedTestResult {
  ok: boolean
  error?: string
  meta: {
    host: string
    port: number
    protocol: 'http' | 'https'
    username: string
    startedAt: string
    finishedAt: string
    totalDurationMs: number
    samplesCount: number
  }
  samples: SpeedSample[]
  stats: {
    successCount: number
    failureCount: number
    successRate: number // 0..1
    failureRate: number // 0..1
    minRtt: number | null
    maxRtt: number | null
    avgRtt: number | null
    medianRtt: number | null
    stddevRtt: number | null
    jitter: number | null // mean absolute deviation between consecutive samples
  }
  grade: {
    score: number // 0..100
    label: 'ممتاز' | 'جيد جداً' | 'جيد' | 'مقبول' | 'ضعيف' | 'سيء'
    letter: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F'
    color: string // tailwind color token
    reasons: string[]
  }
}

const SAMPLES_COUNT = 8
const REQUEST_TIMEOUT_MS = 8000
const INTER_SAMPLE_DELAY_MS = 250

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid]
}

function stddev(values: number[]): number | null {
  if (values.length === 0) return null
  if (values.length === 1) return 0
  const mean = values.reduce((s, v) => s + v, 0) / values.length
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1)
  return Math.round(Math.sqrt(variance))
}

function meanAbsDiff(values: number[]): number | null {
  if (values.length < 2) return null
  let sum = 0
  for (let i = 1; i < values.length; i++) {
    sum += Math.abs(values[i] - values[i - 1])
  }
  return Math.round(sum / (values.length - 1))
}

function buildGrade(
  avgRtt: number | null,
  jitter: number | null,
  failureRate: number,
  successCount: number,
  samplesCount: number
): SpeedTestResult['grade'] {
  const reasons: string[] = []

  // If everything failed, return F immediately
  if (successCount === 0) {
    return {
      score: 0,
      label: 'سيء',
      letter: 'F',
      color: 'rose',
      reasons: ['فشل جميع المحاولات — الخادم غير قابل للوصول أو يرفض الاتصال'],
    }
  }

  let score = 100

  // Latency score (50 points max)
  // Map: <100ms = 50, <250ms = 42, <500ms = 34, <1000ms = 24, <2000ms = 12, else 4
  let latencyScore = 4
  if (avgRtt !== null) {
    if (avgRtt < 100) latencyScore = 50
    else if (avgRtt < 250) latencyScore = 42
    else if (avgRtt < 500) latencyScore = 34
    else if (avgRtt < 1000) latencyScore = 24
    else if (avgRtt < 2000) latencyScore = 12
    else latencyScore = 4

    if (avgRtt < 100) reasons.push(`زمن استجابة ممتاز (${avgRtt}ms)`)
    else if (avgRtt < 250) reasons.push(`زمن استجابة جيد جداً (${avgRtt}ms)`)
    else if (avgRtt < 500) reasons.push(`زمن استجابة جيد (${avgRtt}ms)`)
    else if (avgRtt < 1000) reasons.push(`زمن استجابة مقبول (${avgRtt}ms)`)
    else if (avgRtt < 2000) reasons.push(`زمن استجابة بطيء (${avgRtt}ms)`)
    else reasons.push(`زمن استجابة بطيء جداً (${avgRtt}ms)`)
  } else {
    latencyScore = 0
  }
  score = latencyScore // 50 max

  // Stability score (30 points max) — based on jitter (lower is better)
  // Map: <25ms = 30, <75ms = 24, <150ms = 18, <300ms = 12, <600ms = 6, else 2
  let stabilityScore = 2
  if (jitter !== null) {
    if (jitter < 25) stabilityScore = 30
    else if (jitter < 75) stabilityScore = 24
    else if (jitter < 150) stabilityScore = 18
    else if (jitter < 300) stabilityScore = 12
    else if (jitter < 600) stabilityScore = 6
    else stabilityScore = 2

    if (jitter < 25) reasons.push(`ثبات عالي — تذبذب منخفض (${jitter}ms)`)
    else if (jitter < 75) reasons.push(`ثبات جيد جداً (${jitter}ms)`)
    else if (jitter < 150) reasons.push(`ثبات جيد (${jitter}ms)`)
    else if (jitter < 300) reasons.push(`ثبات مقبول (${jitter}ms)`)
    else reasons.push(`ثبات ضعيف — تذبذب عالٍ (${jitter}ms)`)
  }
  score += stabilityScore

  // Reliability score (20 points max) — based on failure rate
  // 0% failures = 20, 12.5% = 17, 25% = 13, 37.5% = 9, 50% = 5, >50% = 0
  let reliabilityScore = 0
  if (failureRate === 0) reliabilityScore = 20
  else if (failureRate <= 0.125) reliabilityScore = 17
  else if (failureRate <= 0.25) reliabilityScore = 13
  else if (failureRate <= 0.375) reliabilityScore = 9
  else if (failureRate <= 0.5) reliabilityScore = 5
  else reliabilityScore = 0

  if (failureRate === 0) reasons.push(`موثوقية كاملة — نجحت جميع المحاولات (${successCount}/${samplesCount})`)
  else if (failureRate <= 0.25) reasons.push(`موثوقية جيدة — فشل ${Math.round(failureRate * 100)}% من المحاولات`)
  else if (failureRate <= 0.5) reasons.push(`موثوقية مقبولة — فشل ${Math.round(failureRate * 100)}% من المحاولات`)
  else reasons.push(`موثوقية ضعيفة — فشل ${Math.round(failureRate * 100)}% من المحاولات`)

  score += reliabilityScore

  // Final grade
  let label: SpeedTestResult['grade']['label'] = 'سيء'
  let letter: SpeedTestResult['grade']['letter'] = 'F'
  let color: string = 'rose'

  if (score >= 90) {
    label = 'ممتاز'
    letter = 'A+'
    color = 'emerald'
  } else if (score >= 80) {
    label = 'جيد جداً'
    letter = 'A'
    color = 'emerald'
  } else if (score >= 65) {
    label = 'جيد'
    letter = 'B'
    color = 'lime'
  } else if (score >= 45) {
    label = 'مقبول'
    letter = 'C'
    color = 'amber'
  } else if (score >= 25) {
    label = 'ضعيف'
    letter = 'D'
    color = 'orange'
  } else {
    label = 'سيء'
    letter = 'F'
    color = 'rose'
  }

  return { score, label, letter, color, reasons }
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<{ ok: boolean; rtt: number; error?: string }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const started = Date.now()
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; XtreamChecker/1.0 SpeedTest)',
        'Accept': 'application/json, text/plain, */*',
      },
      cache: 'no-store',
    })
    const rtt = Date.now() - started
    if (!res.ok) {
      return { ok: false, rtt, error: `HTTP ${res.status} ${res.statusText}` }
    }
    // Drain the body to ensure full response received
    await res.text()
    return { ok: true, rtt }
  } catch (err) {
    const rtt = Date.now() - started
    const e = err as Error
    if (e.name === 'AbortError') {
      return { ok: false, rtt, error: `انتهى الوقت (${timeoutMs}ms)` }
    }
    return { ok: false, rtt, error: e.message || 'خطأ غير معروف' }
  } finally {
    clearTimeout(timer)
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { host, port, protocol, username, password } = body as {
    host?: string
    port?: number | string
    protocol?: string
    username?: string
    password?: string
  }

  if (!host || !username || !password) {
    return NextResponse.json(
      { ok: false, error: 'بيانات غير مكتملة (host, username, password مطلوبة)' },
      { status: 400 }
    )
  }

  const p = protocol === 'https' ? 'https' : 'http'
  const portNum = port ? parseInt(String(port), 10) : p === 'https' ? 443 : 80
  const apiBase = `${p}://${host}:${portNum}/player_api.php`
  const auth = `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`
  // We use action=get_live_categories which returns a small JSON — good for ping-style testing
  const testUrl = `${apiBase}?${auth}&action=get_live_categories`

  const startedAt = new Date().toISOString()
  const startMs = Date.now()
  const samples: SpeedSample[] = []

  for (let i = 0; i < SAMPLES_COUNT; i++) {
    const result = await fetchWithTimeout(testUrl, REQUEST_TIMEOUT_MS)
    samples.push({
      attempt: i + 1,
      rtt: result.rtt,
      ok: result.ok,
      error: result.error,
      timestamp: Date.now(),
    })
    if (i < SAMPLES_COUNT - 1) {
      await sleep(INTER_SAMPLE_DELAY_MS)
    }
  }

  const finishedAt = new Date().toISOString()
  const totalDurationMs = Date.now() - startMs

  const successSamples = samples.filter((s) => s.ok)
  const successCount = successSamples.length
  const failureCount = samples.length - successCount
  const successRate = samples.length > 0 ? successCount / samples.length : 0
  const failureRate = samples.length > 0 ? failureCount / samples.length : 0

  const rtts = successSamples.map((s) => s.rtt)
  const minRtt = rtts.length > 0 ? Math.min(...rtts) : null
  const maxRtt = rtts.length > 0 ? Math.max(...rtts) : null
  const avgRtt = rtts.length > 0 ? Math.round(rtts.reduce((s, v) => s + v, 0) / rtts.length) : null
  const medianRtt = median(rtts)
  const stddevRtt = stddev(rtts)
  const jitter = meanAbsDiff(rtts)

  const grade = buildGrade(avgRtt, jitter, failureRate, successCount, samples.length)

  const result: SpeedTestResult = {
    ok: true,
    meta: {
      host,
      port: portNum,
      protocol: p,
      username,
      startedAt,
      finishedAt,
      totalDurationMs,
      samplesCount: samples.length,
    },
    samples,
    stats: {
      successCount,
      failureCount,
      successRate,
      failureRate,
      minRtt,
      maxRtt,
      avgRtt,
      medianRtt,
      stddevRtt,
      jitter,
    },
    grade,
  }

  return NextResponse.json(result, { status: 200 })
}
