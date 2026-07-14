"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { useAuth } from "@/contexts/auth-context"
import { useLanguage } from "@/contexts/language-context"

export function LoginForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const { login, error, clearError } = useAuth()
  const { t } = useLanguage()
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    const result = await login(email, password)

    if (result.success) {
      router.push("/dashboard")
    } else if (result.blocked) {
      router.push("/blocked")
    }

    setIsLoading(false)
  }

  return (
    <Card className="w-full max-w-md border border-border shadow-sm">
      <CardContent className="pt-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-foreground">
            {t("auth.welcome")}
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            {t("auth.subtitle")}
          </p>
        </div>
        
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t("auth.email")}</Label>
            <Input
              id="email"
              type="email"
              placeholder={t("auth.emailPlaceholder")}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                clearError()
              }}
              required
              className="h-12"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="password">{t("auth.password")}</Label>
            <Input
              id="password"
              type="password"
              placeholder="********"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                clearError()
              }}
              required
              className="h-12"
            />
          </div>
          
          <Button 
            type="submit" 
            className="w-full h-12 text-base font-medium"
            disabled={isLoading}
          >
            {isLoading ? t("common.loading") : t("auth.login")}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          <p>
            {t("auth.noAccount")} 
            <Link href="/register" className="font-medium text-primary hover:underline">
              {t("auth.register")}
            </Link>
          </p>
        </div>
      </CardContent>
    </Card>
  )
}