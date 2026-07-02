"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import {
  Calendar, Clock, Camera, Users, Trash2, Link2,
  Link2Off, CheckCircle2, XCircle, AlarmClock, Upload, Image as ImageIcon,
  Video, FileText, X, Send, Save, AlertCircle, Loader2, RefreshCw,
  ShieldCheck, User,
} from "lucide-react"
import { cn } from "@/lib/utils"

// Aliases for social icons (lucide doesn't export Instagram/Facebook/Youtube)
const Instagram = Camera
const Facebook = Users
const Youtube = Video

// ─── Types ────────────────────────────────────────────────────────────────────

type SocmedId = "instagram" | "facebook" | "tiktok" | "youtube" | "twitter" | "threads" 

type PostType = {
  instagram: "story" | "feed" | "reels"
  facebook: "feed" | "story" | "reels"
  tiktok: "video"
  youtube: "video" | "shorts"
  twitter: "tweet"
  threads: "post"
}

type MediaSource = "upload" | "generated"

type Connection = {
  platform: SocmedId
  username: string
  connectedAt: string
}

type GeneratedContent = {
  _id: string
  mediaUrl: string
  mediaType: "image" | "video"
  prompt: string
  caption?: string
  createdAt: string
}

type ScheduledPost = {
  _id: string
  mediaSource: MediaSource
  generatedContentId?: string
  caption: string
  mediaUrl: string | null
  mediaName: string | null
  mediaType: "image" | "video" | null
  postTypes: Partial<PostType>
  date: string
  time: string
  platforms: SocmedId[]
  status: "scheduled" | "posted" | "failed" | "draft"
  createdAt: string
}

// ─── Platform icons ───────────────────────────────────────────────────────────

const TikTokIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.19 8.19 0 004.79 1.53V6.79a4.85 4.85 0 01-1.02-.1z"/>
  </svg>
)

const ThreadsIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-.505-1.975-1.442-3.512-2.79-4.572-1.3-1.022-3.147-1.575-5.49-1.59-2.8.018-4.963.87-6.429 2.534-1.418 1.61-2.142 3.965-2.15 7.003v.017c.008 3.038.732 5.393 2.15 7.003 1.466 1.663 3.63 2.517 6.43 2.534 2.292-.016 4.143-.61 5.5-1.76 1.448-1.228 2.19-3.058 2.204-5.438-.014-1.516-.36-2.754-1.027-3.68-.616-.856-1.52-1.384-2.685-1.57-.21 1.697-.723 3.105-1.527 4.186-.978 1.31-2.34 2.014-3.946 2.034-1.348-.013-2.48-.467-3.274-1.312-.845-.9-1.283-2.147-1.265-3.612.018-1.462.495-2.703 1.38-3.594.924-.929 2.217-1.42 3.744-1.42.166 0 .336.006.508.02.5.04.995.13 1.477.265.052-1.068.07-2.184.053-3.327l2.052.002c.017 1.257-.005 2.48-.065 3.657 1.567.582 2.799 1.611 3.562 3.02.79 1.451 1.15 3.198 1.07 5.19-.086 3.023-1.067 5.402-2.835 6.876-1.718 1.434-4.024 2.139-6.857 2.156zm-.334-11.903c-.885.012-1.617.29-2.118.802-.47.48-.702 1.12-.713 1.904-.01.784.21 1.406.655 1.848.426.423 1.017.644 1.712.655 1.03-.013 1.848-.487 2.432-1.37.59-.893.9-2.163.923-3.777-.28-.037-.565-.062-.89-.062z"/>
  </svg>
)

// ─── Platform metadata ────────────────────────────────────────────────────────

type PlatformMeta = {
  id: SocmedId
  name: string
  color: string
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  uiOnly?: boolean
  connectLabel: string
  connectHint: string
  usernameLabel: string
  usernamePlaceholder: string
  postTypes?: string[]
}

