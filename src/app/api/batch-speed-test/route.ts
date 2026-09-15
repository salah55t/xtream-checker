import { NextRequest, NextResponse } from 'next/server'
import {
  SpeedTestResult,
  SpeedSample,
} from '../speed-test/route'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

interface ServerInput {
  host: string
  port: number
  protocol: 'http' | 'https'
  username: string
  password: string
  rawInput?: string
}

interface BatchSpeedResult {
  index: number
  rawInput?: string
  input: ServerInput
  result: SpeedTestResult | { ok: false; error: string }
}

const SAMPLES_PER_SERVER = 5 // fewer samples per server in batch mode for speed
const REQUEST_TIMEOUT_MS = 6000
const INTER_SAMPLE_DELAY_MS = 100
const CONCURRENCY = 3 // parallel servers tested

const SPEED_TEST_URL = new URL('/api/speed-test', 'http://localhost:3000').toString()

// Lightweight inline speed test (no internal HTTP call to avoid overhead)
async function quickSpeedTest(input: ServerInput): Promise<SpeedTestResult> {
  const { host, port, protocol, username, password } = input
  const p = protocol === 'https' ? 'https' : 'http'
  const portNum = port || (p === 'https' ? 443 : 80)
  const apiBase = `${p}://${host}:${portNum}/player_api.php`
  const auth = `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`
  const testUrl = `${apiBase}?${auth}&action=get_live_categories`

  const startedAt = new Date().toISOString()
  const startMs = Date.now()
  const samples: SpeedSample[] = []

  for (let i = 0; i < SAMPLES_PER_SERVER; i++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    const t0 = Date.now()
    let ok = false
    let error: string | undefined
    try {
      const res = await fetch(testUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; XtreamChecker/1.0 BatchSpeed)',
          'Accept': 'application/json, text/plain, */*',
        },
        cache: 'no-store',
      })
      const rtt = Date.now() - t0
      if (!res.ok) {
        error = `HTTP ${res.status}`
      } else {
        await res.text()
        ok = true
      }
      samples.push({ attempt: i + 1, rtt, ok, error, timestamp: Date.now() })
    } catch (err) {
      const rtt = Date.now() - t0
      const e = err as Error
      if (e.name === 'AbortError') error = `انتهى الوقت (${REQUEST_TIMEOUT_MS}ms)`
      else error = e.message || 'خطأ غير معروف'
      samples.push({ attempt: i + 1, rtt, ok: false, error, timestamp: Date.now() })
    } finally {
      clearTimeout(timer)
    }
    if (i < SAMPLES_PER_SERVER - 1) {
      await new Promise((r) => setTimeout(r, INTER_SAMPLE_DELAY_MS))
    }
  }

  const finishedAt = new Date().toISOString()
  const totalDurationMs = Date.now() - startMs

  const successSamples = samples.filter((s) => s.ok)
  const successCount = successSamples.length
  const failureCount = samples.length - successCount
  const successRate = samples.length > 0 ? successCount / samples.length : 0
  const failureRate = 1 - successRate

  const rtts = successSamples.map((s) => s.rtt)
  const minRtt = rtts.length > 0 ? Math.min(...rtts) : null
  const maxRtt = rtts.length > 0 ? Math.max(...rtts) : null
  const avgRtt = rtts.length > 0 ? Math.round(rtts.reduce((s, v) => s + v, 0) / rtts.length) : null
  const sorted = [...rtts].sort((a, b) => a - b)
  const medianRtt = sorted.length > 0
    ? (sorted.length % 2 === 0
      ? Math.round((sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2)
      : sorted[Math.floor(sorted.length / 2)])
    : null
  const stddevRtt = sorted.length > 1
    ? Math.round(Math.sqrt(sorted.reduce((s, v) => s + (v - (avgRtt ?? 0)) ** 2, 0) / (sorted.length - 1)))
    : sorted.length === 1 ? 0 : null
  let jitter: number | null = null
  if (rtts.length >= 2) {
    let sum = 0
    for (let i = 1; i < rtts.length; i++) sum += Math.abs(rtts[i] - rtts[i - 1])
    jitter = Math.round(sum / (rtts.length - 1))
  }

  // Build grade (same logic as single speed-test)
  const grade = buildGrade(avgRtt, jitter, failureRate, successCount, samples.length)

  return {
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
}

function buildGrade(
  avgRtt: number | null,
  jitter: number | null,
  failureRate: number,
  successCount: number,
  samplesCount: number
): SpeedTestResult['grade'] {
  const reasons: string[] = []

  if (successCount === 0) {
    return {
      score: 0,
      label: 'سيء',
      letter: 'F',
      color: 'rose',
      reasons: ['فشل جميع المحاولات — الخادم غير قابل للوصول'],
    }
  }

  let score = 100
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
  score = latencyScore

  let stabilityScore = 2
  if (jitter !== null) {
    if (jitter < 25) stabilityScore = 30
    else if (jitter < 75) stabilityScore = 24
    else if (jitter < 150) stabilityScore = 18
    else if (jitter < 300) stabilityScore = 12
    else if (jitter < 600) stabilityScore = 6
    else stabilityScore = 2

    if (jitter < 25) reasons.push(`ثبات عالي (${jitter}ms)`)
    else if (jitter < 75) reasons.push(`ثبات جيد جداً (${jitter}ms)`)
    else if (jitter < 150) reasons.push(`ثبات جيد (${jitter}ms)`)
    else if (jitter < 300) reasons.push(`ثبات مقبول (${jitter}ms)`)
    else reasons.push(`ثبات ضعيف (${jitter}ms)`)
  }
  score += stabilityScore

  let reliabilityScore = 0
  if (failureRate === 0) reliabilityScore = 20
  else if (failureRate <= 0.2) reliabilityScore = 16
  else if (failureRate <= 0.4) reliabilityScore = 12
  else if (failureRate <= 0.6) reliabilityScore = 7
  else if (failureRate <= 0.8) reliabilityScore = 3
  else reliabilityScore = 0

  if (failureRate === 0) reasons.push(`موثوقية كاملة (${successCount}/${samplesCount})`)
  else if (failureRate <= 0.4) reasons.push(`موثوقية جيدة — فشل ${Math.round(failureRate * 100)}%`)
  else reasons.push(`موثوقية ضعيفة — فشل ${Math.round(failureRate * 100)}%`)

  score += reliabilityScore

  let label: SpeedTestResult['grade']['label'] = 'سيء'
  let letter: SpeedTestResult['grade']['letter'] = 'F'
  let color: string = 'rose'

  if (score >= 90) { label = 'ممتاز'; letter = 'A+'; color = 'emerald' }
  else if (score >= 80) { label = 'جيد جداً'; letter = 'A'; color = 'emerald' }
  else if (score >= 65) { label = 'جيد'; letter = 'B'; color = 'lime' }
  else if (score >= 45) { label = 'مقبول'; letter = 'C'; color = 'amber' }
  else if (score >= 25) { label = 'ضعيف'; letter = 'D'; color = 'orange' }
  else { label = 'سيء'; letter = 'F'; color = 'rose' }

  return { score, label, letter, color, reasons }
}

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
  onProgress?: (done: number, total: number, currentIndex: number) => void
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let cursor = 0
  let done = 0
  const total = items.length

  async function runWorker() {
    while (cursor < items.length) {
      const myIndex = cursor++
      results[myIndex] = await worker(items[myIndex], myIndex)
      done++
      onProgress?.(done, total, myIndex)
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => runWorker())
  await Promise.all(workers)
  return results
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const servers: ServerInput[] = Array.isArray(body?.servers) ? body.servers : []

  if (servers.length === 0) {
    return NextResponse.json({ ok: false, error: 'لا توجد خوادم للاختبار' }, { status: 400 })
  }

  if (servers.length > 50) {
    return NextResponse.json(
      { ok: false, error: 'الحد الأقصى 50 خادماً للاختبار الجماعي' },
      { status: 400 }
    )
  }

  const results = await runWithConcurrency<
    { server: ServerInput; idx: number },
    BatchSpeedResult
  >(
    servers.map((s, idx) => ({ server: s, idx })),
    CONCURRENCY,
    async ({ server, idx }) => {
      try {
        const result = await quickSpeedTest(server)
        return { index: idx, rawInput: server.rawInput, input: server, result }
      } catch (err) {
        const e = err as Error
        return {
          index: idx,
          rawInput: server.rawInput,
          input: server,
          result: { ok: false, error: e.message || 'فشل الاختبار' },
        }
      }
    }
  )

  results.sort((a, b) => a.index - b.index)

  return NextResponse.json(
    {
      ok: true,
      results,
      total: results.length,
    },
    { status: 200 }
  )
}
