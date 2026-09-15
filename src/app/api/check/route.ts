import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface XtreamUserInfo {
  username?: string
  password?: string
  max_connections?: number | string
  active_cons?: number | string
  exp_date?: string | null
  is_trial?: string | number | boolean
  status?: string
  created_at?: string | null
  auth?: number
  allowed_output_formats?: string[]
  messaging?: string | null
  referral?: string | null
  // optional fields
  [k: string]: unknown
}

interface XtreamServerInfo {
  url?: string
  port?: string
  https_port?: string
  server_protocol?: string
  rtmp_port?: string
  server_method?: string
  rip?: string
  timezone?: string
  timestamp_now?: number
  process?: { [k: string]: number } | null
  [k: string]: unknown
}

interface XtreamAuthResponse {
  user_info?: XtreamUserInfo
  server_info?: XtreamServerInfo
}

export interface ParsedAccount {
  ok: boolean
  error?: string
  raw?: XtreamAuthResponse
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

function parseXtreamUrl(input: string): {
  host: string
  port: number
  protocol: 'http' | 'https'
  username: string
  password: string
} | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  // Pattern 1: full get.php URL
  // http://host:port/get.php?username=USER&password=PASS&type=m3u_plus&output=ts
  try {
    const u = new URL(trimmed)
    const params = u.searchParams
    const username = params.get('username') || ''
    const password = params.get('password') || ''
    if (username && password) {
      return {
        host: u.hostname,
        port: u.port ? parseInt(u.port, 10) : (u.protocol === 'https:' ? 443 : 80),
        protocol: u.protocol === 'https:' ? 'https' : 'http',
        username,
        password,
      }
    }
  } catch {
    // not a URL — fall through to other patterns
  }

  // Pattern 2: xtream://host:port/USER/PASS
  const xtreamMatch = trimmed.match(/^xtream:\/\/([^:/]+)(?::(\d+))?\/([^/]+)\/([^/]+)/i)
  if (xtreamMatch) {
    return {
      host: xtreamMatch[1],
      port: xtreamMatch[2] ? parseInt(xtreamMatch[2], 10) : 80,
      protocol: 'http',
      username: decodeURIComponent(xtreamMatch[3]),
      password: decodeURIComponent(xtreamMatch[4]),
    }
  }

  // Pattern 3: USER:PASS@host:port
  const credsMatch = trimmed.match(/^([^:@\s]+):([^:@\s]+)@([^:/]+)(?::(\d+))?$/)
  if (credsMatch) {
    return {
      host: credsMatch[3],
      port: credsMatch[4] ? parseInt(credsMatch[4], 10) : 80,
      protocol: 'http',
      username: credsMatch[1],
      password: credsMatch[2],
    }
  }

  return null
}

function toNumber(v: unknown, def = 0): number {
  if (v === null || v === undefined || v === '') return def
  const n = typeof v === 'number' ? v : parseInt(String(v), 10)
  return Number.isFinite(n) ? n : def
}

