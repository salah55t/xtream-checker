'use client'

import { useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Activity,
  Gauge,
  Loader2,
  Zap,
  TrendingUp,
  TrendingDown,
  Waves,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export interface SpeedTestInput {
  host: string
  port: number
  protocol: 'http' | 'https'
  username: string
  password: string
}

interface SpeedSample {
  attempt: number
  rtt: number
  ok: boolean
  error?: string
  timestamp: number
}

interface SpeedTestResult {
  ok: boolean
  error?: string
  meta: {
    host: string
    port: number
    protocol: string
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
    successRate: number
    failureRate: number
    minRtt: number | null
    maxRtt: number | null
    avgRtt: number | null
    medianRtt: number | null
    stddevRtt: number | null
    jitter: number | null
  }
  grade: {
    score: number
    label: string
    letter: string
    color: string
    reasons: string[]
  }
}

const colorMap: Record<string, { bg: string; text: string; ring: string; bar: string }> = {
  emerald: { bg: 'bg-emerald-500', text: 'text-emerald-700', ring: 'ring-emerald-200', bar: 'bg-emerald-500' },
  lime: { bg: 'bg-lime-500', text: 'text-lime-700', ring: 'ring-lime-200', bar: 'bg-lime-500' },
  amber: { bg: 'bg-amber-500', text: 'text-amber-700', ring: 'ring-amber-200', bar: 'bg-amber-500' },
  orange: { bg: 'bg-orange-500', text: 'text-orange-700', ring: 'ring-orange-200', bar: 'bg-orange-500' },
  rose: { bg: 'bg-rose-500', text: 'text-rose-700', ring: 'ring-rose-200', bar: 'bg-rose-500' },
}

interface SpeedTestCardProps {
  input: SpeedTestInput
}

export function SpeedTestCard({ input }: SpeedTestCardProps) {
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<SpeedTestResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  const handleRun = useCallback(async () => {
    setLoading(true)
    setError(null)
    setResult(null)
    setProgress(0)

    // Simulate progress while waiting (since API is single-shot)
    const progressTimer = setInterval(() => {
      setProgress((p) => Math.min(95, p + 4))
    }, 800)

    try {
      const res = await fetch('/api/speed-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      const data = (await res.json()) as SpeedTestResult | { ok: false; error: string }
      clearInterval(progressTimer)
      setProgress(100)

      if (!data.ok) {
        const err = (data as { ok: false; error: string }).error || 'فشل الاختبار'
        setError(err)
        toast({ title: 'فشل اختبار السرعة', description: err, variant: 'destructive' })
        return
      }

      const r = data as SpeedTestResult
      setResult(r)
      toast({
        title: `النتيجة: ${r.grade.label} (${r.grade.letter})`,
        description: `النقاط: ${r.grade.score}/100 • متوسط الاستجابة: ${r.stats.avgRtt ?? '—'}ms`,
      })
    } catch (err) {
      clearInterval(progressTimer)
      const e = err as Error
      setError(e.message || 'حدث خطأ غير متوقع')
      toast({ title: 'فشل الاتصال', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [input, toast])

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Gauge className="h-4 w-4 text-emerald-600" />
          اختبار سرعة الخادم وثباته
        </CardTitle>
        <Button size="sm" onClick={handleRun} disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 ml-1.5 animate-spin" />
              جارٍ الاختبار…
            </>
          ) : (
            <>
              <Zap className="h-3.5 w-3.5 ml-1.5" />
              {result ? 'إعادة الاختبار' : 'ابدأ الاختبار'}
            </>
          )}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && (
          <div className="space-y-2">
            <Progress value={progress} className="h-1.5" />
            <p className="text-xs text-muted-foreground text-center">
              جارٍ إجراء 8 طلبات متتالية لقياس السرعة والثبات…
            </p>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50/50 p-3 text-sm text-rose-700">
            ⚠ {error}
          </div>
        )}

        {loading && !result && <SpeedSkeleton />}

        {!loading && !result && !error && (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground space-y-2">
            <Gauge className="h-8 w-8 mx-auto text-muted-foreground/50" />
            <p>اضغط &quot;ابدأ الاختبار&quot; لقياس:</p>
            <div className="flex flex-wrap justify-center gap-3 text-xs">
              <span className="inline-flex items-center gap-1"><Activity className="h-3 w-3" /> زمن الاستجابة</span>
              <span className="inline-flex items-center gap-1"><Waves className="h-3 w-3" /> التذبذب (Jitter)</span>
              <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> الموثوقية</span>
            </div>
            <p className="text-xs">يُجرى 8 طلبات متتالية ويُحسب المتوسط والانحراف المعياري ونسبة الفشل</p>
          </div>
        )}

        {!loading && result && <SpeedResult result={result} />}
      </CardContent>
    </Card>
  )
}

function SpeedSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-24 w-full" />
      <div className="grid grid-cols-4 gap-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
      <Skeleton className="h-32 w-full" />
    </div>
  )
}

