'use client'

import { ParsedAccount, ContentStats, HistoryEntry, formatDateAR, formatDuration } from './types'

const NOW = Math.floor(Date.now() / 1000)
const EXP = NOW + 87 * 86400
const CREATED = NOW - 273 * 86400

export const DEMO_ACCOUNT: ParsedAccount = {
  ok: true,
  meta: {
    inputUrl: 'http://demo.iptv-server.com:8080/get.php?username=demo_user&password=demo_pass&type=m3u_plus',
    host: 'demo.iptv-server.com',
    port: 8080,
    protocol: 'http',
    username: 'demo_user',
    password: 'demo_pass',
    fetchedAt: new Date().toISOString(),
    responseTimeMs: 187,
  },
  user: {
    username: 'demo_user',
    status: 'Active',
    isActive: true,
    isTrial: false,
    isExpired: false,
    expDate: new Date(EXP * 1000).toISOString(),
    expTimestamp: EXP,
    daysLeft: 87,
    createdAt: new Date(CREATED * 1000).toISOString(),
    createdTimestamp: CREATED,
    durationDays: 360,
    maxConnections: 2,
    activeConnections: 1,
    availableConnections: 1,
    allowedOutputs: ['ts', 'm3u8', 'rtmp'],
  },
  server: {
    url: 'demo.iptv-server.com',
    port: 8080,
    httpsPort: 8443,
    rtmpPort: 25443,
    protocol: 'http',
    serverMethod: 'default',
    rip: '185.42.144.18',
    timezone: 'Europe/Amsterdam',
    timestampNow: NOW,
  },
  raw: {
    user_info: {
      username: 'demo_user',
      password: 'demo_pass',
      max_connections: '2',
      active_cons: '1',
      exp_date: String(EXP),
      is_trial: '0',
      status: 'Active',
      created_at: String(CREATED),
      allowed_output_formats: ['ts', 'm3u8', 'rtmp'],
      auth: 1,
    },
    server_info: {
      url: 'demo.iptv-server.com',
      port: '8080',
      https_port: '8443',
      rtmp_port: '25443',
      server_protocol: 'http',
      server_method: 'default',
      rip: '185.42.144.18',
      timezone: 'Europe/Amsterdam',
      timestamp_now: NOW,
    },
  },
}

export const DEMO_STATS: ContentStats = {
  liveCategories: 12,
  liveStreams: 1250,
  vodCategories: 8,
  vodStreams: 8420,
  seriesCategories: 6,
  series: 1842,
}

export const DEMO_HISTORY: HistoryEntry[] = [
  {
    id: 'demo1',
    fetchedAt: new Date(Date.now() - 3600 * 1000).toISOString(),
    meta: DEMO_ACCOUNT.meta,
    user: DEMO_ACCOUNT.user,
    server: DEMO_ACCOUNT.server,
  },
]

export { formatDateAR, formatDuration }
