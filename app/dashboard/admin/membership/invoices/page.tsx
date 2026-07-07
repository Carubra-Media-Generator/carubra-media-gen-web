"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useLanguage } from "@/contexts/language-context"

type TransactionStatus = "success" | "pending" | "failed" | "expired"

type AdminTransaction = {
  id: string
  order_id: string
  user_id: string
  userName: string
  userEmail: string
  package_id: string
  title: string
  coins: number
  price_label: string
  amount: number
  status: TransactionStatus
  invoice_url?: string
  paid_at?: string
  created_at: string
}

type Summary = {
  totalRevenue: number
  totalTransactions: number
  successCount: number
  pendingCount: number
  failedCount: number
  expiredCount: number
  totalTokensSold: number
}

const statusConfig: Record<TransactionStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  success: { label: 'Berhasil', variant: 'default' },
  pending: { label: 'Menunggu', variant: 'secondary' },
  failed: { label: 'Gagal', variant: 'destructive' },
  expired: { label: 'Kedaluwarsa', variant: 'outline' },
}

function formatIDR(amount: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount)
}

export default function AdminInvoicesPage() {
  const [transactions, setTransactions] = useState<AdminTransaction[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const buildQuery = useCallback(() => {
    const params = new URLSearchParams()
    if (statusFilter !== 'all') params.set('status', statusFilter)
    if (startDate) params.set('startDate', startDate)
    if (endDate) params.set('endDate', endDate)
    return params.toString()
  }, [statusFilter, startDate, endDate])

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('carubra-token')
      const qs = buildQuery()
      const res = await fetch(`/api/admin/invoices${qs ? `?${qs}` : ''}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setTransactions(data.transactions)
      setSummary(data.summary)
    } catch (err) {
      console.error('[AdminInvoicesPage]', err)
    } finally {
      setLoading(false)
    }
  }, [buildQuery])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const { t } = useLanguage()

  const handleExportCsv = async () => {
    try {
      setExporting(true)
      const token = localStorage.getItem('carubra-token')
      const qs = buildQuery()
      const res = await fetch(`/api/admin/invoices?export=csv${qs ? `&${qs}` : ''}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `carubra-transactions-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('[handleExportCsv]', err)
    } finally {
      setExporting(false)
    }
  }

  const handleViewInvoice = (orderId: string) => {
    window.open(`/dashboard/member/invoice/${orderId}`, '_blank')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('admin.invoiceTransactionsTitle')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t('admin.invoiceTransactionsDescription')}</p>
        </div>
        <Button
          onClick={handleExportCsv}
          disabled={exporting}
          variant="outline"
          size="sm"
        >
          {exporting ? t('admin.exporting') : t('admin.exportCsv')}
        </Button>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="space-y-1 pt-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{t('admin.revenue')}</p>
              <p className="text-2xl font-bold text-emerald-700">{formatIDR(summary.totalRevenue)}</p>
              <p className="text-xs text-muted-foreground">{summary.successCount} {t('admin.successful')}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-1 pt-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{t('admin.tokensSold')}</p>
              <p className="text-2xl font-bold text-foreground">{summary.totalTokensSold.toLocaleString('id-ID')}</p>
              <p className="text-xs text-muted-foreground">{t('admin.ofTotal', { count: summary.totalTransactions })}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-1 pt-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{t('admin.waiting')}</p>
              <p className="text-2xl font-bold text-amber-600">{summary.pendingCount}</p>
              <p className="text-xs text-muted-foreground">{t('admin.transactionsPending')}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-1 pt-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{t('admin.failedExpired')}</p>
              <p className="text-2xl font-bold text-destructive">{summary.failedCount + summary.expiredCount}</p>
              <p className="text-xs text-muted-foreground">{summary.failedCount} {t('admin.failed')}, {summary.expiredCount} {t('admin.expired')}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('admin.status')}</label>
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
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Dari Tanggal</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sampai Tanggal</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <Button size="sm" onClick={fetchData} disabled={loading}>
              {loading ? t('common.loading') : t('admin.applyFilters')}
            </Button>
            {(statusFilter !== 'all' || startDate || endDate) && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setStatusFilter('all'); setStartDate(''); setEndDate('') }}
              >
                {t('admin.reset')}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Transaction list */}
      {loading ? (
        <Card className="p-8 text-center">
          <p className="text-sm text-muted-foreground">Memuat data transaksi…</p>
        </Card>
      ) : transactions.length === 0 ? (
        <Card className="p-8 text-center border-dashed">
          <p className="font-semibold">Tidak ada transaksi</p>
          <p className="text-sm text-muted-foreground mt-1">Coba ubah filter atau periode yang dipilih.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {/* Table header */}
          <div className="hidden lg:grid grid-cols-[1fr_1.2fr_0.8fr_0.7fr_0.7fr_100px_80px] px-5 py-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            <span>Order ID</span>
            <span>User</span>
            <span>Paket</span>
            <span>Token</span>
            <span>Harga</span>
            <span>Status</span>
            <span className="text-right">Aksi</span>
          </div>

          {transactions.map(tx => (
            <Card key={tx.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="py-4">
                {/* Mobile layout */}
                <div className="lg:hidden space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-xs text-muted-foreground">{tx.order_id}</p>
                      <p className="font-semibold text-sm mt-0.5">{tx.userName}</p>
                      <p className="text-xs text-muted-foreground">{tx.userEmail}</p>
                    </div>
                    <Badge variant={statusConfig[tx.status]?.variant ?? 'outline'}>
                      {statusConfig[tx.status]?.label ?? tx.status}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Paket</p>
                      <p className="font-medium">{tx.title}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Token</p>
                      <p className="font-medium">{tx.coins}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Harga</p>
                      <p className="font-medium">{tx.price_label}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      {new Date(tx.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                    <Button size="sm" variant="outline" onClick={() => handleViewInvoice(tx.order_id)}>
                      Lihat Invoice
                    </Button>
                  </div>
                </div>

                {/* Desktop layout */}
                <div className="hidden lg:grid grid-cols-[1fr_1.2fr_0.8fr_0.7fr_0.7fr_100px_80px] items-center gap-4">
                  <div>
                    <p className="font-mono text-xs text-muted-foreground">{tx.order_id}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(tx.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <div>
                    <p className="font-medium text-sm">{tx.userName}</p>
                    <p className="text-xs text-muted-foreground">{tx.userEmail}</p>
                  </div>
                  <p className="text-sm">{tx.title}</p>
                  <p className="text-sm font-medium">{tx.coins} token</p>
                  <p className="text-sm font-semibold">{tx.price_label}</p>
                  <Badge variant={statusConfig[tx.status]?.variant ?? 'outline'} className="w-fit">
                    {statusConfig[tx.status]?.label ?? tx.status}
                  </Badge>
                  <div className="text-right">
                    <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => handleViewInvoice(tx.order_id)}>
                      Invoice →
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Result count */}
      {!loading && transactions.length > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          Menampilkan {transactions.length} transaksi
        </p>
      )}
    </div>
  )
}