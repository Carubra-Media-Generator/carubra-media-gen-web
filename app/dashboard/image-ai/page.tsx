"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import {
  Loader2, Image as ImageIcon, Sparkles, Download, Share2, Trash2,
  Edit2, Clock, CheckCircle2, XCircle, Coins, LayoutGrid,
  History, Copy, Share2 as TwitterIcon, Camera as InstagramIcon, Users as FacebookIcon, Zap,
  RefreshCw, Upload, Info, Eye, Save, RotateCcw
} from "lucide-react"
import { useLanguage } from "@/contexts/language-context"
import { useAuth } from "@/contexts/auth-context"
import { cn } from "@/lib/utils"

// ─── Types ───────────────────────────────────────────────────────────────────

type ImageModel = "text-to-image" | "image-to-image"
type Resolution = "480p" | "720p" | "1080p" | "2K"

type AspectRatio = {
  id: string
  label: string
  ratio: string
  width: number
  height: number
  tw: string
}

const ASPECT_RATIOS: AspectRatio[] = [
  { id: "1:1",  label: "Square",        ratio: "1:1",  width: 1,  height: 1,  tw: "aspect-square"  },
  { id: "9:16", label: "Vertical",      ratio: "9:16", width: 9,  height: 16, tw: "aspect-[9/16]"  },
  { id: "16:9", label: "Widescreen",    ratio: "16:9", width: 16, height: 9,  tw: "aspect-video"   },
  { id: "4:3",  label: "Standard",      ratio: "4:3",  width: 4,  height: 3,  tw: "aspect-[4/3]"   },
  { id: "3:4",  label: "Portrait",      ratio: "3:4",  width: 3,  height: 4,  tw: "aspect-[3/4]"   },
]

const RESOLUTIONS: { id: Resolution; label: string; baseHeight: number; coinCost: number }[] = [
  { id: "480p",  label: "480p",  baseHeight: 480,  coinCost: 1 },
  { id: "720p",  label: "720p",  baseHeight: 720,  coinCost: 1 },
  { id: "1080p", label: "1080p", baseHeight: 1080, coinCost: 2 },
  { id: "2K",    label: "2K",    baseHeight: 1440, coinCost: 3 },
]

type HistoryItem = {
  id: string
  prompt: string
  caption: string
  model: ImageModel
  aspectRatio: string
  resolution: Resolution
  width: number
  height: number
  imageUrl: string | null
  status: "success" | "failed" | "generating"
  createdAt: Date
  durationMs: number | null
}

type ConnectedSocmed = "twitter" | "instagram" | "facebook"

// ─── Detail Modal ─────────────────────────────────────────────────────────────

type DetailModalProps = {
  item: HistoryItem | null
  open: boolean
  onClose: () => void
  onDelete: (id: string) => void
  onSave: (id: string, prompt: string, caption: string) => void
  onRegenCaption: (item: HistoryItem, newPrompt: string) => Promise<void>
  onRegenImage: (item: HistoryItem, newPrompt: string) => Promise<void>
  connectedSocmed: ConnectedSocmed[]
  isRegenerating: boolean
  isCaptioning: boolean
}

