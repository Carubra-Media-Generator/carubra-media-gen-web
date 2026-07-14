"use client"

import { useEffect, useState } from "react"
import { DollarSign, Plus, Pencil, Trash2, X, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useAuth } from "@/contexts/auth-context"
import { useLanguage } from "@/contexts/language-context"

// ─── Types ────────────────────────────────────────────────────────────────────

type PackageOption = {
  id: string
  name: string
  coins: number
  price: string
  description?: string | null
}

type ModalMode = "create" | "edit" | "delete"

type FormState = {
  name: string
  coins: string
  price: string
  description: string
}

const EMPTY_FORM: FormState = { name: "", coins: "", price: "", description: "" }

// ─── API helper ───────────────────────────────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api"

function getApiUrl(path: string) {
  if (path.startsWith("http://") || path.startsWith("https://")) return path
  if (path.startsWith("/api")) return path
  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("carubra-token") : null
  const res = await fetch(getApiUrl(path), {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  })
  const payload = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((payload as any).error ?? `HTTP ${res.status}`)
  return payload as T
}

// ─── Modal Component ──────────────────────────────────────────────────────────

function PackageModal({
  mode,
  pkg,
  onClose,
  onSuccess,
}: {
  mode: ModalMode
  pkg: PackageOption | null
  onClose: () => void
  onSuccess: () => void
}) {
  const { t } = useLanguage()
  const [form, setForm] = useState<FormState>(
    pkg
      ? { name: pkg.name, coins: String(pkg.coins), price: pkg.price, description: pkg.description ?? "" }
      : EMPTY_FORM
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  const handleSubmit = async () => {
    setError(null)

    if (mode === "delete") {
      try {
        setSubmitting(true)
        await apiFetch(`/api/admin/packages/${pkg!.id}`, { method: "DELETE" })
        onSuccess()
      } catch (err: any) {
        setError(err.message)
      } finally {
        setSubmitting(false)
      }
      return
    }

    // validate
    if (!form.name.trim()) return setError(t('adminPricing.nameRequired'))
    const coins = Number(form.coins)
    if (!form.coins || isNaN(coins) || coins <= 0) return setError(t('adminPricing.coinsRequired'))
    if (!form.price.trim()) return setError(t('adminPricing.priceRequired'))

    try {
      setSubmitting(true)
      if (mode === "create") {
        await apiFetch("/api/admin/packages", {
          method: "POST",
          body: JSON.stringify({ name: form.name, coins, price: form.price, description: form.description || null }),
        })
      } else {
        await apiFetch(`/api/admin/packages/${pkg!.id}`, {
          method: "PATCH",
          body: JSON.stringify({ name: form.name, coins, price: form.price, description: form.description || null }),
        })
      }
      onSuccess()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const isDelete = mode === "delete"

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-3xl bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: "modalIn 0.25s cubic-bezier(0.34,1.56,0.64,1) both" }}
      >
        {/* top accent */}
        <div
          className={`h-1.5 w-full ${
            isDelete ? "bg-destructive" : "bg-gradient-to-r from-amber-400 to-amber-600"
          }`}
        />

        <div className="p-6 space-y-5">
          {/* header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-medium">
                {isDelete ? t('adminPricing.confirmLabel') : mode === "create" ? t('adminPricing.newPackage') : t('adminPricing.editPackage')}
              </p>
              <h2 className="text-xl font-bold mt-0.5">
                {isDelete
                  ? t('adminPricing.deleteTitle')
                  : mode === "create"
                  ? t('adminPricing.addTokenPackage')
                  : `${t('adminPricing.editPackage')} "${pkg?.name}"`}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="rounded-xl p-1.5 text-muted-foreground hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* delete confirm */}
          {isDelete ? (
            <p className="text-sm text-muted-foreground">
              {t('adminPricing.deleteConfirm', { name: pkg?.name, coins: pkg?.coins, price: pkg?.price })}
            </p>
          ) : (
            /* form */
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t('adminPricing.packageName')}
                  </label>
                  <input
                    type="text"
                    placeholder={t('adminPricing.packageNamePlaceholder')}
                    value={form.name}
                    onChange={set("name")}
                    className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t('adminPricing.tokenAmount')}
                  </label>
                  <input
                    type="number"
                    placeholder={t('adminPricing.tokenPlaceholder')}
                    value={form.coins}
                    onChange={set("coins")}
                    min={1}
                    className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t('adminPricing.price')}
                  </label>
                  <input
                    type="text"
                    placeholder={t('adminPricing.pricePlaceholder')}
                    value={form.price}
                    onChange={set("price")}
                    className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t('adminPricing.description')} <span className="normal-case font-normal">{t('adminPricing.descriptionOptional')}</span>
                  </label>
                  <textarea
                    placeholder={t('adminPricing.descriptionPlaceholder')}
                    value={form.description}
                    onChange={set("description")}
                    rows={2}
                    className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* error */}
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-xl px-3 py-2">
              {error}
            </p>
          )}

          {/* actions */}
          <div className="flex gap-3 pt-1">
            <Button
              className={`flex-1 rounded-xl ${
                isDelete ? "bg-destructive hover:bg-destructive/90 text-white" : ""
              }`}
              variant={isDelete ? "destructive" : "default"}
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {isDelete ? t('adminPricing.deleting') : mode === "create" ? t('adminPricing.saving') : t('adminPricing.updating')}
                </span>
              ) : isDelete ? (
                t('adminPricing.yesDelete')
              ) : mode === "create" ? (
                t('adminPricing.savePackage')
              ) : (
                t('adminPricing.saveChanges')
              )}
            </Button>
            <Button variant="ghost" className="rounded-xl" onClick={onClose} disabled={submitting}>
{t('admin.close')}
            </Button>
          </div>
        </div>

        <style>{`
          @keyframes modalIn {
            from { opacity: 0; transform: scale(0.9) translateY(12px); }
            to   { opacity: 1; transform: scale(1) translateY(0); }
          }
        `}</style>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminPricingPage() {
  const { user, isLoading } = useAuth()
  const { t } = useLanguage()
  const [packages, setPackages] = useState<PackageOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // modal state
  const [modalMode, setModalMode] = useState<ModalMode | null>(null)
  const [selectedPkg, setSelectedPkg] = useState<PackageOption | null>(null)

  useEffect(() => {
    if (!isLoading) loadPackages()
  }, [isLoading])

  const loadPackages = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch<{ packages: PackageOption[] }>("/api/admin/packages")
      setPackages(data.packages ?? [])
    } catch (err: any) {
      setError(err.message ?? t('adminPricing.loadError'))
    } finally {
      setLoading(false)
    }
  }

  const openCreate = () => { setSelectedPkg(null); setModalMode("create") }
  const openEdit   = (pkg: PackageOption) => { setSelectedPkg(pkg); setModalMode("edit") }
  const openDelete = (pkg: PackageOption) => { setSelectedPkg(pkg); setModalMode("delete") }
  const closeModal = () => { setModalMode(null); setSelectedPkg(null) }

  const handleSuccess = () => {
    closeModal()
    loadPackages()
  }

  if (isLoading || !user) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-base text-muted-foreground">
        {t('adminPricing.loading')}
      </div>
    )
  }

  return (
    <>
      {/* ── Modal ── */}
      {modalMode && (
        <PackageModal
          mode={modalMode}
          pkg={selectedPkg}
          onClose={closeModal}
          onSuccess={handleSuccess}
        />
      )}

      <div className="space-y-6">
        {/* Header */}
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-muted-foreground">{t('admin.console')}</p>
          <h1 className="text-3xl font-bold">{t('adminPricing.title')}</h1>
          <p className="mt-2 text-muted-foreground max-w-2xl">
            {t('adminPricing.description')}
          </p>
        </div>

        {error && (
          <div className="rounded-3xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive flex items-center justify-between gap-4">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="font-medium hover:underline">{t('adminPricing.cancel')}</button>
          </div>
        )}

        <Card className="border border-border bg-background">
          <CardContent className="space-y-4">
            {/* toolbar */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <DollarSign className="h-6 w-6 text-amber-500" />
                <div>
                  <p className="text-sm font-semibold">{t('adminPricing.coinPackages')}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('adminPricing.activePackages', { count: packages.length })}
                  </p>
                </div>
              </div>
              <Button onClick={openCreate} disabled={loading}>
                <Plus className="mr-2 h-4 w-4" /> {t('adminPricing.addPackage')}
              </Button>
            </div>

            {/* package grid */}
            {loading ? (
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> {t('adminPricing.loadingPackages')}
              </div>
            ) : packages.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-border bg-slate-50 p-8 text-center space-y-2">
                <p className="font-semibold text-foreground">{t('adminPricing.noPackages')}</p>
                <p className="text-sm text-muted-foreground">
                  {t('adminPricing.noPackagesDesc')}
                </p>
                <Button variant="outline" size="sm" className="mt-2" onClick={openCreate}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> {t('adminPricing.addNow')}
                </Button>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {packages.map((pkg) => (
                  <div
                    key={pkg.id}
                    className="group relative rounded-3xl border border-border p-5 hover:border-amber-300 hover:shadow-sm transition-all"
                  >
                    {/* action buttons — appear on hover */}
                    <div className="absolute top-3 right-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEdit(pkg)}
                        className="rounded-xl p-1.5 bg-white border border-border text-muted-foreground hover:text-foreground hover:border-amber-400 transition-colors shadow-sm"
                        title={t('adminPricing.edit')}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => openDelete(pkg)}
                        className="rounded-xl p-1.5 bg-white border border-border text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors shadow-sm"
                        title={t('adminPricing.delete')}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <p className="text-xs uppercase tracking-[0.18em] text-amber-600 font-medium mb-1">
                      {t('adminPricing.tokens', { coins: pkg.coins })}
                    </p>
                    <p className="font-semibold text-foreground">{pkg.name}</p>
                    <p className="mt-2 text-2xl font-bold">{pkg.price}</p>
                    {pkg.description && (
                      <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                        {pkg.description}
                      </p>
                    )}

                    {/* bottom actions visible always on mobile */}
                    <div className="mt-4 flex gap-2 sm:hidden">
                      <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => openEdit(pkg)}>
                        <Pencil className="mr-1 h-3 w-3" /> {t('adminPricing.edit')}
                      </Button>
                      <Button size="sm" variant="outline" className="text-xs text-destructive hover:text-destructive" onClick={() => openDelete(pkg)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              {t('adminPricing.footerNote')}
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  )
}