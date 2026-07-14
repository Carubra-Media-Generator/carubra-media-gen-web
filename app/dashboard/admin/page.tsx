"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ShieldCheck, FileText, Settings, Sparkles, BarChart2, DollarSign, AlertTriangle, Users, Database, Zap, Coins, FileText as FileIcon, TrendingUp, Activity, Clock, CheckCircle, XCircle, CreditCard } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/contexts/auth-context"
import { useLanguage } from "@/contexts/language-context"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend as RechartsLegend,
} from "recharts"

type GeneratedContent = {
  id: string
  user_id: string
  title: string
  content: string
  metadata?: any
  created_at?: string
}

type DashboardStats = {
  totalUsers: number
  adminCount: number
  totalCoins: number
  contentCount: number
  bannedUsers: number
  membershipUsers: number
}

type AiUsageLog = {
  id: string
  created_at: string
  model: string
  prompt_tokens?: number
  completion_tokens?: number
  total_tokens?: number
  quota_remaining?: number
}

type AdminMonitoring = {
  aiUsageLogs: AiUsageLog[]
  aiUsageSummary: {
    totalEvents: number
    totalTokens: number
    latestQuotaRemaining: number | null
    latestUsageAt: string | null
  }
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api"

function getApiUrl(path: string) {
  if (path.startsWith("http://") || path.startsWith("https://")) return path
  if (path.startsWith("/api")) return path
  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("carubra-token") : null
  const res = await fetch(getApiUrl(path), {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  })

  const payload = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((payload as any).error ?? `HTTP ${res.status}`)
  }
  return payload as T
}

function formatDate(value?: string) {
  if (!value) return "-"
  try {
    return new Date(value).toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return value
  }
}

function buildMonthlyTrend(logs?: AiUsageLog[]) {
  const grouped: Record<string, { label: string; total: number }> = {}

  logs?.forEach((item) => {
    const date = new Date(item.created_at)
    if (Number.isNaN(date.getTime())) return

    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
    const label = date.toLocaleString("id-ID", { month: "short", year: "numeric" })

    if (!grouped[monthKey]) {
      grouped[monthKey] = { label, total: 0 }
    }
    grouped[monthKey].total += item.total_tokens ?? 0
  })

  const keys = Object.keys(grouped).sort()
  return {
    labels: keys.map((key) => grouped[key].label),
    totals: keys.map((key) => grouped[key].total),
  }
}

const PIE_COLORS = [
  "#3b82f6",
  "#8b5cf6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#06b6d4",
  "#ec4899",
  "#84cc16",
]

const BAR_COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#06b6d4",
  "#ef4444",
]

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border bg-background/95 backdrop-blur-sm px-3 py-2 shadow-lg">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold">{payload[0].value}</p>
      </div>
    )
  }
  return null
}

