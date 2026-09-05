"use client"

import { CarubraLogo, CarubraFooter } from "@/components/carubra-brand"
import { LoginForm } from "@/components/login-form"
import { Badge } from "@/components/ui/badge"
import { Phone } from "lucide-react"
import { useLanguage } from "@/contexts/language-context"

export default function HomePage() {
  const { t } = useLanguage()
  return (
    <div className="relative min-h-screen flex flex-col bg-background">
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="text-center mb-8">
          <CarubraLogo className="text-4xl md:text-5xl" />
          <p className="text-muted-foreground mt-2">
            {t("footer.tagline")}
          </p>
          <Badge variant="outline" className="mt-3 border-primary text-primary">
            {t("home.agentMarketing")}
          </Badge>
        </div>
        
        <LoginForm />
      </main>

      <CarubraFooter />

      <a
        href="https://wa.me/6282140752116?text=Hai%20buatkan%20aku%20konten%20AI!"
        target="_blank"
        rel="noreferrer"
        className="fixed bottom-6 right-6 z-50 inline-flex items-center gap-3 rounded-full bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-xl shadow-emerald-900/20 transition hover:bg-emerald-700"
      >
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-emerald-600">
          <Phone className="h-5 w-5" />
        </span>
        {t("home.whatsappCta")}
      </a>
    </div>
  )
}
