'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Activity,
  Calendar,
  CalendarClock,
  Gauge,
  Globe,
  HardDrive,
  Link2,
  Radio,
  Server,
  ShieldCheck,
  Tv,
  Users,
  Film,
  Clapperboard,
  Clock,
  Zap,
} from 'lucide-react'
import type { ParsedAccount, ContentStats } from '@/lib/xtream/types'
import { formatDateAR, formatDuration } from '@/lib/xtream/types'
import { Button } from '@/components/ui/button'
import { SpeedTestCard } from '@/components/xtream/speed-test-card'

interface ResultCardProps {
  data: ParsedAccount
  stats?: ContentStats | null
  loadingStats?: boolean
  onLoadStats?: () => void
}

export function ResultCard({ data, stats, loadingStats, onLoadStats }: ResultCardProps) {
  const { user, server, meta } = data

  const statusColor = user.isActive
    ? user.isExpired
      ? 'bg-amber-500'
      : 'bg-emerald-500'
    : 'bg-red-500'

  const statusLabel = user.isExpired
    ? 'منتهي الصلاحية'
    : user.isActive
      ? 'نشط'
      : user.status || 'غير معروف'

  const connPct = user.maxConnections > 0
    ? Math.min(100, (user.activeConnections / user.maxConnections) * 100)
    : 0

  const m3uUrl = `${meta.protocol}://${meta.host}:${meta.port}/get.php?username=${encodeURIComponent(meta.username)}&password=${encodeURIComponent(meta.password)}&type=m3u_plus&output=ts`
  const portalUrl = `${meta.protocol}://${meta.host}:${meta.port}`

  return (
    <div className="space-y-4">
      {/* Status hero card */}
      <Card className="overflow-hidden border-0 shadow-lg shadow-emerald-500/10">
        <div className="relative bg-gradient-to-l from-emerald-600 via-emerald-700 to-teal-800 p-6 text-white">
          <div className="absolute inset-0 opacity-20" style={{
            backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }} />
          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className={`inline-block h-3 w-3 rounded-full ${statusColor} ring-4 ring-white/30`} />
                <span className="text-sm font-medium text-emerald-50">{statusLabel}</span>
                {user.isTrial && (
                  <Badge variant="secondary" className="bg-amber-400 text-amber-950 hover:bg-amber-400">تجريبي</Badge>
                )}
              </div>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{user.username}</h2>
              <p className="text-sm text-emerald-100/90 font-mono dir-ltr text-left" dir="ltr">
                {meta.host}:{meta.port}
              </p>
            </div>
            <div className="text-left">
              <div className="text-emerald-100/80 text-xs">الأيام المتبقية</div>
              <div className="text-4xl font-extrabold tabular-nums">
                {user.daysLeft ?? '—'}
              </div>
              <div className="text-xs text-emerald-100/80 mt-1">
                ينتهي في {formatDateAR(user.expDate)}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Subscription details */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              تفاصيل الاشتراك
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <DetailRow icon={<Activity className="h-4 w-4" />} label="الحالة" value={statusLabel} />
            <DetailRow icon={<Zap className="h-4 w-4" />} label="النوع" value={user.isTrial ? 'اشتراك تجريبي' : 'اشتراك مدفوع'} />
            <DetailRow icon={<Calendar className="h-4 w-4" />} label="تاريخ الإنشاء" value={formatDateAR(user.createdAt)} />
            <DetailRow icon={<CalendarClock className="h-4 w-4" />} label="تاريخ الانتهاء" value={formatDateAR(user.expDate)} />
            <DetailRow icon={<Clock className="h-4 w-4" />} label="مدة الاشتراك" value={formatDuration(user.durationDays)} />
            <DetailRow icon={<Gauge className="h-4 w-4" />} label="زمن الاستجابة" value={`${meta.responseTimeMs} مللي ثانية`} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-emerald-600" />
              الاتصالات
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">الاتصالات النشطة</span>
              <span className="font-bold tabular-nums text-lg">
                {user.activeConnections} / {user.maxConnections || '∞'}
              </span>
            </div>
            <Progress value={connPct} className="h-2" />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>المتاحة: {user.availableConnections}</span>
              <span>{Math.round(connPct)}% مستخدم</span>
            </div>
            <Separator />
            <div className="space-y-2">
              <div className="text-muted-foreground">صيغ الإخراج المسموحة</div>
              {user.allowedOutputs.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {user.allowedOutputs.map((o) => (
                    <Badge key={o} variant="secondary" className="font-mono text-xs">{o}</Badge>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">—</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Server info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Server className="h-4 w-4 text-emerald-600" />
            معلومات الخادم
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <DetailRow icon={<Globe className="h-4 w-4" />} label="الرابط" value={server.url || meta.host} />
          <DetailRow icon={<Server className="h-4 w-4" />} label="المنفذ" value={String(server.port)} />
          {server.httpsPort ? <DetailRow icon={<ShieldCheck className="h-4 w-4" />} label="منفذ HTTPS" value={String(server.httpsPort)} /> : null}
          {server.rtmpPort ? <DetailRow icon={<Radio className="h-4 w-4" />} label="منفذ RTMP" value={String(server.rtmpPort)} /> : null}
          <DetailRow icon={<Activity className="h-4 w-4" />} label="البروتوكول" value={server.protocol || meta.protocol} />
          {server.timezone ? <DetailRow icon={<Globe className="h-4 w-4" />} label="المنطقة الزمنية" value={server.timezone} /> : null}
          {server.rip ? <DetailRow icon={<HardDrive className="h-4 w-4" />} label="عنوان IP" value={server.rip} /> : null}
        </CardContent>
      </Card>

      {/* Content stats */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Tv className="h-4 w-4 text-emerald-600" />
            إحصائيات المحتوى
          </CardTitle>
          {onLoadStats && !stats && (
            <Button size="sm" variant="outline" onClick={onLoadStats} disabled={loadingStats}>
              {loadingStats ? 'جارٍ الجلب…' : 'جلب الإحصائيات'}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {stats ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <StatTile icon={<Radio className="h-4 w-4" />} label="قنوات مباشرة" value={stats.liveStreams} sub={`${stats.liveCategories} تصنيف`} color="text-emerald-600" />
              <StatTile icon={<Film className="h-4 w-4" />} label="أفلام VOD" value={stats.vodStreams} sub={`${stats.vodCategories} تصنيف`} color="text-amber-600" />
              <StatTile icon={<Clapperboard className="h-4 w-4" />} label="مسلسلات" value={stats.series} sub={`${stats.seriesCategories} تصنيف`} color="text-rose-600" />
            </div>
          ) : loadingStats ? (
            <div className="grid gap-3 sm:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">اضغط على &quot;جلب الإحصائيات&quot; لعرض تفاصيل المحتوى المتاح في الاشتراك.</p>
          )}
        </CardContent>
      </Card>

      {/* Quick links */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Link2 className="h-4 w-4 text-emerald-600" />
            روابط سريعة
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <LinkRow label="رابط M3U" value={m3uUrl} />
          <LinkRow label="بوابة المشغل" value={portalUrl} />
        </CardContent>
      </Card>

      {/* Speed test */}
      <SpeedTestCard
        input={{
          host: meta.host,
          port: meta.port,
          protocol: meta.protocol,
          username: meta.username,
          password: meta.password,
        }}
      />

      {/* Raw JSON */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">الاستجابة الخام (JSON)</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-64 rounded-md border bg-muted/30 p-3">
            <pre className="text-xs font-mono dir-ltr text-left leading-relaxed" dir="ltr">
              {JSON.stringify(data.raw || {}, null, 2)}
            </pre>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <span className="font-medium text-foreground text-left" dir="auto">{value}</span>
    </div>
  )
}

function StatTile({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: number; sub: string; color: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className={`mb-2 inline-flex h-8 w-8 items-center justify-center rounded-md bg-muted ${color}`}>{icon}</div>
      <div className="text-2xl font-bold tabular-nums">{value.toLocaleString('ar-EG')}</div>
      <div className="text-sm font-medium">{label}</div>
      <div className="text-xs text-muted-foreground">{sub}</div>
    </div>
  )
}

function LinkRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="flex items-center gap-2 rounded-md bg-muted/50 p-2">
        <code className="flex-1 text-xs font-mono break-all dir-ltr text-left" dir="ltr">{value}</code>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs"
          onClick={() => {
            if (typeof navigator !== 'undefined') {
              navigator.clipboard?.writeText(value).catch(() => {})
            }
          }}
        >
          نسخ
        </Button>
      </div>
    </div>
  )
}
