"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { useRouter } from "next/navigation"

type User = {
  id: string
  email: string
  name: string
  role?: "User" | "Developer" | "Admin" | "Developer/Admin"
  phone?: string
  avatar?: string
  passwordChangesUsed?: number
  membershipOrder?: string
  totalCreatedVideos?: number
  connectedSocialAccounts?: number
  coins?: number
}

type LoginResult = {
  success: boolean
  error?: string
  blocked?: boolean
}

type AuthContextType = {
  user: User | null
  isLoading: boolean
  isBalanceLoaded: boolean
  error: string | null
  login: (email: string, password: string) => Promise<LoginResult>
  register: (email: string, password: string) => Promise<boolean>
  logout: () => void
  updateUser: (data: Partial<User>) => void
  clearError: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api"

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  // isBalanceLoaded: true once we have fetched the actual coin balance from the API.
  // Pages must wait for this before showing "insufficient balance" warnings.
  const [isBalanceLoaded, setIsBalanceLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const savedUser = localStorage.getItem("carubra-user")
    const savedToken = localStorage.getItem("carubra-token")

    if (savedUser) {
      // Immediately set user from localStorage so the UI has name/email/avatar
      setUser(JSON.parse(savedUser))
    }
    setIsLoading(false)

    // Always fetch the real-time coin balance from the API after startup.
    // The localStorage value may be stale (coins changed via purchase, generation, etc.).
    if (savedToken) {
      fetch("/api/users/balance", {
        headers: { Authorization: `Bearer ${savedToken}` },
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data && typeof data.coins === "number") {
            setUser((prev) => {
              if (!prev) return prev
              const updated = { ...prev, coins: data.coins }
              localStorage.setItem("carubra-user", JSON.stringify(updated))
              return updated
            })
          }
        })
        .catch(() => {
          // Network error — balance stays at whatever is in localStorage
        })
        .finally(() => {
          setIsBalanceLoaded(true)
        })
    } else {
      // No token → no balance to load
      setIsBalanceLoaded(true)
    }
  }, [])

  const login = async (email: string, password: string): Promise<LoginResult> => {
    try {
      setError(null)
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })

      if (response.ok) {
        const data = await response.json()
        setUser(data.user)
        localStorage.setItem("carubra-user", JSON.stringify(data.user))
        localStorage.setItem("carubra-token", data.token)
        // The login response already includes the real coin balance
        setIsBalanceLoaded(true)
        return { success: true }
      }

      const data = await response.json().catch(() => ({}))
      const errorMessage = (data as any).error || "Email atau password salah"
      setError(errorMessage)
      return {
        success: false,
        error: errorMessage,
        blocked: response.status === 403 && String(errorMessage).toLowerCase().includes("blokir"),
      }
    } catch (err: any) {
      const message = err?.message ?? "Terjadi kesalahan saat login"
      setError(message)
      return { success: false, error: message }
    }
  }

  const register = async (email: string, password: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })

      if (response.ok) {
        const data = await response.json()
        setUser(data.user)
        localStorage.setItem("carubra-user", JSON.stringify(data.user))
        localStorage.setItem("carubra-token", data.token)
        setIsBalanceLoaded(true)
        return true
      }

      return false
    } catch {
      return false
    }
  }

  const logout = () => {
    setUser(null)
    setError(null)
    setIsBalanceLoaded(false)

    // Clear all app storage items to prevent data stuck between sessions
    try {
      fetch("/api/auth/logout", { method: "POST" }).catch(() => null)
      const keysToRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith("carubra-")) keysToRemove.push(key)
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k))
      sessionStorage.clear()
    } catch {
      localStorage.removeItem("carubra-user")
      localStorage.removeItem("carubra-token")
    }

    if (typeof window !== "undefined") {
      window.location.href = "/"
    } else {
      router.push("/")
    }
  }

  const clearError = () => {
    setError(null)
  }

  const updateUser = (data: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...data }
      setUser(updatedUser)
      localStorage.setItem("carubra-user", JSON.stringify(updatedUser))
    }
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, isBalanceLoaded, error, login, register, logout, updateUser, clearError }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
