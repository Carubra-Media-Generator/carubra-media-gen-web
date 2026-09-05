"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useAuth } from "@/contexts/auth-context"
import { useLanguage } from "@/contexts/language-context"
import { Eye, EyeOff, Camera, Upload, X, Loader2 } from "lucide-react"

export default function ProfilePage() {
  const { user, updateUser } = useAuth()
  const { t } = useLanguage()
  const [name, setName] = useState(user?.name || "")
  const [phone, setPhone] = useState(user?.phone || "")
  const [isSaving, setIsSaving] = useState(false)
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null)
  const [showCurrentPw, setShowCurrentPw] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)
  const [showConfirmPw, setShowConfirmPw] = useState(false)

  // ── Avatar state ────────────────────────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatar ?? null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const [avatarSuccess, setAvatarSuccess] = useState(false)

  // ── Stats ───────────────────────────────────────────────────────────────────
  const roleDisplay = user?.role || "User"
  const passwordChangesUsed = user?.passwordChangesUsed ?? 0
  const passwordChangeLimit = 5
  const membershipOrder = user?.membershipOrder || "A7B9C2D"
  const totalCreatedVideos = user?.totalCreatedVideos ?? 0
  const connectedSocialAccounts = user?.connectedSocialAccounts ?? 0

  const [totalVideos, setTotalVideos] = useState<number | null>(null)
  const [totalSocials, setTotalSocials] = useState<number | null>(null)

  useEffect(() => {
    const token = localStorage.getItem("carubra-token")
    if (!token) return

    fetch("/api/video-ai", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        if (data && Array.isArray(data.videos)) {
          setTotalVideos(data.videos.length)
        }
      })
      .catch(() => {})

    fetch("/api/social-connect", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        if (data && Array.isArray(data.accounts)) {
          setTotalSocials(data.accounts.length)
        }
      })
      .catch(() => {})
  }, [])

  // Sync avatar dari user context
  useEffect(() => {
    if (user?.avatar) setAvatarPreview(user.avatar)
  }, [user?.avatar])

  const displayVideos = totalVideos !== null ? totalVideos : totalCreatedVideos
  const displaySocials = totalSocials !== null ? totalSocials : connectedSocialAccounts

  // ── Handle avatar file pick ──────────────────────────────────────────────────
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setAvatarError(null)
    setAvatarSuccess(false)

    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"]
    if (!allowedTypes.includes(file.type)) {
      setAvatarError(t("profile.formatNotSupported"))
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError(t("profile.fileTooLarge"))
      return
    }

    setAvatarFile(file)
    const reader = new FileReader()
    reader.onload = () => setAvatarPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  const handleAvatarUpload = async () => {
    if (!avatarFile) return
    setIsUploadingAvatar(true)
    setAvatarError(null)
    setAvatarSuccess(false)

    try {
      const token = localStorage.getItem("carubra-token")
      const form = new FormData()
      form.append("avatar", avatarFile)

      const res = await fetch("/api/users/avatar", {
        method: "POST",
        headers: { Authorization: `Bearer ${token ?? ""}` },
        body: form,
      })

      const data = await res.json()
      if (!res.ok) {
        setAvatarError(data.error ?? t("profile.uploadFailed"))
        return
      }

      updateUser({ avatar: data.avatarUrl })
      setAvatarFile(null)
      setAvatarSuccess(true)
      setTimeout(() => setAvatarSuccess(false), 3000)
    } catch {
      setAvatarError(t("profile.errorTryAgain"))
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  const handleCancelAvatar = () => {
    setAvatarFile(null)
    setAvatarPreview(user?.avatar ?? null)
    setAvatarError(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  // ── Handle profile save ──────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)

    try {
      const token = localStorage.getItem("carubra-token")
      const res = await fetch("/api/users/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, phone }),
      })

      const data = await res.json()
      if (res.ok) {
        updateUser(data.user)
      }
    } catch (err) {
      console.error("Gagal update profil:", err)
    } finally {
      setIsSaving(false)
    }
  }

  const initials = name
    .split(" ")
    .map(n => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <h1 className="text-3xl font-bold text-foreground">{t("profile.title")}</h1>
      <Card className="border border-border transition-all duration-300 hover:border-emerald-500/60 hover:shadow-lg hover:shadow-emerald-500/10">
        <CardHeader>
          <div className="flex items-center gap-5">
            {/* ── Avatar dengan tombol kamera ── */}
            <div className="relative group">
              <Avatar className="h-24 w-24 ring-2 ring-border group-hover:ring-emerald-500/50 transition-all duration-300">
                {avatarPreview ? (
                  <AvatarImage src={avatarPreview} alt={name} className="object-cover" />
                ) : null}
                <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                  {initials || "U"}
                </AvatarFallback>
              </Avatar>

              {/* Overlay kamera */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer"
              >
                <Camera className="w-6 h-6 text-white" />
              </button>

              {/* Badge notif ada file baru */}
              {avatarFile && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-background animate-pulse" />
              )}
            </div>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handleAvatarChange}
            />

            <div className="flex-1 space-y-1">
              <CardTitle className="text-xl">{name || "User"}</CardTitle>
              <p className="text-muted-foreground text-sm">{user?.email}</p>

              {/* Preview action buttons */}
              {avatarFile ? (
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAvatarUpload}
                    disabled={isUploadingAvatar}
                    className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                  >
                    {isUploadingAvatar ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Upload className="w-3.5 h-3.5" />
                    )}
                    {isUploadingAvatar ? t("profile.uploading") : t("profile.savePhoto")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={handleCancelAvatar}
                    disabled={isUploadingAvatar}
                    className="gap-1.5 text-xs text-muted-foreground hover:text-destructive"
                  >
                    <X className="w-3.5 h-3.5" />
                    {t("common.cancel")}
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs text-emerald-600 hover:text-emerald-500 transition-colors flex items-center gap-1 pt-1"
                >
                  <Camera className="w-3 h-3" />
                  {t("profile.changePhoto")}
                </button>
              )}

              {/* Avatar feedback messages */}
              {avatarError && (
                <p className="text-xs text-destructive">{avatarError}</p>
              )}
              {avatarSuccess && (
                <p className="text-xs text-emerald-600">{t("profile.photoUpdated")}</p>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border bg-muted/50 p-4">
              <p className="text-sm text-muted-foreground">{t("auth.email")}</p>
              <p className="mt-1 font-medium">{user?.email || "-"}</p>
            </div>
            <div className="rounded-lg border bg-muted/50 p-4">
              <p className="text-sm text-muted-foreground">{t("profile.username")}</p>
              <p className="mt-1 font-medium">{user?.name || "User"}</p>
            </div>
            <div className="rounded-lg border bg-muted/50 p-4">
              <p className="text-sm text-muted-foreground">{t("profile.role")}</p>
              <p className="mt-1 font-medium">{roleDisplay}</p>
            </div>
            <div className="rounded-lg border bg-muted/50 p-4">
              <p className="text-sm text-muted-foreground">{t("profile.membershipOrder")}</p>
              <p className="mt-1 font-medium">{membershipOrder}</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 mt-4">
            <div className="rounded-2xl border bg-slate-500/5 dark:bg-slate-400/5 p-6 flex flex-col items-center justify-center text-center shadow-md transition-all duration-300 hover:border-indigo-500/40 hover:shadow-sm hover:scale-[1.01]">
              <p className="text-5xl font-black text-indigo-600 dark:text-indigo-400 tracking-tight mb-1">
                {displayVideos}
              </p>
              <p className="text-[11px] font-bold text-muted-foreground/80 tracking-widest uppercase">
                {t("profile.videosCreated")}
              </p>
            </div>
            <div className="rounded-2xl border bg-slate-500/5 dark:bg-slate-400/5 p-6 flex flex-col items-center justify-center text-center shadow-md transition-all duration-300 hover:border-indigo-500/40 hover:shadow-sm hover:scale-[1.01]">
              <p className="text-5xl font-black text-indigo-600 dark:text-indigo-400 tracking-tight mb-1">
                {displaySocials}
              </p>
              <p className="text-[11px] font-bold text-muted-foreground/80 tracking-widest uppercase">
                {t("profile.platformsConnected")}
              </p>
            </div>
          </div>

          <div className="rounded-lg border bg-muted/50 p-4 mt-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">{t("profile.passwordInfo")}</p>
                <p className="mt-1 font-medium">{passwordChangesUsed}/{passwordChangeLimit}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {t("profile.passwordLimitInfo", { count: passwordChangeLimit })}
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                className="mt-0 transition-all duration-300 hover:bg-emerald-500/20 hover:text-emerald-600 hover:border-emerald-500/40"
                onClick={() => {
                  setShowChangePassword(!showChangePassword)
                  setPasswordError(null)
                  setPasswordSuccess(null)
                }}
              >
                {showChangePassword ? t("profile.cancelChangePassword") : t("profile.changePassword")}
              </Button>
            </div>

            {showChangePassword && (
              <div className="mt-4 space-y-4">
                {passwordError && (
                  <p className="text-sm text-destructive">{passwordError}</p>
                )}
                {passwordSuccess && (
                  <p className="text-sm text-emerald-700">{passwordSuccess}</p>
                )}

                <div className="space-y-2">
                  <Label htmlFor="currentPassword">{t("profile.currentPassword")}</Label>
                  <div className="relative">
                    <Input
                      id="currentPassword"
                      type={showCurrentPw ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder={t("profile.currentPasswordPlaceholder")}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPw(!showCurrentPw)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showCurrentPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newPassword">{t("profile.newPassword")}</Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showNewPw ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder={t("profile.newPasswordPlaceholder")}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPw(!showNewPw)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">{t("profile.confirmNewPassword")}</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPw ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder={t("profile.confirmNewPasswordPlaceholder")}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPw(!showConfirmPw)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showConfirmPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <Button
                  type="button"
                  onClick={async () => {
                    setPasswordError(null)
                    setPasswordSuccess(null)
                    if (!currentPassword || !newPassword || !confirmPassword) {
                      setPasswordError(t("profile.fillAllPasswordFields"))
                      return
                    }
                    if (newPassword !== confirmPassword) {
                      setPasswordError(t("auth.passwordMismatch"))
                      return
                    }

                    setIsChangingPassword(true)
                    try {
                      const token = localStorage.getItem("carubra-token")
                      const res = await fetch("/api/users/password", {
                        method: "PUT",
                        headers: {
                          "Content-Type": "application/json",
                          Authorization: `Bearer ${token}`,
                        },
                        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
                      })

                      const data = await res.json()
                      if (!res.ok) {
                        setPasswordError(data.error || t("profile.passwordChangeFailed"))
                        return
                      }

                      setPasswordSuccess(t("profile.passwordChangedSuccess"))
                      updateUser({ passwordChangesUsed: data.user.passwordChangesUsed })
                      setCurrentPassword("")
                      setNewPassword("")
                      setConfirmPassword("")
                      setShowChangePassword(false)
                    } catch (err) {
                      console.error(err)
                      setPasswordError(t("profile.passwordChangeFailed"))
                    } finally {
                      setIsChangingPassword(false)
                    }
                  }}
                  disabled={isChangingPassword}
                >
                  {isChangingPassword ? t("common.loading") : t("profile.submitPasswordChange")}
                </Button>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 mt-6">
            <div className="space-y-2">
              <Label htmlFor="email">{t("auth.email")}</Label>
              <Input
                id="email"
                type="email"
                value={user?.email || ""}
                disabled
                className="bg-muted"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">{t("profile.name")}</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("profile.namePlaceholder")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">{t("profile.phone")}</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t("profile.phonePlaceholder")}
              />
            </div>

            <Button type="submit" disabled={isSaving}>
              {isSaving ? t("common.loading") : t("profile.save")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}