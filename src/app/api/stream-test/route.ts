import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

interface StreamTestResult {
  ok: boolean
  error?: string
  meta: {
    host: string
    port: number
    protocol: string
    username: string
    startedAt: string
    finishedAt: string
  }
  attempts: Array<{
    type: 'live_stream' | 'vod_stream' | 'live_segment' | 'hls'
    url: string
    ok: boolean
    bytes: number
    durationMs: number
    speedBps: number | null
    error?: string
  }>
  best: {
    type: string
    url: string
    bytes: number
    durationMs: number
    speedBps: number
    speedMBps: number
    speedMbps: number
  } | null
  stats: {
    totalAttempts: number
    successfulAttempts: number
    avgSpeedBps: number | null
    maxSpeedBps: number | null
    totalBytes: number
    totalDurationMs: number
  }
  grade: {
    label: string
    color: string
    quality: 'ممتاز' | 'جيد' | 'مقبول' | 'ضعيف' | 'سيء'
    notes: string[]
  }
}

const FETCH_TIMEOUT_MS = 12000
const MAX_BYTES = 2 * 1024 * 1024 // 2 MB cap per stream sample

async function fetchStreamSample(
  url: string,
  timeoutMs: number = FETCH_TIMEOUT_MS
): Promise<{ ok: boolean; bytes: number; durationMs: number; error?: string }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const start = Date.now()
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; XtreamChecker/1.0 StreamTest)',
        'Accept': '*/*',
      },
      cache: 'no-store',
    })
    if (!res.ok || !res.body) {
      return { ok: false, bytes: 0, durationMs: Date.now() - start, error: `HTTP ${res.status}` }
    }

    // Read up to MAX_BYTES from the stream
    const reader = res.body.getReader()
    let received = 0
    try {
      while (received < MAX_BYTES) {
        const { done, value } = await reader.read()
        if (done) break
        if (value) {
          received += value.byteLength
        }
      }
    } finally {
      try { await reader.cancel() } catch { /* ignore */ }
    }

    return { ok: true, bytes: received, durationMs: Date.now() - start }
  } catch (err) {
    const e = err as Error
    if (e.name === 'AbortError') {
      return { ok: false, bytes: 0, durationMs: Date.now() - start, error: `انتهى الوقت (${timeoutMs}ms)` }
    }
    return { ok: false, bytes: 0, durationMs: Date.now() - start, error: e.message }
  } finally {
    clearTimeout(timer)
  }
}

