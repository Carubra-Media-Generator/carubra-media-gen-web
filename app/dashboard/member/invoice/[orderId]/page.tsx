"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useLanguage } from "@/contexts/language-context"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { AlertTriangle, Info } from "lucide-react"

export default function MemberInvoiceDetailPage() {
  const { orderId } = useParams<{ orderId: string }>()
  const router = useRouter()
  const { t } = useLanguage()
  const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    success: { label: t("invoice.lunas"), variant: "default" },
    paid: { label: t("invoice.lunas"), variant: "default" },
    pending: { label: t("invoice.menunggu"), variant: "secondary" },
    failed: { label: t("invoice.gagal"), variant: "destructive" },
    expired: { label: t("invoice.kedaluwarsa"), variant: "outline" },
  }
  const [invoice, setInvoice] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  
  // Modal states
  const [showExpiredModal, setShowExpiredModal] = useState(false)
  const [showErrorModal, setShowErrorModal] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [isRenewing, setIsRenewing] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        const token = localStorage.getItem("carubra-token")
        const res = await fetch(`/api/member/invoice/${orderId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || t("invoice.notFound"))
        setInvoice(data.invoice)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    })()
  }, [orderId])

  const handleRenewInvoice = async () => {
    try {
      setIsRenewing(true)
      const token = localStorage.getItem("carubra-token")
      const res = await fetch(`/api/payments/create-invoice`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ packageId: invoice.packageId }),
      })
      const data = await res.json()
      
      if (!res.ok) {
        throw new Error(data.error || t("invoice.newInvoiceFailed"))
      }
      
      setShowExpiredModal(false)
      window.location.href = data.invoiceUrl
    } catch (err: any) {
      setIsRenewing(false)
      setShowExpiredModal(false)
      setErrorMessage(err.message || t("invoice.newInvoiceFailed"))
      setShowErrorModal(true)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <p className="text-muted-foreground">{t("invoice.loading")}</p>
    </div>
  )

  if (error || !invoice) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <p className="text-destructive font-semibold">{error || t("invoice.notFound")}</p>
      <Button variant="outline" onClick={() => router.push("/dashboard/member")}>
        {t("invoice.backToDashboard")}
      </Button>
    </div>
  )

  const conf = statusConfig[invoice.status] ?? { label: invoice.status, variant: "outline" as const }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">
      <Button variant="ghost" onClick={() => router.push("/dashboard/member")} className="-ml-2">
        {t("invoice.back")}
      </Button>

      <Card>
        <CardContent className="pt-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">{t("invoice.title")}</h1>
              <p className="text-sm text-muted-foreground font-mono mt-1">{invoice.invoiceNumber}</p>
            </div>
            <Badge variant={conf.variant} className="text-sm px-3 py-1">
              {conf.label}
            </Badge>
          </div>

          <div className="border-t pt-4 space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">{t("invoice.package")}</p>
                <p className="font-medium">{invoice.packageTitle || "-"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">{t("invoice.token")}</p>
                <p className="font-medium">{invoice.coins ?? 0}</p>
              </div>
              <div>
                <p className="text-muted-foreground">{t("invoice.total")}</p>
                <p className="font-semibold text-lg">
                  Rp {Number(invoice.amount || 0).toLocaleString("id-ID")}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">{t("invoice.status")}</p>
                <p className="font-medium">{conf.label}</p>
              </div>
              <div>
                <p className="text-muted-foreground">{t("invoice.created")}</p>
                <p className="font-medium">
                  {invoice.createdAt
                    ? new Date(invoice.createdAt).toLocaleDateString("id-ID", {
                        day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
                      })
                    : "-"}
                </p>
              </div>
              {invoice.paidAt && (
                <div>
                  <p className="text-muted-foreground">{t("invoice.paid")}</p>
                  <p className="font-medium">
                    {new Date(invoice.paidAt).toLocaleDateString("id-ID", {
                      day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
                    })}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="border-t pt-4 flex flex-col items-end gap-2">
            {invoice.status === "pending" && invoice.invoiceUrl && (
              <Button asChild>
                <a href={invoice.invoiceUrl} target="_blank" rel="noopener noreferrer">
                  {t("member.payNow")}
                </a>
              </Button>
            )}
            {invoice.status === "expired" && (
              <Button size="sm" variant="outline" onClick={() => setShowExpiredModal(true)}>
                {t("invoice.createNew")}
              </Button>
            )}
            {(invoice.status === "success" || invoice.status === "paid") && (
              <Button variant="outline" asChild>
                <a href={`/api/member/invoice/${orderId}/pdf`} target="_blank" rel="noopener noreferrer">
                  {t("invoice.downloadPdf")}
                </a>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Expired Invoice Modal */}
      <Dialog open={showExpiredModal} onOpenChange={setShowExpiredModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-full">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <DialogTitle>{t("invoice.expiredTitle")}</DialogTitle>
            </div>
            <DialogDescription className="pt-2">
              {t("invoice.expiredDescription")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExpiredModal(false)} disabled={isRenewing}>
              {t("invoice.cancel")}
            </Button>
            <Button onClick={handleRenewInvoice} disabled={isRenewing}>
              {isRenewing ? t("invoice.processing") : t("invoice.createNew")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Error Modal */}
      <Dialog open={showErrorModal} onOpenChange={setShowErrorModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-full">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <DialogTitle>{t("invoice.failedTitle")}</DialogTitle>
            </div>
            <DialogDescription className="pt-2">
              {errorMessage}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setShowErrorModal(false)}>
              {t("member.close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
