"use client"

import { useEffect, useState } from "react"
import { Search, Loader2, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/contexts/auth-context"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type AdminUser = {
  id: string
  email: string
  name: string
  role: string
  coins?: number
  is_banned?: boolean
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api"

function getApiUrl(path: string) {
  if (path.startsWith("http://") || path.startsWith("https://")) return path
  if (path.startsWith("/api")) return path
  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("carubra-token") : null
  const res = await fetch(getApiUrl(path), {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  })

  const payload = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((payload as any).error ?? `HTTP ${res.status}`)
  }
  return payload as T
}

export default function AdminUsersPage() {
  const { user, isLoading } = useAuth()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Role modal state
  const [roleModalOpen, setRoleModalOpen] = useState(false)
  const [roleModalUser, setRoleModalUser] = useState<AdminUser | null>(null)
  const [selectedRole, setSelectedRole] = useState<string>("")
  const [roleSaving, setRoleSaving] = useState(false)
  
  // Coins modal state
  const [coinsModalOpen, setCoinsModalOpen] = useState(false)
  const [coinsModalUser, setCoinsModalUser] = useState<AdminUser | null>(null)
  const [coinsValue, setCoinsValue] = useState<string>("")
  const [coinsSaving, setCoinsSaving] = useState(false)
  
  // Password reset modal state
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null)
  const [newPassword, setNewPassword] = useState("")

  useEffect(() => {
    if (!isLoading) {
      loadUsers()
    }
  }, [isLoading])

  const loadUsers = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch<{ users: AdminUser[] }>('/api/admin/users')
      setUsers(data.users)
    } catch (err: any) {
      setError(err.message ?? 'Tidak dapat memuat pengguna')
    } finally {
      setLoading(false)
    }
  }

  const patchUser = async (userId: string, body: Record<string, any>) => {
    setError(null)
    try {
      await apiFetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      })
      await loadUsers()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleRoleChange = (target: AdminUser) => {
    setRoleModalUser(target)
    setSelectedRole(target.role)
    setRoleModalOpen(true)
  }
  
  const saveRoleChange = async () => {
    if (!roleModalUser || selectedRole === roleModalUser.role) return
    setRoleSaving(true)
    setError(null)
    try {
      await patchUser(roleModalUser.id, { role: selectedRole })
      setRoleModalOpen(false)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setRoleSaving(false)
    }
  }

  const handleCoinsChange = (target: AdminUser) => {
    setCoinsModalUser(target)
    setCoinsValue(String(target.coins ?? 0))
    setCoinsModalOpen(true)
  }
  
  const saveCoinsChange = async () => {
    if (!coinsModalUser) return
    const coins = Number(coinsValue)
    if (Number.isNaN(coins) || coins < 0) {
      setError('Nilai koin tidak valid')
      return
    }
    setCoinsSaving(true)
    setError(null)
    try {
      await patchUser(coinsModalUser.id, { coins })
      setCoinsModalOpen(false)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setCoinsSaving(false)
    }
  }

  const handleBanToggle = async (target: AdminUser) => {
    const nextState = !(target.is_banned ?? false)
    const confirmText = nextState ? 'blokir' : 'batalkan blokir'
    setSelectedUser(target)
    setError(`Apakah Anda yakin ingin ${confirmText} ${target.email}?`)
    setShowSuccessModal(true)
  }

  const confirmBanToggle = async () => {
    if (!selectedUser) return
    const nextState = !(selectedUser.is_banned ?? false)
    try {
      await patchUser(selectedUser.id, { is_banned: nextState })
      setShowSuccessModal(false)
      loadUsers()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleResetPassword = async (target: AdminUser) => {
    setSelectedUser(target)
    setNewPassword("")
    setShowPasswordModal(true)
  }

  const confirmResetPassword = async () => {
    if (!selectedUser || !newPassword.trim()) return
    try {
      await patchUser(selectedUser.id, { password: newPassword })
      setShowPasswordModal(false)
      setShowSuccessModal(true)
    } catch (err: any) {
      console.error('[handleResetPassword]', err)
    }
  }

  const filteredUsers = users.filter((item) => {
    const normalized = query.trim().toLowerCase()
    return (
      !normalized ||
      item.email.toLowerCase().includes(normalized) ||
      item.name.toLowerCase().includes(normalized) ||
      item.role.toLowerCase().includes(normalized)
    )
  })

  if (isLoading || !user) {
    return <div className="min-h-[60vh] flex items-center justify-center text-base text-muted-foreground">Memuat pengguna...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-[0.24em] text-muted-foreground">Admin Console</p>
        <h1 className="text-3xl font-bold">Manajemen User</h1>
        <p className="mt-2 text-muted-foreground max-w-2xl">Lihat semua pengguna, role, dan status blokir secara terpusat.</p>
      </div>

      {error && (
        <div className="rounded-3xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive flex items-center justify-between">
          <span>{error}</span>
          <Button size="sm" variant="ghost" onClick={() => setError(null)}>✕</Button>
        </div>
      )}

      <Card className="border border-border bg-background">
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 rounded-3xl border border-border bg-slate-50 px-4 py-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                type="search"
                placeholder="Cari email, nama, role..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <Button onClick={loadUsers} disabled={loading}>
              {loading ? 'Memuat...' : 'Muat Ulang'}
            </Button>
          </div>

          <div className="overflow-x-auto rounded-3xl border border-border bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 text-left text-xs uppercase tracking-[0.2em] text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Nama</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Koin</th>
                  <th className="px-4 py-3">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      {loading ? 'Memuat...' : 'Tidak ada pengguna yang cocok.'}
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((item) => (
                    <tr key={item.id} className="border-t border-border hover:bg-slate-50/80">
                      <td className="px-4 py-4 font-medium">{item.email}</td>
                      <td className="px-4 py-4">{item.name}</td>
                      <td className="px-4 py-4">{item.role}</td>
                      <td className="px-4 py-4">
                        <Badge variant={(item.is_banned ?? false) ? 'destructive' : 'outline'}>
                          {(item.is_banned ?? false) ? 'Diblokir' : 'Aktif'}
                        </Badge>
                      </td>
                      <td className="px-4 py-4">{item.coins ?? 0}</td>
                      <td className="px-4 py-4 space-x-2">
                        <Button size="sm" variant="outline" onClick={() => handleRoleChange(item)}>
                          Role
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => handleCoinsChange(item)}>
                          Koin
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleBanToggle(item)}>
                          {(item.is_banned ?? false) ? 'Unban' : 'Ban'}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleResetPassword(item)}>
                          Reset PW
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      
      {/* Role Change Modal */}
      <Dialog open={roleModalOpen} onOpenChange={setRoleModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ubah Role Pengguna</DialogTitle>
            <DialogDescription>
              {roleModalUser && (
                <span className="text-foreground font-medium">
                  {roleModalUser.name || roleModalUser.email}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            {['User', 'Developer', 'Admin'].map((role) => (
              <button
                key={role}
                onClick={() => setSelectedRole(role)}
                className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                  selectedRole === role
                    ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                    : 'border-border hover:border-primary/50 hover:bg-muted/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{role}</span>
                  {selectedRole === role && (
                    <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                      <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </div>
                {roleModalUser?.role === role && (
                  <span className="text-xs text-muted-foreground mt-1 block">Role saat ini</span>
                )}
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleModalOpen(false)} disabled={roleSaving}>
              Batal
            </Button>
            <Button onClick={saveRoleChange} disabled={roleSaving || selectedRole === roleModalUser?.role}>
              {roleSaving ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Menyimpan...</>
              ) : (
                'Simpan Perubahan'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Coins Change Modal */}
      <Dialog open={coinsModalOpen} onOpenChange={setCoinsModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ubah Saldo Koin</DialogTitle>
            <DialogDescription>
              {coinsModalUser && (
                <span className="text-foreground font-medium">
                  {coinsModalUser.name || coinsModalUser.email}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Jumlah Koin</label>
              <input
                type="number"
                min="0"
                value={coinsValue}
                onChange={(e) => setCoinsValue(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Masukkan jumlah koin"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Saldo saat ini: {coinsModalUser?.coins ?? 0} koin
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCoinsModalOpen(false)} disabled={coinsSaving}>
              Batal
            </Button>
            <Button onClick={saveCoinsChange} disabled={coinsSaving}>
              {coinsSaving ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Menyimpan...</>
              ) : (
                'Simpan Perubahan'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password Reset Modal */}
      <Dialog open={showPasswordModal} onOpenChange={setShowPasswordModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset Kata Sandi</DialogTitle>
            <DialogDescription>
              Masukkan kata sandi baru untuk {selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              type="password"
              placeholder="Kata sandi baru"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPasswordModal(false)}>
              Batal
            </Button>
            <Button onClick={confirmResetPassword} disabled={!newPassword.trim()}>
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Modal for Ban Toggle */}
      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-full">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <DialogTitle>Konfirmasi</DialogTitle>
            </div>
            <DialogDescription className="pt-2">
              {error}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSuccessModal(false)}>
              Batal
            </Button>
            <Button variant="destructive" onClick={confirmBanToggle}>
              Ya, Lanjutkan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