const PLATFORM_META: PlatformMeta[] = [
  {
    id: "instagram", name: "Instagram", color: "#E1306C", Icon: Camera,
    connectLabel: "Masuk dengan Instagram",
    connectHint: "Mulai koneksi Instagram Business atau Creator melalui OAuth. Pastikan akun sudah terhubung ke Facebook Page.",
    usernameLabel: "Username Instagram",
    usernamePlaceholder: "@namakamu",
    postTypes: ["story", "feed", "reels"],
  },
  {
    id: "facebook", name: "Facebook", color: "#1877F2", Icon: Users,
    connectLabel: "Masuk dengan Facebook",
    connectHint: "Mulai OAuth untuk menghubungkan Facebook Page kamu. Pastikan kamu adalah Admin halaman tersebut.",
    usernameLabel: "Nama Facebook Page",
    usernamePlaceholder: "Nama Page / @username",
    postTypes: ["feed", "story", "reels"],
  },
  {
    id: "tiktok", name: "TikTok", color: "#010101", Icon: TikTokIcon,
    connectLabel: "Masuk dengan TikTok",
    connectHint: "Hubungkan akun TikTok melalui OAuth untuk memeriksa apakah koneksi dapat dibuat.",
    usernameLabel: "Username TikTok",
    usernamePlaceholder: "@namakamu",
    postTypes: ["video"],
  },
  {
    id: "youtube", name: "YouTube", color: "#FF0000", Icon: Video,
    connectLabel: "Masuk dengan Google",
    connectHint: "Hubungkan channel YouTube kamu melalui akun Google untuk menjadwalkan upload video.",
    usernameLabel: "Nama Channel YouTube",
    usernamePlaceholder: "Nama Channel",
    postTypes: ["video", "shorts"],
  },
  {
    id: "twitter", name: "X (Twitter)", color: "#14171A", Icon: X,
    connectLabel: "Masuk dengan X",
    connectHint: "Gunakan OAuth untuk menghubungkan akun X/Twitter dan mengaktifkan penjadwalan tweet.",
    usernameLabel: "Username X",
    usernamePlaceholder: "@namakamu",
    postTypes: ["tweet"],
  },
  {
    id: "threads", name: "Threads", color: "#101010", Icon: ThreadsIcon,
    connectLabel: "Masuk dengan Threads",
    connectHint: "Gunakan OAuth untuk menghubungkan akun Threads dan mengaktifkan penjadwalan post.",
    usernameLabel: "Username Threads",
    usernamePlaceholder: "@namakamu",
    postTypes: ["post"],
  },
]

const metaMap = Object.fromEntries(PLATFORM_META.map(p => [p.id, p])) as Record<SocmedId, PlatformMeta>

