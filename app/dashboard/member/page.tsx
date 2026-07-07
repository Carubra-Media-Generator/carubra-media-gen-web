"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useLanguage } from "@/contexts/language-context"
import { useAuth } from "@/contexts/auth-context"

// ─── Types ────────────────────────────────────────────────────────────────────

type PackageOption = {
  id: string
  title: string
  coins: number
  price: string
  unitPrice: string
  audience: string
  note: string
  badge?: string
}

type TransactionStatus = "success" | "pending" | "failed" | "expired"

type Transaction = {
  id: string
  orderId: string
  packageId: string
  title: string
  coins: number
  priceLabel: string
  status: TransactionStatus
  invoiceUrl?: string
  paidAt?: string
  createdAt: string
}

// ─── API helper (bukan hook, boleh di luar komponen) ─────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api"

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("carubra-token") : null
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }
  return res.json()
}

// ─── Component ────────────────────────────────────────────────────────────────

const ADMIN_ROLES = ["Admin", "Developer/Admin"]

export default function MemberPage() {
  const { t } = useLanguage()
  const { user, isLoading } = useAuth()
  const router = useRouter()

  // ── Role guard: admin tidak boleh akses halaman ini ─────────────────────────
  useEffect(() => {
    if (!isLoading && user && ADMIN_ROLES.includes(user.role ?? "")) {
      router.replace("/dashboard/admin")
    }
  }, [user, isLoading, router])

  const [packageOptions, setPackageOptions] = useState<PackageOption[]>([])
  const [loadingPkg, setLoadingPkg] = useState(true)

  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loadingTx, setLoadingTx] = useState(true)
  const [buyingId, setBuyingId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [coinBalance, setCoinBalance] = useState<number | null>(null)
  const [lastTopup, setLastTopup] = useState<string | null>(null)
  const [showWelcomeModal, setShowWelcomeModal] = useState(false)

  // ── Fetch packages ──────────────────────────────────────────────────────────
  useEffect(() => {
    setShowWelcomeModal(true)
  }, [])
  useEffect(() => {
    apiFetch<{ packages: any[] }>("/packages")
      .then((data) => {
        setPackageOptions(
          data.packages.map((pkg) => ({
            id: pkg.id,
            title: `${pkg.coins} TOKEN`,
            coins: pkg.coins,
            price: `Rp ${Number(pkg.price).toLocaleString("id-ID")}`,
            unitPrice: `Rp ${Math.round(pkg.price / pkg.coins).toLocaleString("id-ID")} / token`,
            audience: pkg.tag ?? "",
            note: pkg.description ?? "",
            badge: pkg.tag ?? undefined,
          }))
        )
      })
      .catch(() => {})
      .finally(() => setLoadingPkg(false))
  }, [])

  // ── Fetch transactions ──────────────────────────────────────────────────────
  const fetchTransactions = useCallback(async () => {
    try {
      setLoadingTx(true)
      const data = await apiFetch<{ transactions: Transaction[] }>(
        "/payments/transactions"
      )
      setTransactions(data.transactions)

      const lastSuccess = data.transactions.find((tx) => tx.status === "success")
      if (lastSuccess?.paidAt) {
        setLastTopup(
          new Date(lastSuccess.paidAt).toLocaleDateString("id-ID", {
            day: "2-digit",
            month: "long",
            year: "numeric",
          })
        )
      }
    } catch (err: any) {
      console.error("[fetchTransactions]", err)
    } finally {
      setLoadingTx(false)
    }
  }, [])

  useEffect(() => {
    fetchTransactions()
  }, [fetchTransactions])

  // ── Fetch coin balance ──────────────────────────────────────────────────────
  useEffect(() => {
    apiFetch<{ coins: number }>("/users/balance")
      .then((data) => setCoinBalance(data.coins))
      .catch(() => setCoinBalance(0))
  }, [])

  // ── Handle redirect after payment ──────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    const paymentResult = params.get("payment")
    const orderId = params.get("orderId")

    if (paymentResult && orderId) {
      const clean = window.location.pathname
      window.history.replaceState({}, "", clean)

      if (paymentResult === "success") {
        setTimeout(() => {
          fetchTransactions()
          apiFetch<{ coins: number }>("/users/balance")
            .then((data) => setCoinBalance(data.coins))
            .catch(() => {})
        }, 1500)
      }
    }
  }, [fetchTransactions])

  // ── Buy handler ─────────────────────────────────────────────────────────────
  const handleBuy = async (option: PackageOption) => {
    try {
      setErrorMsg(null)
      setBuyingId(option.id)

      const data = await apiFetch<{ invoiceUrl: string; orderId: string }>(
        "/payments/create-invoice",
        {
          method: "POST",
          body: JSON.stringify({ packageId: option.id }),
        }
      )

      window.location.href = data.invoiceUrl
    } catch (err: any) {
      console.error("[handleBuy]", err)
      setErrorMsg(err.message ?? "Gagal membuat invoice. Coba lagi.")
    } finally {
      setBuyingId(null)
    }
  }

  // ── Open invoice handler ──────────────────────────────────────────────────────
  const handleOpenInvoice = async (orderId: string) => {
    try {
      const res = await fetch(`/api/payments/resolve-invoice?orderId=${orderId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("carubra-token")}`,
        },
      })
      const data = await res.json()

      if (data.status === "pending" && data.invoiceUrl) {
        window.open(data.invoiceUrl, "_blank")
        if (data.renewed) {
          fetchTransactions()
        }
      } else if (data.status === "success") {
        setErrorMsg("Pembayaran sudah selesai.")
        fetchTransactions()
      } else if (data.status === "expired" || data.status === "failed") {
        setErrorMsg(data.message ?? "Invoice tidak dapat digunakan.")
        fetchTransactions()
      } else {
        setErrorMsg(data.message ?? "Gagal membuka invoice.")
      }
    } catch (err: any) {
      console.error("[handleOpenInvoice]", err)
      setErrorMsg(err.message ?? "Gagal membuka invoice.")
    }
  }

  // ── Status helpers ──────────────────────────────────────────────────────────
  const statusLabel: Record<TransactionStatus, string> = {
    success: "Berhasil",
    pending: "Menunggu Pembayaran",
    failed: "Gagal",
    expired: "Kedaluwarsa",
  }

  const statusVariant: Record<
    TransactionStatus,
    "default" | "secondary" | "destructive" | "outline"
  > = {
    success: "default",
    pending: "secondary",
    failed: "destructive",
    expired: "outline",
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  // Jangan render apapun sampai auth selesai / redirect admin terjadi
  if (isLoading || (user && ADMIN_ROLES.includes(user.role ?? ""))) {
    return null
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">{t("member.title")}</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl">{t("member.subtitle")}</p>
      </div>

      {/* ── Welcome Modal ── */}
      {showWelcomeModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
          onClick={() => setShowWelcomeModal(false)}
        >
          <div
            className="relative w-full max-w-md rounded-3xl bg-white shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            style={{ animation: "modalIn 0.3s cubic-bezier(0.34,1.56,0.64,1) both" }}
          >
            {/* top accent */}
            <div className="h-2 w-full bg-gradient-to-r from-emerald-400 to-emerald-600" />

            <div className="p-7 space-y-5">
              {/* icon */}
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-2xl">
                🪙
              </div>

              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.2em] text-emerald-600 font-medium">
                  {t('Paket Token')}
                </p>
                <h2 className="text-2xl font-bold text-gray-900">
                  {t('Paket token untuk semua kebutuhan Anda')}
                </h2>
              </div>

              <p className="text-sm text-gray-500 leading-relaxed">
                {t('Dengan paket token kami, Anda mendapatkan akses instan ke berbagai fitur premium. Token dapat digunakan untuk meningkatkan pengalaman Anda, membuka fitur eksklusif, dan mendapatkan dukungan prioritas. Pilih paket yang sesuai dengan kebutuhan Anda dan nikmati manfaatnya sekarang!')}
              </p>

              <div className="flex items-start gap-3 rounded-2xl bg-emerald-50 border border-emerald-100 px-4 py-3">
                <span className="text-base mt-0.5">🔒</span>
                <p className="text-sm text-emerald-800 leading-relaxed">
                  {t('member.securePayment')} <span className="font-semibold">Xendit</span> — {t('member.paymentMethods')}
                </p>
              </div>

              <div className="flex gap-3 pt-1">
                <Button
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl"
                  onClick={() => {
                    setShowWelcomeModal(false)
                    setTimeout(() => {
                      document.getElementById("packages")?.scrollIntoView({ behavior: "smooth" })
                    }, 100)
                  }}
                >
                  {t('member.viewPackages')}
                </Button>
                <Button
                  variant="ghost"
                  className="rounded-xl text-gray-500"
                  onClick={() => setShowWelcomeModal(false)}
                >
                  {t('member.later')}
                </Button>
              </div>
            </div>

            <style>{`
              @keyframes modalIn {
                from { opacity: 0; transform: scale(0.88) translateY(16px); }
                to   { opacity: 1; transform: scale(1) translateY(0); }
              }
            `}</style>
          </div>
        </div>
      )}

      {/* ── Summary cards ── */}
      <div className="grid gap-4">
        <Card className="bg-emerald-950 text-white shadow-lg">
          <CardContent className="space-y-6">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-emerald-200">
                {t('member.balanceTitle')}
              </p>
              <h2 className="mt-3 text-4xl font-semibold">
                {coinBalance === null ? "— TOKEN" : `${coinBalance} TOKEN`}
              </h2>
              <p className="mt-2 text-sm text-emerald-100">
                {t('member.balanceDescription')}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-emerald-900/80 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-emerald-200">
                  {t('member.statusLabel')}
                </p>
                <p className="mt-2 text-xl font-semibold">
                  {coinBalance !== null && coinBalance > 0
                    ? t('member.active')
                    : t('member.noTokens')}
                </p>
              </div>
              <div className="rounded-2xl bg-emerald-900/80 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-emerald-200">
                  {t('member.lastTopup')}
                </p>
                <p className="mt-2 text-xl font-semibold">{lastTopup ?? '—'}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="secondary"
                className="bg-white text-emerald-950 hover:bg-emerald-100"
                onClick={() =>
                  document
                    .getElementById("packages")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
              >
                Top Up Sekarang
              </Button>
              <Button
                variant="ghost"
                className="text-emerald-100"
                onClick={() =>
                  document
                    .getElementById("transactions")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
              >
                Lihat Riwayat
              </Button>
            </div>
          </CardContent>
        </Card>


      </div>

      {/* ── Error banner ── */}
      {errorMsg && (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 px-5 py-4 text-sm text-destructive flex items-center justify-between gap-4">
          <span>{errorMsg}</span>
          <button
            onClick={() => setErrorMsg(null)}
            className="text-destructive/70 hover:text-destructive font-medium"
          >
            Tutup
          </button>
        </div>
      )}

      {/* ── Packages ── */}
      <section id="packages" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {loadingPkg ? (
          <p className="text-sm text-muted-foreground col-span-3">{t('member.loadingPackages')}</p>
        ) : packageOptions.length === 0 ? (
          <p className="text-sm text-muted-foreground col-span-3">
            {t('member.noPackages')}
          </p>
        ) : (
          packageOptions.map((option) => (
            <Card
              key={option.id}
              className={
                option.badge ? "border-2 border-emerald-500 shadow-sm" : ""
              }
            >
              <CardContent className="space-y-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium uppercase tracking-[0.18em] text-emerald-600">
                      {option.audience}
                    </p>
                    <h3 className="mt-2 text-2xl font-semibold text-foreground">
                      {option.title}
                    </h3>
                  </div>
                  {option.badge && (
                    <Badge variant="secondary">{option.badge}</Badge>
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">{option.note}</p>
                  <p className="text-sm font-medium text-foreground">
                    {option.unitPrice}
                  </p>
                </div>

                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      Harga
                    </p>
                    <p className="text-3xl font-bold text-foreground">
                      {option.price}
                    </p>
                  </div>
                  <Button
                    onClick={() => handleBuy(option)}
                    disabled={buyingId === option.id}
                  >
                    {buyingId === option.id ? (
                      <span className="flex items-center gap-2">
                        <svg
                          className="h-4 w-4 animate-spin"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8v4l3-3-3-3V4a10 10 0 100 10h-4a6 6 0 01-6-6z"
                          />
                        </svg>
                        Memproses…
                      </span>
                    ) : (
                      t("member.buy")
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </section>

      {/* ── Transactions ── */}
      <section id="transactions" className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            {t("member.recentTransactions")}
          </h2>
          <p className="text-muted-foreground mt-1">
            {t("member.transactionDescription")}
          </p>
        </div>

        {loadingTx ? (
          <Card className="border border-dashed border-border p-8 text-center">
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Memuat riwayat transaksi…
              </p>
            </CardContent>
          </Card>
        ) : transactions.length === 0 ? (
          <Card className="rounded-3xl border border-dashed border-border p-8 text-center">
            <CardContent className="space-y-4">
              <p className="text-lg font-semibold text-foreground">
                Belum ada transaksi.
              </p>
              <p className="text-sm text-muted-foreground">
                Riwayat transaksi akan muncul setelah Anda melakukan pembayaran.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {transactions.map((tx) => (
              <Card key={tx.id} className="border border-border">
                <CardContent className="grid gap-4 sm:grid-cols-[1.2fr_auto] items-start">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                      <span>
                        {new Date(tx.createdAt).toLocaleString("id-ID", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                      <span>·</span>
                      <span>Order ID: {tx.orderId}</span>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                          {t('member.packageLabel')}
                        </p>
                        <p className="font-medium">{tx.title}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                          {t('member.tokenLabel')}
                        </p>
                        <p className="font-medium">{tx.coins} token</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                          {t('member.priceLabel')}
                        </p>
                        <p className="font-medium">{tx.priceLabel}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                          {t('member.statusLabel')}
                        </p>
                        <Badge
                          variant={statusVariant[tx.status]}
                          className="text-sm mt-1"
                        >
                          {statusLabel[tx.status]}
                        </Badge>
                      </div>
                    </div>

                    {tx.paidAt && (
                      <p className="text-xs text-muted-foreground">
                        Dibayar:{" "}
                        {new Date(tx.paidAt).toLocaleString("id-ID", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col items-end justify-between gap-3 min-w-[140px]">
                    {tx.status === "pending" && (
                      <Button size="sm" onClick={() => handleOpenInvoice(tx.orderId)}>
                        Bayar Sekarang
                      </Button>
                    )}
                    {tx.status === "expired" && (
                      <div className="text-right space-y-1">
                        <p className="text-xs text-muted-foreground">
                          Invoice kedaluwarsa pada{" "}
                          {tx.createdAt
                            ? new Date(tx.createdAt).toLocaleDateString("id-ID", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })
                            : "tanggal tidak diketahui"}
                          .
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const pkg = packageOptions.find(
                              (p) => p.id === tx.packageId
                            )
                            if (pkg) handleBuy(pkg)
                          }}
                        >
                          Buat Invoice Baru
                        </Button>
                      </div>
                    )}
                    {tx.status === "failed" && (
                      <div className="text-right text-sm text-muted-foreground space-y-1">
                        <p>Hubungi admin:</p>
                        <p className="font-semibold text-foreground">
                          0819-9990-0900
                        </p>
                      </div>
                    )}
                    {tx.status === "success" && (
                      <p className="text-sm text-muted-foreground text-right">
                        Pembayaran selesai ✓
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}