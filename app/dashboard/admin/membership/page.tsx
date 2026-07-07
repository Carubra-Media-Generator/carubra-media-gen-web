"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useLanguage } from "@/contexts/language-context"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import { AlertTriangle } from "lucide-react"

type TransactionStatus = "success" | "paid" | "pending" | "failed" | "expired" | "refunded"

type AdminTransaction = {
  id: string
  userId: string
  packageId: string
  packageName: string
  coins: number
  amount: number
  paymentMethod: string
  status: string
  invoiceId: string
  invoiceUrl: string | null
  paidAt: string | null
  createdAt: string | null
}

type Summary = {
  totalTransactions: number
  totalRevenue: number
  successCount: number
  pendingCount: number
  failedCount: number
}

const statusVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  success: 'default',
  paid:    'default',
  pending: 'secondary',
  failed:  'destructive',
  refunded:'destructive',
  expired: 'outline',
}

const statusLabel: Record<string, string> = {
  success:  'Berhasil',
  paid:     'Berhasil',
  pending:  'Menunggu',
  failed:   'Gagal',
  refunded: 'Refund',
  expired:  'Kedaluwarsa',
}

function formatIDR(amount: number) {
  return `Rp ${Number(amount).toLocaleString('id-ID')}`
}

export default function AdminInvoicesPage() {
  const router = useRouter()
  const [transactions, setTransactions] = useState<AdminTransaction[]>([])
  const [filtered, setFiltered] = useState<AdminTransaction[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [showErrorModal, setShowErrorModal] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [exporting, setExporting] = useState(false)

  // Filters
  const [statusFilter, setStatusFilter] = useState('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [search, setSearch] = useState('')

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('carubra-token')
      const res = await fetch('/api/admin/transactions', {
        credentials: 'include',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setTransactions(data.transactions ?? [])
      // Tambah sementara di fetchData setelah setTransactions
      console.log(data.transactions.map((tx: AdminTransaction) => ({ id: tx.invoiceId, url: tx.invoiceUrl })))
      setSummary(data.summary ?? null)
    } catch (err) {
      console.error('[AdminInvoicesPage]', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Filter in-memory
  useEffect(() => {
    let result = [...transactions]

    if (statusFilter !== 'all') {
      result = result.filter(tx => tx.status === statusFilter || (statusFilter === 'success' && tx.status === 'paid'))
    }
    if (startDate) {
      result = result.filter(tx => tx.createdAt && new Date(tx.createdAt) >= new Date(startDate))
    }
    if (endDate) {
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      result = result.filter(tx => tx.createdAt && new Date(tx.createdAt) <= end)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(tx =>
        tx.invoiceId.toLowerCase().includes(q) ||
        tx.userId.toLowerCase().includes(q) ||
        tx.packageName.toLowerCase().includes(q)
      )
    }

    setFiltered(result)
  }, [transactions, statusFilter, startDate, endDate, search])

  const { t } = useLanguage()

  const handleExportCsv = async () => {
    try {
      setExporting(true)
      const headers = [t('admin.exportInvoiceId'), t('admin.exportUserId'), t('admin.exportPackage'), t('admin.exportToken'), t('admin.exportAmount'), t('admin.exportMethod'), t('admin.exportStatus'), t('admin.exportCreatedAt'), t('admin.exportPaidAt')]
      const rows = filtered.map(tx => [
        tx.invoiceId,
        tx.userId,
        tx.packageName,
        tx.coins,
        tx.amount,
        tx.paymentMethod,
        tx.status,
        tx.createdAt ? new Date(tx.createdAt).toLocaleString('id-ID') : '-',
        tx.paidAt ? new Date(tx.paidAt).toLocaleString('id-ID') : '-',
      ])
      const csv = [
        headers.join(','),
        ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')),
      ].join('\n')

      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `carubra-transaksi-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  // Summary dari filtered
  const filteredSummary = {
    total: filtered.length,
    revenue: filtered.filter(tx => tx.status === 'success' || tx.status === 'paid').reduce((s, tx) => s + tx.amount, 0),
    success: filtered.filter(tx => tx.status === 'success' || tx.status === 'paid').length,
    pending: filtered.filter(tx => tx.status === 'pending').length,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t('admin.invoiceTransactionsTitle')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('admin.invoiceTransactionsDescription')}</p>
        </div>
        <Button onClick={handleExportCsv} disabled={exporting || filtered.length === 0} variant="outline" size="sm">
          {exporting ? t('admin.exporting') : `${t('admin.exportCsv')} (${filtered.length})`}
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4 space-y-1">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">{t('admin.revenue')}</p>
          <p className="text-xl font-bold text-emerald-700">{formatIDR(filteredSummary.revenue)}</p>
          <p className="text-xs text-muted-foreground">{filteredSummary.success} {t('admin.successful')}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 space-y-1">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">{t('admin.displayed')}</p>
          <p className="text-xl font-bold">{filteredSummary.total}</p>
          <p className="text-xs text-muted-foreground">{t('admin.ofTotal', { count: transactions.length })}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 space-y-1">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">{t('admin.waiting')}</p>
          <p className="text-xl font-bold text-amber-600">{filteredSummary.pending}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 space-y-1">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">{t('admin.failed')}</p>
          <p className="text-xl font-bold text-destructive">
            {filtered.filter(tx => tx.status === 'failed' || tx.status === 'refunded').length}
          </p>
        </CardContent></Card>
      </div>

      {/* Filters */}
      <Card><CardContent className="pt-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('admin.search')}</label>
            <input
              type="text"
              placeholder={t('admin.searchPlaceholder')}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-9 w-56 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('admin.status')}</label>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">{t('admin.statusAll')}</option>
              <option value="success">{t('admin.statusSuccess')}</option>
              <option value="pending">{t('admin.statusPending')}</option>
              <option value="failed">{t('admin.statusFailed')}</option>
              <option value="expired">{t('admin.statusExpired')}</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('admin.dateFrom')}</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('admin.dateTo')}</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          {(statusFilter !== 'all' || startDate || endDate || search) && (
            <Button size="sm" variant="ghost" onClick={() => { setStatusFilter('all'); setStartDate(''); setEndDate(''); setSearch('') }}>
              {t('admin.reset')}
            </Button>
          )}
        </div>
      </CardContent></Card>

      {/* Transaction list */}
      {loading ? (
        <Card className="p-8 text-center">
          <p className="text-sm text-muted-foreground">Memuat transaksi…</p>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center border-dashed">
          <p className="font-semibold">Tidak ada transaksi</p>
          <p className="text-sm text-muted-foreground mt-1">Coba ubah filter.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(tx => (
            <Card key={tx.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="py-4">
                <div className="grid grid-cols-[1fr_auto] gap-4 items-start">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={statusVariant[tx.status] ?? 'outline'}>
                        {statusLabel[tx.status] ?? tx.status}
                      </Badge>
                      <span className="font-mono text-xs text-muted-foreground">{tx.invoiceId}</span>
                      {tx.createdAt && (
                        <span className="text-xs text-muted-foreground">
                          · {new Date(tx.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-1 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Paket</p>
                        <p className="font-medium">{tx.packageName}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Token</p>
                        <p className="font-medium">{tx.coins}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Amount</p>
                        <p className="font-semibold">{formatIDR(tx.amount)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">User ID</p>
                        <p className="font-mono text-xs truncate max-w-[120px]">{tx.userId}</p>
                      </div>
                    </div>
                    {tx.paidAt && (
                      <p className="text-xs text-muted-foreground">
                        Dibayar: {new Date(tx.paidAt).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {(tx.status === "pending" || tx.status === "success" || tx.status === "paid" || tx.status === "expired") && (
                      <Button size="sm" variant="outline" className="text-xs" onClick={async () => {
                        try {
                          const token = localStorage.getItem('carubra-token')
                          const res = await fetch(`/api/payments/resolve-invoice?orderId=${tx.invoiceId}`, {
                            headers: { Authorization: `Bearer ${token}` },
                          })
                          const data = await res.json()
                          if (data.status === "pending" && data.invoiceUrl) {
                            window.open(data.invoiceUrl, "_blank")
                          } else if (data.status === "success") {
                            setErrorMessage("Pembayaran sudah selesai.")
                            setShowErrorModal(true)
                          } else {
                            setErrorMessage(data.message ?? "Invoice tidak dapat dibuka.")
                            setShowErrorModal(true)
                          }
                        } catch {
                          setErrorMessage("Gagal membuka invoice.")
                          setShowErrorModal(true)
                        }
                      }}>
                        Buka Invoice
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {filtered.length > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          Menampilkan {filtered.length} transaksi
        </p>
      )}

      {/* Error Modal */}
      <Dialog open={showErrorModal} onOpenChange={setShowErrorModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-full">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <DialogTitle>Peringatan</DialogTitle>
            </div>
            <DialogDescription className="pt-2">
              {errorMessage}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setShowErrorModal(false)}>
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}