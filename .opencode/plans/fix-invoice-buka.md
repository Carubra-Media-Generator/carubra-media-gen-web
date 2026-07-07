# Fix "Buka Invoice" & Invoice Detail Page

## Problem

1. **"Buka Invoice" on expired invoices** — The button opens the Xendit checkout URL, but Xendit shows "Your invoice has expired" for invoices older than 24h.
2. **"Lihat Invoice" redirects to dashboard** — The page at `/member/invoice/[orderId]` is actually an admin transaction list page (fetches `/api/admin/transactions`), not an invoice detail page. Members get redirected to dashboard.

## Fix 1: Hide "Buka Invoice" for expired/failed

**File:** `app/dashboard/admin/membership/page.tsx:298`

Change this:
```tsx
{tx.invoiceUrl && (
  <Button size="sm" variant="outline" asChild className="text-xs">
    <a href={tx.invoiceUrl} target="_blank" rel="noopener noreferrer">
      Buka Invoice
    </a>
  </Button>
)}
```

To this:
```tsx
{(tx.status === "pending" || tx.status === "success" || tx.status === "paid") && tx.invoiceUrl && (
  <Button size="sm" variant="outline" asChild className="text-xs">
    <a href={tx.invoiceUrl} target="_blank" rel="noopener noreferrer">
      Buka Invoice
    </a>
  </Button>
)}
```

## Fix 2: Add `invoiceUrl` to member invoice API

**File:** `app/api/member/invoice/[orderId]/route.ts`

Add `invoiceUrl` (from `transaction.xendit_payment_url`) to the returned invoice data so the detail page can show a "Bayar Sekarang" link for pending invoices.

After line 52 (`amount: transaction.amount ?? 0`), add:
```tsx
invoiceUrl: transaction.xendit_payment_url ?? null,
```

## Fix 3: Rewrite member invoice detail page

**File:** `app/dashboard/member/invoice/[orderId]/page.tsx` (replace entirely)

Replace the admin transaction list page with a proper member-facing invoice detail page:

```tsx
"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useLanguage } from "@/contexts/language-context"

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  success: { label: "LUNAS", variant: "default" },
  paid: { label: "LUNAS", variant: "default" },
  pending: { label: "Menunggu Pembayaran", variant: "secondary" },
  failed: { label: "GAGAL", variant: "destructive" },
  expired: { label: "KEDALUWARSA", variant: "outline" },
}

export default function MemberInvoiceDetailPage() {
  const { orderId } = useParams<{ orderId: string }>()
  const router = useRouter()
  const { t } = useLanguage()
  const [invoice, setInvoice] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    ;(async () => {
      try {
        const token = localStorage.getItem("carubra-token")
        const res = await fetch(`/api/member/invoice/${orderId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Gagal memuat invoice")
        setInvoice(data.invoice)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    })()
  }, [orderId])

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <p className="text-muted-foreground">Memuat invoice…</p>
    </div>
  )

  if (error || !invoice) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <p className="text-destructive font-semibold">{error || "Invoice tidak ditemukan"}</p>
      <Button variant="outline" onClick={() => router.push("/dashboard/member")}>
        Kembali ke Dashboard
      </Button>
    </div>
  )

  const conf = statusConfig[invoice.status] ?? { label: invoice.status, variant: "outline" as const }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">
      <Button variant="ghost" onClick={() => router.push("/dashboard/member")} className="-ml-2">
        ← Kembali
      </Button>

      <Card>
        <CardContent className="pt-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">Invoice</h1>
              <p className="text-sm text-muted-foreground font-mono mt-1">{invoice.invoiceNumber}</p>
            </div>
            <Badge variant={conf.variant} className="text-sm px-3 py-1">
              {conf.label}
            </Badge>
          </div>

          <div className="border-t pt-4 space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Paket</p>
                <p className="font-medium">{invoice.packageTitle || "-"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Token</p>
                <p className="font-medium">{invoice.coins ?? 0}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Total</p>
                <p className="font-semibold text-lg">
                  Rp {Number(invoice.amount || 0).toLocaleString("id-ID")}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Status</p>
                <p className="font-medium">{conf.label}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Dibuat</p>
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
                  <p className="text-muted-foreground">Dibayar</p>
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
                  Bayar Sekarang
                </a>
              </Button>
            )}
            {invoice.status === "expired" && (
              <p className="text-sm text-muted-foreground">
                Invoice telah kedaluwarsa. Silakan buat invoice baru dari dashboard.
              </p>
            )}
            {(invoice.status === "success" || invoice.status === "paid") && (
              <Button variant="outline" asChild>
                <a href={`/api/member/invoice/${orderId}/pdf`} target="_blank" rel="noopener noreferrer">
                  Download PDF
                </a>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

## Summary of Changes

| File | Change |
|------|--------|
| `admin/membership/page.tsx:298` | Add status check: only show "Buka Invoice" for pending/success/paid |
| `api/member/invoice/[orderId]/route.ts` | Add `invoiceUrl` (xendit_payment_url) to API response |
| `member/invoice/[orderId]/page.tsx` | Replace admin table page with proper member invoice detail page |

After these changes:
- "Buka Invoice" only appears for invoices that can actually be opened (pending/success)
- Expired/failed invoices just show the status badge, no button
- "Lihat Invoice" navigates to a proper invoice detail page that shows the right info
