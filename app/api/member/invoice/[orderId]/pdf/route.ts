import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/middleware/auth'
import { findOne } from '@/lib/supabase'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId: rawOrderId } = await params
  const user = getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const orderId = rawOrderId

    const transaction = await findOne('transactions', { invoice_number: orderId })
    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    const requester = await findOne('users', { id: user.id })
    const isAdmin = requester?.role?.toLowerCase() === 'admin'
    if (transaction.user_id !== user.id && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const userData = await findOne('users', { id: transaction.user_id })
    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const invoiceNumber = transaction.invoice_number ?? `INV-${orderId}`
    const paidDate = transaction.paid_at
      ? new Date(transaction.paid_at).toLocaleDateString('id-ID', {
          day: '2-digit', month: 'long', year: 'numeric',
          hour: '2-digit', minute: '2-digit',
        })
      : '-'
    const createdDate = new Date(transaction.created_at).toLocaleDateString('id-ID', {
      day: '2-digit', month: 'long', year: 'numeric',
    })

    const statusLabel: Record<string, string> = {
      success: 'LUNAS',
      pending: 'MENUNGGU PEMBAYARAN',
      failed: 'GAGAL',
      expired: 'KEDALUWARSA',
    }
    const statusColor: Record<string, string> = {
      success: '#059669',
      pending: '#d97706',
      failed: '#dc2626',
      expired: '#6b7280',
    }

    // Generate QR code data (simple text-based, no external dependency)
    // Format: carubra:invoice:{orderId}
    const qrData = `carubra:invoice:${orderId}`

    const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice ${invoiceNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      background: #f9fafb;
      color: #111827;
      font-size: 13px;
      line-height: 1.5;
    }
    .page {
      width: 794px;
      min-height: 1123px;
      background: #fff;
      margin: 0 auto;
      padding: 56px 64px;
      position: relative;
    }

    /* Header */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 32px;
      border-bottom: 2px solid #d1fae5;
    }
    .brand { display: flex; flex-direction: column; gap: 4px; }
    .brand-name {
      font-size: 28px;
      font-weight: 800;
      color: #064e3b;
      letter-spacing: -0.5px;
    }
    .brand-tagline { font-size: 11px; color: #6b7280; letter-spacing: 0.05em; }
    .invoice-badge {
      text-align: right;
    }
    .invoice-title {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.2em;
      color: #6b7280;
      text-transform: uppercase;
      margin-bottom: 6px;
    }
    .invoice-number {
      font-size: 22px;
      font-weight: 700;
      color: #064e3b;
    }
    .status-badge {
      display: inline-block;
      margin-top: 8px;
      padding: 4px 12px;
      border-radius: 100px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      background: ${statusColor[transaction.status] ?? '#6b7280'}22;
      color: ${statusColor[transaction.status] ?? '#6b7280'};
      border: 1px solid ${statusColor[transaction.status] ?? '#6b7280'}44;
    }

    /* Meta grid */
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 32px;
      margin-top: 36px;
    }
    .meta-section { display: flex; flex-direction: column; gap: 16px; }
    .meta-label {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: #9ca3af;
      margin-bottom: 2px;
    }
    .meta-value {
      font-size: 13px;
      font-weight: 600;
      color: #111827;
    }
    .meta-sub {
      font-size: 12px;
      color: #6b7280;
      margin-top: 1px;
    }

    /* Divider */
    .divider {
      height: 1px;
      background: #f3f4f6;
      margin: 32px 0;
    }

    /* Items table */
    .table-header {
      display: grid;
      grid-template-columns: 1fr 120px 120px;
      padding: 10px 16px;
      background: #f0fdf4;
      border-radius: 8px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: #6b7280;
    }
    .table-row {
      display: grid;
      grid-template-columns: 1fr 120px 120px;
      padding: 16px 16px;
      border-bottom: 1px solid #f3f4f6;
      align-items: center;
    }
    .item-name { font-weight: 600; color: #111827; font-size: 14px; }
    .item-sub { font-size: 11px; color: #6b7280; margin-top: 2px; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }

    /* Total */
    .total-section {
      display: flex;
      justify-content: flex-end;
      margin-top: 24px;
    }
    .total-box {
      background: #064e3b;
      color: white;
      border-radius: 12px;
      padding: 20px 28px;
      min-width: 240px;
    }
    .total-label {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: #6ee7b7;
      margin-bottom: 6px;
    }
    .total-amount {
      font-size: 28px;
      font-weight: 800;
      letter-spacing: -0.5px;
    }
    .total-note {
      font-size: 11px;
      color: #6ee7b7;
      margin-top: 4px;
    }

    /* Payment info */
    .payment-info {
      margin-top: 32px;
      background: #f9fafb;
      border-radius: 12px;
      padding: 20px 24px;
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 20px;
    }
    .pay-label {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: #9ca3af;
      margin-bottom: 4px;
    }
    .pay-value {
      font-size: 13px;
      font-weight: 600;
      color: #111827;
    }

    /* QR code area */
    .qr-section {
      display: flex;
      align-items: center;
      gap: 20px;
      margin-top: 32px;
      padding: 20px 24px;
      border: 1.5px dashed #d1fae5;
      border-radius: 12px;
    }
    .qr-placeholder {
      width: 80px;
      height: 80px;
      background: #f0fdf4;
      border: 2px solid #6ee7b7;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      font-size: 8px;
      color: #059669;
      font-weight: 700;
      text-align: center;
      padding: 6px;
    }
    .qr-text { flex: 1; }
    .qr-title {
      font-size: 12px;
      font-weight: 700;
      color: #064e3b;
      margin-bottom: 4px;
    }
    .qr-sub { font-size: 11px; color: #6b7280; }
    .qr-code-text {
      font-size: 10px;
      font-family: monospace;
      color: #059669;
      background: #ecfdf5;
      padding: 3px 8px;
      border-radius: 4px;
      display: inline-block;
      margin-top: 6px;
    }

    /* Footer */
    .footer {
      position: absolute;
      bottom: 40px;
      left: 64px;
      right: 64px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 16px;
      border-top: 1px solid #f3f4f6;
      font-size: 10px;
      color: #9ca3af;
    }
    .footer-right { text-align: right; }
  </style>
</head>
<body>
  <div class="page">

    <!-- Header -->
    <div class="header">
      <div class="brand">
        <div class="brand-name">Carubra</div>
        <div class="brand-tagline">SOCIAL MEDIA MANAGEMENT PLATFORM</div>
        <div style="font-size:11px;color:#6b7280;margin-top:4px;">support@carubra.id · carubra.id</div>
      </div>
      <div class="invoice-badge">
        <div class="invoice-title">Invoice</div>
        <div class="invoice-number">${invoiceNumber}</div>
        <div class="status-badge">${statusLabel[transaction.status] ?? transaction.status}</div>
      </div>
    </div>

    <!-- Meta info -->
    <div class="meta-grid">
      <div class="meta-section">
        <div>
          <div class="meta-label">Ditagihkan Kepada</div>
          <div class="meta-value">${userData.name ?? '-'}</div>
          <div class="meta-sub">${userData.email}</div>
        </div>
      </div>
      <div class="meta-section">
        <div>
          <div class="meta-label">Tanggal Invoice</div>
          <div class="meta-value">${createdDate}</div>
        </div>
        <div>
          <div class="meta-label">Order ID</div>
          <div class="meta-value" style="font-family:monospace;font-size:12px;">${transaction.order_id}</div>
        </div>
      </div>
    </div>

    <div class="divider"></div>

    <!-- Items -->
    <div class="table-header">
      <div>Deskripsi</div>
      <div class="text-center">Jumlah</div>
      <div class="text-right">Total</div>
    </div>
    <div class="table-row">
      <div>
        <div class="item-name">Paket Token — ${transaction.title}</div>
        <div class="item-sub">Token digital untuk platform Carubra</div>
      </div>
      <div class="text-center">
        <div style="font-weight:600;">${transaction.coins} TOKEN</div>
      </div>
      <div class="text-right">
        <div style="font-weight:700;font-size:15px;">${transaction.price_label}</div>
      </div>
    </div>

    <!-- Total -->
    <div class="total-section">
      <div class="total-box">
        <div class="total-label">Total Pembayaran</div>
        <div class="total-amount">${transaction.price_label}</div>
        <div class="total-note">${transaction.coins} token dikreditkan ke akun</div>
      </div>
    </div>

    <!-- Payment info -->
    <div class="payment-info">
      <div>
        <div class="pay-label">Metode Pembayaran</div>
        <div class="pay-value">Xendit</div>
      </div>
      <div>
        <div class="pay-label">Tanggal Bayar</div>
        <div class="pay-value">${paidDate}</div>
      </div>
      <div>
        <div class="pay-label">Status</div>
        <div class="pay-value" style="color:${statusColor[transaction.status] ?? '#6b7280'}">
          ${statusLabel[transaction.status] ?? transaction.status}
        </div>
      </div>
    </div>

    <!-- QR Section -->
    <div class="qr-section">
      <div class="qr-placeholder">CARUBRA<br/>INVOICE<br/>QR</div>
      <div class="qr-text">
        <div class="qr-title">Verifikasi Invoice</div>
        <div class="qr-sub">Scan QR code ini untuk memverifikasi keaslian invoice, atau gunakan kode berikut:</div>
        <div class="qr-code-text">${qrData}</div>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <div>
        <div>© 2025 Carubra · PT Utero Kreatif Indonesia</div>
        <div>Dokumen ini dibuat secara otomatis dan sah tanpa tanda tangan.</div>
      </div>
      <div class="footer-right">
        <div>${invoiceNumber}</div>
        <div>Dicetak: ${new Date().toLocaleDateString('id-ID')}</div>
      </div>
    </div>

  </div>
</body>
</html>`

    // Return HTML as PDF using puppeteer
    // Jika puppeteer tidak tersedia, fallback ke HTML response dengan header print
    try {
      const puppeteer = await import('puppeteer')
      const browser = await puppeteer.default.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      })
      const page = await browser.newPage()
      await page.setContent(html, { waitUntil: 'domcontentloaded' })
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' },
      })
      await browser.close()

      return new NextResponse(pdfBuffer as any, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${invoiceNumber}.pdf"`,
          'Cache-Control': 'private, no-cache',
        },
      })
    } catch {
      // Fallback: return HTML jika puppeteer tidak available
      return new NextResponse(html, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Disposition': `inline; filename="${invoiceNumber}.html"`,
        },
      })
    }
  } catch (error: any) {
    console.error('[GET /api/member/invoice/:orderId/pdf]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}