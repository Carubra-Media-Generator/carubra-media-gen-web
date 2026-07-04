"use client"

import { useState, useEffect, useRef } from "react"
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
  status: "completed" | "processing" | "failed"
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

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(diff / 86400000)
  if (d > 0) return `${d} hari lalu`
  if (h > 0) return `${h} jam lalu`
  return "Baru saja"
}

function platformIcon(p: string) {
  const icons: Record<string, string> = {
    TikTok: "📱", Instagram: "📸", YouTube: "▶️",
    Facebook: "👥", "X / Twitter": "𝕏", LinkedIn: "💼",
  }
  return icons[p] ?? "🌐"
}

function priorityColor(priority: string) {
  return {
    high:   { bg: "#FCEBEB", color: "#A32D2D", label: "Penting" },
    medium: { bg: "#FAEEDA", color: "#854F0B", label: "Disarankan" },
    low:    { bg: "#EAF3DE", color: "#3B6D11", label: "Opsional" },
  }[priority] ?? { bg: "#F1EFE8", color: "#5F5E5A", label: "" }
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ContentStrategyPage() {
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
    if (!prompt.trim()) return setError("Deskripsikan konten yang ingin kamu buat")

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
      if (!res.ok) throw new Error(json.error || "Gagal generate strategi")

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
      label: "Engagement Rate",
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
      label: "Est. Reach",
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
    labels: ["Positive", "Neutral", "Negative"],
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
            <h1 className="text-base font-medium">Content Strategy AI</h1>
            <span className="text-xs px-2.5 py-1 rounded-full font-medium"
              style={{ background: "#E6F1FB", color: "#185FA5" }}>
              Powered by AI
            </span>
          </div>

          {/* Prompt textarea */}
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="Deskripsikan konten yang ingin kamu buat... contoh: 'launching produk skincare baru buat Gen Z, mau viral di TikTok, budget minim tapi kesan premium'"
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
              {loading ? "Generating..." : "Generate strategi →"}
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
            <p className="text-sm text-muted-foreground">AI sedang menyusun strategi konten kamu...</p>
          </CardContent>
        </Card>
      )}

      {/* ── Empty state ── */}
      {!loading && !result && (
        <Card>
          <CardContent className="py-16 flex flex-col items-center gap-3 text-center">
            <div className="text-4xl">🚀</div>
            <p className="font-medium">Belum ada strategi</p>
            <p className="text-sm text-muted-foreground max-w-sm">
              Tulis deskripsi konten yang kamu inginkan, pilih platform dan audience, lalu biarkan AI menyusun strategi lengkap untukmu.
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
                  <p className="text-xs text-muted-foreground mt-1">Viral score</p>
                </div>
              </div>

              {/* Hook */}
              <div className="rounded-lg p-3 mb-3" style={{ background: "#E6F1FB" }}>
                <p className="text-xs font-medium mb-1" style={{ color: "#185FA5" }}>Hook 3 detik pertama</p>
                <p className="text-sm" style={{ color: "#0C447C" }}>"{result.hook}"</p>
              </div>

              {/* Content flow */}
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Alur konten</p>
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
                label: "Est. views",
                value: `${result.estimated_views.min}–${result.estimated_views.max}`,
                sub: "estimasi jangkauan",
                subColor: "text-muted-foreground",
              },
              {
                label: "Engagement rate",
                value: `${result.engagement_rate}%`,
                sub: result.engagement_rate >= 6 ? "Di atas rata-rata" : "Rata-rata industri",
                subColor: result.engagement_rate >= 6 ? "text-green-600" : "text-amber-600",
              },
              {
                label: "Best post time",
                value: result.best_post_time,
                sub: result.best_post_days,
                subColor: "text-muted-foreground",
              },
              {
                label: "Caption score",
                value: `${result.caption_score}/100`,
                sub: result.caption_score >= 80 ? "Sangat baik" : result.caption_score >= 60 ? "Cukup baik" : "Perlu perbaikan",
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
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Caption</p>
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
                      {copiedCaption ? "✓ Copied" : "Copy"}
                    </button>
                  </div>
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{result.caption}</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Hashtag</p>
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
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Format konten</p>
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
                Proyeksi engagement trend — 30 hari
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
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">Diagram alur konten</p>
                <div className="rounded border border-border p-3 min-h-[140px] overflow-auto" ref={mermaidRef} />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Analisis sentimen</p>
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
                  Audience match
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
                  Est. reach per platform
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
                Analisis sentimen konten
              </p>
              <div className="flex rounded-lg overflow-hidden h-2.5 mb-3">
                <div style={{ width: `${result.sentiment.positive}%`, background: "#639922" }} />
                <div style={{ width: `${result.sentiment.neutral}%`, background: "#EF9F27" }} />
                <div style={{ width: `${result.sentiment.negative}%`, background: "#E24B4A" }} />
              </div>
              <div className="flex gap-4 text-xs text-muted-foreground mb-3">
                {[
                  { label: `Positif ${result.sentiment.positive}%`, color: "#639922" },
                  { label: `Netral ${result.sentiment.neutral}%`, color: "#EF9F27" },
                  { label: `Negatif ${result.sentiment.negative}%`, color: "#E24B4A" },
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
                Rekomendasi strategi AI
              </p>
              <div className="divide-y divide-border">
                {result.recommendations.map((r, i) => {
                  const pColor = priorityColor(r.priority)
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
                  Variasi Call to Action
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
                  Insight kompetitor
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
            Riwayat strategi
          </p>
          {historyLoading ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Memuat riwayat...</p>
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Belum ada riwayat strategi.</p>
          ) : (
            <div className="divide-y divide-border">
              {history.map(job => (
                <button
                  key={job.id}
                  onClick={() => {
                    setSelectedHistoryJob(job)
                  }}
                  disabled={job.status !== "completed"}
                  className={`w-full flex items-center gap-3 py-3 text-left transition-colors rounded px-1 hover:bg-muted/30 disabled:opacity-60 disabled:cursor-default`}
                >
                  <span className="text-lg">{platformIcon(job.platform)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{job.prompt}</p>
                    <p className="text-xs text-muted-foreground">
                      {job.platform} · {job.target_audience} · {timeAgo(job.created_at)}
                    </p>
                  </div>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                    style={
                      job.status === "completed"
                        ? { background: "#EAF3DE", color: "#3B6D11" }
                        : job.status === "processing"
                        ? { background: "#FAEEDA", color: "#854F0B" }
                        : { background: "#FCEBEB", color: "#A32D2D" }
                    }
                  >
                    {job.status === "completed" ? "Selesai" : job.status === "processing" ? "Diproses..." : "Gagal"}
                  </span>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Detail Modal ── */}
      <Dialog open={!!selectedHistoryJob} onOpenChange={(open) => !open && setSelectedHistoryJob(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto w-full mx-auto bg-background p-0">
          <DialogHeader className="px-6 py-4 border-b border-border sticky top-0 bg-background z-10">
            <DialogTitle>Detail Strategi Konten</DialogTitle>
            <DialogDescription>Hasil generasi AI untuk prompt: {selectedHistoryJob?.prompt}</DialogDescription>
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
                        <p className="text-xs text-muted-foreground mt-1">Viral score</p>
                      </div>
                    </div>

                    {/* Hook */}
                    <div className="rounded-lg p-3 mb-3" style={{ background: "#E6F1FB" }}>
                      <p className="text-xs font-medium mb-1" style={{ color: "#185FA5" }}>Hook 3 detik pertama</p>
                      <p className="text-sm" style={{ color: "#0C447C" }}>"{selectedHistoryJob.result.hook}"</p>
                    </div>

                    {/* Content flow */}
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Alur konten</p>
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
                      label: "Est. views",
                      value: `${selectedHistoryJob.result.estimated_views.min}–${selectedHistoryJob.result.estimated_views.max}`,
                      sub: "estimasi jangkauan",
                      subColor: "text-muted-foreground",
                    },
                    {
                      label: "Engagement rate",
                      value: `${selectedHistoryJob.result.engagement_rate}%`,
                      sub: selectedHistoryJob.result.engagement_rate >= 6 ? "Di atas rata-rata" : "Rata-rata industri",
                      subColor: selectedHistoryJob.result.engagement_rate >= 6 ? "text-green-600" : "text-amber-600",
                    },
                    {
                      label: "Best post time",
                      value: selectedHistoryJob.result.best_post_time,
                      sub: selectedHistoryJob.result.best_post_days,
                      subColor: "text-muted-foreground",
                    },
                    {
                      label: "Caption score",
                      value: `${selectedHistoryJob.result.caption_score}/100`,
                      sub: selectedHistoryJob.result.caption_score >= 80 ? "Sangat baik" : selectedHistoryJob.result.caption_score >= 60 ? "Cukup baik" : "Perlu perbaikan",
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
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Caption</p>
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
                            {modalCopiedCaption ? "✓ Copied" : "Copy"}
                          </button>
                        </div>
                      </div>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{selectedHistoryJob.result.caption}</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-5">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Hashtag</p>
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
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Format konten</p>
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
                      Proyeksi engagement trend — 30 hari
                    </p>
                    <div style={{ height: 180 }}>
                      <Line data={{
                        labels: trendLabels,
                        datasets: [{
                          label: "Engagement Rate",
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
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">Diagram alur konten</p>
                      <div className="rounded border border-border p-3 min-h-[140px] overflow-auto" ref={modalMermaidRef} />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-5">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Analisis sentimen</p>
                      <div style={{ height: 150 }}>
                        <Pie data={{
                          labels: ["Positive", "Neutral", "Negative"],
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
                        Audience match
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
                        Est. reach per platform
                      </p>
                      <div style={{ height: 130 }}>
                        <Bar data={{
                          labels: selectedHistoryJob.result.platform_reach.map(p => p.platform) ?? [],
                          datasets: [{
                            label: "Est. Reach",
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
                      Analisis sentimen konten
                    </p>
                    <div className="flex rounded-lg overflow-hidden h-2.5 mb-3">
                      <div style={{ width: `${selectedHistoryJob.result.sentiment.positive}%`, background: "#639922" }} />
                      <div style={{ width: `${selectedHistoryJob.result.sentiment.neutral}%`, background: "#EF9F27" }} />
                      <div style={{ width: `${selectedHistoryJob.result.sentiment.negative}%`, background: "#E24B4A" }} />
                    </div>
                    <div className="flex gap-4 text-xs text-muted-foreground mb-3">
                      {[
                        { label: `Positif ${selectedHistoryJob.result.sentiment.positive}%`, color: "#639922" },
                        { label: `Netral ${selectedHistoryJob.result.sentiment.neutral}%`, color: "#EF9F27" },
                        { label: `Negatif ${selectedHistoryJob.result.sentiment.negative}%`, color: "#E24B4A" },
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
                      Rekomendasi strategi AI
                    </p>
                    <div className="divide-y divide-border">
                      {selectedHistoryJob.result.recommendations.map((r, i) => {
                        const pColor = priorityColor(r.priority)
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
                        Variasi Call to Action
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
                        Insight kompetitor
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