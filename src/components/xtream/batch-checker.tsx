'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
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
import { Switch } from '@/components/ui/switch'
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
  ArrowDownWideNarrow,
  ArrowUpDown,
  Zap,
  Crown,
  Trophy,
  Medal,
  Eye,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import type { ParsedAccount } from '@/lib/xtream/types'
import { formatDateAR, formatDuration } from '@/lib/xtream/types'
import type { BatchResultItem } from '@/app/api/batch/route'
import { SpeedTestCard } from '@/components/xtream/speed-test-card'
import type { SpeedTestResultType } from '@/components/xtream/speed-test-card'
import {
  saveSpeedHistoryEntry,
  type SpeedHistoryEntry,
} from '@/lib/xtream/speed-history'

interface BatchCheckerProps {
  onCheckSingle?: (input: { url: string }) => void
}

type FilterMode = 'all' | 'active' | 'expired' | 'failed'
type SortMode = 'input' | 'grade-desc' | 'grade-asc' | 'rtt-asc' | 'rtt-desc'

interface SpeedResultMap {
  [index: number]: SpeedTestResultType | { ok: false; error: string }
}

const gradeColors: Record<string, string> = {
  emerald: 'bg-emerald-500 text-white',
  lime: 'bg-lime-500 text-white',
  amber: 'bg-amber-500 text-white',
  orange: 'bg-orange-500 text-white',
  rose: 'bg-rose-500 text-white',
}

