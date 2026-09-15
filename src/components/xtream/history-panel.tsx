'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { History, Trash2, RotateCw } from 'lucide-react'
import type { HistoryEntry } from '@/lib/xtream/types'
import { formatDateAR, formatDuration } from '@/lib/xtream/types'

interface HistoryPanelProps {
  items: HistoryEntry[]
  onRecheck: (entry: HistoryEntry) => void
  onRemove: (id: string) => void
  onClear: () => void
}

export function HistoryPanel({ items, onRecheck, onRemove, onClear }: HistoryPanelProps) {
  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4 text-emerald-600" />
          السجل ({items.length})
        </CardTitle>
        {items.length > 0 && (
          <Button size="sm" variant="ghost" className="text-destructive" onClick={onClear}>
            <Trash2 className="h-3.5 w-3.5 ml-1" />
            مسح الكل
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            لا توجد فحوصات سابقة بعد. ابدأ بفحص رابطك الأول.
          </p>
        ) : (
          <ScrollArea className="h-72">
            <div className="space-y-2 pr-1">
              {items.map((e) => {
                const statusColor = e.user.isActive
                  ? e.user.isExpired
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                  : 'bg-red-500'
                return (
                  <div
                    key={e.id}
                    className="rounded-lg border p-3 hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`inline-block h-2 w-2 rounded-full ${statusColor}`} />
                          <span className="font-medium truncate">{e.user.username}</span>
                          {e.user.isTrial && (
                            <Badge variant="secondary" className="text-[10px] py-0 px-1.5 h-4">تجريبي</Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono dir-ltr text-left" dir="ltr">
                          {e.meta.host}:{e.meta.port}
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                          <span>الاتصالات: {e.user.activeConnections}/{e.user.maxConnections || '∞'}</span>
                          <span>المتبقي: {e.user.daysLeft ?? '—'} يوم</span>
                          <span>المدة: {formatDuration(e.user.durationDays)}</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground/70">{formatDateAR(e.fetchedAt)}</div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => onRecheck(e)}
                          title="إعادة الفحص"
                        >
                          <RotateCw className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-destructive"
                          onClick={() => onRemove(e.id)}
                          title="حذف"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}
