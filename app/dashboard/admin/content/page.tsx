"use client"

import { useEffect, useState } from "react"
import { Search, Filter, ArrowUpDown, Eye, Trash2, AlertTriangle, FileText, Image as ImageIcon, Video, CalendarDays, Lightbulb, Archive, CheckCircle2, XCircle, Loader2, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Checkbox } from "@/components/ui/checkbox"
import { useAuth } from "@/contexts/auth-context"
import { useLanguage } from "@/contexts/language-context"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

type GeneratedContent = {
  id: string
  user_id: string
  title: string
  content: string
  metadata?: {
    status?: 'completed' | 'processing' | 'failed' | 'scheduled'
    content_type?: 'image' | 'video' | 'strategy' | 'scheduled' | 'legacy'
    coin_cost?: number
    [key: string]: any
  }
  created_at?: string
  updated_at?: string
}

type TabType = 'all' | 'image' | 'video' | 'strategy' | 'scheduled' | 'legacy'
type StatusType = 'all' | 'completed' | 'processing' | 'failed' | 'scheduled'
type SortType = 'newest' | 'oldest' | 'title-asc' | 'title-desc'

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

function getStatusVariant(status?: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case 'completed': return 'default'
    case 'processing': return 'secondary'
    case 'failed': return 'destructive'
    case 'scheduled': return 'outline'
    default: return 'secondary'
  }
}

function getStatusColor(status?: string): string {
  switch (status) {
    case 'completed': return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
    case 'processing': return 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
    case 'failed': return 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20'
    case 'scheduled': return 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20'
    default: return 'bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/20'
  }
}

function getContentTypeColor(type?: string): string {
  switch (type) {
    case 'image': return 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20'
    case 'video': return 'bg-pink-500/10 text-pink-700 dark:text-pink-400 border-pink-500/20'
    case 'strategy': return 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/20'
    case 'scheduled': return 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20'
    case 'legacy': return 'bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/20'
    default: return 'bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/20'
  }
}

function getContentTypeIcon(type?: string) {
  switch (type) {
    case 'image': return ImageIcon
    case 'video': return Video
    case 'strategy': return Lightbulb
    case 'scheduled': return CalendarDays
    case 'legacy': return Archive
    default: return FileText
  }
}

const TABS: { id: TabType; label: string }[] = [
  { id: 'all', label: 'Semua' },
  { id: 'image', label: 'Gambar' },
  { id: 'video', label: 'Video' },
  { id: 'strategy', label: 'Strategi' },
  { id: 'scheduled', label: 'Terjadwal' },
  { id: 'legacy', label: 'Legacy' },
]

const STATUS_OPTIONS: { id: StatusType; label: string }[] = [
  { id: 'all', label: 'Semua Status' },
  { id: 'completed', label: 'Completed' },
  { id: 'processing', label: 'Processing' },
  { id: 'failed', label: 'Failed' },
  { id: 'scheduled', label: 'Scheduled' },
]

const SORT_OPTIONS: { id: SortType; label: string }[] = [
  { id: 'newest', label: 'Terbaru' },
  { id: 'oldest', label: 'Terlama' },
  { id: 'title-asc', label: 'Judul A-Z' },
  { id: 'title-desc', label: 'Judul Z-A' },
]

function ContentCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border/50 bg-gradient-to-br from-background to-background/50 p-5 shadow-sm">
      <div className="flex items-start gap-4">
        <Skeleton className="h-5 w-5 rounded" />
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          <Skeleton className="h-5 w-3/4 rounded" />
          <Skeleton className="h-4 w-1/2 rounded" />
          <Skeleton className="h-4 w-full rounded" />
          <Skeleton className="h-4 w-2/3 rounded" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-8 w-8 rounded-lg" />
        </div>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 mb-4">
        <FileText className="h-10 w-10 text-slate-400" />
      </div>
      <h3 className="text-lg font-semibold mb-2">Tidak Ada Konten</h3>
      <p className="text-sm text-muted-foreground max-w-md">
        Belum ada konten yang tersedia. Konten yang dibuat oleh pengguna akan muncul di sini.
      </p>
    </div>
  )
}