function formatTimestamp(ts: string | null | undefined): {
  iso: string | null
  ts: number | null
} {
  if (!ts) return { iso: null, ts: null }
  const n = parseInt(String(ts), 10)
  if (!Number.isFinite(n) || n <= 0) return { iso: null, ts: null }
  const d = new Date(n * 1000)
  if (isNaN(d.getTime())) return { iso: null, ts: null }
  return { iso: d.toISOString(), ts: n }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const input: {
    url?: string
    host?: string
    port?: number | string
    protocol?: string
    username?: string
    password?: string
  } = body || {}

  let host = (input.host || '').trim()
  let port = input.port ? parseInt(String(input.port), 10) : 0
  let protocol: 'http' | 'https' = (input.protocol as 'http' | 'https') || 'http'
  let username = (input.username || '').trim()
  let password = (input.password || '').trim()
  let inputUrl: string | undefined

  if (input.url && input.url.trim()) {
    const parsed = parseXtreamUrl(input.url)
    if (!parsed) {
      return NextResponse.json(
        { ok: false, error: 'صيغة الرابط غير صالحة. تحقق من المدخلات.' },
        { status: 400 }
      )
    }
    host = parsed.host
    port = parsed.port
    protocol = parsed.protocol
    username = parsed.username
    password = parsed.password
    inputUrl = input.url.trim()
  }

  if (!host || !username || !password) {
    return NextResponse.json(
      { ok: false, error: 'يجب توفير المضيف واسم المستخدم وكلمة المرور (أو رابط Xtream كامل).' },
      { status: 400 }
    )
  }

  if (!port) port = protocol === 'https' ? 443 : 80

  const apiBase = `${protocol}://${host}:${port}/player_api.php`
  const authUrl = `${apiBase}?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`

  const started = Date.now()
  const controller = new AbortController()
  const timeoutMs = 15000
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(authUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; XtreamChecker/1.0)',
        'Accept': 'application/json, text/plain, */*',
      },
      cache: 'no-store',
    })

    clearTimeout(timer)
    const responseTimeMs = Date.now() - started

    if (!res.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: `استجابة الخادم غير ناجحة: ${res.status} ${res.statusText}`,
          meta: { host, port, protocol, username, responseTimeMs },
        },
        { status: 200 }
      )
    }

    const text = await res.text()
    let data: XtreamAuthResponse
    try {
      data = JSON.parse(text) as XtreamAuthResponse
    } catch {
      return NextResponse.json(
        {
          ok: false,
          error: 'لم يتمكن الخادم من إرجاع JSON صالح. قد يكون الرابط غير صحيح أو محجوب.',
          meta: { host, port, protocol, username, responseTimeMs, sample: text.slice(0, 200) },
        },
        { status: 200 }
      )
    }

    const userInfo = data.user_info || {}
    const serverInfo = data.server_info || {}

    const status = (userInfo.status || 'Unknown').toString()
    const isActive = status.toLowerCase() === 'active'
    const isTrial = toNumber(userInfo.is_trial, 0) === 1

    const exp = formatTimestamp(userInfo.exp_date as string | null)
    const created = formatTimestamp(userInfo.created_at as string | null)

    const now = Date.now() / 1000
    const daysLeft = exp.ts ? Math.max(0, Math.floor((exp.ts - now) / 86400)) : null
    const isExpired = exp.ts ? exp.ts < now : false

    const durationDays =
      exp.ts && created.ts ? Math.floor((exp.ts - created.ts) / 86400) : null

    const maxConnections = toNumber(userInfo.max_connections, 0)
    const activeConnections = toNumber(userInfo.active_cons, 0)

    const allowedOutputs = Array.isArray(userInfo.allowed_output_formats)
      ? (userInfo.allowed_output_formats as string[]).map((s) => String(s))
      : []

    const result: ParsedAccount = {
      ok: true,
      raw: data,
      meta: {
        inputUrl,
        host,
        port,
        protocol,
        username,
        password,
        fetchedAt: new Date().toISOString(),
        responseTimeMs,
      },
      user: {
        username: userInfo.username || username,
        status,
        isActive,
        isTrial,
        isExpired,
        expDate: exp.iso,
        expTimestamp: exp.ts,
        daysLeft,
        createdAt: created.iso,
        createdTimestamp: created.ts,
        durationDays,
        maxConnections,
        activeConnections,
        availableConnections: Math.max(0, maxConnections - activeConnections),
        allowedOutputs,
      },
      server: {
        url: serverInfo.url || host,
        port: toNumber(serverInfo.port, port),
        httpsPort: serverInfo.https_port ? toNumber(serverInfo.https_port, 0) || null : null,
        rtmpPort: serverInfo.rtmp_port ? toNumber(serverInfo.rtmp_port, 0) || null : null,
        protocol: serverInfo.server_protocol || protocol,
        serverMethod: serverInfo.server_method || '',
        rip: serverInfo.rip || '',
        timezone: serverInfo.timezone || '',
        timestampNow: serverInfo.timestamp_now || null,
      },
    }

    return NextResponse.json(result, { status: 200 })
  } catch (err: unknown) {
    clearTimeout(timer)
    const e = err as Error
    const message = e.name === 'AbortError'
      ? `انتهى وقت الانتظار (${timeoutMs / 1000} ثانية) دون استجابة من الخادم.`
      : `فشل الاتصال بالخادم: ${e.message || 'خطأ غير معروف'}`
    return NextResponse.json(
      {
        ok: false,
        error: message,
        meta: { host, port, protocol, username, responseTimeMs: Date.now() - started },
      },
      { status: 200 }
    )
  }
}