function DetailModal({
  item, open, onClose, onDelete, onSave,
  onRegenCaption, onRegenImage,
  connectedSocmed, isRegenerating, isCaptioning
}: DetailModalProps) {
  const { t } = useLanguage()
  const [editPrompt, setEditPrompt] = useState("")
  const [editCaption, setEditCaption] = useState("")
  const [activeTab, setActiveTab] = useState<"view" | "edit">("view")
  const [shareSuccess, setShareSuccess] = useState<string | null>(null)
  const [showFullPrompt, setShowFullPrompt] = useState(false)

  useEffect(() => {
    if (item) {
      setEditPrompt(item.prompt)
      setEditCaption(item.caption)
      setActiveTab("view")
      setShareSuccess(null)
      setShowFullPrompt(false)
    }
  }, [item])

  if (!item) return null

  const handleSave = () => {
    onSave(item.id, editPrompt, editCaption)
    setActiveTab("view")
  }

  const handleShare = (platform: ConnectedSocmed) => {
    setShareSuccess(platform)
    setTimeout(() => setShareSuccess(null), 2500)
  }

  const handleDownload = () => {
    if (!item.imageUrl) return
    const a = document.createElement("a")
    a.href = item.imageUrl
    a.download = `image-ai-${item.id}.png`
    a.click()
  }

  const promptText = item.prompt || ""
  const isLongPrompt = promptText.length > 200
  const displayPrompt = isLongPrompt && !showFullPrompt 
    ? promptText.slice(0, 200) + "..." 
    : promptText

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-full p-0 overflow-hidden rounded-2xl gap-0 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-muted/30 sticky top-0 z-10 backdrop-blur-sm">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <DialogTitle className="text-base font-semibold line-clamp-1">
              {promptText.slice(0, 60)}
            </DialogTitle>
            <Badge
              variant={item.status === "success" ? "default" : item.status === "failed" ? "destructive" : "secondary"}
              className="text-xs gap-1 flex-shrink-0"
            >
              {item.status === "success" && <CheckCircle2 className="h-3 w-3" />}
              {item.status === "failed" && <XCircle className="h-3 w-3" />}
              {item.status === "generating" && <Loader2 className="h-3 w-3 animate-spin" />}
              {item.status === "success" ? t("videoAi.completed") : item.status === "failed" ? t("videoAi.failed") : t("videoAi.processing")}
            </Badge>
          </div>
          <div className="flex rounded-lg bg-muted p-1 gap-1 ml-4">
            <button onClick={() => setActiveTab("view")}
              className={cn("rounded-md px-3 py-1.5 text-sm font-medium transition-all",
                activeTab === "view" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              )}>
              <Eye className="h-3.5 w-3.5 inline mr-1.5" />{t("videoAi.detail")}
            </button>
            <button onClick={() => setActiveTab("edit")}
              className={cn("rounded-md px-3 py-1.5 text-sm font-medium transition-all",
                activeTab === "edit" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              )}>
              <Edit2 className="h-3.5 w-3.5 inline mr-1.5" />{t("videoAi.edit")}
            </button>
          </div>
        </div>

        {activeTab === "view" && (
          <div className="flex flex-col">
            {/* Media Section - Full Width */}
            <div className="bg-neutral-100 dark:bg-neutral-900/50 flex items-center justify-center p-6">
              {item.imageUrl ? (
                <img 
                  src={item.imageUrl} 
                  alt={item.prompt} 
                  className="rounded-xl object-contain max-w-full max-h-[60vh] shadow-2xl animate-in fade-in duration-300" 
                />
              ) : item.status === "generating" ? (
                <div className="flex flex-col items-center gap-3 text-muted-foreground py-12">
                  <Loader2 className="h-12 w-12 animate-spin text-primary" />
                  <p className="text-sm font-medium">{t("imageAi.generatingImage")}</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground py-12">
                  <XCircle className="h-12 w-12 opacity-30" />
                  <p className="text-sm font-medium">{t("videoAi.failed")}</p>
                </div>
              )}
            </div>

            {/* Details Section */}
            <div className="p-6 space-y-6">
              {/* Metadata Chips */}
              <div className="flex flex-wrap gap-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/50 text-xs font-medium">
                  <ImageIcon className="h-3 w-3" />
                  {item.model === "text-to-image" ? "Text→Image" : "Image→Image"}
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/50 text-xs font-medium">
                  <LayoutGrid className="h-3 w-3" />
                  {item.aspectRatio}
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/50 text-xs font-medium">
                  {item.resolution} ({item.width}×{item.height}px)
                </div>
                {item.durationMs && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/50 text-xs font-medium">
                    <Clock className="h-3 w-3" />
                    {(item.durationMs / 1000).toFixed(1)}s
                  </div>
                )}
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/50 text-xs font-medium">
                  <Coins className="h-3 w-3" />
                  1 {t("header.coins")}
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/50 text-xs font-medium">
                  {item.createdAt.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>

              {/* Prompt Section */}
              <div className="bg-muted/30 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("imageAi.editPromptLabel")}</p>
                  {isLongPrompt && (
                    <button 
                      onClick={() => setShowFullPrompt(!showFullPrompt)}
                      className="text-xs text-primary hover:underline"
                    >
                      {showFullPrompt ? "Show Less" : "Show More"}
                    </button>
                  )}
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-line">
                  {displayPrompt}
                </p>
              </div>

              {/* Caption Section */}
              <div className="bg-muted/30 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("imageAi.captionLabel")}</p>
                  {item.caption && (
                    <button 
                      onClick={() => navigator.clipboard.writeText(item.caption)}
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                    >
                      <Copy className="h-3 w-3" /> {t("imageAi.copyCaption")}
                    </button>
                  )}
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-line">
                  {item.caption || (item.status === "generating" ? t("videoAi.preparingCaption") : t("imageAi.noCaption"))}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2 pt-2">
                <Button size="sm" variant="outline" className="gap-1.5" onClick={handleDownload} disabled={!item.imageUrl}>
                  <Download className="h-4 w-4" /> {t("imageAi.download")}
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5"
                  onClick={() => item.imageUrl && navigator.clipboard.writeText(item.imageUrl)} disabled={!item.imageUrl}>
                  <Copy className="h-4 w-4" /> {t("imageAi.copyUrl")}
                </Button>

                {connectedSocmed.length > 0 && item.imageUrl && (
                  <>
                    {connectedSocmed.includes("twitter") && (
                      <Button size="sm" className={cn("gap-1.5 text-white border-0",
                        shareSuccess === "twitter" ? "bg-green-500" : "bg-sky-500 hover:bg-sky-600")}
                        onClick={() => handleShare("twitter")}>
                        {shareSuccess === "twitter" ? <CheckCircle2 className="h-4 w-4" /> : <TwitterIcon className="h-4 w-4" />}
                        {shareSuccess === "twitter" ? t("imageAi.shared") : t("imageAi.twitter")}
                      </Button>
                    )}
                    {connectedSocmed.includes("instagram") && (
                      <Button size="sm" className={cn("gap-1.5 text-white border-0",
                        shareSuccess === "instagram" ? "bg-green-500" : "bg-gradient-to-r from-pink-500 to-purple-600")}
                        onClick={() => handleShare("instagram")}>
                        {shareSuccess === "instagram" ? <CheckCircle2 className="h-4 w-4" /> : <InstagramIcon className="h-4 w-4" />}
                        {shareSuccess === "instagram" ? t("imageAi.shared") : t("imageAi.instagram")}
                      </Button>
                    )}
                    {connectedSocmed.includes("facebook") && (
                      <Button size="sm" className={cn("gap-1.5 text-white border-0",
                        shareSuccess === "facebook" ? "bg-green-500" : "bg-blue-600 hover:bg-blue-700")}
                        onClick={() => handleShare("facebook")}>
                        {shareSuccess === "facebook" ? <CheckCircle2 className="h-4 w-4" /> : <FacebookIcon className="h-4 w-4" />}
                        {shareSuccess === "facebook" ? t("imageAi.shared") : t("imageAi.facebook")}
                      </Button>
                    )}
                  </>
                )}

                <Button size="sm" variant="outline"
                  className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30 ml-auto"
                  onClick={() => { onDelete(item.id); onClose() }}>
                  <Trash2 className="h-4 w-4" /> {t("imageAi.deleteImage")}
                </Button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "edit" && (
          <div className="flex flex-col p-6 space-y-6">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">{t("imageAi.editPromptLabel")}</Label>
              <Textarea value={editPrompt} onChange={e => setEditPrompt(e.target.value)}
                rows={4} className="resize-none" placeholder={t("imageAi.editPromptPlaceholder")} />
              <Button size="sm" variant="outline" className="w-full gap-1.5"
                disabled={isRegenerating || !editPrompt.trim()} onClick={() => onRegenImage(item, editPrompt)}>
                {isRegenerating
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> {t("imageAi.generatingLong")}</>
                  : <><RotateCcw className="h-4 w-4" /> {t("imageAi.regenImage")}</>}
              </Button>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold">{t("imageAi.captionLabel")}</Label>
              <Textarea value={editCaption} onChange={e => setEditCaption(e.target.value)}
                rows={4} className="resize-none" placeholder={t("imageAi.editCaptionPlaceholder")} />
              <Button size="sm" variant="outline" className="w-full gap-1.5"
                disabled={isCaptioning || !item.imageUrl} onClick={() => onRegenCaption(item, editCaption || editPrompt)}>
                {isCaptioning
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> {t("imageAi.captionGenerating")}</>
                  : <><Sparkles className="h-4 w-4" /> {t("imageAi.regenCaption")}</>}
              </Button>
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="flex-1 gap-1.5" onClick={handleSave}>
                <Save className="h-4 w-4" /> {t("imageAi.saveChanges")}
              </Button>
              <Button size="sm" variant="outline" className="flex-1 gap-1.5" onClick={() => setActiveTab("view")}>
                {t("videoAi.cancel")}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}


// ─── Main Component ───────────────────────────────────────────────────────────

export default function ImageAIPage() {
  const { t } = useLanguage()
  const { user, isBalanceLoaded } = useAuth()

  const [model, setModel] = useState<ImageModel>("text-to-image")
  const [aspectRatio, setAspectRatio] = useState<string>("1:1")
  const [resolution, setResolution] = useState<Resolution>("720p")
  const [prompt, setPrompt] = useState("")
  const [sourceImage, setSourceImage] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  const [resultImage, setResultImage] = useState<string | null>(null)
  const [resultImageId, setResultImageId] = useState<string | null>(null)
  const [resultCaption, setResultCaption] = useState("")
  const [isCaptioning, setIsCaptioning] = useState(false)
  const [captionPrompt, setCaptionPrompt] = useState("")

  // Initialize from user.coins immediately to prevent 0-flash before API resolves
  const [coinBalance, setCoinBalance] = useState<number>(user?.coins ?? 0)
  const [history, setHistory] = useState<HistoryItem[]>([])

  const [detailItem, setDetailItem] = useState<HistoryItem | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [isModalRegenerating, setIsModalRegenerating] = useState(false)
  const [isModalCaptioning, setIsModalCaptioning] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const selectedRatio = ASPECT_RATIOS.find(r => r.id === aspectRatio)!
  const selectedRes = RESOLUTIONS.find(r => r.id === resolution)!
  const connectedSocmed: ConnectedSocmed[] = ["twitter", "instagram"]

  const getImageDimensions = () => {
    const baseH = selectedRes.baseHeight
    const w = selectedRatio.width
    const h = selectedRatio.height
    const width = Math.round((baseH * w) / h)
    const height = baseH
    return { width, height }
  }

  const coinCost = selectedRes.coinCost

  const reportAiUsage = async (payload: {
    apiName: string
    action: string
    model: string
    prompt: string
    promptTokens?: number | null
    completionTokens?: number | null
    totalTokens?: number | null
    quotaRemaining?: number | null
    metadata?: Record<string, any>
  }) => {
    try {
      const token = localStorage.getItem("carubra-token")
      if (!token) return
      await fetch("/api/ai-usage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })
    } catch {
      // Ignore logging failures
    }
  }

  const updateCoinBalance = (coins: number) => {
    setCoinBalance(coins)
    window.dispatchEvent(new CustomEvent("carubra-balance-updated", { detail: { coins } }))
  }

  // Clear temporary state on page unmount
  useEffect(() => {
    return () => {
      setResultImage(null)
      setResultImageId(null)
      setResultCaption("")
      setPrompt("")
      setSourceImage(null)
      setCaptionPrompt("")
    }
  }, [])

  // Clear previous preview when user starts editing/entering a new prompt
  useEffect(() => {
    setResultImage(null)
    setResultImageId(null)
    setResultCaption("")
  }, [prompt])

  // Sync coin balance whenever auth context updates it (handles API fetch completion)
  useEffect(() => {
    if (typeof user?.coins === 'number') {
      setCoinBalance(user.coins)
    }
  }, [user?.coins])

  useEffect(() => {
    const token = localStorage.getItem("carubra-token")
    if (!token) return
    fetch("/api/image-ai", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        const items: HistoryItem[] = (data.images || []).map((img: any) => ({
          id: img.id,
          prompt: img.prompt,
          caption: img.caption || "",
          model: "text-to-image" as ImageModel,
          aspectRatio: img.aspectRatio || "1:1",
          resolution: (img.resolution || "720p") as Resolution,
          width: img.width || 720,
          height: img.height || 720,
          imageUrl: img.imageUrl || null,
          status: img.status === "completed" ? "success" : img.status === "failed" ? "failed" : "generating",
          createdAt: new Date(img.createdAt),
          durationMs: null,
        }))
        setHistory(items)
      })
      .catch(() => {})
  }, [])

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setSourceImage(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  const handleGenerateCaption = async (imageUrl: string, imagePrompt: string, imageId?: string) => {
    setIsCaptioning(true)
    try {
      const token = localStorage.getItem("carubra-token")
      const response = await fetch("/api/image-ai/caption", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ imageUrl, prompt: imagePrompt, imageId }),
      })
      const data = await response.json()
      const caption = data?.caption ?? ""
      const usage = data?.usage ?? null
      setResultCaption(caption)
      setHistory(prev => prev.map(item =>
        (imageId ? item.id === imageId : item.imageUrl === imageUrl) ? { ...item, caption } : item
      ))
      if (detailItem && (imageId ? detailItem.id === imageId : detailItem.imageUrl === imageUrl)) {
        setDetailItem(prev => prev ? { ...prev, caption } : prev)
      }
      await reportAiUsage({
        apiName: 'image-ai.caption',
        action: 'caption',
        model: 'image-caption',
        prompt: imagePrompt,
        totalTokens: usage?.total_tokens ?? null,
        promptTokens: usage?.prompt_tokens ?? null,
        completionTokens: usage?.completion_tokens ?? null,
        metadata: { imageUrl, imageId },
      })
    } catch (err) {
      console.error('[image-ai] Frontend - caption generation failed:', err)
      setResultCaption(t("imageAi.captionFailed"))
    } finally {
      setIsCaptioning(false)
    }
  }

  const handleGenerate = async () => {
    if (!prompt.trim() || coinBalance < coinCost) return
    if (model === "image-to-image" && !sourceImage) return

    setIsGenerating(true)
    setResultImage(null)
    setResultImageId(null)
    setResultCaption("")

    const startTime = Date.now()
    const historyId = Date.now().toString()
    const { width, height } = getImageDimensions()

    setHistory(prev => [{
      id: historyId, prompt, caption: "", model, aspectRatio, resolution, width, height,
      imageUrl: null, status: "generating", createdAt: new Date(), durationMs: null,
    }, ...prev])
    setCoinBalance(prev => prev - coinCost)

    try {
      const body: Record<string, unknown> = {
        prompt, width, height, steps: 4, cfg_scale: 1,
      }
      if (model === "image-to-image" && sourceImage) {
        body.init_image = sourceImage.split(",")[1]
        body.strength = 0.2 // Low strength to preserve identity
      }

      const token = localStorage.getItem("carubra-token")
      if (!token) throw new Error("Auth required")

      const response = await fetch("/api/image-ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })

      const durationMs = Date.now() - startTime
      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err?.error || "Generation failed")
      }

      const data = await response.json()
      const imageUrl: string | null = data?.image?.imageUrl ?? null
      const imageId: string = data?.image?.id ?? historyId
      if (typeof data?.coins === "number") updateCoinBalance(data.coins)

      if (!imageUrl) throw new Error("No image URL returned")

      setResultImage(imageUrl)
      setResultImageId(imageId)
      setHistory(prev => prev.map(item =>
        item.id === historyId ? { ...item, id: imageId, imageUrl, status: "success", durationMs } : item
      ))
      await reportAiUsage({
        apiName: 'image-ai.generate',
        action: 'generate',
        model: model === 'image-to-image' ? 'image-to-image' : 'text-to-image',
        prompt,
        totalTokens: null,
        promptTokens: null,
        completionTokens: null,
        metadata: { width, height, aspectRatio, resolution },
      })
      await handleGenerateCaption(imageUrl, prompt, imageId)
    } catch {
      const durationMs = Date.now() - startTime
      setHistory(prev => prev.map(item =>
        item.id === historyId ? { ...item, status: "failed", durationMs } : item
      ))
      setCoinBalance(prev => prev + coinCost)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDelete = async (id: string) => {
    const token = localStorage.getItem("carubra-token")
    if (!token) return

    // Temp IDs are numeric timestamps (Date.now().toString()); real DB IDs are UUIDs.
    // Deleting a temp ID would silently fail in the API and reappear on next refresh.
    const isRealId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    if (!isRealId) {
      // Just remove from UI — the item is still generating and has no DB record yet
      setHistory(prev => prev.filter(item => item.id !== id))
      return
    }

    try {
      const res = await fetch(`/api/image-ai/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        console.error("Failed to delete image:", err)
        // Still remove from UI even if API returned an error to avoid stuck items
      }
      setHistory(prev => prev.filter(item => item.id !== id))
    } catch (error) {
      console.error("Failed to delete image:", error)
      // Remove from UI anyway so the user isn't stuck
      setHistory(prev => prev.filter(item => item.id !== id))
    }
  }

  const handleSaveEdit = (id: string, newPrompt: string, newCaption: string) => {
    setHistory(prev => prev.map(item => item.id === id ? { ...item, prompt: newPrompt, caption: newCaption } : item))
    setDetailItem(prev => prev && prev.id === id ? { ...prev, prompt: newPrompt, caption: newCaption } : prev)
  }

  const handleModalRegenCaption = async (item: HistoryItem, newPrompt: string) => {
    if (!item.imageUrl) return
    setIsModalCaptioning(true)
    try {
      const token = localStorage.getItem("carubra-token")
      const response = await fetch("/api/image-ai/caption", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ imageUrl: item.imageUrl, prompt: newPrompt, imageId: item.id }),
      })
      const data = await response.json()
      const caption = data?.caption ?? ""
      const usage = data?.usage ?? null
      setHistory(prev => prev.map(h => h.id === item.id ? { ...h, caption } : h))
      setDetailItem(prev => prev ? { ...prev, caption } : prev)
      await reportAiUsage({
        apiName: 'image-ai.caption',
        action: 'regen-caption',
        model: 'image-caption',
        prompt: newPrompt,
        totalTokens: usage?.total_tokens ?? null,
        promptTokens: usage?.prompt_tokens ?? null,
        completionTokens: usage?.completion_tokens ?? null,
        metadata: { imageId: item.id, imageUrl: item.imageUrl },
      })
    } catch (err) {
      console.error('[image-ai] Frontend - caption regen failed:', err)
    } finally {
      setIsModalCaptioning(false)
    }
  }


  const handleModalRegenImage = async (item: HistoryItem, newPrompt: string) => {
    if (coinBalance < coinCost) return
    setIsModalRegenerating(true)
    setCoinBalance(prev => prev - coinCost)
    try {
      const token = localStorage.getItem("carubra-token")
      const response = await fetch("/api/image-ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ prompt: newPrompt, width: item.width, height: item.height, steps: 4, cfg_scale: 1 }),
      })
      if (!response.ok) throw new Error("Generation failed")
      const data = await response.json()
      const imageUrl: string | null = data?.image?.imageUrl ?? null
      const imageId: string = data?.image?.id ?? item.id
      if (typeof data?.coins === "number") updateCoinBalance(data.coins)
      if (!imageUrl) throw new Error("No URL")
      setHistory(prev => prev.map(h =>
        h.id === item.id ? { ...h, id: imageId, imageUrl, prompt: newPrompt, status: "success" } : h
      ))
      setDetailItem(prev => prev ? { ...prev, id: imageId, imageUrl, prompt: newPrompt, status: "success" } : prev)
      await reportAiUsage({
        apiName: 'image-ai.generate',
        action: 'regen-generate',
        model: 'text-to-image',
        prompt: newPrompt,
        totalTokens: null,
        promptTokens: null,
        completionTokens: null,
        metadata: { imageId: item.id, width: item.width, height: item.height },
      })
    } catch {
      setCoinBalance(prev => prev + coinCost)
    } finally {
      setIsModalRegenerating(false)
    }
  }

  const openDetail = (item: HistoryItem) => {
    // Create a deep copy to prevent reference corruption
    const itemCopy = { ...item }
    setDetailItem(itemCopy)
    setDetailOpen(true)
    // Fallback: if completed image has no caption, auto-generate one
    if (item.status === "success" && item.imageUrl && !item.caption) {
      handleGenerateCaption(item.imageUrl, item.prompt, item.id)
    }
  }

  const formatDuration = (ms: number | null) => {
    if (ms === null) return "—"
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    return `${(ms / 60000).toFixed(1)}m`
  }

  const { width: previewW, height: previewH } = getImageDimensions()

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Sparkles className="h-8 w-8 text-primary" />
            {t("imageAi.header")}
          </h1>
          <p className="text-muted-foreground mt-1">{t("imageAi.headerDesc")}</p>
        </div>
      </div>

      <div className="grid xl:grid-cols-5 gap-6">
        {/* Left Panel */}
        <div className="xl:col-span-2 space-y-4">
          <Card className="border-2">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Zap className="h-5 w-5 text-primary" />
                {t("imageAi.generateForm")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">

              {/* Model */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">{t("imageAi.model")}</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(["text-to-image", "image-to-image"] as ImageModel[]).map(m => (
                    <button key={m} onClick={() => setModel(m)}
                      className={cn("rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition-all",
                        model === m ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground hover:border-primary/50"
                      )}>
                      {m === "text-to-image" ? t("imageAi.textToImage") : t("imageAi.imageToImage")}
                    </button>
                  ))}
                </div>
              </div>

              {/* Image Upload */}
              {model === "image-to-image" && (
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">{t("imageAi.sourceImage")}</Label>
                  <div onClick={() => fileInputRef.current?.click()}
                    className={cn("border-2 border-dashed rounded-xl cursor-pointer transition-colors flex flex-col items-center justify-center gap-2 p-4 min-h-[120px]",
                      sourceImage ? "border-primary/50" : "border-border hover:border-primary/50"
                    )}>
                    {sourceImage
                      ? <img src={sourceImage} alt="source" className="max-h-32 rounded-lg object-contain" />
                      : <><Upload className="h-8 w-8 text-muted-foreground" /><span className="text-sm text-muted-foreground">{t("imageAi.clickToUpload")}</span></>
                    }
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                  <p className="text-xs text-muted-foreground mt-2">
                    💡 {t("imageAi.tipLabel")} {t("imageAi.tipText")}
                  </p>
                </div>
              )}

              {/* Aspect Ratio */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">{t("imageAi.aspectRatio")}</Label>
                <div className="grid grid-cols-5 gap-1.5">
                  {ASPECT_RATIOS.map(r => (
                    <button key={r.id} onClick={() => setAspectRatio(r.id)} title={`${r.label} (${r.ratio})`}
                      className={cn("rounded-lg border-2 p-1.5 flex flex-col items-center gap-1 transition-all text-[10px]",
                        aspectRatio === r.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"
                      )}>
                      <div className="flex items-center justify-center w-full" style={{ height: 28 }}>
                        <div className={cn("rounded-sm border-2", aspectRatio === r.id ? "border-primary bg-primary/20" : "border-muted-foreground/40 bg-muted")}
                          style={{
                            width: Math.min(22, 22 * (r.width / Math.max(r.width, r.height))),
                            height: Math.min(22, 22 * (r.height / Math.max(r.width, r.height)))
                          }} />
                      </div>
                      <span className={cn("font-medium leading-tight text-center", aspectRatio === r.id ? "text-primary" : "text-muted-foreground")}>{r.ratio}</span>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">{selectedRatio.label} — {selectedRatio.ratio}</p>
              </div>

              {/* Resolution */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">{t("imageAi.resolution")}</Label>
                <div className="grid grid-cols-4 gap-2">
                  {RESOLUTIONS.map(r => (
                    <button key={r.id} onClick={() => setResolution(r.id)}
                      className={cn("rounded-lg border-2 px-2 py-2 text-sm font-medium transition-all flex flex-col items-center gap-0.5",
                        resolution === r.id ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground hover:border-primary/50"
                      )}>
                      <span className="font-semibold">{r.label}</span>
                      <span className="text-[10px] opacity-70">{r.coinCost} {t("header.coins")}</span>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("imageAi.outputSize", { w: previewW, h: previewH })}
                </p>
              </div>

              {/* Prompt */}
              <div className="space-y-2">
                <Label htmlFor="prompt" className="text-sm font-semibold">{t("imageAi.prompt")}</Label>
                <Textarea id="prompt" placeholder={t("imageAi.promptPlaceholder")}
                  value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={5} className="resize-none text-sm" />
              </div>

              {/* Cost */}
              <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Info className="h-4 w-4" /><span>{t("imageAi.coinCost")}</span>
                </div>
                <div className="flex items-center gap-1 font-semibold text-sm">
                  <Coins className="h-4 w-4 text-amber-500" />
                  <span className="text-amber-600">{coinCost} {t("header.coins")}</span>
                </div>
              </div>

              {/* Only show insufficient balance warning AFTER balance has fully loaded to prevent flash */}
              {isBalanceLoaded && coinBalance < coinCost && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive flex items-center gap-2">
                  <XCircle className="h-4 w-4 flex-shrink-0" />{t("imageAi.insufficientBalance")}
                </div>
              )}

              <Button onClick={handleGenerate}
                disabled={isGenerating || !user || !prompt.trim() || (isBalanceLoaded && coinBalance < coinCost) || (model === "image-to-image" && !sourceImage)}
                className="w-full h-12 text-base font-semibold" size="lg">
                {isGenerating
                  ? <><Loader2 className="h-5 w-5 mr-2 animate-spin" />{t("imageAi.generatingState")}</>
                  : <><Sparkles className="h-5 w-5 mr-2" />{t("imageAi.generate")}</>}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right Panel */}
        <div className="xl:col-span-3 space-y-4">
          <Card className="border-2">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <ImageIcon className="h-5 w-5 text-primary" />
                {t("imageAi.resultTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className={cn("w-full rounded-xl border-2 border-dashed overflow-hidden bg-muted/30 flex items-center justify-center",
                selectedRatio.tw, "min-h-[200px] max-h-[500px]")}>
                {isGenerating ? (
                  <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <p className="text-sm font-medium">{t("imageAi.generatingImage")}</p>
                    <p className="text-xs opacity-60">{t("imageAi.mayTakeSeconds")}</p>
                  </div>
                ) : resultImage ? (
                  <img src={resultImage} alt="Generated" className="w-full h-full object-contain rounded-xl" />
                ) : (
                  <div className="flex flex-col items-center gap-3 text-muted-foreground p-8 text-center">
                    <ImageIcon className="h-12 w-12 opacity-30" />
                    <p className="text-sm">{t("imageAi.waitingResult")}</p>
                  </div>
                )}
              </div>

              {resultImage && (
                <div className="flex flex-wrap gap-2">
                  <a href={resultImage} download="generated-image.png">
                    <Button size="sm" variant="outline" className="gap-2"><Download className="h-4 w-4" /> {t("imageAi.download")}</Button>
                  </a>
                  <Button size="sm" variant="outline" className="gap-2" onClick={() => navigator.clipboard.writeText(resultImage)}>
                    <Copy className="h-4 w-4" /> {t("imageAi.copyUrl")}
                  </Button>
                  <Button size="sm" variant="outline" className="gap-2" onClick={() => { setResultImage(null); setResultCaption("") }}>
                    <RefreshCw className="h-4 w-4" /> {t("imageAi.reset")}
                  </Button>
                </div>
              )}

              {resultImage && (
                <div className="space-y-2">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <Share2 className="h-4 w-4" /> {t("imageAi.shareToSocial")}
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {connectedSocmed.includes("twitter") && (
                      <Button size="sm" className="gap-2 bg-sky-500 hover:bg-sky-600 text-white border-0">
                        <TwitterIcon className="h-4 w-4" /> {t("imageAi.twitter")}
                      </Button>
                    )}
                    {connectedSocmed.includes("instagram") && (
                      <Button size="sm" className="gap-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white border-0">
                        <InstagramIcon className="h-4 w-4" /> {t("imageAi.instagram")}
                      </Button>
                    )}
                    {connectedSocmed.length === 0 && (
                      <p className="text-sm text-muted-foreground">{t("imageAi.noAccounts")}</p>
                    )}
                  </div>
                </div>
              )}

              {resultImage && (
                <div className="space-y-3 border-t pt-4">
                  <Label className="text-sm font-semibold">{t("imageAi.generateCaption")}</Label>
                  {isCaptioning && !resultCaption && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /><span>{t("imageAi.generatingCaption")}</span>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Textarea placeholder={t("imageAi.captionPlaceholder")}
                      value={captionPrompt} onChange={(e) => setCaptionPrompt(e.target.value)}
                      rows={2} className="resize-none text-sm flex-1" />
                    <Button onClick={() => resultImage && handleGenerateCaption(resultImage, captionPrompt || prompt, resultImageId ?? undefined)}
                      disabled={isCaptioning} className="self-end" size="sm">
                      {isCaptioning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    </Button>
                  </div>
                  {resultCaption && (
                    <div className="rounded-lg bg-muted p-3 text-sm whitespace-pre-line relative group">
                      {resultCaption}
                      <button onClick={() => navigator.clipboard.writeText(resultCaption)}
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Copy className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* History & Gallery */}
      <Card className="border-2">
        <CardContent className="pt-4">
          <Tabs defaultValue="history">
            <TabsList className="mb-4">
              <TabsTrigger value="history" className="gap-2"><History className="h-4 w-4" /> {t("imageAi.historyTab")}</TabsTrigger>
              <TabsTrigger value="gallery" className="gap-2"><LayoutGrid className="h-4 w-4" /> {t("imageAi.galleryTab")}</TabsTrigger>
            </TabsList>

            <TabsContent value="history">
              {history.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <History className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">{t("imageAi.noHistory")}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {history.map(item => (
                    <div key={item.id}
                      className="flex items-start gap-4 rounded-xl border p-4 hover:bg-muted/30 transition-colors cursor-pointer group"
                      onClick={() => openDetail(item)}>
                      <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-muted flex items-center justify-center border relative">
                        {item.imageUrl ? (
                          <>
                            <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
                              <Eye className="h-5 w-5 text-white" />
                            </div>
                          </>
                        ) : item.status === "generating" ? (
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        ) : (
                          <XCircle className="h-5 w-5 text-destructive/50" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.prompt}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <span>{item.aspectRatio}</span><span>·</span>
                          <span>{item.resolution}</span><span>·</span>
                          <span>{item.width}×{item.height}px</span><span>·</span>
                          <Clock className="h-3 w-3" />
                          <span>{formatDuration(item.durationMs)}</span><span>·</span>
                          <span>{item.createdAt.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                        {item.caption && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-1 italic">{t("imageAi.captionPrefix")} {item.caption}</p>
                        )}
                      </div>
                      <div className="flex-shrink-0 flex flex-col items-end gap-2" onClick={e => e.stopPropagation()}>
                        <Badge variant={item.status === "success" ? "default" : item.status === "failed" ? "destructive" : "secondary"} className="text-xs gap-1">
                          {item.status === "success" && <CheckCircle2 className="h-3 w-3" />}
                          {item.status === "failed" && <XCircle className="h-3 w-3" />}
                          {item.status === "generating" && <Loader2 className="h-3 w-3 animate-spin" />}
{item.status === "success" ? t("videoAi.completed") : item.status === "failed" ? t("videoAi.failed") : t("videoAi.processing")}
                        </Badge>
                        <div className="flex items-center gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openDetail(item)}>
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(item.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="gallery">
              {history.filter(h => h.imageUrl).length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <LayoutGrid className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">{t("imageAi.noGallery")}</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {history.filter(h => h.imageUrl).map(item => (
                    <div key={item.id}
                      className="group relative rounded-xl overflow-hidden bg-muted aspect-square border cursor-pointer"
                      onClick={() => openDetail(item)}>
                      <img src={item.imageUrl!} alt={item.prompt} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2.5">
                        <p className="text-white text-xs line-clamp-2 leading-tight">{item.prompt}</p>
                        <div className="flex items-center justify-between mt-1.5">
                          <span className="text-white/60 text-[10px]">{item.aspectRatio} · {item.resolution}</span>
                          <Button size="icon" variant="ghost" className="h-6 w-6 text-white hover:text-white hover:bg-white/20"
                            onClick={e => { e.stopPropagation(); openDetail(item) }}>
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <DetailModal
        item={detailItem}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onDelete={handleDelete}
        onSave={handleSaveEdit}
        onRegenCaption={handleModalRegenCaption}
        onRegenImage={handleModalRegenImage}
        connectedSocmed={connectedSocmed}
        isRegenerating={isModalRegenerating}
        isCaptioning={isModalCaptioning}
      />
    </div>
  )
}
