"use client"

import { useEffect, useState } from "react"
import { FileText, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useAuth } from "@/contexts/auth-context"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"

type GeneratedContent = {
  id: string
  title: string
  content: string
  created_at?: string
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

export default function AdminContentPage() {
  const { user, isLoading } = useAuth()
  const [contents, setContents] = useState<GeneratedContent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Modal states
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedContentId, setSelectedContentId] = useState<string | null>(null)
  const [selectedContentTitle, setSelectedContentTitle] = useState("")

  useEffect(() => {
    if (!isLoading) {
      loadContents()
    }
  }, [isLoading])

  const loadContents = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch<{ contents: GeneratedContent[] }>("/api/admin/contents")
      setContents(data.contents)
    } catch (err: any) {
      setError(err.message ?? "Tidak dapat memuat konten")
    } finally {
      setLoading(false)
    }
  }

  if (isLoading || !user) {
    return <div className="min-h-[60vh] flex items-center justify-center text-base text-muted-foreground">Memuat konten...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-[0.24em] text-muted-foreground">Admin Console</p>
        <h1 className="text-3xl font-bold">Manajemen Konten</h1>
        <p className="mt-2 text-muted-foreground max-w-2xl">Lihat konten yang dihasilkan dan kelola riwayatnya di sini.</p>
      </div>

      {error && (
        <div className="rounded-3xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card className="border border-border bg-background">
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <FileText className="h-6 w-6 text-sky-600" />
            <div>
              <p className="text-sm font-semibold">Konten Tersimpan</p>
              <p className="text-xs text-muted-foreground">Ringkasan konten terbaru sekaligus kontrol penghapusan.</p>
            </div>
          </div>

          <div className="space-y-3">
            {contents.slice(0, 8).map((item) => (
              <div key={item.id} className="rounded-3xl border border-border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold">{item.title || "(Tanpa judul)"}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(item.created_at)}</p>
                    <p className="mt-2 text-sm text-muted-foreground line-clamp-3">{item.content ?? "Tidak ada konten."}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={async () => {
                      setSelectedContentId(item.id)
                      setSelectedContentTitle(item.title || 'tanpa judul')
                      setShowDeleteModal(true)
                    }}
                  >
                    Hapus
                  </Button>
                </div>
              </div>
            ))}
            {contents.length === 0 && (
              <div className="rounded-3xl border border-border bg-slate-50 p-4 text-sm text-muted-foreground">
                Belum ada konten yang tersedia untuk ditampilkan.
              </div>
            )}
          </div>

          <Button onClick={loadContents} disabled={loading}>
            {loading ? "Memuat..." : "Muat Ulang Konten"}
          </Button>
        </CardContent>
      </Card>

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-full">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <DialogTitle>Hapus Konten</DialogTitle>
            </div>
            <DialogDescription className="pt-2">
              Hapus konten "{selectedContentTitle}" secara permanen?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
              Batal
            </Button>
            <Button variant="destructive" onClick={async () => {
              if (!selectedContentId) return
              try {
                await apiFetch(`/api/admin/contents/${selectedContentId}`, { method: 'DELETE' })
                await loadContents()
                setShowDeleteModal(false)
              } catch (err: any) {
                setError(err.message)
              }
            }}>
              Ya, Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
