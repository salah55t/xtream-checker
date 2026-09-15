'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Search, Link2, Sliders, Loader2 } from 'lucide-react'

export interface CheckInput {
  url?: string
  host?: string
  port?: number | string
  protocol?: 'http' | 'https'
  username?: string
  password?: string
}

interface InputFormProps {
  onCheck: (input: CheckInput) => void
  loading: boolean
}

export function InputForm({ onCheck, loading }: InputFormProps) {
  const [tab, setTab] = useState<'url' | 'manual'>('url')
  const [url, setUrl] = useState('')
  const [host, setHost] = useState('')
  const [port, setPort] = useState('8080')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [https, setHttps] = useState(false)

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) return
    onCheck({ url: url.trim() })
  }

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!host.trim() || !username.trim() || !password.trim()) return
    onCheck({
      host: host.trim(),
      port: port.trim(),
      protocol: https ? 'https' : 'http',
      username: username.trim(),
      password: password.trim(),
    })
  }

  return (
    <Card className="border-0 shadow-lg shadow-emerald-500/10">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Search className="h-4 w-4 text-emerald-600" />
          إدخال بيانات الاشتراك
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={tab} onValueChange={(v) => setTab(v as 'url' | 'manual')}>
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="url" className="gap-1.5">
              <Link2 className="h-3.5 w-3.5" />
              رابط Xtream
            </TabsTrigger>
            <TabsTrigger value="manual" className="gap-1.5">
              <Sliders className="h-3.5 w-3.5" />
              إدخال يدوي
            </TabsTrigger>
          </TabsList>

          <TabsContent value="url">
            <form onSubmit={handleUrlSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="xtream-url">رابط الاشتراك</Label>
                <Input
                  id="xtream-url"
                  dir="ltr"
                  placeholder="http://host:port/get.php?username=USER&password=PASS&type=m3u_plus"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="font-mono text-sm"
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  الصق رابط get.php الكامل أو رابط xtream:// أو الصيغة USER:PASS@host:port
                </p>
              </div>
              <Button type="submit" className="w-full" disabled={loading || !url.trim()}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                    جارٍ الفحص…
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 ml-2" />
                    فحص الرابط
                  </>
                )}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="manual">
            <form onSubmit={handleManualSubmit} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="host">المضيف (Host)</Label>
                  <Input
                    id="host"
                    dir="ltr"
                    placeholder="example.com"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    className="font-mono text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="port">المنفذ (Port)</Label>
                  <Input
                    id="port"
                    dir="ltr"
                    inputMode="numeric"
                    placeholder="8080"
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                    className="font-mono text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="username">اسم المستخدم</Label>
                  <Input
                    id="username"
                    dir="ltr"
                    placeholder="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="font-mono text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">كلمة المرور</Label>
                  <Input
                    id="password"
                    dir="ltr"
                    type="text"
                    placeholder="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="font-mono text-sm"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
                <Label htmlFor="https-toggle" className="text-sm cursor-pointer">استخدام HTTPS</Label>
                <Switch id="https-toggle" checked={https} onCheckedChange={setHttps} />
              </div>
              <Button type="submit" className="w-full" disabled={loading || !host.trim() || !username.trim() || !password.trim()}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                    جارٍ الفحص…
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 ml-2" />
                    فحص الاشتراك
                  </>
                )}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