const KPICard = ({ icon: Icon, title, value, subtitle, color, delay = 0 }: any) => (
  <div
    className="group relative overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br from-background to-background/50 p-6 shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
    style={{ animation: `fadeInUp 0.5s ease-out ${delay}s both` }}
  >
    <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-white/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
    <div className="relative">
      <div className={`mb-3 inline-flex rounded-xl p-2.5 ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight">{value}</p>
      {subtitle && (
        <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
      )}
    </div>
  </div>
)

export default function AdminDashboardPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [contents, setContents] = useState<GeneratedContent[]>([])
  const [monitoring, setMonitoring] = useState<AdminMonitoring | null>(null)
  const [monthlyTrend, setMonthlyTrend] = useState<{ labels: string[]; totals: number[] }>({ labels: [], totals: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Modal states
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false)
  const [modalMessage, setModalMessage] = useState("")
  const [selectedContentId, setSelectedContentId] = useState<string | null>(null)

  const { t } = useLanguage()
  const isAdmin = user?.role?.toString().toLowerCase().includes("admin")

  useEffect(() => {
    if (!isLoading && user && !isAdmin) {
      router.push("/dashboard")
    }
  }, [user, isLoading, isAdmin, router])

  useEffect(() => {
    if (!isLoading && isAdmin) {
      fetchAdminData()
    }
  }, [isLoading, isAdmin])

  const fetchAdminData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [dashboardData, contentsData, monitoringData] = await Promise.all([
        apiFetch<DashboardStats>("/api/admin/dashboard"),
        apiFetch<{ contents: GeneratedContent[] }>("/api/admin/contents"),
        apiFetch<AdminMonitoring>("/api/admin/monitoring"),
      ])

      setStats(dashboardData)
      setContents(contentsData.contents)
      setMonitoring(monitoringData)
      setMonthlyTrend(buildMonthlyTrend(monitoringData.aiUsageLogs))
    } catch (err: any) {
      console.error(err)
      setError(err.message ?? t('admin.fetchError'))
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteContent = async (contentId: string) => {
    setSelectedContentId(contentId)
    setModalMessage(t('admin.confirmDeleteContent'))
    setShowDeleteConfirmModal(true)
  }

  const confirmDeleteContent = async () => {
    if (!selectedContentId) return
    try {
      await apiFetch(`/api/admin/contents/${selectedContentId}`, { method: "DELETE" })
      setContents((prev) => prev.filter((item) => item.id !== selectedContentId))
      setShowDeleteConfirmModal(false)
    } catch (err: any) {
      setError(err.message)
    }
  }

  const hasAiLogs = (monitoring?.aiUsageLogs?.length ?? 0) > 0
  const hasMonthlyTrend = monthlyTrend.labels.length > 0

  if (isLoading || !user) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-base text-muted-foreground">
        {t('admin.loadingAdmin')}
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-base text-destructive">
        {t('admin.accessDenied')}
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-full">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">{t('admin.console')}</p>
          <h1 className="text-3xl font-bold tracking-tight">{t('admin.dashboardTitle')}</h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            {t('admin.dashboardDescription')}
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-border/50 bg-gradient-to-br from-background to-background/50 px-5 py-3 shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t('admin.signedInAs')}</p>
            <p className="text-sm font-semibold">{user.email}</p>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KPICard
          icon={Users}
          title={t('admin.totalUsers')}
          value={stats?.totalUsers ?? "—"}
          color="bg-blue-500/10 text-blue-600 dark:text-blue-400"
          delay={0}
        />
        <KPICard
          icon={ShieldCheck}
          title={t('admin.activeAdmins')}
          value={stats?.adminCount ?? "—"}
          color="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          delay={0.1}
        />
        <KPICard
          icon={XCircle}
          title={t('admin.bannedUsers')}
          value={stats?.bannedUsers ?? "—"}
          color="bg-amber-500/10 text-amber-600 dark:text-amber-400"
          delay={0.2}
        />
        <KPICard
          icon={CreditCard}
          title={t('admin.activeMembership')}
          value={stats?.membershipUsers ?? "—"}
          color="bg-purple-500/10 text-purple-600 dark:text-purple-400"
          delay={0.3}
        />
        <KPICard
          icon={Coins}
          title={t('admin.totalCoins')}
          value={stats?.totalCoins ?? "—"}
          color="bg-cyan-500/10 text-cyan-600 dark:text-cyan-400"
          delay={0.4}
        />
        <KPICard
          icon={FileIcon}
          title={t('admin.savedContent')}
          value={stats?.contentCount ?? "—"}
          color="bg-pink-500/10 text-pink-600 dark:text-pink-400"
          delay={0.5}
        />
      </div>

      {/* System Health */}
      <Card className="border border-border/50 bg-gradient-to-br from-background to-background/50 shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
                <Sparkles className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-semibold">{t('admin.systemHealth')}</p>
                <p className="text-xs text-muted-foreground">{t('admin.systemHealthDesc')}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex items-center gap-2 rounded-xl bg-slate-950/5 px-4 py-2">
                <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-sm font-medium">{t('admin.authentication')}</span>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-slate-950/5 px-4 py-2">
                <Database className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-sm font-medium">{t('admin.database')}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistik / Ringkasan Kinerja */}
      <Card className="border border-border/50 bg-gradient-to-br from-background to-background/50 shadow-sm">
        <CardContent className="p-6">
          <div className="mb-6">
                <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">{t('admin.stats')}</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight">{t('admin.performanceSummary')}</h2>
          </div>
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[
                  { name: "Pengguna", value: stats?.totalUsers ?? 0 },
                  { name: "Admin", value: stats?.adminCount ?? 0 },
                  { name: "Diblokir", value: stats?.bannedUsers ?? 0 },
                  { name: "Membership", value: stats?.membershipUsers ?? 0 },
                  { name: "Konten", value: stats?.contentCount ?? 0 },
                  { name: "Koin", value: stats?.totalCoins ?? 0 },
                ]}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis
                  dataKey="name"
                  className="text-xs text-muted-foreground"
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  className="text-xs text-muted-foreground"
                  axisLine={false}
                  tickLine={false}
                />
                <RechartsTooltip content={<CustomTooltip />} />
                <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                  {BAR_COLORS.map((color, index) => (
                    <Cell key={`cell-${index}`} fill={color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Monitor AI + Tren Bulanan */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Monitor AI */}
        <Card className="border border-border/50 bg-gradient-to-br from-background to-background/50 shadow-sm">
          <CardContent className="p-6">
            <div className="mb-6">
                <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">{t('admin.aiMonitor')}</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight">{t('admin.aiUsageTitle')}</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <KPICard
                icon={Activity}
                title={t('admin.totalAiEvents')}
                value={monitoring?.aiUsageSummary.totalEvents ?? "—"}
                color="bg-blue-500/10 text-blue-600 dark:text-blue-400"
              />
              <KPICard
                icon={Zap}
                title={t('admin.totalTokensUsed')}
                value={monitoring?.aiUsageSummary.totalTokens ?? "—"}
                color="bg-purple-500/10 text-purple-600 dark:text-purple-400"
              />
              <KPICard
                icon={TrendingUp}
                title={t('admin.lastQuota')}
                value={monitoring?.aiUsageSummary.latestQuotaRemaining ?? "—"}
                color="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              />
              <KPICard
                icon={Clock}
                title={t('admin.lastUsed')}
                value={monitoring?.aiUsageSummary.latestUsageAt
                  ? new Date(monitoring.aiUsageSummary.latestUsageAt).toLocaleString("id-ID", {
                      day: "2-digit", month: "short", year: "numeric",
                      hour: "2-digit", minute: "2-digit",
                    })
                  : "—"}
                color="bg-amber-500/10 text-amber-600 dark:text-amber-400"
              />
            </div>
            {hasAiLogs ? (
              <div className="mt-6 h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={monitoring!.aiUsageLogs.map((item) => ({
                        name: new Date(item.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
                        value: item.total_tokens ?? 0,
                      }))}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {PIE_COLORS.map((color, index) => (
                        <Cell key={`cell-${index}`} fill={color} />
                      ))}
                    </Pie>
                    <RechartsTooltip content={<CustomTooltip />} />
                    <RechartsLegend
                      verticalAlign="bottom"
                      height={36}
                      iconType="circle"
                      wrapperStyle={{ fontSize: '12px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="mt-6 flex h-[280px] items-center justify-center rounded-2xl border border-dashed border-border text-sm text-muted-foreground">
                {t('admin.noAiData')}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tren Bulanan */}
        <Card className="border border-border/50 bg-gradient-to-br from-background to-background/50 shadow-sm">
          <CardContent className="p-6">
            <div className="mb-6">
                <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">{t('admin.monthlyTrend')}</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight">{t('admin.monthlyAiUsage')}</h2>
            </div>
            {hasMonthlyTrend ? (
              <div className="h-[340px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={monthlyTrend.labels.map((label, index) => ({
                        name: label,
                        value: monthlyTrend.totals[index],
                      }))}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {PIE_COLORS.map((color, index) => (
                        <Cell key={`cell-${index}`} fill={color} />
                      ))}
                    </Pie>
                    <RechartsTooltip content={<CustomTooltip />} />
                    <RechartsLegend
                      verticalAlign="bottom"
                      height={36}
                      iconType="circle"
                      wrapperStyle={{ fontSize: '12px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-[340px] items-center justify-center rounded-2xl border border-dashed border-border text-sm text-muted-foreground">
                {t('admin.noTrendData')}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {error && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteConfirmModal} onOpenChange={setShowDeleteConfirmModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-full">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <DialogTitle>{t('admin.deleteContent')}</DialogTitle>
            </div>
            <DialogDescription className="pt-2">
              {modalMessage}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirmModal(false)}>
              {t('admin.cancel')}
            </Button>
            <Button variant="destructive" onClick={confirmDeleteContent}>
              {t('admin.confirmDelete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}