export default function AdminContentPage() {
  const { user, isLoading } = useAuth()
  const { t } = useLanguage()
  const [contents, setContents] = useState<GeneratedContent[]>([])
  const [filteredContents, setFilteredContents] = useState<GeneratedContent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState<TabType>('all')
  const [statusFilter, setStatusFilter] = useState<StatusType>('all')
  const [sortBy, setSortBy] = useState<SortType>('newest')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  
  // Modal states
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showViewModal, setShowViewModal] = useState(false)
  const [selectedContentId, setSelectedContentId] = useState<string | null>(null)
  const [selectedContentTitle, setSelectedContentTitle] = useState("")
  const [selectedContent, setSelectedContent] = useState<GeneratedContent | null>(null)

  useEffect(() => {
    if (!isLoading) {
      loadContents()
    }
  }, [isLoading])

  // Auto-refresh every 30 seconds to show new content
  useEffect(() => {
    const interval = setInterval(() => {
      if (!loading) {
        loadContents()
      }
    }, 30000)
    return () => clearInterval(interval)
  }, [loading])

  useEffect(() => {
    filterAndSortContents()
  }, [contents, searchQuery, activeTab, statusFilter, sortBy])

  const loadContents = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch<{ contents: GeneratedContent[] }>("/api/admin/contents")
      setContents(data.contents)
    } catch (err: any) {
      setError(err.message ?? t('adminContent.loadError'))
    } finally {
      setLoading(false)
    }
  }

  const filterAndSortContents = () => {
    let filtered = [...contents]

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(item => 
        item.title?.toLowerCase().includes(query) ||
        item.content?.toLowerCase().includes(query)
      )
    }

    // Tab filter (content type)
    if (activeTab !== 'all') {
      filtered = filtered.filter(item => 
        item.metadata?.content_type === activeTab
      )
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(item => 
        item.metadata?.status === statusFilter
      )
    }

    // Sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        case 'oldest':
          return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
        case 'title-asc':
          return (a.title || '').localeCompare(b.title || '')
        case 'title-desc':
          return (b.title || '').localeCompare(a.title || '')
        default:
          return 0
      }
    })

    setFilteredContents(filtered)
  }

  const getTabCount = (tab: TabType) => {
    if (tab === 'all') return contents.length
    return contents.filter(item => item.metadata?.content_type === tab).length
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredContents.map(item => item.id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  const handleSelectItem = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds)
    if (checked) {
      newSelected.add(id)
    } else {
      newSelected.delete(id)
    }
    setSelectedIds(newSelected)
  }

  const handleView = (item: GeneratedContent) => {
    setSelectedContent(item)
    setShowViewModal(true)
  }

  const handleDelete = async (id: string, title: string) => {
    setSelectedContentId(id)
    setSelectedContentTitle(title || 'tanpa judul')
    setShowDeleteModal(true)
  }

  const confirmDelete = async () => {
    if (!selectedContentId) return
    try {
      await apiFetch(`/api/admin/contents/${selectedContentId}`, { method: 'DELETE' })
      // Remove the deleted item from local state immediately
      setContents(prev => prev.filter(item => item.id !== selectedContentId))
      setShowDeleteModal(false)
      setSelectedIds(new Set())
      setSelectedContentId(null)
      setSelectedContentTitle("")
    } catch (err: any) {
      setError(err.message)
    }
  }

  if (isLoading || !user) {
    return <div className="min-h-[60vh] flex items-center justify-center text-base text-muted-foreground">{t('adminContent.loading')}</div>
  }

  return (
    <div className="space-y-6 max-w-full">
      {/* Header */}
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">{t('admin.console')}</p>
        <h1 className="text-3xl font-bold tracking-tight">{t('adminContent.title')}</h1>
        <p className="text-sm text-muted-foreground max-w-2xl">{t('adminContent.description')}</p>
      </div>

      {error && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Controls */}
      <Card className="border border-border/50 bg-gradient-to-br from-background to-background/50 shadow-sm">
        <CardContent className="p-5 space-y-4">
          {/* Search and Filters Row */}
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari konten..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-10 rounded-xl"
              />
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* Status Filter */}
              <div className="relative">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as StatusType)}
                  className="h-10 px-4 pr-10 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/50 appearance-none cursor-pointer"
                >
                  {STATUS_OPTIONS.map(option => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
                <Filter className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>

              {/* Sort */}
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortType)}
                  className="h-10 px-4 pr-10 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/50 appearance-none cursor-pointer"
                >
                  {SORT_OPTIONS.map(option => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
                <ArrowUpDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {TABS.map(tab => {
              const count = getTabCount(tab.id)
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 whitespace-nowrap",
                    "hover:bg-accent/50",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-secondary/50 text-secondary-foreground"
                  )}
                >
                  {tab.label}
                  <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-black/10 dark:bg-white/10">
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Content Cards */}
      <div className="space-y-3">
        {/* Bulk Actions */}
        {selectedIds.size > 0 && (
          <div className="flex items-center justify-between p-4 rounded-2xl border border-primary/50 bg-primary/5">
            <span className="text-sm font-medium">{selectedIds.size} item dipilih</span>
            <Button size="sm" variant="destructive" onClick={() => setSelectedIds(new Set())}>
              Batal Pilih
            </Button>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <ContentCardSkeleton key={i} />
            ))}
          </div>
        ) : filteredContents.length === 0 ? (
          <Card className="border border-border/50 bg-gradient-to-br from-background to-background/50 shadow-sm">
            <CardContent className="p-8">
              <EmptyState />
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {/* Select All */}
            {filteredContents.length > 0 && (
              <div className="flex items-center gap-3 px-2">
                <Checkbox
                  id="select-all"
                  checked={selectedIds.size === filteredContents.length && filteredContents.length > 0}
                  onCheckedChange={handleSelectAll}
                />
                <label
                  htmlFor="select-all"
                  className="text-sm font-medium cursor-pointer select-none"
                >
                  Pilih Semua
                </label>
              </div>
            )}

            {filteredContents.map((item) => {
              const status = item.metadata?.status || 'processing'
              const contentType = item.metadata?.content_type || 'legacy'
              const TypeIcon = getContentTypeIcon(contentType)
              const isSelected = selectedIds.has(item.id)

              return (
                <Card
                  key={item.id}
                  className={cn(
                    "group border border-border/50 bg-gradient-to-br from-background to-background/50 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5",
                    isSelected && "ring-2 ring-primary/50 border-primary/50"
                  )}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      {/* Checkbox */}
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) => handleSelectItem(item.id, checked as boolean)}
                        className="mt-1"
                      />

                      {/* Content Info */}
                      <div className="flex-1 min-w-0">
                        {/* Badges */}
                        <div className="flex items-center gap-2 mb-3 flex-wrap">
                          <Badge
                            variant="outline"
                            className={cn("gap-1.5", getContentTypeColor(contentType))}
                          >
                            <TypeIcon className="h-3 w-3" />
                            {contentType.charAt(0).toUpperCase() + contentType.slice(1)}
                          </Badge>
                          <Badge
                            className={cn("gap-1.5", getStatusColor(status))}
                          >
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                          </Badge>
                        </div>

                        {/* Title */}
                        <h3 className="font-semibold text-base mb-1 truncate">
                          {item.title || t('adminContent.untitled')}
                        </h3>

                        {/* Date and Cost */}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2">
                          <span>{formatDate(item.created_at)}</span>
                          {item.metadata?.coin_cost && (
                            <span className="flex items-center gap-1">
                              <span className="font-medium text-foreground">{item.metadata.coin_cost}</span>
                              <span>koin</span>
                            </span>
                          )}
                        </div>

                        {/* Caption Preview */}
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {item.content || t('adminContent.noContent')}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-9 w-9 rounded-lg hover:bg-accent/50"
                          title="Lihat"
                          onClick={() => handleView(item)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-9 w-9 rounded-lg text-destructive hover:text-destructive hover:bg-destructive/10"
                          title="Hapus"
                          onClick={() => handleDelete(item.id, item.title)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 dark:bg-red-900/20 rounded-full">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <DialogTitle>{t('adminContent.deleteTitle')}</DialogTitle>
            </div>
            <DialogDescription className="pt-2">
              {t('adminContent.deleteConfirm', { title: selectedContentTitle })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
              {t('adminContent.cancel')}
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              {t('adminContent.yesDelete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Content Modal */}
      <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
        <DialogContent className="max-w-3xl w-full p-0 overflow-hidden rounded-2xl gap-0">
          <div className="flex items-center justify-between px-6 py-4 border-b bg-muted/30">
            <div className="flex items-center gap-3">
              <DialogTitle className="text-base font-semibold line-clamp-1 max-w-sm">
                {selectedContent?.title || t('adminContent.untitled')}
              </DialogTitle>
              {selectedContent?.metadata?.status && (
                <Badge
                  variant={selectedContent.metadata.status === 'completed' ? 'default' : selectedContent.metadata.status === 'failed' ? 'destructive' : 'secondary'}
                  className="text-xs gap-1 flex-shrink-0"
                >
                  {selectedContent.metadata.status === 'completed' && <CheckCircle2 className="h-3 w-3" />}
                  {selectedContent.metadata.status === 'failed' && <XCircle className="h-3 w-3" />}
                  {selectedContent.metadata.status === 'processing' && <Loader2 className="h-3 w-3 animate-spin" />}
                  {selectedContent.metadata.status === 'scheduled' && <Clock className="h-3 w-3" />}
                  {selectedContent.metadata.status.charAt(0).toUpperCase() + selectedContent.metadata.status.slice(1)}
                </Badge>
              )}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-0 max-h-[75vh] overflow-y-auto">
            {/* Left: Preview */}
            <div className="bg-black/10 dark:bg-black/40 flex items-center justify-center p-4 min-h-[280px]">
              {selectedContent?.metadata?.image_url ? (
                <img 
                  src={selectedContent.metadata.image_url} 
                  alt={selectedContent.title} 
                  className="rounded-xl object-contain max-h-[420px] w-full shadow-lg" 
                />
              ) : selectedContent?.metadata?.video_url ? (
                <video 
                  src={selectedContent.metadata.video_url} 
                  controls 
                  className="rounded-xl w-full max-h-[420px] shadow-lg object-contain"
                />
              ) : selectedContent?.metadata?.status === 'processing' ? (
                <div className="flex flex-col items-center gap-3 text-muted-foreground">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <p className="text-sm">Memproses...</p>
                </div>
              ) : selectedContent?.metadata?.status === 'failed' ? (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <XCircle className="h-10 w-10 opacity-30" />
                  <p className="text-sm">Gagal</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <FileText className="h-10 w-10 opacity-30" />
                  <p className="text-sm">Tidak ada preview</p>
                </div>
              )}
            </div>

            {/* Right: Info */}
            <div className="flex flex-col p-5 gap-4 overflow-y-auto">
              {/* Information Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-muted/50 px-3 py-2">
                  <p className="text-muted-foreground mb-0.5">Tipe Konten</p>
                  <p className="font-medium capitalize">{selectedContent?.metadata?.content_type || 'Legacy'}</p>
                </div>
                <div className="rounded-lg bg-muted/50 px-3 py-2">
                  <p className="text-muted-foreground mb-0.5">Status</p>
                  <p className="font-medium capitalize">{selectedContent?.metadata?.status || 'Processing'}</p>
                </div>
                {selectedContent?.metadata?.resolution && (
                  <div className="rounded-lg bg-muted/50 px-3 py-2">
                    <p className="text-muted-foreground mb-0.5">Resolusi</p>
                    <p className="font-medium">{selectedContent.metadata.resolution}</p>
                  </div>
                )}
                {selectedContent?.metadata?.width && selectedContent?.metadata?.height && (
                  <div className="rounded-lg bg-muted/50 px-3 py-2">
                    <p className="text-muted-foreground mb-0.5">Dimensi</p>
                    <p className="font-medium">{selectedContent.metadata.width}×{selectedContent.metadata.height}px</p>
                  </div>
                )}
                {selectedContent?.metadata?.aspect_ratio && (
                  <div className="rounded-lg bg-muted/50 px-3 py-2">
                    <p className="text-muted-foreground mb-0.5">Aspect Ratio</p>
                    <p className="font-medium">{selectedContent.metadata.aspect_ratio}</p>
                  </div>
                )}
                {selectedContent?.metadata?.duration && (
                  <div className="rounded-lg bg-muted/50 px-3 py-2">
                    <p className="text-muted-foreground mb-0.5">Durasi</p>
                    <p className="font-medium">{selectedContent.metadata.duration}s</p>
                  </div>
                )}
                {selectedContent?.metadata?.coin_cost && (
                  <div className="rounded-lg bg-muted/50 px-3 py-2">
                    <p className="text-muted-foreground mb-0.5">Biaya Koin</p>
                    <p className="font-medium">{selectedContent.metadata.coin_cost} koin</p>
                  </div>
                )}
                <div className="rounded-lg bg-muted/50 px-3 py-2">
                  <p className="text-muted-foreground mb-0.5">Dibuat</p>
                  <p className="font-medium">{formatDate(selectedContent?.created_at)}</p>
                </div>
                {selectedContent?.updated_at && (
                  <div className="rounded-lg bg-muted/50 px-3 py-2">
                    <p className="text-muted-foreground mb-0.5">Diupdate</p>
                    <p className="font-medium">{formatDate(selectedContent.updated_at)}</p>
                  </div>
                )}
              </div>

              {/* Content/Prompt */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1.5">Prompt / Konten</p>
                <p className="text-sm leading-relaxed bg-muted/40 rounded-lg px-3 py-2 whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
                  {selectedContent?.content || t('adminContent.noContent')}
                </p>
              </div>

              {/* Actions */}
              <div className="mt-auto flex flex-col gap-2">
                {selectedContent?.metadata?.image_url && (
                  <Button size="sm" variant="outline" className="w-full gap-1.5"
                    onClick={() => selectedContent.metadata?.image_url && window.open(selectedContent.metadata.image_url, '_blank')}>
                    <Eye className="h-3.5 w-3.5" /> Buka Gambar
                  </Button>
                )}
                {selectedContent?.metadata?.video_url && (
                  <Button size="sm" variant="outline" className="w-full gap-1.5"
                    onClick={() => selectedContent.metadata?.video_url && window.open(selectedContent.metadata.video_url, '_blank')}>
                    <Eye className="h-3.5 w-3.5" /> Buka Video
                  </Button>
                )}
                <Button size="sm" onClick={() => setShowViewModal(false)}>
                  Tutup
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
