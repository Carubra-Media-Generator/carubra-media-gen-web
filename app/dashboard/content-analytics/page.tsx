"use client"

import { useState, useEffect, useRef } from "react"
import { useLanguage } from "@/contexts/language-context"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Filler,
} from "chart.js"
import { ArcElement, Legend } from 'chart.js'
import { Line, Bar, Pie } from "react-chartjs-2"

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Filler, ArcElement, Legend)

// ─── Types ────────────────────────────────────────────────────────────────────
type StrategyResult = {
  concept_title: string
  concept_description: string
  hook: string
  content_flow: string[]
  caption: string
  caption_score: number
  caption_tone: string
  hashtags: string[]
  hashtag_warning: string | null
  estimated_views: { min: string; max: string }
  engagement_rate: number
  viral_score: number
  best_post_time: string
  best_post_days: string
  content_formats: string[]
  audience_match: { segment: string; pct: number }[]
  platform_reach: { platform: string; reach: string; color: string }[]
  trend_30d: number[]
  sentiment: { positive: number; neutral: number; negative: number }
  sentiment_summary: string
  recommendations: {
    icon: string
    title: string
    description: string
    priority: "high" | "medium" | "low"
  }[]
  competitor_insight: string
  cta_suggestions: string[]
}

type HistoryJob = {
  id: string
  prompt: string
  platform: string
  target_audience: string
  status: "completed" | "processing" | "failed" | "cancelled"
  created_at: string
  result: StrategyResult | null
}

// ─── Constants ────────────────────────────────────────────────────────────────
const PLATFORMS = ["TikTok", "Instagram", "YouTube", "Facebook", "X / Twitter", "LinkedIn"]

const AUDIENCES = [
  "Gen Z (13–24)",
  "Millennial (25–34)",
  "Profesional (30–45)",
  "Ibu rumah tangga",
  "Pelajar / Mahasiswa",
  "Umum",
]

const CONTENT_TYPES = [
  "Produk launch",
  "Edukasi / Tutorial",
  "Entertaiment / Hiburan",
  "Behind the scenes",
  "User-generated content",
  "Promosi / Diskon",
  "Inspirational / Motivasi",
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getToken() {
  if (typeof window === "undefined") return null
  return localStorage.getItem("carubra-token")
}

function apiFetch(path: string, options?: RequestInit) {
  const token = getToken()
  return fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
  })
}

function timeAgo(iso: string, t: (key: string, params?: any) => string) {
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(diff / 86400000)
  if (d > 0) return t("analytics.timeAgoDays", { d })
  if (h > 0) return t("analytics.timeAgoHours", { h })
  return t("analytics.timeAgoJustNow")
}

function platformIcon(p: string) {
  const icons: Record<string, string> = {
    TikTok: "📱", Instagram: "📸", YouTube: "▶️",
    Facebook: "👥", "X / Twitter": "𝕏", LinkedIn: "💼",
  }
  return icons[p] ?? "🌐"
}

