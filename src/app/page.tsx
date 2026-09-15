'use client'

import { useEffect, useState, useCallback } from 'react'
import { InputForm, CheckInput } from '@/components/xtream/input-form'
import { ResultCard } from '@/components/xtream/result-card'
import { HistoryPanel } from '@/components/xtream/history-panel'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import {
  AlertCircle,
  Eye,
  Github,
  Radar,
  ShieldCheck,
  Sparkles,
  Tv,
  Users,
  Wifi,
  Zap,
} from 'lucide-react'
import type { ParsedAccount, ContentStats, HistoryEntry } from '@/lib/xtream/types'
import {
  loadHistory,
  saveHistoryEntry,
  removeHistoryEntry,
  clearHistory,
  buildId,
} from '@/lib/xtream/types'
import { DEMO_ACCOUNT, DEMO_STATS } from '@/lib/xtream/demo-data'

export default function Home() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ParsedAccount | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<ContentStats | null>(null)
  const [loadingStats, setLoadingStats] = useState(false)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const { toast } = useToast()

  useEffect(() => {
    setHistory(loadHistory())
  }, [])

  const handleCheck = useCallback(
    async (input: CheckInput) => {
      setLoading(true)
      setError(null)
      setResult(null)
      setStats(null)
      try {
        const res = await fetch('/api/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        })
        const data = (await res.json()) as ParsedAccount | { ok: false; error: string }
        if (!data.ok) {
          setError((data as { ok: false; error: string }).error || 'فشل الفحص')
          return
        }
        const acc = data as ParsedAccount
        setResult(acc)
        const entry: HistoryEntry = {
          id: buildId(acc.meta),
          fetchedAt: acc.meta.fetchedAt,
          meta: acc.meta,
          user: acc.user,
          server: acc.server,
        }
        const next = saveHistoryEntry(entry)
        setHistory(next)
        toast({
          title: 'تم الفحص بنجاح',
          description: `الحالة: ${acc.user.status} • الاتصالات: ${acc.user.activeConnections}/${acc.user.maxConnections}`,
        })
      } catch (err) {
        const e = err as Error
        setError(e.message || 'حدث خطأ غير متوقع')
      } finally {
        setLoading(false)
      }
    },
    [toast]
  )

  const handleLoadStats = useCallback(async () => {
    if (!result) return
    setLoadingStats(true)
    try {
      const res = await fetch('/api/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: result.meta.host,
          port: result.meta.port,
          protocol: result.meta.protocol,
          username: result.meta.username,
          password: result.meta.password,
        }),
      })
      const data = await res.json()
      if (data.ok) {
        setStats(data.stats as ContentStats)
      } else {
        toast({
          title: 'تعذر جلب الإحصائيات',
          description: data.error || 'خطأ غير معروف',
          variant: 'destructive',
        })
      }
    } catch (err) {
      const e = err as Error
      toast({
        title: 'تعذر جلب الإحصائيات',
        description: e.message,
        variant: 'destructive',
      })
    } finally {
      setLoadingStats(false)
    }
  }, [result, toast])

  const handleRecheck = useCallback(
    (entry: HistoryEntry) => {
      handleCheck({
        host: entry.meta.host,
        port: entry.meta.port,
        protocol: entry.meta.protocol,
        username: entry.meta.username,
        password: entry.meta.password,
      })
    },
    [handleCheck]
  )

  const handleRemove = useCallback((id: string) => {
    setHistory(removeHistoryEntry(id))
  }, [])

  const handleClear = useCallback(() => {
    clearHistory()
    setHistory([])
  }, [])

  const handleShowDemo = useCallback(() => {
    setLoading(true)
    setError(null)
    setResult(null)
    setStats(null)
    // Simulate loading for better UX
    setTimeout(() => {
      setResult(DEMO_ACCOUNT)
      setStats(DEMO_STATS)
      setLoading(false)
      toast({
        title: 'وضع العرض التجريبي',
        description: 'هذه بيانات تجريبية لعرض شكل النتيجة. استخدم رابطك الحقيقي للفحص الفعلي.',
      })
    }, 600)
  }, [toast])

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-emerald-50/40 via-background to-background">
      <Toaster />

      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur sticky top-0 z-40">
        <div className="container mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="relative h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <Radar className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight">فاحص روابط Xtream</h1>
              <p className="text-[10px] text-muted-foreground leading-tight">أداة احترافية لفحص اشتراكات IPTV</p>
            </div>
          </div>
          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
          >
            <Github className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">GitHub</span>
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto max-w-6xl px-4 pt-8 pb-4">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 text-emerald-800 px-3 py-1 text-xs font-medium">
            <Sparkles className="h-3 w-3" />
            أداة فحص شاملة ومجانية
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight bg-gradient-to-l from-emerald-700 via-emerald-800 to-teal-900 bg-clip-text text-transparent">
            افحص اشتراكات Xtream Codes في ثوانٍ
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
            الصق رابط اشتراكك وستحصل فوراً على حالة الاشتراك وعدد الاتصالات النشطة والحد الأقصى
            وتاريخ الانتهاء ومدة الباقة ومحتوى القنوات والأفلام والمسلسلات — كل ذلك في واجهة عربية واضحة.
          </p>
        </div>
      </section>

      {/* Features strip */}
      <section className="container mx-auto max-w-6xl px-4 pb-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <FeatureChip icon={<ShieldCheck className="h-4 w-4" />} label="حالة الاشتراك" />
          <FeatureChip icon={<Users className="h-4 w-4" />} label="عدد الاتصالات" />
          <FeatureChip icon={<Tv className="h-4 w-4" />} label="إحصائيات المحتوى" />
          <FeatureChip icon={<Wifi className="h-4 w-4" />} label="معلومات الخادم" />
        </div>
      </section>

      {/* Main */}
      <main className="container mx-auto max-w-6xl px-4 pb-10 flex-1">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <InputForm onCheck={handleCheck} loading={loading} />

            <div className="flex justify-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleShowDemo}
                disabled={loading}
                className="text-muted-foreground hover:text-emerald-700"
              >
                <Eye className="h-3.5 w-3.5 ml-1.5" />
                عرض تجريبي لشكل النتائج
              </Button>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>فشل الفحص</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {loading && <LoadingSkeleton />}

            {!loading && result && (
              <ResultCard
                data={result}
                stats={stats}
                loadingStats={loadingStats}
                onLoadStats={handleLoadStats}
              />
            )}

            {!loading && !result && !error && (
              <EmptyState />
            )}
          </div>

          <aside className="lg:col-span-1 space-y-4">
            <HistoryPanel
              items={history}
              onRecheck={handleRecheck}
              onRemove={handleRemove}
              onClear={handleClear}
            />
            <Card>
              <CardContent className="p-4 space-y-3 text-xs text-muted-foreground">
                <div className="flex items-start gap-2">
                  <Zap className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <p>
                    تتم جميع الفحوصات عبر خادمنا لتجنب قيود CORS وحماية خصوصية روابطك. لا نخزّن
                    أي بيانات على الخادم — السجل محلي في متصفحك فقط.
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <p>
                    ندعم روابط get.php و xtream:// و USER:PASS@host:port. البيانات تُجلب من
                    player_api.php الرسمي.
                  </p>
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      </main>

      <footer className="border-t bg-background/80 mt-auto">
        <div className="container mx-auto max-w-6xl px-4 py-5 text-center text-xs text-muted-foreground">
          <p>أداة فاحص روابط Xtream — مبنية بـ Next.js و TypeScript و Tailwind CSS</p>
          <p className="mt-1">استخدم هذه الأداة بمسؤولية وللتحقق من اشتراكاتك الخاصة فقط.</p>
        </div>
      </footer>
    </div>
  )
}

function FeatureChip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-card/60 backdrop-blur px-3 py-2.5">
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-emerald-100 text-emerald-700">
        {icon}
      </span>
      <span className="text-sm font-medium">{label}</span>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <Card className="overflow-hidden">
      <Skeleton className="h-40 w-full rounded-none" />
      <CardContent className="p-6 space-y-4">
        <Skeleton className="h-6 w-1/3" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </CardContent>
    </Card>
  )
}

function EmptyState() {
  return (
    <Card className="border-dashed">
      <CardContent className="p-10 text-center space-y-3">
        <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <Radar className="h-7 w-7" />
        </div>
        <h3 className="text-lg font-semibold">جاهز للفحص</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          أدخل رابط Xtream أو بيانات الاشتراك يدوياً في النموذج أعلاه لعرض حالة الاشتراك
          والاتصالات ومعلومات الخادم.
        </p>
      </CardContent>
    </Card>
  )
}
