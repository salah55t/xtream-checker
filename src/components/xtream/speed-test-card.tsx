'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
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
  Radio,
  History,
  AlertTriangle,
  Settings2,
  ChevronDown,
  ChevronUp,
  Video,
  Film,
  PlayCircle,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import {
  loadSpeedHistory,
  saveSpeedHistoryEntry,
  getSpeedHistoryForHost,
  loadThresholds,
  saveThresholds,
  checkAlerts,
  type SpeedHistoryEntry,
  type SpeedThresholds,
  type SpeedAlert,
} from '@/lib/xtream/speed-history'

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
    type: string
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
    quality: string
    notes: string[]
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
  /** Optional: pass a result computed externally (e.g. from batch test) */
  initialResult?: SpeedTestResult | null
  /** Hide the action button when used as a read-only display */
  readOnly?: boolean
}

export function SpeedTestCard({ input, initialResult, readOnly }: SpeedTestCardProps) {
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<SpeedTestResult | null>(initialResult ?? null)
  const [error, setError] = useState<string | null>(null)
  const [streamLoading, setStreamLoading] = useState(false)
  const [streamResult, setStreamResult] = useState<StreamTestResult | null>(null)
  const [streamError, setStreamError] = useState<string | null>(null)
  const [history, setHistory] = useState<SpeedHistoryEntry[]>([])
  const [thresholds, setThresholds] = useState<SpeedThresholds>(loadThresholds())
  const [showThresholds, setShowThresholds] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const { toast } = useToast()

  // Load history for this host when input changes
  useEffect(() => {
    setHistory(getSpeedHistoryForHost(input.host, input.port))
  }, [input.host, input.port])

  // Sync initialResult if provided externally
  useEffect(() => {
    if (initialResult) {
      setResult(initialResult)
      setError(null)
    }
  }, [initialResult])

  const handleRun = useCallback(async () => {
    setLoading(true)
    setError(null)
    setResult(null)
    setProgress(0)
    setStreamResult(null)
    setStreamError(null)

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

      // Save to history
      const entry: SpeedHistoryEntry = {
        id: `${input.host}:${input.port}-${Date.now()}`,
        host: input.host,
        port: input.port,
        username: input.username,
        testedAt: r.meta.finishedAt,
        score: r.grade.score,
        letter: r.grade.letter,
        label: r.grade.label,
        color: r.grade.color,
        avgRtt: r.stats.avgRtt,
        jitter: r.stats.jitter,
        successRate: r.stats.successRate,
        samplesCount: r.meta.samplesCount,
      }
      const next = saveSpeedHistoryEntry(entry)
      setHistory(getSpeedHistoryForHost(input.host, input.port))

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

  const handleStreamTest = useCallback(async () => {
    setStreamLoading(true)
    setStreamError(null)
    setStreamResult(null)
    try {
      const res = await fetch('/api/stream-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      const data = (await res.json()) as StreamTestResult | { ok: false; error: string }
      if (!data.ok) {
        const err = (data as { ok: false; error: string }).error || 'فشل اختبار البث'
        setStreamError(err)
        toast({ title: 'فشل اختبار البث', description: err, variant: 'destructive' })
        return
      }
      const r = data as StreamTestResult
      setStreamResult(r)

      // Update the latest history entry with stream info
      const latest = history[0]
      if (latest) {
        const updated: SpeedHistoryEntry = {
          ...latest,
          streamSpeedMbps: r.best?.speedMbps ?? null,
          streamQuality: r.grade.quality,
        }
        saveSpeedHistoryEntry(updated)
        setHistory(getSpeedHistoryForHost(input.host, input.port))
      }

      toast({
        title: `اختبار البث: ${r.grade.label}`,
        description: r.best
          ? `السرعة القصوى: ${r.best.speedMbps.toFixed(2)} Mbps`
          : 'تعذر قياس سرعة البث',
      })
    } catch (err) {
      const e = err as Error
      setStreamError(e.message)
      toast({ title: 'فشل الاتصال', description: e.message, variant: 'destructive' })
    } finally {
      setStreamLoading(false)
    }
  }, [input, history, toast])

  const alerts = useMemo<SpeedAlert[]>(() => {
    if (!result) return []
    return checkAlerts(
      result.grade.score,
      result.stats.avgRtt,
      result.stats.successRate,
      thresholds
    )
  }, [result, thresholds])

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Gauge className="h-4 w-4 text-emerald-600" />
          اختبار سرعة الخادم وثباته
        </CardTitle>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={() => setShowThresholds((v) => !v)}
            title="إعدادات الحدود"
          >
            <Settings2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={() => setShowHistory((v) => !v)}
            title="السجل التاريخي"
          >
            <History className="h-3.5 w-3.5" />
          </Button>
          {!readOnly && (
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
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showThresholds && (
          <ThresholdsEditor
            thresholds={thresholds}
            onChange={(t) => {
              setThresholds(t)
              saveThresholds(t)
            }}
          />
        )}

        {showHistory && (
          <HistoryPanel
            entries={history}
            onClear={() => {
              setHistory([])
              // Clear only this host's history (we have only this host's entries here)
              // but for simplicity clear all
              if (typeof window !== 'undefined') {
                localStorage.removeItem('xtream-speed-history-v1')
              }
            }}
          />
        )}

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

        {!loading && !result && !error && !readOnly && (
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

        {!loading && result && (
          <SpeedResult
            result={result}
            alerts={alerts}
            streamLoading={streamLoading}
            streamResult={streamResult}
            streamError={streamError}
            onStreamTest={handleStreamTest}
            history={history}
          />
        )}
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

function ThresholdsEditor({
  thresholds,
  onChange,
}: {
  thresholds: SpeedThresholds
  onChange: (t: SpeedThresholds) => void
}) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
      <div className="text-xs font-medium flex items-center gap-1.5">
        <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
        إعدادات التنبيهات الحدية
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="space-y-1">
          <Label htmlFor="thr-score" className="text-[10px]">أقل تقييم مقبول</Label>
          <Input
            id="thr-score"
            type="number"
            min={0}
            max={100}
            value={thresholds.minScore}
            onChange={(e) => onChange({ ...thresholds, minScore: Number(e.target.value) || 0 })}
            className="h-7 text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="thr-rtt" className="text-[10px]">أقصى زمن استجابة (ms)</Label>
          <Input
            id="thr-rtt"
            type="number"
            min={50}
            max={10000}
            value={thresholds.maxAvgRtt}
            onChange={(e) => onChange({ ...thresholds, maxAvgRtt: Number(e.target.value) || 500 })}
            className="h-7 text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="thr-success" className="text-[10px]">أدنى نسبة نجاح (%)</Label>
          <Input
            id="thr-success"
            type="number"
            min={0}
            max={100}
            value={Math.round(thresholds.minSuccessRate * 100)}
            onChange={(e) => onChange({ ...thresholds, minSuccessRate: (Number(e.target.value) || 0) / 100 })}
            className="h-7 text-xs"
          />
        </div>
      </div>
    </div>
  )
}

function HistoryPanel({
  entries,
  onClear,
}: {
  entries: SpeedHistoryEntry[]
  onClear: () => void
}) {
  if (entries.length === 0) {
    return (
      <div className="rounded-lg border bg-muted/30 p-3 text-xs text-center text-muted-foreground">
        لا توجد فحوصات سابقة لهذا الخادم بعد
      </div>
    )
  }
  return (
    <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium flex items-center gap-1.5">
          <History className="h-3.5 w-3.5 text-emerald-600" />
          السجل التاريخي ({entries.length})
        </div>
        <Button size="sm" variant="ghost" className="h-6 text-[10px] text-destructive" onClick={onClear}>
          مسح
        </Button>
      </div>
      <div className="space-y-1 max-h-40 overflow-y-auto">
        {entries.map((e) => (
          <div key={e.id} className="flex items-center justify-between gap-2 text-[11px] rounded bg-background/60 p-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <Badge variant="outline" className={`text-[9px] py-0 h-3.5`}>
                {e.letter}
              </Badge>
              <span className="tabular-nums font-bold">{e.score}</span>
              <span className="text-muted-foreground truncate">
                {e.avgRtt !== null ? `${e.avgRtt}ms` : '—'}
              </span>
              {e.streamSpeedMbps !== undefined && e.streamSpeedMbps !== null && (
                <span className="text-muted-foreground">• {e.streamSpeedMbps.toFixed(1)}Mbps</span>
              )}
            </div>
            <span className="text-[10px] text-muted-foreground shrink-0">
              {new Date(e.testedAt).toLocaleString('ar-EG', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function SpeedResult({
  result,
  alerts,
  streamLoading,
  streamResult,
  streamError,
  onStreamTest,
  history,
}: {
  result: SpeedTestResult
  alerts: SpeedAlert[]
  streamLoading: boolean
  streamResult: StreamTestResult | null
  streamError: string | null
  onStreamTest: () => void
  history: SpeedHistoryEntry[]
}) {
  const { grade, stats, samples, meta } = result
  const colors = colorMap[grade.color] || colorMap.rose

  // Build bar chart heights (normalize to max rtt)
  const maxRtt = stats.maxRtt && stats.maxRtt > 0 ? stats.maxRtt : 1

  // Trend: compare with previous entry (history[0] is current, history[1] is previous)
  const previous = history[1]
  const trend = previous ? grade.score - previous.score : null

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
            <div className="text-xs opacity-90 flex items-center gap-2">
              <span>تقييم الأداء الإجمالي</span>
              {trend !== null && (
                <span className="inline-flex items-center gap-0.5 bg-white/20 rounded-full px-1.5 py-0.5 text-[10px]">
                  {trend > 0 ? (
                    <>
                      <TrendingUp className="h-2.5 w-2.5" />
                      +{trend}
                    </>
                  ) : trend < 0 ? (
                    <>
                      <TrendingDown className="h-2.5 w-2.5" />
                      {trend}
                    </>
                  ) : (
                    'مستقر'
                  )}
                </span>
              )}
            </div>
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

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-1.5">
          {alerts.map((alert, i) => (
            <div
              key={i}
              className={`flex items-start gap-2 rounded-lg p-2 text-xs ${
                alert.level === 'critical'
                  ? 'bg-rose-50 border border-rose-200 text-rose-800'
                  : 'bg-amber-50 border border-amber-200 text-amber-800'
              }`}
            >
              <AlertTriangle className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${
                alert.level === 'critical' ? 'text-rose-600' : 'text-amber-600'
              }`} />
              <span>{alert.message}</span>
            </div>
          ))}
        </div>
      )}

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

      {/* Stream test */}
      <StreamTestSection
        loading={streamLoading}
        result={streamResult}
        error={streamError}
        onRun={onStreamTest}
      />
    </div>
  )
}

function StreamTestSection({
  loading,
  result,
  error,
  onRun,
}: {
  loading: boolean
  result: StreamTestResult | null
  error: string | null
  onRun: () => void
}) {
  return (
    <div className="rounded-lg border bg-card p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-medium flex items-center gap-1.5">
          <Video className="h-3.5 w-3.5 text-purple-600" />
          اختبار سرعة البث الفعلي
        </div>
        <Button size="sm" variant="outline" onClick={onRun} disabled={loading} className="h-7 text-xs">
          {loading ? (
            <>
              <Loader2 className="h-3 w-3 ml-1 animate-spin" />
              جارٍ البث…
            </>
          ) : result ? (
            'إعادة الاختبار'
          ) : (
            'ابدأ اختبار البث'
          )}
        </Button>
      </div>

      {error && (
        <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded p-2">
          ⚠ {error}
        </div>
      )}

      {loading && (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <p className="text-[10px] text-muted-foreground text-center">
            يجري الخادم اختبار بث عينة من قناة مباشرة وفيلم…
          </p>
        </div>
      )}

      {!loading && !result && !error && (
        <p className="text-xs text-muted-foreground">
          يحاول هذا الاختبار جلب عينة بث حقيقية (2MB) من قناة مباشرة وفيلم لقياس سرعة التنزيل الفعلية.
        </p>
      )}

      {!loading && result && (
        <div className="space-y-3">
          {/* Grade badge */}
          <div className={`flex items-center justify-between rounded p-2 ${
            result.grade.color === 'emerald' ? 'bg-emerald-50 text-emerald-800' :
            result.grade.color === 'amber' ? 'bg-amber-50 text-amber-800' :
            result.grade.color === 'orange' ? 'bg-orange-50 text-orange-800' :
            'bg-rose-50 text-rose-800'
          }`}>
            <span className="text-xs font-bold">{result.grade.label}</span>
            <span className="text-[10px]">{result.grade.quality}</span>
          </div>

          {/* Best speed */}
          {result.best && (
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="rounded bg-muted/40 p-2 text-center">
                <div className="text-[10px] text-muted-foreground">السرعة القصوى</div>
                <div className="text-base font-bold tabular-nums text-emerald-700">
                  {result.best.speedMbps.toFixed(2)}
                </div>
                <div className="text-[9px] text-muted-foreground">Mbps</div>
              </div>
              <div className="rounded bg-muted/40 p-2 text-center">
                <div className="text-[10px] text-muted-foreground">الحجم</div>
                <div className="text-base font-bold tabular-nums">
                  {(result.best.bytes / 1024).toFixed(0)}
                </div>
                <div className="text-[9px] text-muted-foreground">KB</div>
              </div>
              <div className="rounded bg-muted/40 p-2 text-center">
                <div className="text-[10px] text-muted-foreground">الزمن</div>
                <div className="text-base font-bold tabular-nums">
                  {(result.best.durationMs / 1000).toFixed(2)}
                </div>
                <div className="text-[9px] text-muted-foreground">ث</div>
              </div>
            </div>
          )}

          {/* Notes */}
          <ul className="space-y-1 text-[11px]">
            {result.grade.notes.map((n, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="inline-block h-1 w-1 rounded-full bg-purple-500 mt-1.5 shrink-0" />
                <span>{n}</span>
              </li>
            ))}
          </ul>

          {/* Per-attempt details */}
          <div className="space-y-1">
            <div className="text-[10px] text-muted-foreground">تفاصيل كل محاولة:</div>
            {result.attempts.map((a, i) => (
              <div key={i} className="flex items-center gap-2 text-[10px] rounded bg-muted/30 p-1.5">
                {a.type === 'live_stream' && <Radio className="h-3 w-3 text-emerald-600" />}
                {a.type === 'hls' && <PlayCircle className="h-3 w-3 text-purple-600" />}
                {a.type === 'vod_stream' && <Film className="h-3 w-3 text-amber-600" />}
                <span className="font-mono">{a.type}</span>
                <span className="text-muted-foreground mr-auto">
                  {a.ok
                    ? `${(a.bytes / 1024).toFixed(0)}KB في ${a.durationMs}ms`
                    : `فشل: ${a.error}`}
                </span>
                {a.ok && a.speedBps !== null && (
                  <Badge variant="outline" className="text-[9px] py-0 h-3.5">
                    {(a.speedBps * 8 / 1_000_000).toFixed(2)} Mbps
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
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

export type { SpeedTestResult as SpeedTestResultType, StreamTestResult as StreamTestResultType }