function SpeedResult({ result }: { result: SpeedTestResult }) {
  const { grade, stats, samples, meta } = result
  const colors = colorMap[grade.color] || colorMap.rose

  // Build bar chart heights (normalize to max rtt)
  const maxRtt = stats.maxRtt && stats.maxRtt > 0 ? stats.maxRtt : 1

  return (
    <div className="space-y-4">
      {/* Grade hero */}
      <div className={`relative overflow-hidden rounded-lg p-5 text-white ${colors.bg}`}>
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: 'radial-gradient(circle at 30% 50%, white 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }} />
        <div className="relative flex items-center justify-between gap-4">
          <div>
            <div className="text-xs opacity-90">تقييم الأداء الإجمالي</div>
            <div className="text-3xl font-extrabold mt-1">{grade.label}</div>
            <div className="text-xs opacity-90 mt-1">{grade.reasons[0]}</div>
          </div>
          <div className="text-center">
            <div className="text-5xl font-black tabular-nums">{grade.score}</div>
            <div className="text-xs opacity-90">/ 100</div>
            <Badge className="mt-1 bg-white/25 text-white hover:bg-white/25">الدرجة: {grade.letter}</Badge>
          </div>
        </div>
      </div>

      {/* Reasons */}
      {grade.reasons.length > 0 && (
        <ul className="space-y-1 text-xs">
          {grade.reasons.map((r, i) => (
            <li key={i} className="flex items-start gap-1.5">
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${colors.bg} mt-1.5 shrink-0`} />
              <span>{r}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatBox
          icon={<Activity className="h-3.5 w-3.5" />}
          label="متوسط الاستجابة"
          value={stats.avgRtt !== null ? `${stats.avgRtt}` : '—'}
          unit="ms"
          color={colors.text}
        />
        <StatBox
          icon={<TrendingDown className="h-3.5 w-3.5" />}
          label="أقل استجابة"
          value={stats.minRtt !== null ? `${stats.minRtt}` : '—'}
          unit="ms"
          color="text-emerald-700"
        />
        <StatBox
          icon={<TrendingUp className="h-3.5 w-3.5" />}
          label="أعلى استجابة"
          value={stats.maxRtt !== null ? `${stats.maxRtt}` : '—'}
          unit="ms"
          color="text-amber-700"
        />
        <StatBox
          icon={<Waves className="h-3.5 w-3.5" />}
          label="التذبذب (Jitter)"
          value={stats.jitter !== null ? `${stats.jitter}` : '—'}
          unit="ms"
          color={stats.jitter !== null && stats.jitter < 100 ? 'text-emerald-700' : 'text-amber-700'}
        />
      </div>

      {/* Reliability row */}
      <div className="grid grid-cols-3 gap-2">
        <StatBox
          icon={<CheckCircle2 className="h-3.5 w-3.5" />}
          label="ناجحة"
          value={`${stats.successCount}`}
          unit={`/ ${meta.samplesCount}`}
          color="text-emerald-700"
        />
        <StatBox
          icon={<XCircle className="h-3.5 w-3.5" />}
          label="فاشلة"
          value={`${stats.failureCount}`}
          unit={`/ ${meta.samplesCount}`}
          color={stats.failureCount > 0 ? 'text-rose-700' : 'text-muted-foreground'}
        />
        <StatBox
          icon={<Clock className="h-3.5 w-3.5" />}
          label="زمن الاختبار"
          value={`${(meta.totalDurationMs / 1000).toFixed(1)}`}
          unit="ث"
          color="text-muted-foreground"
        />
      </div>

      {/* Advanced stats */}
      <div className="rounded-lg border bg-muted/30 p-3 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
        <AdvStat label="الوسيط (Median)" value={stats.medianRtt} unit="ms" />
        <AdvStat label="الانحراف المعياري" value={stats.stddevRtt} unit="ms" />
        <AdvStat label="نسبة النجاح" value={Math.round(stats.successRate * 100)} unit="%" />
      </div>

      {/* Bar chart of samples */}
      <div>
        <div className="text-xs font-medium text-muted-foreground mb-2">تتبع زمن الاستجابة لكل محاولة</div>
        <div className="flex items-end gap-1.5 h-32 rounded-lg border bg-card p-3">
          {samples.map((s) => {
            const height = s.ok ? Math.max(8, (s.rtt / maxRtt) * 100) : 100
            const color = !s.ok
              ? 'bg-rose-400'
              : s.rtt < 250
                ? 'bg-emerald-500'
                : s.rtt < 600
                  ? 'bg-lime-500'
                  : s.rtt < 1200
                    ? 'bg-amber-500'
                    : 'bg-orange-500'
            return (
              <div key={s.attempt} className="flex-1 flex flex-col items-center gap-1 group relative">
                <div className="text-[10px] text-muted-foreground tabular-nums opacity-0 group-hover:opacity-100 transition-opacity">
                  {s.ok ? `${s.rtt}ms` : 'فشل'}
                </div>
                <div
                  className={`w-full rounded-t ${color} transition-all`}
                  style={{ height: `${height}%` }}
                  title={`المحاولة ${s.attempt}: ${s.ok ? `${s.rtt}ms` : `فشل (${s.error})`}`}
                />
                <div className="text-[9px] text-muted-foreground tabular-nums">{s.attempt}</div>
              </div>
            )
          })}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[10px] text-muted-foreground">
          <Legend color="bg-emerald-500" label="< 250ms" />
          <Legend color="bg-lime-500" label="< 600ms" />
          <Legend color="bg-amber-500" label="< 1200ms" />
          <Legend color="bg-orange-500" label="أبطأ" />
          <Legend color="bg-rose-400" label="فشل" />
        </div>
      </div>
    </div>
  )
}

function StatBox({
  icon,
  label,
  value,
  unit,
  color,
}: {
  icon: React.ReactNode
  label: string
  value: string
  unit?: string
  color?: string
}) {
  return (
    <div className="rounded-lg border bg-card p-2.5">
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1">
        {icon}
        <span>{label}</span>
      </div>
      <div className={`text-lg font-bold tabular-nums ${color || ''}`}>
        {value}
        {unit && <span className="text-[10px] text-muted-foreground font-normal ml-1">{unit}</span>}
      </div>
    </div>
  )
}

function AdvStat({ label, value, unit }: { label: string; value: number | null; unit: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-bold tabular-nums">
        {value !== null ? value : '—'}
        <span className="text-[10px] text-muted-foreground font-normal ml-1">{unit}</span>
      </span>
    </div>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`inline-block h-2 w-2 rounded-sm ${color}`} />
      <span>{label}</span>
    </span>
  )
}

/**
 * Compact badge component for embedding inside other cards (e.g. BatchChecker rows)
 */
export function SpeedBadge({ result }: { result: SpeedTestResult | null }) {
  if (!result) return null
  const colors = colorMap[result.grade.color] || colorMap.rose
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${colors.bg} text-white`}>
      <Zap className="h-2.5 w-2.5" />
      {result.grade.letter}
      <span className="opacity-90 font-normal">{result.grade.score}</span>
    </span>
  )
}

export type { SpeedTestResult as SpeedTestResultType }