function buildStreamGrade(maxSpeedBps: number | null, successful: number, total: number): StreamTestResult['grade'] {
  const notes: string[] = []

  if (successful === 0) {
    return {
      label: 'غير قابل للبث',
      color: 'rose',
      quality: 'سيء',
      notes: ['تعذر جلب أي عينة بث من الخادم — قد يكون الخادم مقيداً أو البث متعثراً'],
    }
  }

  // Convert to Mbps for easier interpretation
  const mbps = maxSpeedBps ? maxSpeedBps * 8 / 1_000_000 : 0
  let label = 'ضعيف'
  let color = 'orange'
  let quality: StreamTestResult['grade']['quality'] = 'ضعيف'

  if (mbps >= 8) {
    label = 'ممتاز'
    color = 'emerald'
    quality = 'ممتاز'
    notes.push(`سرعة بث ممتازة (${mbps.toFixed(2)} Mbps) — تكفي لجودة 1080p وما فوق`)
  } else if (mbps >= 4) {
    label = 'جيد'
    color = 'emerald'
    quality = 'جيد'
    notes.push(`سرعة بث جيدة (${mbps.toFixed(2)} Mbps) — تكفي لجودة 720p`)
  } else if (mbps >= 1.5) {
    label = 'مقبول'
    color = 'amber'
    quality = 'مقبول'
    notes.push(`سرعة بث مقبولة (${mbps.toFixed(2)} Mbps) — تكفي لجودة 480p`)
  } else if (mbps > 0) {
    label = 'ضعيف'
    color = 'orange'
    quality = 'ضعيف'
    notes.push(`سرعة بث ضعيفة (${mbps.toFixed(2)} Mbps) — قد تحدث تقطعات`)
  } else {
    label = 'سيء'
    color = 'rose'
    quality = 'سيء'
    notes.push('لم يتم جلب بيانات كافية لقياس السرعة')
  }

  if (successful < total) {
    notes.push(`تنبيه: ${total - successful} من ${total} محاولات بث فشلت`)
  } else {
    notes.push(`نجحت جميع محاولات البث (${successful}/${total})`)
  }

  return { label, color, quality, notes }
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
      { ok: false, error: 'بيانات غير مكتملة' },
      { status: 400 }
    )
  }

  const p = protocol === 'https' ? 'https' : 'http'
  const portNum = port ? parseInt(String(port), 10) : p === 'https' ? 443 : 80
  const apiBase = `${p}://${host}:${portNum}/player_api.php`
  const auth = `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`
  const startedAt = new Date().toISOString()
  const startMs = Date.now()

  // Step 1: Get one live stream and one VOD stream ID
  const [liveRes, vodRes] = await Promise.all([
    fetch(`${apiBase}?${auth}&action=get_live_streams`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; XtreamChecker/1.0)' },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    }).then((r) => r.json()).catch(() => null),
    fetch(`${apiBase}?${auth}&action=get_vod_streams`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; XtreamChecker/1.0)' },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    }).then((r) => r.json()).catch(() => null),
  ])

  const attempts: StreamTestResult['attempts'] = []

  // Build candidate URLs to test
  const candidates: Array<{ type: StreamTestResult['attempts'][0]['type']; url: string }> = []

  // Live stream test (uses .ts format)
  if (Array.isArray(liveRes) && liveRes.length > 0) {
    const streamId = liveRes[0]?.stream_id
    if (streamId) {
      candidates.push({
        type: 'live_stream',
        url: `${p}://${host}:${portNum}/live/${encodeURIComponent(username)}/${encodeURIComponent(password)}/${streamId}.ts`,
      })
      candidates.push({
        type: 'hls',
        url: `${p}://${host}:${portNum}/live/${encodeURIComponent(username)}/${encodeURIComponent(password)}/${streamId}.m3u8`,
      })
    }
  }

  // VOD stream test (movie .mp4 sample)
  if (Array.isArray(vodRes) && vodRes.length > 0) {
    const vodId = vodRes[0]?.stream_id
    if (vodId) {
      candidates.push({
        type: 'vod_stream',
        url: `${p}://${host}:${portNum}/movie/${encodeURIComponent(username)}/${encodeURIComponent(password)}/${vodId}.mp4`,
      })
    }
  }

  if (candidates.length === 0) {
    return NextResponse.json({
      ok: false,
      error: 'لا توجد قنوات أو أفلام متاحة للاختبار',
      meta: { host, port: portNum, protocol: p, username, startedAt, finishedAt: new Date().toISOString() },
    }, { status: 200 })
  }

  // Run stream tests sequentially (parallel would compete for bandwidth and skew results)
  let totalBytes = 0
  let totalDuration = 0
  let successful = 0
  const speeds: number[] = []
  let bestAttempt: StreamTestResult['best'] | null = null

  for (const candidate of candidates) {
    const result = await fetchStreamSample(candidate.url)
    const speedBps = result.ok && result.durationMs > 0
      ? (result.bytes / result.durationMs) * 1000
      : null
    attempts.push({
      type: candidate.type,
      url: candidate.url,
      ok: result.ok,
      bytes: result.bytes,
      durationMs: result.durationMs,
      speedBps,
      error: result.error,
    })

    if (result.ok) {
      successful++
      totalBytes += result.bytes
      totalDuration += result.durationMs
      if (speedBps !== null) {
        speeds.push(speedBps)
        if (!bestAttempt || speedBps > bestAttempt.speedBps) {
          bestAttempt = {
            type: candidate.type,
            url: candidate.url,
            bytes: result.bytes,
            durationMs: result.durationMs,
            speedBps,
            speedMBps: speedBps / (1024 * 1024),
            speedMbps: (speedBps * 8) / 1_000_000,
          }
        }
      }
    }
  }

  const finishedAt = new Date().toISOString()
  const avgSpeedBps = speeds.length > 0 ? speeds.reduce((s, v) => s + v, 0) / speeds.length : null
  const maxSpeedBps = speeds.length > 0 ? Math.max(...speeds) : null

  const grade = buildStreamGrade(maxSpeedBps, successful, candidates.length)

  const result: StreamTestResult = {
    ok: true,
    meta: {
      host,
      port: portNum,
      protocol: p,
      username,
      startedAt,
      finishedAt,
    },
    attempts,
    best: bestAttempt,
    stats: {
      totalAttempts: candidates.length,
      successfulAttempts: successful,
      avgSpeedBps: avgSpeedBps !== null ? Math.round(avgSpeedBps) : null,
      maxSpeedBps: maxSpeedBps !== null ? Math.round(maxSpeedBps) : null,
      totalBytes,
      totalDurationMs: Date.now() - startMs,
    },
    grade,
  }

  return NextResponse.json(result, { status: 200 })
}
