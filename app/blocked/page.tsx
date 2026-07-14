"use client"

import Link from "next/link"
import { useLanguage } from "@/contexts/language-context"

export default function BlockedPage() {
  const { t } = useLanguage()
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-12 text-center">
      <div className="max-w-lg rounded-3xl border border-border bg-white p-10 shadow-sm">
        <h1 className="text-4xl font-bold text-foreground">{t("blocked.title")}</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          {t("blocked.description")}
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/register"
            className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white hover:bg-primary/90"
          >
            {t("blocked.registerAgain")}
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-border bg-background px-5 py-3 text-sm font-semibold text-foreground hover:bg-slate-50"
          >
            {t("blocked.backToLogin")}
          </Link>
        </div>
      </div>
    </div>
  )
}
