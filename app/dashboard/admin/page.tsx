"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ShieldCheck, FileText, Settings, Sparkles, BarChart2, DollarSign, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/contexts/auth-context"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Filler,
  Title,
  Tooltip,
  Legend,
} from "chart.js"
import { Bar, Pie } from "react-chartjs-2"

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Filler, Title, Tooltip, Legend)

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
  "rgba(56,189,248,0.8)",
  "rgba(99,102,241,0.8)",
  "rgba(16,185,129,0.8)",
  "rgba(245,158,11,0.8)",
  "rgba(248,113,113,0.8)",
  "rgba(167,139,250,0.8)",
  "rgba(37,99,235,0.8)",
  "rgba(239,68,68,0.8)",
]

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
      setError(err.message ?? "Tidak dapat memuat data admin")
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteContent = async (contentId: string) => {
    setSelectedContentId(contentId)
    setModalMessage("Hapus konten ini secara permanen?")
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
        Memuat halaman admin…
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-base text-destructive">
        Akses ditolak. Halaman ini hanya untuk admin.
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-muted-foreground">Admin Console</p>
          <h1 className="text-3xl font-bold">Superadmin Dashboard</h1>
          <p className="mt-2 text-muted-foreground max-w-2xl">
            Kelola pengguna, isi konten, dan pantau kesehatan platform secara cepat.
          </p>
        </div>
        <div className="rounded-3xl border border-border bg-background p-4 text-center">
          <ShieldCheck className="mx-auto h-9 w-9 text-primary" />
          <p className="mt-3 text-sm text-muted-foreground">Signed in as</p>
          <p className="mt-1 font-semibold">{user.email}</p>
        </div>
      </div>

      {/* Ringkasan + Kesehatan Sistem */}
      <div className="grid gap-4">
        <Card className="border border-border bg-background">
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground uppercase tracking-[0.24em]">Ringkasan</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-3xl bg-primary/5 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-primary/80">Total Pengguna</p>
                <p className="mt-2 text-3xl font-semibold">{stats?.totalUsers ?? "—"}</p>
              </div>
              <div className="rounded-3xl bg-secondary/5 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-emerald-700">Admin Aktif</p>
                <p className="mt-2 text-3xl font-semibold">{stats?.adminCount ?? "—"}</p>
              </div>
              <div className="rounded-3xl bg-emerald-950/5 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-emerald-700">Pengguna Terblokir</p>
                <p className="mt-2 text-3xl font-semibold">{stats?.bannedUsers ?? "—"}</p>
              </div>
              <div className="rounded-3xl bg-slate-950/5 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-700">Membership Aktif</p>
                <p className="mt-2 text-3xl font-semibold">{stats?.membershipUsers ?? "—"}</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 mt-3">
              <div className="rounded-3xl bg-emerald-950/5 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-emerald-700">Total Koin</p>
                <p className="mt-2 text-3xl font-semibold">{stats?.totalCoins ?? "—"}</p>
              </div>
              <div className="rounded-3xl bg-slate-950/5 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-700">Konten Tersimpan</p>
                <p className="mt-2 text-3xl font-semibold">{stats?.contentCount ?? "—"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border bg-background">
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-amber-500" />
              <div>
                <p className="text-sm font-semibold">Kesehatan Sistem</p>
                <p className="text-xs text-muted-foreground">Semua layanan platform berjalan normal.</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-slate-950/5 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Autentikasi</p>
                <p className="mt-2 font-semibold">Berhasil</p>
              </div>
              <div className="rounded-2xl bg-slate-950/5 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Database</p>
                <p className="mt-2 font-semibold">Tersambung</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bar chart statistik */}
      <Card className="border border-border bg-background">
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-muted-foreground">Statistik</p>
            <h2 className="text-xl font-semibold">Ringkasan Kinerja</h2>
          </div>
          <Bar
            options={{
              responsive: true,
              plugins: {
                legend: { position: "bottom" },
                title: {
                  display: true,
                  text: "Perbandingan Pengguna dan Konten",
                  font: { size: 14 },
                },
              },
              scales: {
                y: { beginAtZero: true, ticks: { precision: 0 } },
              },
            }}
            data={{
              labels: ["Pengguna", "Admin", "Diblokir", "Membership", "Konten", "Koin"],
              datasets: [
                {
                  label: "Jumlah",
                  data: [
                    stats?.totalUsers ?? 0,
                    stats?.adminCount ?? 0,
                    stats?.bannedUsers ?? 0,
                    stats?.membershipUsers ?? 0,
                    stats?.contentCount ?? 0,
                    stats?.totalCoins ?? 0,
                  ],
                  backgroundColor: [
                    "rgba(59,130,246,0.75)",
                    "rgba(16,185,129,0.75)",
                    "rgba(245,158,11,0.75)",
                    "rgba(123,63,248,0.75)",
                    "rgba(14,165,233,0.75)",
                    "rgba(248,113,113,0.75)",
                  ],
                  borderRadius: 12,
                },
              ],
            }}
          />
        </CardContent>
      </Card>

      {/* Monitor AI + Tren Bulanan — side by side */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Monitor AI */}
        <Card className="border border-border bg-background">
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-muted-foreground">Monitor AI</p>
              <h2 className="text-xl font-semibold">Penggunaan AI Terakhir</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-3xl bg-slate-950/5 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Total Event AI</p>
                <p className="mt-2 text-3xl font-semibold">{monitoring?.aiUsageSummary.totalEvents ?? "—"}</p>
              </div>
              <div className="rounded-3xl bg-slate-950/5 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Total Token</p>
                <p className="mt-2 text-3xl font-semibold">{monitoring?.aiUsageSummary.totalTokens ?? "—"}</p>
              </div>
              <div className="rounded-3xl bg-slate-950/5 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Kuota Terakhir</p>
                <p className="mt-2 text-3xl font-semibold">{monitoring?.aiUsageSummary.latestQuotaRemaining ?? "—"}</p>
              </div>
              <div className="rounded-3xl bg-slate-950/5 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Terakhir Dipakai</p>
                <p className="mt-2 text-sm font-semibold">
                  {monitoring?.aiUsageSummary.latestUsageAt
                    ? new Date(monitoring.aiUsageSummary.latestUsageAt).toLocaleString("id-ID", {
                        day: "2-digit", month: "short", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })
                    : "—"}
                </p>
              </div>
            </div>
            {hasAiLogs ? (
              <div className="flex justify-center">
                <div className="w-64 h-64">
                  <Pie
                    options={{
                      responsive: true,
                      plugins: {
                        legend: { position: "bottom" },
                        title: { display: true, text: "Token AI per event", font: { size: 13 } },
                      },
                    }}
                    data={{
                      labels: monitoring!.aiUsageLogs.map((item) =>
                        new Date(item.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
                      ),
                      datasets: [
                        {
                          label: "Total Token",
                          data: monitoring!.aiUsageLogs.map((item) => item.total_tokens ?? 0),
                          backgroundColor: PIE_COLORS,
                          borderWidth: 1,
                        },
                      ],
                    }}
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-40 rounded-2xl border border-dashed border-border text-sm text-muted-foreground">
                Belum ada data penggunaan AI
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tren Bulanan */}
        <Card className="border border-border bg-background">
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-muted-foreground">Tren Bulanan</p>
              <h2 className="text-xl font-semibold">Penggunaan AI Bulanan</h2>
            </div>
            {hasMonthlyTrend ? (
              <div className="flex justify-center">
                <div className="w-64 h-64">
                  <Pie
                    options={{
                      responsive: true,
                      plugins: {
                        legend: { position: "bottom" },
                        title: { display: true, text: "Total token AI per bulan", font: { size: 13 } },
                      },
                    }}
                    data={{
                      labels: monthlyTrend.labels,
                      datasets: [
                        {
                          label: "Total Token AI",
                          data: monthlyTrend.totals,
                          backgroundColor: PIE_COLORS,
                          borderWidth: 1,
                        },
                      ],
                    }}
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-40 rounded-2xl border border-dashed border-border text-sm text-muted-foreground">
                Belum ada data tren bulanan
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {error && (
        <div className="rounded-3xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
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
              <DialogTitle>Hapus Konten</DialogTitle>
            </div>
            <DialogDescription className="pt-2">
              {modalMessage}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirmModal(false)}>
              Batal
            </Button>
            <Button variant="destructive" onClick={confirmDeleteContent}>
              Ya, Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}