function priorityColor(priority: string, t: (key: string) => string) {
  return {
    high:   { bg: "#FCEBEB", color: "#A32D2D", label: t("analytics.priorityHigh") },
    medium: { bg: "#FAEEDA", color: "#854F0B", label: t("analytics.priorityMedium") },
    low:    { bg: "#EAF3DE", color: "#3B6D11", label: t("analytics.priorityLow") },
  }[priority] ?? { bg: "#F1EFE8", color: "#5F5E5A", label: "" }
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ContentStrategyPage() {
  const { t } = useLanguage()
  // Form state
  const [prompt, setPrompt]               = useState("")
  const [platform, setPlatform]           = useState("TikTok")
  const [targetAudience, setTargetAudience] = useState("Gen Z (13–24)")
  const [contentType, setContentType]     = useState("Produk launch")

  // UI state
  const [loading, setLoading]             = useState(false)
  const [error, setError]                 = useState<string | null>(null)
  const [result, setResult]               = useState<StrategyResult | null>(null)
  const [copiedCaption, setCopiedCaption] = useState(false)
  const [activeJobId, setActiveJobId]     = useState<string | null>(null)

  const [selectedHistoryJob, setSelectedHistoryJob] = useState<HistoryJob | null>(null)
  const [modalCopiedCaption, setModalCopiedCaption] = useState(false)

  // History state
  const [history, setHistory]             = useState<HistoryJob[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  // Trend chart labels
  const trendLabels = Array.from({ length: 30 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (29 - i))
    return `${d.getDate()}/${d.getMonth() + 1}`
  })

  // ─── Fetch history ────────────────────────────────────────────────────────
  const fetchHistory = async (autoLoadFirst = false) => {
    try {
      const res = await apiFetch("/api/content-analysis")
      if (res.ok) {
        const json = await res.json()
        const fetchedJobs: HistoryJob[] = json.jobs ?? []
        setHistory(fetchedJobs)

        // Auto-load hasil terbaru hanya saat pertama buka halaman (tidak ada result aktif)
        if (autoLoadFirst && fetchedJobs.length > 0) {
          const firstCompleted = fetchedJobs.find(j => j.status === "completed" && j.result)
          if (firstCompleted) {
            setResult(firstCompleted.result)
            setActiveJobId(firstCompleted.id)
          }
        }
      }
    } catch {
      // ignore
    } finally {
      setHistoryLoading(false)
    }
  }

  useEffect(() => { fetchHistory(false) }, [])

  // ─── Submit ───────────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    setError(null)
    if (!prompt.trim()) return setError(t("analytics.promptRequired"))

    setLoading(true)
    setResult(null)

    try {
      const res = await apiFetch("/api/content-analysis", {
        method: "POST",
        body: JSON.stringify({
          prompt: prompt.trim(),
          platform,
          target_audience: targetAudience,
          content_type: contentType,
        }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error || t("analytics.generateFailed"))

      setResult(json.job.result)
      setActiveJobId(json.job.id)
      setPrompt("")
      await fetchHistory()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  // ─── Cancel ───────────────────────────────────────────────────────────────
  const handleCancel = async (id: string) => {
    setCancellingId(id)
    try {
      await apiFetch("/api/content-analysis", {
        method: "PATCH",
        body: JSON.stringify({ id, action: "cancel" }),
      })
      setHistory(prev => prev.map(j => j.id === id ? { ...j, status: "cancelled" as const } : j))
    } catch {
      // ignore
    } finally {
      setCancellingId(null)
    }
  }

  // ─── Delete ───────────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`/api/content-analysis?id=${encodeURIComponent(id)}`, { method: "DELETE" })
      setHistory(prev => prev.filter(j => j.id !== id))
      if (activeJobId === id) {
        setResult(null)
        setActiveJobId(null)
      }
    } catch {
      // ignore
    } finally {
      setConfirmDeleteId(null)
    }
  }

  // ─── Copy caption ─────────────────────────────────────────────────────────
  const copyCaption = async () => {
    if (!result?.caption) return
    await navigator.clipboard.writeText(result.caption)
    setCopiedCaption(true)
    setTimeout(() => setCopiedCaption(false), 2000)
  }

  const copyModalCaption = async () => {
    if (!selectedHistoryJob?.result?.caption) return
    await navigator.clipboard.writeText(selectedHistoryJob.result.caption)
    setModalCopiedCaption(true)
    setTimeout(() => setModalCopiedCaption(false), 2000)
  }

  // ─── Chart configs ────────────────────────────────────────────────────────
  const trendChartData = {
    labels: trendLabels,
    datasets: [{
      label: t("analytics.engagementRate"),
      data: result?.trend_30d ?? [],
      borderColor: "#378ADD",
      backgroundColor: "rgba(55,138,221,0.07)",
      borderWidth: 2,
      fill: true,
      tension: 0.4,
      pointRadius: 0,
      pointHoverRadius: 4,
    }],
  }

  const trendChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { mode: "index" as const, intersect: false },
    },
    scales: {
      x: { ticks: { maxTicksLimit: 6, font: { size: 11 } }, grid: { display: false } },
      y: {
        ticks: { callback: (v: any) => v + "%", font: { size: 11 } },
        grid: { color: "rgba(128,128,128,0.1)" },
      },
    },
  }

  const reachChartData = {
    labels: result?.platform_reach.map(p => p.platform) ?? [],
    datasets: [{
      label: t("analytics.estReachChart"),
      data: result?.platform_reach.map(p => parseInt(p.reach.replace(/[^0-9]/g, ""))) ?? [],
      backgroundColor: result?.platform_reach.map(p => p.color) ?? [],
      borderRadius: 4,
    }],
  }

  const reachChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { font: { size: 11 } }, grid: { display: false } },
      y: { ticks: { font: { size: 11 } }, grid: { color: "rgba(128,128,128,0.1)" } },
    },
  }

  // Mermaid container ref and render logic (client-side only)
  const mermaidRef = useRef<HTMLDivElement | null>(null)
  const modalMermaidRef = useRef<HTMLDivElement | null>(null)

  const renderMermaid = (res: StrategyResult | null, targetRef: any, jobId: string | null) => {
    if (!res) return
    // @ts-ignore
    import("mermaid").then((m: any) => {
      try {
        const mermaid = m.default ?? m
        mermaid.initialize({ startOnLoad: false, theme: "default" })
        const nodes = res.content_flow
          .map((s, i) => `A${i}["${s.replace(/\"/g, '\\"')}"]`)
          .join("\n")
        const links = res.content_flow
          .map((_, i) => (i < res.content_flow.length - 1 ? `A${i} --> A${i + 1}` : ""))
          .filter(Boolean)
          .join("\n")
        const graph = `flowchart LR\n${nodes}\n${links}`
        const renderId = `mermaidDiagram-${jobId ?? Math.random().toString(36).slice(2)}`
        mermaid.render(renderId, graph).then((r: any) => {
          const svg = r?.svg ?? ""
          if (targetRef.current) targetRef.current.innerHTML = svg
        })
      } catch (e) {}
    }).catch(() => {})
  }

  useEffect(() => {
    renderMermaid(result, mermaidRef, activeJobId)
  }, [result, activeJobId])

  useEffect(() => {
    if (selectedHistoryJob?.result) {
      setTimeout(() => {
        renderMermaid(selectedHistoryJob.result, modalMermaidRef, selectedHistoryJob.id)
      }, 100) // allow dialog content to mount
    }
  }, [selectedHistoryJob])

  // Sentiment pie data
  const sentimentData = {
    labels: [t("analytics.sentimentPositive"), t("analytics.sentimentNeutral"), t("analytics.sentimentNegative")],
    datasets: [
      {
        data: [result?.sentiment.positive ?? 0, result?.sentiment.neutral ?? 0, result?.sentiment.negative ?? 0],
        backgroundColor: ["#34D399", "#FBBF24", "#F87171"],
        hoverOffset: 6,
      },
    ],
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-5">

      {/* ── Input Card ── */}
      <Card>
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-base font-medium">{t("analytics.title")}</h1>
            <span className="text-xs px-2.5 py-1 rounded-full font-medium"
              style={{ background: "#E6F1FB", color: "#185FA5" }}>
              {t("analytics.poweredBy")}
            </span>
          </div>

          {/* Prompt textarea */}
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder={t("analytics.promptPlaceholder")}
            rows={3}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none mb-3"
          />

          {/* Form controls row */}
          <div className="flex flex-wrap gap-2 mb-3">
            <select
              value={platform}
              onChange={e => setPlatform(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              {PLATFORMS.map(p => <option key={p}>{p}</option>)}
            </select>

            <select
              value={targetAudience}
              onChange={e => setTargetAudience(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              {AUDIENCES.map(a => <option key={a}>{a}</option>)}
            </select>

            <select
              value={contentType}
              onChange={e => setContentType(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              {CONTENT_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>

            <button
              onClick={handleGenerate}
              disabled={loading}
              className="ml-auto h-9 px-5 rounded-md bg-foreground text-background text-sm font-medium hover:opacity-85 disabled:opacity-50 transition-opacity"
            >
              {loading ? t("analytics.generating") : t("analytics.generateStrategy")}
            </button>
          </div>

          {error && <p className="text-sm text-destructive mt-1">{error}</p>}
        </CardContent>
      </Card>

      {/* ── Loading ── */}
      {loading && (
        <Card>
          <CardContent className="py-14 flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">{t("analytics.aiThinking")}</p>
          </CardContent>
        </Card>
      )}

      {/* ── Empty state ── */}
      {!loading && !result && (
        <Card>
          <CardContent className="py-16 flex flex-col items-center gap-3 text-center">
            <div className="text-4xl">🚀</div>
            <p className="font-medium">{t("analytics.emptyTitle")}</p>
            <p className="text-sm text-muted-foreground max-w-sm">
              {t("analytics.emptyDesc")}
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Results ── */}
      {!loading && result && (
        <>
          {/* Konsep + Metric utama */}
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <h2 className="text-base font-medium mb-1">{result.concept_title}</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">{result.concept_description}</p>
                </div>
                <div className="flex-shrink-0 text-center">
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-medium"
                    style={{
                      background: result.viral_score >= 80 ? "#EAF3DE" : result.viral_score >= 60 ? "#FAEEDA" : "#FCEBEB",
                      color: result.viral_score >= 80 ? "#3B6D11" : result.viral_score >= 60 ? "#854F0B" : "#A32D2D",
                    }}
                  >
                    {result.viral_score}
                  </div>
                        <p className="text-xs text-muted-foreground mt-1">{t("analytics.viralScore")}</p>
                      </div>
                    </div>

                    {/* Hook */}
                    <div className="rounded-lg p-3 mb-3" style={{ background: "#E6F1FB" }}>
                      <p className="text-xs font-medium mb-1" style={{ color: "#185FA5" }}>{t("analytics.hookLabel")}</p>
                <p className="text-sm" style={{ color: "#0C447C" }}>"{result.hook}"</p>
              </div>

              {/* Content flow */}
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">{t("analytics.contentFlow")}</p>
              <div className="flex flex-wrap gap-2">
                {result.content_flow.map((step, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0"
                      style={{ background: "#E6F1FB", color: "#185FA5" }}
                    >
                      {i + 1}
                    </span>
                    <span className="text-sm">{step}</span>
                    {i < result.content_flow.length - 1 && (
                      <span className="text-muted-foreground text-xs ml-1">→</span>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Metric cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                label: t("analytics.estimatedViews"),
                value: `${result.estimated_views.min}–${result.estimated_views.max}`,
                sub: t("analytics.estReach"),
                subColor: "text-muted-foreground",
              },
              {
                label: t("analytics.engagementRate"),
                value: `${result.engagement_rate}%`,
                sub: result.engagement_rate >= 6 ? t("analytics.aboveAverage") : t("analytics.industryAverage"),
                subColor: result.engagement_rate >= 6 ? "text-green-600" : "text-amber-600",
              },
              {
                label: t("analytics.bestPostTime"),
                value: result.best_post_time,
                sub: result.best_post_days,
                subColor: "text-muted-foreground",
              },
              {
                label: t("analytics.captionScore"),
                value: t("analytics.captionScoreValue", { score: result.caption_score }),
                sub: result.caption_score >= 80 ? t("analytics.excellent") : result.caption_score >= 60 ? t("analytics.fair") : t("analytics.needsImprovement"),
                subColor: result.caption_score >= 80 ? "text-green-600" : result.caption_score >= 60 ? "text-amber-600" : "text-red-600",
              },
            ].map(m => (
              <div key={m.label} className="bg-muted rounded-lg p-3">
                <div className="text-xs text-muted-foreground mb-1">{m.label}</div>
                <div className="text-xl font-medium">{m.value}</div>
                <div className={`text-xs mt-0.5 ${m.subColor}`}>{m.sub}</div>
              </div>
            ))}
          </div>

          {/* Caption + Hashtag */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("analytics.caption")}</p>
                  <div className="flex items-center gap-2">
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ background: "#E6F1FB", color: "#185FA5" }}
                    >
                      {result.caption_tone}
                    </span>
                    <button
                      onClick={copyCaption}
                      className="text-xs px-2.5 py-1 rounded-md border border-border hover:bg-muted transition-colors"
                    >
                      {copiedCaption ? t("analytics.copied") : t("analytics.copy")}
                    </button>
                  </div>
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{result.caption}</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">{t("analytics.hashtag")}</p>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {result.hashtags.map(h => (
                    <span
                      key={h}
                      className="text-xs px-2.5 py-1 rounded-full border border-border"
                      style={{ background: "var(--background)" }}
                    >
                      {h}
                    </span>
                  ))}
                </div>
                {result.hashtag_warning && (
                  <div className="text-xs rounded-lg px-3 py-2" style={{ background: "#FAEEDA", color: "#854F0B" }}>
                    ⚠️ {result.hashtag_warning}
                  </div>
                )}

                <div className="mt-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">{t("analytics.contentFormats")}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {result.content_formats.map(f => (
                      <span
                        key={f}
                        className="text-xs px-2.5 py-1 rounded-full"
                        style={{ background: "#EAF3DE", color: "#3B6D11" }}
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Trend chart */}
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">
                {t("analytics.engagementTrend")}
              </p>
              <div style={{ height: 180 }}>
                <Line data={trendChartData} options={trendChartOptions} />
              </div>
            </CardContent>
          </Card>

          {/* Diagram (Mermaid) + Sentiment Pie */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card className="sm:col-span-2">
              <CardContent className="pt-5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">{t("analytics.contentFlowDiagram")}</p>
                <div className="rounded border border-border p-3 min-h-[140px] overflow-auto" ref={mermaidRef} />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">{t("analytics.sentimentAnalysis")}</p>
                <div style={{ height: 150 }}>
                  <Pie data={sentimentData} options={{ plugins: { legend: { position: 'bottom' } }, maintainAspectRatio: false }} />
                </div>
                <p className="text-sm text-muted-foreground mt-3">{result.sentiment_summary}</p>
              </CardContent>
            </Card>
          </div>

          {/* Audience match + Platform reach */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Card>
              <CardContent className="pt-5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">
                  {t("analytics.audienceMatch")}
                </p>
                <div className="space-y-3">
                  {result.audience_match.map(a => (
                    <div key={a.segment}>
                      <div className="flex justify-between text-sm mb-1">
                        <span>{a.segment}</span>
                        <span className="font-medium">{a.pct}%</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${a.pct}%`, background: "#378ADD" }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">
                  {t("analytics.estReachPerPlatform")}
                </p>
                <div style={{ height: 130 }}>
                  <Bar data={reachChartData} options={reachChartOptions} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sentiment */}
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                {t("analytics.sentimentAnalysis")}
              </p>
              <div className="flex rounded-lg overflow-hidden h-2.5 mb-3">
                <div style={{ width: `${result.sentiment.positive}%`, background: "#639922" }} />
                <div style={{ width: `${result.sentiment.neutral}%`, background: "#EF9F27" }} />
                <div style={{ width: `${result.sentiment.negative}%`, background: "#E24B4A" }} />
              </div>
              <div className="flex gap-4 text-xs text-muted-foreground mb-3">
                {[
                  { label: t("analytics.positive", { pct: result.sentiment.positive }), color: "#639922" },
                  { label: t("analytics.neutral", { pct: result.sentiment.neutral }), color: "#EF9F27" },
                  { label: t("analytics.negative", { pct: result.sentiment.negative }), color: "#E24B4A" },
                ].map(s => (
                  <span key={s.label} className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-sm inline-block" style={{ background: s.color }} />
                    {s.label}
                  </span>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">{result.sentiment_summary}</p>
            </CardContent>
          </Card>

          {/* Recommendations */}
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">
                {t("analytics.aiRecommendations")}
              </p>
              <div className="divide-y divide-border">
                {result.recommendations.map((r, i) => {
                  const pColor = priorityColor(r.priority, t)
                  return (
                    <div key={i} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-base flex-shrink-0"
                        style={{ background: pColor.bg, color: pColor.color }}
                      >
                        {r.icon}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-sm font-medium">{r.title}</p>
                          <span
                            className="text-xs px-1.5 py-0.5 rounded font-medium"
                            style={{ background: pColor.bg, color: pColor.color }}
                          >
                            {pColor.label}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">{r.description}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* CTA Suggestions + Competitor Insight */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Card>
              <CardContent className="pt-5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                  {t("analytics.ctaVariations")}
                </p>
                <div className="space-y-2">
                  {result.cta_suggestions.map((cta, i) => (
                    <div
                      key={i}
                      className="text-sm px-3 py-2 rounded-lg border border-border"
                    >
                      "{cta}"
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                  {t("analytics.competitorInsight")}
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">{result.competitor_insight}</p>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* ── History ── */}
      <Card>
        <CardContent className="pt-5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
            {t("analytics.history")}
          </p>
          {historyLoading ? (
            <p className="text-sm text-muted-foreground py-4 text-center">{t("analytics.loadingHistory")}</p>
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">{t("analytics.noHistory")}</p>
          ) : (
            <div className="divide-y divide-border">
              {history.map(job => (
                <div
                  key={job.id}
                  className="flex items-center gap-2 py-3 px-1 rounded transition-colors hover:bg-muted/30 group"
                >
                  <button
                    onClick={() => { setSelectedHistoryJob(job) }}
                    disabled={job.status !== "completed"}
                    className="flex items-center gap-3 flex-1 min-w-0 text-left disabled:opacity-60 disabled:cursor-default"
                  >
                    <span className="text-lg">{platformIcon(job.platform)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{job.prompt}</p>
                      <p className="text-xs text-muted-foreground">
                        {job.platform} · {job.target_audience} · {timeAgo(job.created_at, t)}
                      </p>
                    </div>
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                      style={
                        job.status === "completed"
                          ? { background: "#EAF3DE", color: "#3B6D11" }
                          : job.status === "processing"
                          ? { background: "#FAEEDA", color: "#854F0B" }
                          : job.status === "cancelled"
                          ? { background: "#E5E7EB", color: "#6B7280" }
                          : { background: "#FCEBEB", color: "#A32D2D" }
                      }
                    >
                      {job.status === "completed" ? t("analytics.completed") : job.status === "processing" ? t("analytics.processing") : job.status === "cancelled" ? "Cancelled" : t("analytics.failed")}
                    </span>
                  </button>

                  {job.status === "processing" && (
                    <button
                      onClick={() => handleCancel(job.id)}
                      disabled={cancellingId === job.id}
                      className="text-xs px-2 py-1 rounded border border-border hover:bg-muted transition-colors flex-shrink-0 disabled:opacity-50"
                      title="Cancel"
                    >
                      {cancellingId === job.id ? "..." : "⏹"}
                    </button>
                  )}

                  {confirmDeleteId === job.id ? (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => handleDelete(job.id)}
                        className="text-xs px-2 py-1 rounded bg-destructive text-destructive-foreground hover:opacity-85 transition-opacity"
                      >
                        Hapus
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="text-xs px-2 py-1 rounded border border-border hover:bg-muted transition-colors"
                      >
                        Batal
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(job.id)}
                      className="text-xs px-2 py-1 rounded border border-border hover:bg-muted transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                      title="Delete"
                    >
                      🗑
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Detail Modal ── */}
      <Dialog open={!!selectedHistoryJob} onOpenChange={(open) => !open && setSelectedHistoryJob(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto w-full mx-auto bg-background p-0">
          <DialogHeader className="px-6 py-4 border-b border-border sticky top-0 bg-background z-10">
            <DialogTitle>{t("analytics.detailTitle")}</DialogTitle>
            <DialogDescription>{t("analytics.detailDesc", { prompt: selectedHistoryJob?.prompt })}</DialogDescription>
          </DialogHeader>
          <div className="p-6 space-y-5">
            {selectedHistoryJob?.result && (
              <>
                {/* Konsep + Metric utama */}
                <Card>
                  <CardContent className="pt-5">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <h2 className="text-base font-medium mb-1">{selectedHistoryJob.result.concept_title}</h2>
                        <p className="text-sm text-muted-foreground leading-relaxed">{selectedHistoryJob.result.concept_description}</p>
                      </div>
                      <div className="flex-shrink-0 text-center">
                        <div
                          className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-medium"
                          style={{
                            background: selectedHistoryJob.result.viral_score >= 80 ? "#EAF3DE" : selectedHistoryJob.result.viral_score >= 60 ? "#FAEEDA" : "#FCEBEB",
                            color: selectedHistoryJob.result.viral_score >= 80 ? "#3B6D11" : selectedHistoryJob.result.viral_score >= 60 ? "#854F0B" : "#A32D2D",
                          }}
                        >
                          {selectedHistoryJob.result.viral_score}
                        </div>
                  <p className="text-xs text-muted-foreground mt-1">{t("analytics.viralScore")}</p>
                      </div>
                    </div>

                    {/* Hook */}
                    <div className="rounded-lg p-3 mb-3" style={{ background: "#E6F1FB" }}>
                <p className="text-xs font-medium mb-1" style={{ color: "#185FA5" }}>{t("analytics.hookLabel")}</p>
                      <p className="text-sm" style={{ color: "#0C447C" }}>"{selectedHistoryJob.result.hook}"</p>
                    </div>

                    {/* Content flow */}
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">{t("analytics.contentFlow")}</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedHistoryJob.result.content_flow.map((step, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <span
                            className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0"
                            style={{ background: "#E6F1FB", color: "#185FA5" }}
                          >
                            {i + 1}
                          </span>
                          <span className="text-sm">{step}</span>
                          {selectedHistoryJob.result && i < selectedHistoryJob.result.content_flow.length - 1 && (
                            <span className="text-muted-foreground text-xs ml-1">→</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Metric cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    {
                      label: t("analytics.estimatedViews"),
                      value: `${selectedHistoryJob.result.estimated_views.min}–${selectedHistoryJob.result.estimated_views.max}`,
                      sub: t("analytics.estReach"),
                      subColor: "text-muted-foreground",
                    },
                    {
                      label: t("analytics.engagementRate"),
                      value: `${selectedHistoryJob.result.engagement_rate}%`,
                      sub: selectedHistoryJob.result.engagement_rate >= 6 ? t("analytics.aboveAverage") : t("analytics.industryAverage"),
                      subColor: selectedHistoryJob.result.engagement_rate >= 6 ? "text-green-600" : "text-amber-600",
                    },
                    {
                      label: t("analytics.bestPostTime"),
                      value: selectedHistoryJob.result.best_post_time,
                      sub: selectedHistoryJob.result.best_post_days,
                      subColor: "text-muted-foreground",
                    },
                    {
                      label: t("analytics.captionScore"),
                      value: t("analytics.captionScoreValue", { score: selectedHistoryJob.result.caption_score }),
                      sub: selectedHistoryJob.result.caption_score >= 80 ? t("analytics.excellent") : selectedHistoryJob.result.caption_score >= 60 ? t("analytics.fair") : t("analytics.needsImprovement"),
                      subColor: selectedHistoryJob.result.caption_score >= 80 ? "text-green-600" : selectedHistoryJob.result.caption_score >= 60 ? "text-amber-600" : "text-red-600",
                    },
                  ].map(m => (
                    <div key={m.label} className="bg-muted rounded-lg p-3">
                      <div className="text-xs text-muted-foreground mb-1">{m.label}</div>
                      <div className="text-xl font-medium">{m.value}</div>
                      <div className={`text-xs mt-0.5 ${m.subColor}`}>{m.sub}</div>
                    </div>
                  ))}
                </div>

                {/* Caption + Hashtag */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Card>
                    <CardContent className="pt-5">
                      <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("analytics.caption")}</p>
                        <div className="flex items-center gap-2">
                          <span
                            className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{ background: "#E6F1FB", color: "#185FA5" }}
                          >
                            {selectedHistoryJob.result.caption_tone}
                          </span>
                          <button
                            onClick={copyModalCaption}
                            className="text-xs px-2.5 py-1 rounded-md border border-border hover:bg-muted transition-colors"
                          >
                            {modalCopiedCaption ? t("analytics.copied") : t("analytics.copy")}
                          </button>
                        </div>
                      </div>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{selectedHistoryJob.result.caption}</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">{t("analytics.hashtag")}</p>
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {selectedHistoryJob.result.hashtags.map(h => (
                          <span
                            key={h}
                            className="text-xs px-2.5 py-1 rounded-full border border-border"
                            style={{ background: "var(--background)" }}
                          >
                            {h}
                          </span>
                        ))}
                      </div>
                      {selectedHistoryJob.result.hashtag_warning && (
                        <div className="text-xs rounded-lg px-3 py-2" style={{ background: "#FAEEDA", color: "#854F0B" }}>
                          ⚠️ {selectedHistoryJob.result.hashtag_warning}
                        </div>
                      )}

                      <div className="mt-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">{t("analytics.contentFormats")}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedHistoryJob.result.content_formats.map(f => (
                            <span
                              key={f}
                              className="text-xs px-2.5 py-1 rounded-full"
                              style={{ background: "#EAF3DE", color: "#3B6D11" }}
                            >
                              {f}
                            </span>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Trend chart */}
                <Card>
                  <CardContent className="pt-5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">
                      {t("analytics.engagementTrend")}
                    </p>
                    <div style={{ height: 180 }}>
                      <Line data={{
                        labels: trendLabels,
                        datasets: [{
      label: t("analytics.engagementRate"),
                          data: selectedHistoryJob.result.trend_30d ?? [],
                          borderColor: "#378ADD",
                          backgroundColor: "rgba(55,138,221,0.07)",
                          borderWidth: 2,
                          fill: true,
                          tension: 0.4,
                          pointRadius: 0,
                          pointHoverRadius: 4,
                        }],
                      }} options={trendChartOptions} />
                    </div>
                  </CardContent>
                </Card>

                {/* Diagram (Mermaid) + Sentiment Pie */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Card className="sm:col-span-2">
                    <CardContent className="pt-5">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">{t("analytics.contentFlowDiagram")}</p>
                      <div className="rounded border border-border p-3 min-h-[140px] overflow-auto" ref={modalMermaidRef} />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-5">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">{t("analytics.sentimentAnalysis")}</p>
                      <div style={{ height: 150 }}>
                        <Pie data={{
                          labels: [t("analytics.sentimentPositive"), t("analytics.sentimentNeutral"), t("analytics.sentimentNegative")],
                          datasets: [
                            {
                              data: [selectedHistoryJob.result.sentiment.positive ?? 0, selectedHistoryJob.result.sentiment.neutral ?? 0, selectedHistoryJob.result.sentiment.negative ?? 0],
                              backgroundColor: ["#34D399", "#FBBF24", "#F87171"],
                              hoverOffset: 6,
                            },
                          ],
                        }} options={{ plugins: { legend: { position: 'bottom' } }, maintainAspectRatio: false }} />
                      </div>
                      <p className="text-sm text-muted-foreground mt-3">{selectedHistoryJob.result.sentiment_summary}</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Audience match + Platform reach */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Card>
                    <CardContent className="pt-5">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">
                        {t("analytics.audienceMatch")}
                      </p>
                      <div className="space-y-3">
                        {selectedHistoryJob.result.audience_match.map(a => (
                          <div key={a.segment}>
                            <div className="flex justify-between text-sm mb-1">
                              <span>{a.segment}</span>
                              <span className="font-medium">{a.pct}%</span>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{ width: `${a.pct}%`, background: "#378ADD" }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-5">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">
                        {t("analytics.estReachPerPlatform")}
                      </p>
                      <div style={{ height: 130 }}>
                        <Bar data={{
                          labels: selectedHistoryJob.result.platform_reach.map(p => p.platform) ?? [],
                          datasets: [{
                            label: t("analytics.estReachChart"),
                            data: selectedHistoryJob.result.platform_reach.map(p => parseInt(p.reach.replace(/[^0-9]/g, ""))) ?? [],
                            backgroundColor: selectedHistoryJob.result.platform_reach.map(p => p.color) ?? [],
                            borderRadius: 4,
                          }],
                        }} options={reachChartOptions} />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Sentiment */}
                <Card>
                  <CardContent className="pt-5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                      {t("analytics.sentimentAnalysis")}
                    </p>
                    <div className="flex rounded-lg overflow-hidden h-2.5 mb-3">
                      <div style={{ width: `${selectedHistoryJob.result.sentiment.positive}%`, background: "#639922" }} />
                      <div style={{ width: `${selectedHistoryJob.result.sentiment.neutral}%`, background: "#EF9F27" }} />
                      <div style={{ width: `${selectedHistoryJob.result.sentiment.negative}%`, background: "#E24B4A" }} />
                    </div>
                    <div className="flex gap-4 text-xs text-muted-foreground mb-3">
                      {[
                        { label: t("analytics.positive", { pct: selectedHistoryJob.result.sentiment.positive }), color: "#639922" },
                        { label: t("analytics.neutral", { pct: selectedHistoryJob.result.sentiment.neutral }), color: "#EF9F27" },
                        { label: t("analytics.negative", { pct: selectedHistoryJob.result.sentiment.negative }), color: "#E24B4A" },
                      ].map(s => (
                        <span key={s.label} className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-sm inline-block" style={{ background: s.color }} />
                          {s.label}
                        </span>
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground">{selectedHistoryJob.result.sentiment_summary}</p>
                  </CardContent>
                </Card>

                {/* Recommendations */}
                <Card>
                  <CardContent className="pt-5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">
                      {t("analytics.aiRecommendations")}
                    </p>
                    <div className="divide-y divide-border">
                      {selectedHistoryJob.result.recommendations.map((r, i) => {
                        const pColor = priorityColor(r.priority, t)
                        return (
                          <div key={i} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                            <div
                              className="w-9 h-9 rounded-full flex items-center justify-center text-base flex-shrink-0"
                              style={{ background: pColor.bg, color: pColor.color }}
                            >
                              {r.icon}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-0.5">
                                <p className="text-sm font-medium">{r.title}</p>
                                <span
                                  className="text-xs px-1.5 py-0.5 rounded font-medium"
                                  style={{ background: pColor.bg, color: pColor.color }}
                                >
                                  {pColor.label}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground leading-relaxed">{r.description}</p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>

                {/* CTA Suggestions + Competitor Insight */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Card>
                    <CardContent className="pt-5">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                        {t("analytics.ctaVariations")}
                      </p>
                      <div className="space-y-2">
                        {selectedHistoryJob.result.cta_suggestions.map((cta, i) => (
                          <div
                            key={i}
                            className="text-sm px-3 py-2 rounded-lg border border-border"
                          >
                            "{cta}"
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-5">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                        {t("analytics.competitorInsight")}
                      </p>
                      <p className="text-sm text-muted-foreground leading-relaxed">{selectedHistoryJob.result.competitor_insight}</p>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}