const STATUS_META = {
  scheduled: { label: "Terjadwal",  cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",   Icon: AlarmClock   },
  posted:  { label: "Selesai",   cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", Icon: CheckCircle2 },
  failed:     { label: "Gagal",     cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",         Icon: XCircle      },
  draft:      { label: "Draft",     cls: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",        Icon: Save         },
} as const

// ─── API helpers ──────────────────────────────────────────────────────────────
async function apiFetch<T = any>(url: string, options?: RequestInit): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('carubra-token') : null
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options?.headers,
    },
  })

  const text = await res.text()
  let data: any = null
  try {
    data = text ? JSON.parse(text) : null
  } catch (e) {
    data = null
  }

  if (!res.ok) {
    const message = data?.error || text || 'Terjadi kesalahan pada server'
    throw new Error(message)
  }

  return data as T
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AutoUploadPage() {
  // Remote data
  const [connections, setConnections] = useState<Connection[]>([])
  const [posts, setPosts] = useState<ScheduledPost[]>([])
  const [generatedContents, setGeneratedContents] = useState<GeneratedContent[]>([])
  const [loadingConnections, setLoadingConnections] = useState(true)
  const [loadingPosts, setLoadingPosts] = useState(true)
  const [loadingGenerated, setLoadingGenerated] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // Connect dialog (manual username input)
  const [connectPlatform, setConnectPlatform] = useState<SocmedId | null>(null)
  const [connectUsername, setConnectUsername] = useState("")
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectError, setConnectError] = useState<string | null>(null)

  // Detail / Disconnect dialog
  const [detailPlatform, setDetailPlatform] = useState<SocmedId | null>(null)
  const [disconnectConfirm, setDisconnectConfirm] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)

  // Instagram instruction dialog
  const [showIgInstructionDialog, setShowIgInstructionDialog] = useState(false)
  const [pendingOAuthId, setPendingOAuthId] = useState<SocmedId | null>(null)


  // WhatsApp / Threads coming soon dialog
  const [showComingSoonDialog, setShowComingSoonDialog] = useState(false)
  const [comingSoonPlatform, setComingSoonPlatform] = useState<SocmedId | null>(null)

  // Form
  const [mediaSource, setMediaSource] = useState<MediaSource>("upload")
  const [selectedGeneratedContent, setSelectedGeneratedContent] = useState<GeneratedContent | null>(null)
  const [selectedPlatforms, setSelectedPlatforms] = useState<SocmedId[]>([])
  const [postTypes, setPostTypes] = useState<Partial<PostType>>({})
  const [date, setDate] = useState("")
  const [time, setTime] = useState("")
  const [caption, setCaption] = useState("")
  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [mediaPreview, setMediaPreview] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [isGeneratingCaption, setIsGeneratingCaption] = useState(false)
  const [captionError, setCaptionError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // ─── Fetch ──────────────────────────────────────────────────────────────────

  const fetchConnections = useCallback(async () => {
    setLoadingConnections(true)
    try {
      const data = await apiFetch<{ connections: Connection[] }>("/api/social-connect")
      setConnections(data.connections)
      setFetchError(null)
    } catch (e: any) {
      setFetchError(e.message)
    } finally {
      setLoadingConnections(false)
    }
  }, [])

  const fetchPosts = useCallback(async () => {
    setLoadingPosts(true)
    try {
      const data = await apiFetch<{ posts: ScheduledPost[] }>("/api/scheduled-posts")
      setPosts(data.posts)
    } catch {
      // silently show empty list
    } finally {
      setLoadingPosts(false)
    }
  }, [])

  const fetchGeneratedContents = useCallback(async () => {
    setLoadingGenerated(true)
    try {
      const data = await apiFetch<{ contents: GeneratedContent[] }>("/api/generated-contents")
      setGeneratedContents(data.contents)
    } catch {
      // silently show empty list
    } finally {
      setLoadingGenerated(false)
    }
  }, [])

  const searchParams = useSearchParams()

  useEffect(() => {
    const error = searchParams.get('error')
    if (error) {
      setFetchError(error)
    }
  }, [searchParams])

  useEffect(() => {
    fetchConnections()
    fetchPosts()
    fetchGeneratedContents()
  }, [fetchConnections, fetchPosts, fetchGeneratedContents])

  // ─── Connection helpers ─────────────────────────────────────────────────────

  const isConnected = (id: SocmedId) => connections.some(c => c.platform === id)
  const getConnection = (id: SocmedId) => connections.find(c => c.platform === id)

  const startOAuth = async (id: SocmedId) => {
    try {
      const data = await apiFetch<{ url: string }>(`/api/social-connect/${id}/start`, { method: 'POST' })
      window.location.href = data.url
    } catch (e: any) {
      alert(`Gagal memulai koneksi ${id}: ` + e.message)
    }
  }

  const handleClickConnect = (id: SocmedId) => {
    const meta = metaMap[id]

    // Coming soon platforms
    if (meta?.uiOnly) {
      setComingSoonPlatform(id)
      setShowComingSoonDialog(true)
      return
    }
    if (id === 'instagram') {
      setPendingOAuthId(id)
      setShowIgInstructionDialog(true)
      return
    }

    if (id === 'facebook' || id === 'youtube' || id === 'tiktok' || id === 'twitter' || id === 'threads') {
      startOAuth(id)
      return
    }

    // Others: manual username input
    setConnectPlatform(id)
    setConnectUsername("")
    setConnectError(null)
  }

  const handleProceedOAuth = async () => {
    if (!pendingOAuthId) return
    setShowIgInstructionDialog(false)
    await startOAuth(pendingOAuthId)
  }

  const handleConfirmConnect = async () => {
    if (!connectPlatform) return
    if (!connectUsername.trim()) {
      setConnectError("Username tidak boleh kosong.")
      return
    }
    
    setIsConnecting(true)
    setConnectError(null)
    try {
      await apiFetch("/api/social-connect", {
        method: "POST",
        body: JSON.stringify({ 
          platform: connectPlatform, 
          username: connectUsername.trim(),
        }),
      })
      await fetchConnections()
      setConnectPlatform(null)
      setConnectUsername("")
    } catch (e: any) {
      setConnectError(e.message)
    } finally {
      setIsConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    if (!detailPlatform) return
    setIsDisconnecting(true)
    try {
      await apiFetch(`/api/social-connect/${detailPlatform}`, { method: "DELETE" })
      await fetchConnections()
      setSelectedPlatforms(prev => prev.filter(p => p !== detailPlatform))
      setDetailPlatform(null)
      setDisconnectConfirm(false)
    } catch (e: any) {
      alert(`Gagal memutus: ${e.message}`)
    } finally {
      setIsDisconnecting(false)
    }
  }

  // ─── Form handlers ──────────────────────────────────────────────────────────

  const connectedPlatforms = PLATFORM_META.filter(p => isConnected(p.id))

  const togglePlatform = (id: SocmedId) =>
    setSelectedPlatforms(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    )

  const selectAll = () => {
    const ids = connectedPlatforms.map(p => p.id)
    setSelectedPlatforms(prev => prev.length === ids.length ? [] : ids)
  }

  const handleMediaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setMediaFile(file)
    const reader = new FileReader()
    reader.onload = ev => setMediaPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  const resetForm = () => {
    setMediaSource("upload")
    setSelectedGeneratedContent(null)
    setSelectedPlatforms([])
    setPostTypes({})
    setDate("")
    setTime("")
    setCaption("")
    setMediaFile(null)
    setMediaPreview(null)
    setFormError(null)
    setIsGeneratingCaption(false)
    setCaptionError(null)
  }

  const handleSubmit = async (asDraft = false) => {
    setFormError(null)
    if (!asDraft) {
      if (!date || !time) return setFormError("Tanggal dan waktu wajib diisi.")
      if (selectedPlatforms.length === 0) return setFormError("Pilih minimal satu platform.")
    }

    let hasMedia = false
    let mediaUrl = null
    let mediaName = null
    let mediaType = null
    let generatedContentId = null

    if (mediaSource === "upload") {
      if (mediaPreview && mediaFile) {
        hasMedia = true
        mediaUrl = mediaPreview
        mediaName = mediaFile.name
        mediaType = mediaFile.type.startsWith("video") ? "video" : "image"
      }
    } else if (mediaSource === "generated") {
      if (selectedGeneratedContent) {
        hasMedia = true
        mediaUrl = selectedGeneratedContent.mediaUrl
        mediaName = `generated-${selectedGeneratedContent._id}`
        mediaType = selectedGeneratedContent.mediaType
        generatedContentId = selectedGeneratedContent._id
      }
    }

    if (!hasMedia) return setFormError("Pilih media dari upload atau generated content.")

    for (const platform of selectedPlatforms) {
      if (!postTypes[platform as SocmedId]) {
        return setFormError(`Pilih tipe postingan untuk ${metaMap[platform].name}`)
      }
    }

    setIsSubmitting(true)
    try {
      const payload = {
        mediaSource,
        generatedContentId: generatedContentId ?? undefined,
        caption,
        mediaUrl,
        mediaName,
        mediaType,
        date,
        time,
        platforms: selectedPlatforms,
        postTypes,
        status: asDraft ? "draft" : "scheduled",
      }
      await apiFetch("/api/scheduled-posts", { method: "POST", body: JSON.stringify(payload) })
      await fetchPosts()
      resetForm()
    } catch (e: any) {
      setFormError(e.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const [isRunning, setIsRunning] = useState(false)

  const handleRunPending = async () => {
    setIsRunning(true)
    try {
      const data = await apiFetch<{ posted: number; failed: number; errors: string[] }>('/api/scheduled-posts/run', { method: 'POST' })
      const message = `Diproses: ${data.posted} berhasil, ${data.failed} gagal.`
      alert(data.errors && data.errors.length ? `${message}\n
${data.errors.join('\n')}` : message)
      await fetchPosts()
    } catch (e: any) {
      alert(`Gagal menjalankan jadwal: ${e.message}`)
    } finally {
      setIsRunning(false)
    }
  }

  const handleDeletePost = async (id: string) => {
    try {
      await apiFetch(`/api/scheduled-posts/${id}`, { method: "DELETE" })
      setPosts(prev => prev.filter(p => p._id !== id))
    } catch (e: any) {
      alert(`Gagal hapus: ${e.message}`)
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  const connectMeta  = connectPlatform ? metaMap[connectPlatform] : null
  const detailConn   = detailPlatform  ? getConnection(detailPlatform) : null
  const detailMeta   = detailPlatform  ? metaMap[detailPlatform] : null
  const csMeta       = comingSoonPlatform ? metaMap[comingSoonPlatform] : null

  return (
    <div className="space-y-8 max-w-6xl mx-auto">

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
          <Send className="h-8 w-8 text-primary" />
          Upload Otomatis
        </h1>
        <p className="text-muted-foreground mt-1">
          Jadwalkan dan publikasikan konten ke semua platform dari satu tempat
        </p>
      </div>

      {fetchError && (
        <div className="flex items-center gap-2 rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {fetchError}
          <button onClick={() => { fetchConnections(); fetchPosts() }} className="ml-auto hover:underline flex items-center gap-1">
            <RefreshCw className="h-3.5 w-3.5" /> Coba lagi
          </button>
        </div>
      )}

      {/* ── Section 1: Koneksi Sosmed ── */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Link2 className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Koneksi Media Sosial</h2>
          {loadingConnections && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground ml-1" />}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {PLATFORM_META.map(({ id, name, color, Icon, uiOnly }) => {
            const connected = isConnected(id)
            return (
              <div
                key={id}
                className={cn(
                  "rounded-xl border-2 p-3 flex flex-col items-center gap-2 text-center transition-all",
                  connected ? "border-primary/30 bg-primary/5" : "border-border bg-background"
                )}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center relative" style={{ background: `${color}20` }}>
                  <Icon className="h-5 w-5" style={{ color }} />
                </div>
                <span className="text-xs font-semibold leading-tight">{name}</span>

                {connected ? (
                  <button
                    onClick={() => { setDetailPlatform(id); setDisconnectConfirm(false) }}
                    className="text-[10px] font-medium flex items-center gap-1 text-green-600 dark:text-green-400 hover:underline"
                  >
                    <CheckCircle2 className="h-3 w-3" /> Terhubung
                  </button>
                ) : (
                  <button
                    onClick={() => handleClickConnect(id)}
                    disabled={loadingConnections}
                    className={cn(
                      "text-[10px] font-medium flex items-center gap-1 hover:underline disabled:opacity-50",
                      uiOnly ? "text-amber-600 dark:text-amber-400" : "text-primary"
                    )}
                  >
                    <Link2 className="h-3 w-3" /> Hubungkan
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* ── Section 2: Form Jadwal ── */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Jadwalkan Postingan</h2>
        </div>

        <Card className="border-2">
          <CardContent className="pt-5 space-y-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm font-semibold">
                  <Calendar className="h-4 w-4 text-muted-foreground" /> Tanggal
                </Label>
                <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm font-semibold">
                  <Clock className="h-4 w-4 text-muted-foreground" /> Waktu
                </Label>
                <Input type="time" value={time} onChange={e => setTime(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <Upload className="h-4 w-4 text-muted-foreground" /> Pilih Sumber Konten
              </Label>
              <div className="flex gap-2 items-center">
                <label className={cn("px-3 py-1 rounded-lg border cursor-pointer text-sm", mediaSource === 'upload' ? 'border-primary bg-primary/10' : 'border-border')}>
                  <input type="radio" name="mediaSource" className="sr-only" checked={mediaSource === 'upload'} onChange={() => { setMediaSource('upload'); setSelectedGeneratedContent(null); setCaption('') }} /> Upload
                </label>
                <label className={cn("px-3 py-1 rounded-lg border cursor-pointer text-sm", mediaSource === 'generated' ? 'border-primary bg-primary/10' : 'border-border')}>
                  <input type="radio" name="mediaSource" className="sr-only" checked={mediaSource === 'generated'} onChange={() => { setMediaSource('generated'); setMediaFile(null); setMediaPreview(null); setCaption('') }} /> Generated
                </label>
              </div>

              {mediaSource === 'upload' ? (
                <>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      "border-2 border-dashed rounded-xl cursor-pointer transition-colors p-4",
                      mediaPreview ? "border-primary/40" : "border-border hover:border-primary/40"
                    )}
                  >
                    {mediaPreview && mediaFile ? (
                      <div className="flex items-center gap-3">
                        {mediaFile.type.startsWith("video") ? (
                          <video src={mediaPreview} className="w-16 h-16 rounded-lg object-cover" />
                        ) : (
                          <img src={mediaPreview} alt="" className="w-16 h-16 rounded-lg object-cover" />
                        )}
                        <div>
                          <p className="text-sm font-medium">{mediaFile.name}</p>
                          <p className="text-xs text-muted-foreground">{(mediaFile.size / 1024).toFixed(1)} KB</p>
                          <button
                            onClick={e => { e.stopPropagation(); setMediaFile(null); setMediaPreview(null) }}
                            className="text-xs text-destructive hover:underline mt-1"
                          >Hapus</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2 py-4 text-muted-foreground">
                        <div className="flex gap-3">
                          <ImageIcon className="h-8 w-8" />
                          <Video className="h-8 w-8" />
                        </div>
                        <p className="text-sm">Klik untuk upload gambar atau video</p>
                        <p className="text-xs opacity-60">JPG, PNG, MP4, MOV — maks 100MB</p>
                      </div>
                    )}
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleMediaUpload} />
                </>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {loadingGenerated ? (
                    <div className="col-span-3 text-sm text-muted-foreground">Memuat generated contents...</div>
                  ) : generatedContents.length === 0 ? (
                    <div className="col-span-3 text-sm text-muted-foreground">Belum ada konten generated.</div>
                  ) : (
                    generatedContents.map(c => (
                      <button key={c._id} onClick={async () => {
                        setSelectedGeneratedContent(c)
                        setMediaPreview(c.mediaUrl)
                        setCaptionError(null)
                        if (c.caption) {
                          // Caption already saved — auto-fill immediately
                          setCaption(c.caption)
                        } else {
                          // Fallback: generate caption on-the-fly, save it, then fill
                          setIsGeneratingCaption(true)
                          try {
                            const token = localStorage.getItem('carubra-token')
                            const endpoint = c.mediaType === 'image'
                              ? '/api/image-ai/caption'
                              : '/api/video-ai/caption'
                            const body = c.mediaType === 'image'
                              ? { imageUrl: c.mediaUrl, prompt: c.prompt, imageId: c._id }
                              : { script: c.prompt, videoId: c._id }
                            const res = await fetch(endpoint, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                              body: JSON.stringify(body),
                            })
                            const data = await res.json()
                            if (data.caption) {
                              setCaption(data.caption)
                              // Update local state so future clicks don't re-generate
                              setGeneratedContents(prev => prev.map(item =>
                                item._id === c._id ? { ...item, caption: data.caption } : item
                              ))
                            } else {
                              setCaptionError("Gagal membuat caption. Silakan tulis manual.")
                            }
                          } catch (err) {
                            console.error("Caption generation error:", err)
                            setCaptionError("Gagal membuat caption. Silakan tulis manual.")
                          } finally {
                            setIsGeneratingCaption(false)
                          }
                        }
                      }} className={cn("border rounded-lg overflow-hidden text-left relative", selectedGeneratedContent?._id === c._id ? 'border-primary' : 'border-border')}>
                        {isGeneratingCaption && selectedGeneratedContent?._id === c._id && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
                            <Loader2 className="h-6 w-6 animate-spin text-white" />
                          </div>
                        )}
                        {c.mediaType === 'video' ? (
                          <video src={c.mediaUrl} className="w-full h-24 object-cover" muted />
                        ) : (
                          <img src={c.mediaUrl} alt={c.prompt} className="w-full h-24 object-cover" />
                        )}
                        <div className="p-2 text-xs text-muted-foreground">{c.prompt?.slice(0, 60)}</div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" /> Caption / Teks Postingan
              </Label>
              <Textarea
                placeholder="Tulis caption postinganmu... atau terisi otomatis dari hasil generate AI."
                value={caption}
                onChange={e => { setCaption(e.target.value); setCaptionError(null) }}
                rows={4}
                className="resize-none text-sm"
              />
              {captionError && (
                <div className="flex items-center gap-2 text-xs text-destructive">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {captionError}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Pilih Platform</Label>
                {connectedPlatforms.length > 0 && (
                  <button onClick={selectAll} className="text-xs text-primary hover:underline">
                    {selectedPlatforms.length === connectedPlatforms.length ? "Batal Pilih Semua" : "Pilih Semua"}
                  </button>
                )}
              </div>

              {loadingConnections ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Memuat platform...
                </div>
              ) : connectedPlatforms.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 bg-muted/50 rounded-lg">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  Belum ada akun terhubung. Hubungkan platform di atas terlebih dahulu.
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {connectedPlatforms.map(({ id, name, color, Icon }) => {
                    const selected = selectedPlatforms.includes(id)
                    return (
                      <button
                        key={id}
                        onClick={() => togglePlatform(id)}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all",
                          selected ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground hover:border-primary/40"
                        )}
                      >
                        <Icon className="h-4 w-4" style={{ color: selected ? undefined : color }} />
                        {name}
                        {selected && <CheckCircle2 className="h-3.5 w-3.5" />}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {selectedPlatforms.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Tipe Postingan per Platform</Label>
                <div className="grid gap-2">
                  {selectedPlatforms.map(pid => {
                    const meta = metaMap[pid]
                    const options = meta.postTypes ?? []
                    return (
                      <div key={pid} className="flex items-center gap-3">
                        <div className="w-28 text-sm">{meta.name}</div>
                        <select
                          value={(postTypes as any)[pid] ?? ''}
                          onChange={e => setPostTypes(prev => ({ ...prev, [pid]: e.target.value }))}
                          className="px-3 py-2 rounded-lg border"
                        >
                          <option value="">Pilih tipe</option>
                          {options.map(o => (
                            <option key={o} value={o}>{o}</option>
                          ))}
                        </select>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {formError && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0" /> {formError}
              </div>
            )}

            <div className="flex flex-wrap gap-3 pt-2 border-t">
              <Button onClick={() => handleSubmit(false)} disabled={isSubmitting} className="gap-2">
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlarmClock className="h-4 w-4" />}
                Jadwalkan
              </Button>
              <Button variant="outline" onClick={() => handleSubmit(true)} disabled={isSubmitting} className="gap-2">
                <Save className="h-4 w-4" /> Simpan Draft
              </Button>
              <Button variant="ghost" onClick={resetForm} disabled={isSubmitting} className="gap-2 text-muted-foreground">
                <X className="h-4 w-4" /> Batal
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ── Section 3: History ── */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <AlarmClock className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">History Postingan Terjadwal</h2>
          </div>
          {!loadingPosts && (
            <Badge variant="secondary" className="ml-auto">{posts.length} postingan</Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRunPending}
            disabled={isRunning || posts.length === 0}
            className="ml-auto"
          >
            {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Jalankan Jadwal
          </Button>
        </div>

        {loadingPosts ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" /> Memuat postingan...
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-xl">
            <Send className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Belum ada postingan terjadwal</p>
          </div>
        ) : (
          <div className="space-y-3">
            {posts.map(post => {
              const sm = STATUS_META[post.status]
              const SmIcon = sm.Icon
              return (
                <div key={post._id} className="flex items-start gap-4 rounded-xl border p-4 hover:bg-muted/20 transition-colors">
                  <div className="flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden bg-muted border flex items-center justify-center">
                    {post.mediaUrl ? (
                      post.mediaType === "video"
                        ? <video src={post.mediaUrl} className="w-full h-full object-cover" />
                        : <img src={post.mediaUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <FileText className="h-5 w-5 text-muted-foreground/50" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <p className="text-sm font-medium line-clamp-1">
                      {post.caption || post.mediaName || "Postingan tanpa caption"}
                    </p>
                    <div className="flex items-center gap-1.5">
                      {post.platforms.map(pid => {
                        const m = metaMap[pid]
                        if (!m) return null
                        const { Icon, color, name } = m
                        return (
                          <div key={pid} title={name} className="w-5 h-5 rounded flex items-center justify-center" style={{ background: `${color}18` }}>
                            <Icon className="h-3 w-3" style={{ color }} />
                          </div>
                        )
                      })}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" /> {post.date}
                      <Clock className="h-3 w-3 ml-1" /> {post.time}
                    </div>
                  </div>
                  <div className="flex-shrink-0 flex flex-col items-end gap-2">
                    <span className={cn("inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full", sm.cls)}>
                      <SmIcon className="h-3 w-3" /> {sm.label}
                    </span>
                    <button
                      onClick={() => handleDeletePost(post._id)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ══ Dialog 1: MANUAL CONNECT ══ */}
      <Dialog open={!!connectPlatform} onOpenChange={open => !open && setConnectPlatform(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {connectMeta && (
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${connectMeta.color}20` }}>
                  <connectMeta.Icon className="h-5 w-5" style={{ color: connectMeta.color }} />
                </div>
              )}
              <div>
                <p className="text-base font-bold">{connectMeta?.connectLabel}</p>
                <p className="text-xs font-normal text-muted-foreground">{connectMeta?.name}</p>
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-xl bg-muted/60 px-4 py-3 text-sm text-muted-foreground leading-relaxed">
              {connectMeta?.connectHint}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
              <ShieldCheck className="h-4 w-4 text-green-500 flex-shrink-0" />
              <span>Koneksi aman — data tersimpan di database & hanya bisa diakses oleh kamu.</span>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                {connectMeta?.usernameLabel}
              </Label>
              <Input
                placeholder={connectMeta?.usernamePlaceholder}
                value={connectUsername}
                onChange={e => setConnectUsername(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleConfirmConnect()}
                autoFocus
              />
              {connectError && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" /> {connectError}
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConnectPlatform(null)} disabled={isConnecting}>Batal</Button>
            <Button onClick={handleConfirmConnect} disabled={isConnecting} className="gap-2">
              {isConnecting ? <><Loader2 className="h-4 w-4 animate-spin" /> Menghubungkan...</> : <><CheckCircle2 className="h-4 w-4" /> Hubungkan Akun</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══ Dialog 2: DETAIL AKUN ══ */}
      <Dialog open={!!detailPlatform} onOpenChange={open => !open && setDetailPlatform(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {detailMeta && (
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${detailMeta.color}20` }}>
                  <detailMeta.Icon className="h-4 w-4" style={{ color: detailMeta.color }} />
                </div>
              )}
              {detailMeta?.name}
            </DialogTitle>
            <DialogDescription>Detail akun yang terhubung</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2.5">
              <span className="text-sm text-muted-foreground">Username</span>
              <span className="text-sm font-semibold">{detailConn?.username || "—"}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2.5">
              <span className="text-sm text-muted-foreground">Terhubung sejak</span>
              <span className="text-sm font-semibold">
                {detailConn?.connectedAt
                  ? new Date(detailConn.connectedAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })
                  : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-green-50 dark:bg-green-900/20 px-3 py-2.5">
              <span className="text-sm text-muted-foreground">Status</span>
              <span className="text-sm font-semibold text-green-600 dark:text-green-400 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Terhubung
              </span>
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            {!disconnectConfirm ? (
              <>
                <Button variant="outline" onClick={() => setDetailPlatform(null)}>Tutup</Button>
                <Button variant="destructive" onClick={() => setDisconnectConfirm(true)} className="gap-2">
                  <Link2Off className="h-4 w-4" /> Putus Sambungan
                </Button>
              </>
            ) : (
              <div className="w-full space-y-2">
                <p className="text-sm text-center text-muted-foreground">Yakin ingin memutus sambungan?</p>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setDisconnectConfirm(false)} disabled={isDisconnecting}>Batal</Button>
                  <Button variant="destructive" className="flex-1" onClick={handleDisconnect} disabled={isDisconnecting}>
                    {isDisconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ya, Putuskan"}
                  </Button>
                </div>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══ Dialog 3: INSTAGRAM INSTRUCTION ══ */}
      <Dialog open={showIgInstructionDialog} onOpenChange={setShowIgInstructionDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#E1306C20]">
                <Instagram className="h-4 w-4 text-[#E1306C]" />
              </div>
              Sebelum Menghubungkan Instagram
            </DialogTitle>
            <DialogDescription>Pastikan syarat berikut terpenuhi</DialogDescription>
          </DialogHeader>
          <div className="py-3 space-y-3">
            <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-4 py-3 space-y-2">
              <p className="text-sm font-semibold text-blue-700 dark:text-blue-400">Persyaratan Instagram Business API:</p>
              <ol className="text-xs text-blue-600 dark:text-blue-400 space-y-1.5 list-decimal list-inside leading-relaxed">
                <li>Akun Instagram harus bertipe <strong>Bisnis</strong> atau <strong>Kreator</strong></li>
                <li>Akun Instagram harus sudah <strong>dihubungkan ke Facebook Page</strong></li>
                <li>Kamu harus menjadi <strong>Admin</strong> dari Facebook Page tersebut</li>
              </ol>
            </div>
            <div className="rounded-xl bg-muted/60 px-4 py-3 space-y-1">
              <p className="text-xs font-semibold text-muted-foreground">Belum punya Facebook Page?</p>
              <a href="https://facebook.com/pages/create" target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                Buat Facebook Page gratis →
              </a>
            </div>
            <div className="rounded-xl bg-muted/60 px-4 py-3 space-y-1">
              <p className="text-xs font-semibold text-muted-foreground">Cara ubah akun ke Bisnis/Kreator:</p>
              <p className="text-xs text-muted-foreground">Instagram → Pengaturan → Akun → Beralih ke Akun Profesional</p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowIgInstructionDialog(false)}>Batal</Button>
            <Button onClick={handleProceedOAuth} className="gap-2">
              <Instagram className="h-4 w-4" /> Lanjut ke Instagram
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      

      {/* ══ Dialog 5: PLATFORM STATUS ══ */}
      <Dialog open={showComingSoonDialog} onOpenChange={setShowComingSoonDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {csMeta && (
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${csMeta.color}20` }}>
                  <csMeta.Icon className="h-4 w-4" style={{ color: csMeta.color }} />
                </div>
              )}
              {csMeta?.name}
            </DialogTitle>
            <DialogDescription>Status Integrasi {csMeta?.name}</DialogDescription>
          </DialogHeader>
          <div className="py-3 space-y-3">
            <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-3 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Status Koneksi</p>
                <p className="text-xs text-amber-600 dark:text-amber-500 leading-relaxed">
                  Integrasi {csMeta?.name} belum tersedia dalam versi ini.
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Platform ini ditampilkan untuk keperluan roadmap. Silakan gunakan Instagram, Facebook, atau platform lain yang sudah terhubung.
            </p>
          </div>
          <DialogFooter>
            <Button className="w-full" onClick={() => setShowComingSoonDialog(false)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}