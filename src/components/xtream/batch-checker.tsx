'use client'

import { useState, useMemo, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Loader2,
  ListChecks,
  Play,
  Trash2,
  Download,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  Filter,
  Gauge,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import type { ParsedAccount } from '@/lib/xtream/types'
import { formatDateAR, formatDuration } from '@/lib/xtream/types'
import type { BatchResultItem } from '@/app/api/batch/route'
import { SpeedTestCard } from '@/components/xtream/speed-test-card'

interface BatchCheckerProps {
  onCheckSingle?: (input: { url: string }) => void
}

type FilterMode = 'all' | 'active' | 'expired' | 'failed'

export function BatchChecker({ onCheckSingle }: BatchCheckerProps) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressTotal, setProgressTotal] = useState(0)
  const [progressDone, setProgressDone] = useState(0)
  const [results, setResults] = useState<BatchResultItem[]>([])
  const [filter, setFilter] = useState<FilterMode>('all')
  const { toast } = useToast()

  // Parse textarea to extract URLs (one per line)
  const parsedLines = useMemo(() => {
    return text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('#'))
  }, [text])

  const handleCheck = useCallback(async () => {
    if (parsedLines.length === 0) {
      toast({ title: 'لا توجد روابط', description: 'الصق رابطاً واحداً على الأقل', variant: 'destructive' })
      return
    }

    setLoading(true)
    setResults([])
    setProgress(0)
    setProgressTotal(parsedLines.length)
    setProgressDone(0)

    try {
      const res = await fetch('/api/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: parsedLines.map((url) => ({ url })),
          rawInputs: parsedLines,
        }),
      })

      const data = await res.json()
      if (!data.ok) {
        toast({ title: 'فشل الفحص', description: data.error, variant: 'destructive' })
        return
      }

      setResults(data.results as BatchResultItem[])
      const success = (data.results as BatchResultItem[]).filter(
        (r) => (r.result as ParsedAccount).ok
      ).length
      const failed = (data.results as BatchResultItem[]).length - success
      toast({
        title: 'اكتمل الفحص',
        description: `نجح: ${success} • فشل: ${failed} من أصل ${data.total}`,
      })
    } catch (err) {
      const e = err as Error
      toast({ title: 'خطأ في الاتصال', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
      setProgress(100)
    }
  }, [parsedLines, toast])

  // Simulate progress while loading (since the API is single-shot)
  // We'll just show indeterminate progress bar via progressDone
  const liveProgress = loading ? Math.min(95, (progressDone / Math.max(1, progressTotal)) * 100) : progress

  const filtered = useMemo(() => {
    if (filter === 'all') return results
    return results.filter((r) => {
      const ok = (r.result as ParsedAccount).ok
      if (filter === 'failed') return !ok
      if (!ok) return false
      const acc = r.result as ParsedAccount
      if (filter === 'active') return acc.user.isActive && !acc.user.isExpired
      if (filter === 'expired') return acc.user.isExpired || !acc.user.isActive
      return true
    })
  }, [results, filter])

  const stats = useMemo(() => {
    const total = results.length
    let active = 0
    let expired = 0
    let failed = 0
    let totalConnections = 0
    let maxConnections = 0
    let totalDays = 0
    let daysCount = 0
    for (const r of results) {
      const acc = r.result as ParsedAccount
      if (!acc.ok) {
        failed++
        continue
      }
      if (acc.user.isExpired || !acc.user.isActive) {
        expired++
      } else {
        active++
      }
      totalConnections += acc.user.activeConnections
      maxConnections += acc.user.maxConnections
      if (acc.user.daysLeft !== null) {
        totalDays += acc.user.daysLeft
        daysCount++
      }
    }
    return {
      total,
      active,
      expired,
      failed,
      totalConnections,
      maxConnections,
      avgDays: daysCount > 0 ? Math.round(totalDays / daysCount) : null,
    }
  }, [results])

  const handleClear = useCallback(() => {
    setText('')
    setResults([])
    setProgress(0)
    setProgressDone(0)
    setProgressTotal(0)
  }, [])

  const handleExportCSV = useCallback(() => {
    if (results.length === 0) return
    const headers = [
      'Index',
      'Input',
      'Status',
      'Host',
      'Port',
      'Username',
      'IsActive',
      'IsTrial',
      'IsExpired',
      'DaysLeft',
      'Expiration',
      'MaxConnections',
      'ActiveConnections',
      'CreatedAt',
      'Error',
    ]
    const rows = results.map((r) => {
      const acc = r.result as ParsedAccount
      if (acc.ok) {
        return [
          r.index + 1,
          `"${r.rawInput.replace(/"/g, '""')}"`,
          acc.user.status,
          acc.meta.host,
          acc.meta.port,
          acc.meta.username,
          acc.user.isActive ? 'yes' : 'no',
          acc.user.isTrial ? 'yes' : 'no',
          acc.user.isExpired ? 'yes' : 'no',
          acc.user.daysLeft ?? '',
          acc.user.expDate ?? '',
          acc.user.maxConnections,
          acc.user.activeConnections,
          acc.user.createdAt ?? '',
          '',
        ].join(',')
      }
      return [
        r.index + 1,
        `"${r.rawInput.replace(/"/g, '""')}"`,
        'Failed',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        `"${(acc as { error?: string }).error?.replace(/"/g, '""') ?? ''}"`,
      ].join(',')
    })
    const csv = '\uFEFF' + headers.join(',') + '\n' + rows.join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `xtream-batch-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast({ title: 'تم التصدير', description: `تم تنزيل ${results.length} نتيجة بصيغة CSV` })
  }, [results, toast])

  const handleExportTXT = useCallback(() => {
    if (results.length === 0) return
    const lines = results.map((r) => {
      const acc = r.result as ParsedAccount
      const header = `#${r.index + 1} ${r.rawInput}`
      if (acc.ok) {
        return [
          header,
          `  الحالة: ${acc.user.status} (${acc.user.isExpired ? 'منتهي' : acc.user.isActive ? 'نشط' : 'مقفل'})`,
          `  المضيف: ${acc.meta.host}:${acc.meta.port}`,
          `  المستخدم: ${acc.meta.username}`,
          `  الاتصالات: ${acc.user.activeConnections}/${acc.user.maxConnections}`,
          `  الأيام المتبقية: ${acc.user.daysLeft ?? '—'}`,
          `  الانتهاء: ${formatDateAR(acc.user.expDate)}`,
          `  المدة: ${formatDuration(acc.user.durationDays)}`,
          '',
        ].join('\n')
      }
      return [header, `  ❌ خطأ: ${(acc as { error?: string }).error ?? 'غير معروف'}`, ''].join('\n')
    })
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `xtream-batch-${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
    toast({ title: 'تم التصدير', description: `تم تنزيل ${results.length} نتيجة بصيغة TXT` })
  }, [results, toast])

  const handleRecheckSingle = useCallback(
    (raw: string) => {
      onCheckSingle?.({ url: raw })
    },
    [onCheckSingle]
  )

  return (
    <Card className="border-0 shadow-lg shadow-emerald-500/10">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ListChecks className="h-4 w-4 text-emerald-600" />
          فحص قائمة روابط (دفعة واحدة)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="batch-text">الصق الروابط (رابط واحد في كل سطر)</Label>
            <Badge variant="secondary" className="text-xs">
              {parsedLines.length} رابط
            </Badge>
          </div>
          <Textarea
            id="batch-text"
            dir="ltr"
            placeholder={`http://host1:8080/get.php?username=u1&password=p1&type=m3u_plus\nhttp://host2:8080/get.php?username=u2&password=p2&type=m3u_plus\nxtream://host3:8080/user3/pass3\nuser4:pass4@host4.com:8080`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="font-mono text-xs min-h-[160px] resize-y"
            disabled={loading}
          />
          <p className="text-xs text-muted-foreground">
            كل سطر = رابط واحد. يدعم: get.php / xtream:// / USER:PASS@host:port. الحد الأقصى 50 رابطاً.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={handleCheck} disabled={loading || parsedLines.length === 0}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                جارٍ الفحص… ({progressDone}/{progressTotal})
              </>
            ) : (
              <>
                <Play className="h-4 w-4 ml-2" />
                فحص {parsedLines.length > 0 ? `${parsedLines.length} رابط` : 'القائمة'}
              </>
            )}
          </Button>
          <Button variant="outline" onClick={handleClear} disabled={loading || (!text && results.length === 0)}>
            <Trash2 className="h-3.5 w-3.5 ml-1.5" />
            مسح
          </Button>
          {results.length > 0 && (
            <>
              <Button variant="outline" size="sm" onClick={handleExportCSV}>
                <Download className="h-3.5 w-3.5 ml-1.5" />
                CSV
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportTXT}>
                <FileText className="h-3.5 w-3.5 ml-1.5" />
                TXT
              </Button>
            </>
          )}
        </div>

        {loading && (
          <div className="space-y-1.5">
            <Progress value={liveProgress} className="h-1.5" />
            <p className="text-xs text-muted-foreground text-center">
              يتم الفحص بـ 5 طلبات متوازية لتسريع العملية
            </p>
          </div>
        )}

        {results.length > 0 && (
          <>
            {/* Summary tiles */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <SummaryTile label="إجمالي" value={stats.total} color="text-foreground" />
              <SummaryTile label="نشطة" value={stats.active} color="text-emerald-600" icon={<CheckCircle2 className="h-3.5 w-3.5" />} />
              <SummaryTile label="منتهية/مقفلة" value={stats.expired} color="text-amber-600" icon={<Clock className="h-3.5 w-3.5" />} />
              <SummaryTile label="فاشلة" value={stats.failed} color="text-rose-600" icon={<XCircle className="h-3.5 w-3.5" />} />
            </div>

            {stats.maxConnections > 0 && (
              <div className="rounded-lg border bg-muted/30 p-3 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">إجمالي الاتصالات النشطة:</span>
                  <span className="font-bold tabular-nums">{stats.totalConnections} / {stats.maxConnections}</span>
                </div>
                {stats.avgDays !== null && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">متوسط الأيام المتبقية:</span>
                    <span className="font-bold tabular-nums">{stats.avgDays} يوم</span>
                  </div>
                )}
              </div>
            )}

            {/* Filter */}
            <div className="flex items-center gap-2">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              <Select value={filter} onValueChange={(v) => setFilter(v as FilterMode)}>
                <SelectTrigger className="w-44 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل ({results.length})</SelectItem>
                  <SelectItem value="active">النشطة ({stats.active})</SelectItem>
                  <SelectItem value="expired">المنتهية ({stats.expired})</SelectItem>
                  <SelectItem value="failed">الفاشلة ({stats.failed})</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground">يعرض {filtered.length} من {results.length}</span>
            </div>

            {/* Results list */}
            <div className="space-y-2 max-h-[600px] overflow-y-auto pl-1 pr-1">
              {filtered.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-6">
                  لا توجد نتائج مطابقة للتصفية المختارة
                </p>
              ) : (
                filtered.map((r) => (
                  <BatchResultRow
                    key={r.index}
                    item={r}
                    onRecheck={() => handleRecheckSingle(r.rawInput)}
                  />
                ))
              )}
            </div>
          </>
        )}

        {!loading && results.length === 0 && parsedLines.length === 0 && (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            الصق قائمة روابطك في المربع أعلاه (رابط واحد في كل سطر) ثم اضغط &quot;فحص القائمة&quot;
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function SummaryTile({
  label,
  value,
  color,
  icon,
}: {
  label: string
  value: number
  color: string
  icon?: React.ReactNode
}) {
  return (
    <div className="rounded-lg border bg-card p-2.5 text-center">
      <div className={`text-xl font-bold tabular-nums ${color} flex items-center justify-center gap-1`}>
        {icon}
        {value}
      </div>
      <div className="text-[10px] text-muted-foreground mt-0.5">{label}</div>
    </div>
  )
}

function BatchResultRow({
  item,
  onRecheck,
}: {
  item: BatchResultItem
  onRecheck: () => void
}) {
  const [speedOpen, setSpeedOpen] = useState(false)
  const acc = item.result as ParsedAccount
  const ok = acc.ok

  let statusColor = 'bg-rose-500'
  let statusLabel = 'فاشل'
  let bg = 'bg-rose-50/50 border-rose-200'

  if (ok) {
    if (acc.user.isExpired) {
      statusColor = 'bg-amber-500'
      statusLabel = 'منتهي'
      bg = 'bg-amber-50/40 border-amber-200'
    } else if (acc.user.isActive) {
      statusColor = 'bg-emerald-500'
      statusLabel = 'نشط'
      bg = 'bg-emerald-50/40 border-emerald-200'
    } else {
      statusColor = 'bg-zinc-500'
      statusLabel = acc.user.status || 'موقوف'
      bg = 'bg-zinc-50/50 border-zinc-200'
    }
  }

  return (
    <>
      <div className={`rounded-lg border p-3 ${bg}`}>
        <div className="flex items-start gap-3">
          <div className="shrink-0 pt-0.5">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${statusColor}`} />
          </div>
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono text-muted-foreground">#{item.index + 1}</span>
              <Badge variant="outline" className={`text-[10px] py-0 h-4 ${ok ? '' : 'border-rose-300 text-rose-700'}`}>
                {statusLabel}
              </Badge>
              {ok && acc.user.isTrial && (
                <Badge variant="secondary" className="text-[10px] py-0 h-4 bg-amber-100 text-amber-800">تجريبي</Badge>
              )}
              {ok && (
                <span className="text-[10px] text-muted-foreground">
                  {acc.user.activeConnections}/{acc.user.maxConnections} اتصال
                  {acc.user.daysLeft !== null && ` • ${acc.user.daysLeft} يوم`}
                </span>
              )}
            </div>
            <div className="text-xs font-mono text-foreground/80 truncate dir-ltr text-left" dir="ltr" title={item.rawInput}>
              {item.rawInput}
            </div>
            {ok ? (
              <div className="text-[11px] text-muted-foreground">
                {acc.meta.host}:{acc.meta.port} • ينتهي {formatDateAR(acc.user.expDate)}
                {acc.user.durationDays && ` • المدة ${formatDuration(acc.user.durationDays)}`}
              </div>
            ) : (
              <div className="text-[11px] text-rose-700">
                ⚠ {acc.error}
              </div>
            )}
          </div>
          {ok && (
            <div className="flex flex-col gap-1 shrink-0">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={onRecheck}
                title="فحص فردي مفصّل"
              >
                تفاصيل
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs"
                onClick={() => setSpeedOpen(true)}
                title="اختبار سرعة الخادم وثباته"
              >
                <Gauge className="h-3 w-3 ml-1" />
                سرعة
              </Button>
            </div>
          )}
        </div>
      </div>

      {ok && (
        <Dialog open={speedOpen} onOpenChange={setSpeedOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <Gauge className="h-4 w-4 text-emerald-600" />
                اختبار سرعة الخادم — {acc.meta.host}:{acc.meta.port}
              </DialogTitle>
              <DialogDescription>
                قياس زمن الاستجابة وثبات الخادم عبر 8 طلبات متتالية، مع حساب التقييم الإجمالي.
              </DialogDescription>
            </DialogHeader>
            <SpeedTestCard
              input={{
                host: acc.meta.host,
                port: acc.meta.port,
                protocol: acc.meta.protocol,
                username: acc.meta.username,
                password: acc.meta.password,
              }}
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