export function BatchChecker({ onCheckSingle }: BatchCheckerProps) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressTotal, setProgressTotal] = useState(0)
  const [progressDone, setProgressDone] = useState(0)
  const [results, setResults] = useState<BatchResultItem[]>([])
  const [filter, setFilter] = useState<FilterMode>('all')
  const [speedResults, setSpeedResults] = useState<SpeedResultMap>({})
  const [speedLoading, setSpeedLoading] = useState(false)
  const [speedProgress, setSpeedProgress] = useState(0)
  const [speedProgressDone, setSpeedProgressDone] = useState(0)
  const [speedProgressTotal, setSpeedProgressTotal] = useState(0)
  const [sortMode, setSortMode] = useState<SortMode>('input')
  const [autoSort, setAutoSort] = useState(true)
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
    setSpeedResults({})
    setSpeedProgress(0)
    setSpeedProgressDone(0)
    setSpeedProgressTotal(0)
    setSortMode('input')
  }, [])

  // Batch speed test: tests speed on all successful (ok) results
  const handleBatchSpeedTest = useCallback(async () => {
    const successful = results.filter((r) => (r.result as ParsedAccount).ok)
    if (successful.length === 0) {
      toast({
        title: 'لا توجد خوادم للاختبار',
        description: 'أجرِ فحصاً عادياً أولاً واحصل على نتائج ناجحة',
        variant: 'destructive',
      })
      return
    }

    setSpeedLoading(true)
    setSpeedProgress(0)
    setSpeedProgressDone(0)
    setSpeedProgressTotal(successful.length)
    setSpeedResults({})

    const servers = successful.map((r) => {
      const acc = r.result as ParsedAccount
      return {
        host: acc.meta.host,
        port: acc.meta.port,
        protocol: acc.meta.protocol,
        username: acc.meta.username,
        password: acc.meta.password,
        rawInput: r.rawInput,
      }
    })

    try {
      const res = await fetch('/api/batch-speed-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ servers }),
      })
      const data = await res.json()
      if (!data.ok) {
        toast({ title: 'فشل الاختبار', description: data.error, variant: 'destructive' })
        return
      }

      // Map results by original index
      const map: SpeedResultMap = {}
      const originalIndexMap = new Map<string, number>()
      successful.forEach((r) => {
        const acc = r.result as ParsedAccount
        originalIndexMap.set(`${acc.meta.host}:${acc.meta.port}`, r.index)
      })

      let done = 0
      for (const item of data.results) {
        const acc = item.input
        const key = `${acc.host}:${acc.port}`
        const origIdx = originalIndexMap.get(key)
        if (origIdx !== undefined) {
          map[origIdx] = item.result
          done++
          setSpeedProgressDone(done)
          setSpeedProgress(Math.round((done / successful.length) * 100))

          // Save successful results to history
          if (item.result.ok) {
            const sr = item.result as SpeedTestResultType
            const entry: SpeedHistoryEntry = {
              id: `${acc.host}:${acc.port}-${Date.now()}-${origIdx}`,
              host: acc.host,
              port: acc.port,
              username: acc.username,
              testedAt: sr.meta.finishedAt,
              score: sr.grade.score,
              letter: sr.grade.letter,
              label: sr.grade.label,
              color: sr.grade.color,
              avgRtt: sr.stats.avgRtt,
              jitter: sr.stats.jitter,
              successRate: sr.stats.successRate,
              samplesCount: sr.meta.samplesCount,
            }
            saveSpeedHistoryEntry(entry)
          }
        }
      }

      setSpeedResults(map)

      // Auto-switch to "best first" sort
      if (autoSort) {
        setSortMode('grade-desc')
      }

      const successCount = Object.values(map).filter((r) => (r as SpeedTestResultType).ok).length
      toast({
        title: 'اكتمل فحص السرعة',
        description: `تم تقييم ${successCount} من ${successful.length} خادم. تم ترتيب النتائج من الأقوى إلى الأضعف.`,
      })
    } catch (err) {
      const e = err as Error
      toast({ title: 'خطأ في الاتصال', description: e.message, variant: 'destructive' })
    } finally {
      setSpeedLoading(false)
    }
  }, [results, autoSort, toast])

  // Demo mode: generate fake results with varying grades for testing the sort feature
  const handleDemo = useCallback(() => {
    const demoData = [
      {
        idx: 0,
        raw: 'http://fast-server.example.com:8080/get.php?username=demo1&password=pass1&type=m3u_plus',
        avgRtt: 85,
        jitter: 15,
        score: 95,
        letter: 'A+' as const,
        label: 'ممتاز',
        color: 'emerald',
      },
      {
        idx: 1,
        raw: 'http://medium-server.example.com:8080/get.php?username=demo2&password=pass2&type=m3u_plus',
        avgRtt: 320,
        jitter: 80,
        score: 62,
        letter: 'B' as const,
        label: 'جيد',
        color: 'lime',
      },
      {
        idx: 2,
        raw: 'http://slow-server.example.com:8080/get.php?username=demo3&password=pass3&type=m3u_plus',
        avgRtt: 1100,
        jitter: 350,
        score: 28,
        letter: 'D' as const,
        label: 'ضعيف',
        color: 'orange',
      },
      {
        idx: 3,
        raw: 'http://jittery-server.example.com:8080/get.php?username=demo4&password=pass4&type=m3u_plus',
        avgRtt: 180,
        jitter: 220,
        score: 51,
        letter: 'C' as const,
        label: 'مقبول',
        color: 'amber',
      },
      {
        idx: 4,
        raw: 'http://unstable-server.example.com:8080/get.php?username=demo5&password=pass5&type=m3u_plus',
        avgRtt: null,
        jitter: null,
        score: 0,
        letter: 'F' as const,
        label: 'سيء',
        color: 'rose',
      },
    ]

    // Build mock BatchResultItem[] (all "ok" so speed test can be triggered)
    const mockResults: BatchResultItem[] = demoData.map((d) => ({
      index: d.idx,
      rawInput: d.raw,
      input: { url: d.raw },
      result: {
        ok: true,
        meta: {
          inputUrl: d.raw,
          host: `${d.idx === 0 ? 'fast' : d.idx === 1 ? 'medium' : d.idx === 2 ? 'slow' : d.idx === 3 ? 'jittery' : 'unstable'}-server.example.com`,
          port: 8080,
          protocol: 'http' as const,
          username: `demo${d.idx + 1}`,
          password: `pass${d.idx + 1}`,
          fetchedAt: new Date().toISOString(),
          responseTimeMs: d.avgRtt ?? 5000,
        },
        user: {
          username: `demo${d.idx + 1}`,
          status: 'Active',
          isActive: true,
          isTrial: false,
          isExpired: false,
          expDate: new Date(Date.now() + 90 * 86400000).toISOString(),
          expTimestamp: Math.floor(Date.now() / 1000) + 90 * 86400,
          daysLeft: 90,
          createdAt: new Date(Date.now() - 200 * 86400000).toISOString(),
          createdTimestamp: Math.floor(Date.now() / 1000) - 200 * 86400,
          durationDays: 290,
          maxConnections: 2,
          activeConnections: 1,
          availableConnections: 1,
          allowedOutputs: ['ts', 'm3u8'],
        },
        server: {
          url: 'demo.example.com',
          port: 8080,
          httpsPort: 8443,
          rtmpPort: 25443,
          protocol: 'http',
          serverMethod: 'default',
          rip: '10.0.0.1',
          timezone: 'UTC',
          timestampNow: Math.floor(Date.now() / 1000),
        },
      } as ParsedAccount,
    }))

    // Build mock speed results
    const mockSpeed: SpeedResultMap = {}
    demoData.forEach((d) => {
      if (d.score === 0) {
        mockSpeed[d.idx] = { ok: false, error: 'فشل جميع المحاولات — الخادم غير قابل للوصول' }
      } else {
        mockSpeed[d.idx] = {
          ok: true,
          meta: {
            host: `server-${d.idx}.example.com`,
            port: 8080,
            protocol: 'http',
            username: `demo${d.idx + 1}`,
            startedAt: new Date().toISOString(),
            finishedAt: new Date().toISOString(),
            totalDurationMs: 5000,
            samplesCount: 5,
          },
          samples: [],
          stats: {
            successCount: 5,
            failureCount: 0,
            successRate: 1,
            failureRate: 0,
            minRtt: d.avgRtt ? Math.round(d.avgRtt * 0.8) : null,
            maxRtt: d.avgRtt ? Math.round(d.avgRtt * 1.3) : null,
            avgRtt: d.avgRtt,
            medianRtt: d.avgRtt,
            stddevRtt: d.jitter ? Math.round(d.jitter / 2) : null,
            jitter: d.jitter,
          },
          grade: {
            score: d.score,
            label: d.label,
            letter: d.letter,
            color: d.color,
            reasons: [
              d.avgRtt ? `زمن استجابة ${d.avgRtt < 100 ? 'ممتاز' : d.avgRtt < 250 ? 'جيد جداً' : d.avgRtt < 500 ? 'جيد' : d.avgRtt < 1000 ? 'مقبول' : 'بطيء'} (${d.avgRtt}ms)` : 'لا توجد بيانات',
              d.jitter !== null ? `ثبات ${d.jitter < 25 ? 'عالي' : d.jitter < 75 ? 'جيد جداً' : d.jitter < 150 ? 'جيد' : d.jitter < 300 ? 'مقبول' : 'ضعيف'} (${d.jitter}ms)` : '',
              'موثوقية كاملة (5/5)',
            ].filter(Boolean),
          },
        } as SpeedTestResultType
      }
    })

    setText(demoData.map((d) => d.raw).join('\n'))
    setResults(mockResults)
    setSpeedResults(mockSpeed)
    setProgress(100)
    setProgressDone(5)
    setProgressTotal(5)
    setSpeedProgress(100)
    setSpeedProgressDone(5)
    setSpeedProgressTotal(5)
    if (autoSort) {
      setSortMode('grade-desc')
    }

    toast({
      title: 'وضع العرض التجريبي',
      description: 'تم إنشاء 5 خوادم بدرجات سرعة مختلفة لعرض الترتيب من الأقوى إلى الأضعف',
    })
  }, [autoSort, toast])

  // Re-sort when sortMode or speedResults change
  const sortedFiltered = useMemo(() => {
    let arr = [...filtered]
    if (sortMode === 'input') {
      arr.sort((a, b) => a.index - b.index)
    } else if (sortMode === 'grade-desc' || sortMode === 'grade-asc') {
      const dir = sortMode === 'grade-desc' ? -1 : 1
      arr.sort((a, b) => {
        const sa = speedResults[a.index]
        const sb = speedResults[b.index]
        const va = sa && (sa as SpeedTestResultType).ok ? (sa as SpeedTestResultType).grade.score : -1
        const vb = sb && (sb as SpeedTestResultType).ok ? (sb as SpeedTestResultType).grade.score : -1
        return dir * (va - vb)
      })
    } else if (sortMode === 'rtt-asc' || sortMode === 'rtt-desc') {
      const dir = sortMode === 'rtt-asc' ? 1 : -1
      arr.sort((a, b) => {
        const sa = speedResults[a.index]
        const sb = speedResults[b.index]
        const va = sa && (sa as SpeedTestResultType).ok ? ((sa as SpeedTestResultType).stats.avgRtt ?? 99999) : 99999
        const vb = sb && (sb as SpeedTestResultType).ok ? ((sb as SpeedTestResultType).stats.avgRtt ?? 99999) : 99999
        return dir * (va - vb)
      })
    }
    return arr
  }, [filtered, sortMode, speedResults])

  // Auto-sort: when batch speed test completes, switch to grade-desc
  useEffect(() => {
    if (autoSort && Object.keys(speedResults).length > 0 && !speedLoading) {
      setSortMode('grade-desc')
    }
  }, [speedResults, autoSort, speedLoading])

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
      'SpeedScore',
      'SpeedGrade',
      'SpeedAvgRtt',
      'SpeedJitter',
      'SpeedSuccessRate',
      'Error',
    ]
    const rows = results.map((r) => {
      const acc = r.result as ParsedAccount
      const sr = speedResults[r.index]
      const speedOk = sr && (sr as SpeedTestResultType).ok
      const srt = speedOk ? (sr as SpeedTestResultType) : null
      const speedFields = srt
        ? [
            srt.grade.score,
            srt.grade.letter,
            srt.stats.avgRtt ?? '',
            srt.stats.jitter ?? '',
            Math.round(srt.stats.successRate * 100) + '%',
          ]
        : ['', '', '', '', '']
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
          ...speedFields,
          '',
        ].join(',')
      }
      return [
        r.index + 1,
        `"${r.rawInput.replace(/"/g, '""')}"`,
        'Failed',
        '', '', '', '', '', '', '', '', '', '', '',
        '', '', '', '', '',
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
  }, [results, speedResults, toast])

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
          <Button
            variant="secondary"
            onClick={handleBatchSpeedTest}
            disabled={speedLoading || loading || results.filter((r) => (r.result as ParsedAccount).ok).length === 0}
            title="اختبر سرعة وثبات جميع الخوادم الناجحة دفعة واحدة"
          >
            {speedLoading ? (
              <>
                <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                جارٍ قياس السرعة… ({speedProgressDone}/{speedProgressTotal})
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 ml-2" />
                فحص سرعة الكل
              </>
            )}
          </Button>
          <Button variant="outline" onClick={handleClear} disabled={loading || speedLoading || (!text && results.length === 0)}>
            <Trash2 className="h-3.5 w-3.5 ml-1.5" />
            مسح
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDemo}
            disabled={loading || speedLoading}
            className="text-muted-foreground hover:text-emerald-700"
            title="عرض تجريبي ببيانات وهمية لاختبار الترتيب"
          >
            <Eye className="h-3.5 w-3.5 ml-1.5" />
            عرض تجريبي
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

        {speedLoading && (
          <div className="space-y-1.5 rounded-lg border border-purple-200 bg-purple-50/40 p-3">
            <Progress value={speedProgress} className="h-1.5" />
            <p className="text-xs text-purple-700 text-center">
              جارٍ قياس سرعة {speedProgressDone} من {speedProgressTotal} خادم… (3 خوادم بالتوازي)
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

            {/* Sort controls */}
            <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/20 p-2">
              <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">ترتيب حسب:</span>
              <Select value={sortMode} onValueChange={(v) => setSortMode(v as SortMode)}>
                <SelectTrigger className="w-44 h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="input">ترتيب الإدخال</SelectItem>
                  <SelectItem value="grade-desc">التقييم: الأقوى أولاً</SelectItem>
                  <SelectItem value="grade-asc">التقييم: الأضعف أولاً</SelectItem>
                  <SelectItem value="rtt-asc">زمن الاستجابة: الأسرع أولاً</SelectItem>
                  <SelectItem value="rtt-desc">زمن الاستجابة: الأبطأ أولاً</SelectItem>
                </SelectContent>
              </Select>
              <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground cursor-pointer mr-auto">
                <Switch
                  checked={autoSort}
                  onCheckedChange={setAutoSort}
                  className="scale-75"
                />
                ترتيب تلقائي بعد فحص السرعة
              </label>
            </div>

            {/* Results list */}
            <div className="space-y-2 max-h-[600px] overflow-y-auto pl-1 pr-1">
              {sortedFiltered.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-6">
                  لا توجد نتائج مطابقة للتصفية المختارة
                </p>
              ) : (
                sortedFiltered.map((r, displayIdx) => {
                  const sr = speedResults[r.index]
                  return (
                    <BatchResultRow
                      key={r.index}
                      item={r}
                      speedResult={sr}
                      rank={sortMode !== 'input' && sr && (sr as SpeedTestResultType).ok ? displayIdx + 1 : undefined}
                      onRecheck={() => handleRecheckSingle(r.rawInput)}
                    />
                  )
                })
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
  speedResult,
  rank,
}: {
  item: BatchResultItem
  onRecheck: () => void
  speedResult?: SpeedTestResultType | { ok: false; error: string }
  rank?: number
}) {
  const [speedOpen, setSpeedOpen] = useState(false)
  const acc = item.result as ParsedAccount
  const ok = acc.ok

  const speedOk = speedResult && (speedResult as SpeedTestResultType).ok
  const srt = speedOk ? (speedResult as SpeedTestResultType) : null

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

  // Top-3 podium colors
  const rankBadge = rank && rank <= 3
    ? rank === 1
      ? { icon: <Crown className="h-3 w-3" />, cls: 'bg-amber-400 text-amber-950' }
      : rank === 2
        ? { icon: <Medal className="h-3 w-3" />, cls: 'bg-slate-300 text-slate-800' }
        : { icon: <Medal className="h-3 w-3" />, cls: 'bg-orange-400 text-orange-950' }
    : null

  return (
    <>
      <div className={`rounded-lg border p-3 ${bg} ${rankBadge ? 'ring-2 ring-offset-1 ring-amber-300/40' : ''}`}>
        <div className="flex items-start gap-3">
          {/* Rank badge or status dot */}
          <div className="shrink-0 pt-0.5 flex flex-col items-center gap-1">
            {rankBadge ? (
              <span className={`inline-flex items-center justify-center h-6 w-6 rounded-full text-[10px] font-bold ${rankBadge.cls}`}>
                {rankBadge.icon}
              </span>
            ) : (
              <span className={`inline-block h-2.5 w-2.5 rounded-full ${statusColor}`} />
            )}
            {rank && rank > 3 && (
              <span className="text-[9px] text-muted-foreground font-bold">#{rank}</span>
            )}
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
              {/* Speed grade badge */}
              {srt && (
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0 text-[10px] font-bold ${gradeColors[srt.grade.color] || 'bg-zinc-500 text-white'}`} title={`التقييم: ${srt.grade.label} (${srt.grade.letter}) — النقاط: ${srt.grade.score}`}>
                  <Zap className="h-2.5 w-2.5" />
                  {srt.grade.letter}
                  <span className="opacity-90 font-normal">{srt.grade.score}</span>
                  {srt.stats.avgRtt !== null && (
                    <span className="opacity-90 font-normal">• {srt.stats.avgRtt}ms</span>
                  )}
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
                {srt && srt.stats.jitter !== null && ` • تذبذب ${srt.stats.jitter}ms`}
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
              initialResult={srt}
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
