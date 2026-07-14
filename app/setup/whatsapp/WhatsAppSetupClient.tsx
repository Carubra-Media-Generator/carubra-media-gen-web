"use client"

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useLanguage } from '@/contexts/language-context'
import { Copy, RefreshCw, AlertTriangle, ArrowRight } from 'lucide-react'

type Props = {
  gowaBaseUrl: string | null
}

export default function WhatsAppSetupClient({ gowaBaseUrl }: Props) {
  const { t } = useLanguage()
  const [error, setError] = useState<string | null>(null)
  const [qrUrl, setQrUrl] = useState<string | null>(null)
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const handleSavePhone = async () => {
    if (!phone.trim()) {
      setError(t('whatsapp.phoneRequired'))
      return
    }

    setError(null)
    setSuccessMessage(null)
    setSaving(true)

    try {
      const res = await fetch('/api/social-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: 'whatsapp', username: phone.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t('whatsapp.saveError'))
      setSuccessMessage(t('whatsapp.saveSuccess'))
    } catch (err: any) {
      setError(err.message || t('whatsapp.saveError'))
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    if (!gowaBaseUrl) return
    setQrUrl(`${gowaBaseUrl.replace(/\/$/, '')}/setup/whatsapp`)
  }, [gowaBaseUrl])

  const handleCopy = async () => {
    if (!qrUrl) return
    try {
      await navigator.clipboard.writeText(qrUrl)
      setSuccessMessage(t('whatsapp.copySuccess'))
    } catch (err) {
      setError(t('whatsapp.copyError'))
    }
  }

  const handleRefresh = () => {
    setQrUrl(null)
    setError(null)
    setSuccessMessage(null)
    setTimeout(() => {
      if (gowaBaseUrl) setQrUrl(`${gowaBaseUrl.replace(/\/$/, '')}/setup/whatsapp`)
    }, 100)
  }

  const details = (
    <div className="space-y-3 text-sm text-muted-foreground">
      <p>{t('whatsapp.details1')}</p>
      <p>{t('whatsapp.details2')}</p>
      <p>{t('whatsapp.details3')}</p>
    </div>
  )

  if (!gowaBaseUrl) {
    return (
      <div className="mx-auto max-w-2xl py-16 px-4 text-center">
        <div className="mb-6 rounded-3xl border border-red-200 bg-red-50 p-6">
          <p className="text-lg font-semibold text-red-700">{t('whatsapp.notConfiguredTitle')}</p>
          <p className="mt-2 text-sm text-red-600">{t('whatsapp.notConfiguredDesc')}</p>
        </div>
        {details}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl py-16 px-4">
      <div className="rounded-3xl border border-slate-200 bg-white/90 p-8 shadow-sm">
        <div className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">{t('whatsapp.setupTitle')}</p>
          <h1 className="mt-3 text-3xl font-semibold text-slate-900">{t('whatsapp.heading')}</h1>
          <p className="mt-3 text-sm text-slate-600">{t('whatsapp.description')}</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-5">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{t('whatsapp.urlLabel')}</p>
                  <p className="mt-1 text-xs text-slate-500">{t('whatsapp.urlDesc')}</p>
                </div>
                <Button variant="secondary" size="sm" className="gap-2" onClick={handleRefresh}>
                  <RefreshCw className="h-4 w-4" /> {t('whatsapp.refresh')}
                </Button>
              </div>
              <div className="rounded-2xl bg-white p-4 shadow-sm">
                <div className="mb-3 overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 p-4 text-white">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-400">{t('whatsapp.url')}</p>
                  <p className="mt-2 break-words text-sm font-medium">{qrUrl}</p>
                </div>
                
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button onClick={handleCopy} className="gap-2" disabled={!qrUrl}>
                    <Copy className="h-4 w-4" /> {t('whatsapp.copyUrl')}
                  </Button>
                  <Button asChild>
                    <a href={qrUrl || '#'} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2">
                      <ArrowRight className="h-4 w-4" /> {t('whatsapp.openGowa')}
                    </a>
                  </Button>
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  {t('whatsapp.openGowaHint')}
                </p>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-800">{t('whatsapp.phoneNumber')}</p>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{t('whatsapp.required')}</span>
              </div>
              <div className="mt-4 space-y-3">
                <p className="text-sm text-slate-600">{t('whatsapp.phoneHint')}</p>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{t('whatsapp.phoneInputLabel')}</Label>
                  <Input
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder={t('whatsapp.phonePlaceholder')}
                  />
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    onClick={handleSavePhone}
                    disabled={saving}
                    className="gap-2"
                  >
                    {saving ? t('whatsapp.saving') : t('whatsapp.savePhone')}
                  </Button>
                  <Button asChild>
                    <a href="/dashboard/auto-upload" className="inline-flex items-center justify-center">
                      {t('whatsapp.backToDashboard')}
                    </a>
                  </Button>
                </div>
                {successMessage && (
                  <div className="rounded-2xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                    {successMessage}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-slate-800">{t('whatsapp.quickSteps')}</p>
                <ol className="mt-3 space-y-2 text-sm text-slate-600 list-decimal list-inside">
                  <li>{t('whatsapp.step1')}</li>
                  <li>{t('whatsapp.step2')}</li>
                  <li>{t('whatsapp.step3')}</li>
                  <li>{t('whatsapp.step4')}</li>
                </ol>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-800">{t('whatsapp.importantNotes')}</p>
                <p className="mt-2 text-sm text-slate-600">{t('whatsapp.note1')}</p>
                <p className="mt-2 text-sm text-slate-500">{t('whatsapp.note2')}</p>
              </div>
              {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  <AlertTriangle className="inline h-4 w-4 mr-2 align-text-bottom" /> {error}
                </div>
              )}
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">{t('whatsapp.noQrHint')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}