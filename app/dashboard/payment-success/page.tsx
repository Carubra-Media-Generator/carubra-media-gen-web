"use client"

import { useEffect, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { CheckCircle2, Coins, ArrowRight, Home, Loader2, PartyPopper } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"
import { useLanguage } from "@/contexts/language-context"

// ── Inner component (perlu useSearchParams → wajib dalam Suspense) ────────────

function PaymentSuccessContent() {
  const { t } = useLanguage()
  const router      = useRouter()
  const searchParams = useSearchParams()
  const { user, updateUser } = useAuth()

  const orderId = searchParams.get("orderId") ?? ""
  const status  = searchParams.get("status")  ?? ""

  const [coinBalance, setCoinBalance] = useState<number | null>(null)
  const [loading, setLoading]         = useState(true)
  const [countdown, setCountdown]     = useState(10)

  // ── Redirect jika bukan dari payment success ──────────────────────────────
  useEffect(() => {
    if (status !== "success") {
      router.replace("/dashboard/member")
    }
  }, [status, router])

  // ── Fetch saldo terbaru setelah Xendit redirect ────────────────────────────
  useEffect(() => {
    if (status !== "success") return

    const token = typeof window !== "undefined" ? localStorage.getItem("carubra-token") : null
    if (!token) return

    // Delay 1.5s agar webhook sempat diproses
    const delay = setTimeout(async () => {
      try {
        const res = await fetch("/api/users/balance", {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const data = await res.json()
          setCoinBalance(data.coins)
        }
      } catch {
        // silent – balance bisa dilihat di halaman member
      } finally {
        setLoading(false)
      }
    }, 1500)

    return () => clearTimeout(delay)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  // ── Auto-redirect countdown ───────────────────────────────────────────────
  useEffect(() => {
    if (loading || status !== "success") return
    const iv = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(iv)
          router.push("/dashboard/member")
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(iv)
  }, [loading, status, router])

  if (status !== "success") return null

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">

        {/* ── Header ── */}
        <div className="text-center space-y-3">
          {/* Animated icon */}
          <div className="flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-emerald-500/20 blur-2xl scale-150 animate-pulse" />
              <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-xl shadow-emerald-500/30">
                <CheckCircle2 className="w-10 h-10 text-white" strokeWidth={2.5} />
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-center gap-2 mb-1">
              <PartyPopper className="w-5 h-5 text-emerald-500" />
              <p className="text-sm font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                {t("paymentSuccess.title")}
              </p>
              <PartyPopper className="w-5 h-5 text-emerald-500 scale-x-[-1]" />
            </div>
            <h1 className="text-3xl font-black text-foreground">{t("paymentSuccess.heading")}</h1>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              {t("paymentSuccess.description")}
            </p>
          </div>
        </div>

        {/* ── Order ID card ── */}
        {orderId && (
          <div className="rounded-2xl border bg-muted/40 px-5 py-4 text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">{t("paymentSuccess.orderId")}</p>
            <p className="text-sm font-mono text-emerald-600 dark:text-emerald-400 break-all">
              {orderId}
            </p>
          </div>
        )}

        {/* ── Coin balance ── */}
        <div className="rounded-2xl border-2 border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-teal-500/5 px-6 py-6 text-center space-y-2">
          {loading ? (
            <div className="flex items-center justify-center gap-2 text-muted-foreground py-2">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
              <span className="text-sm">{t("paymentSuccess.loadingBalance")}</span>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <Coins className="w-4 h-4" />
                <p className="text-xs font-semibold uppercase tracking-widest">{t("paymentSuccess.yourBalance")}</p>
              </div>
              <p className="text-5xl font-black text-foreground tracking-tight">
                {coinBalance !== null ? coinBalance.toLocaleString("id-ID") : "—"}
              </p>
              <p className="text-xs text-muted-foreground font-medium tracking-[0.2em]">{t("header.coins")}</p>
            </>
          )}
        </div>

        {/* ── CTA Buttons ── */}
        <div className="grid grid-cols-2 gap-3">
          <Link href="/dashboard">
            <Button
              variant="outline"
              className="w-full rounded-xl gap-2 hover:bg-muted/60 transition-all"
            >
              <Home className="w-4 h-4" />
              {t("paymentSuccess.dashboard")}
            </Button>
          </Link>
          <Link href="/dashboard/member">
            <Button
              className="w-full rounded-xl gap-2 bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-lg shadow-emerald-500/20"
            >
              {t("paymentSuccess.viewTokens")}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>

        {/* ── Auto redirect ── */}
        {!loading && (
          <p className="text-center text-xs text-muted-foreground">
            {t("paymentSuccess.autoRedirect", { seconds: countdown })}
          </p>
        )}
      </div>
    </div>
  )
}

// ── Page wrapper dengan Suspense ─────────────────────────────────────────────

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-[70vh] items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    }>
      <PaymentSuccessContent />
    </Suspense>
  )
}
