"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { useLanguage } from "@/contexts/language-context"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  const { t } = useLanguage()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && user && !user.role?.toString().toLowerCase().includes("admin")) {
      router.push("/dashboard")
    }
  }, [user, isLoading, router])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-primary text-xl font-semibold">{t("admin.loadingAdmin")}</div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return <>{children}</>
}