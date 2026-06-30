"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Coins, ShoppingCart } from "lucide-react"
import React from "react"
// Logo is in sidebar; header will not render it

const BALANCE_UPDATED_EVENT = 'carubra-balance-updated'

export function DashboardHeader() {
  const router = useRouter()
  const { user } = useAuth()
  const [coins, setCoins] = useState<number>(0)
  const [cartCount, setCartCount] = useState(0)

  useEffect(() => {
    async function fetchBalance() {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('carubra-token') : null
        const res = await fetch('/api/users/balance', { headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) } })
        const json = await res.json()
        if (res.ok) setCoins(json.coins ?? 0)
      } catch (e) {
        // ignore
      }
    }
    fetchBalance()

    const readCart = () => {
      if (typeof window === 'undefined') return
      const stored = localStorage.getItem('carubra-cart-items')
      if (!stored) {
        setCartCount(0)
        return
      }
      try {
        const items = JSON.parse(stored) as any[]
        setCartCount(Array.isArray(items) ? items.length : 0)
      } catch {
        setCartCount(0)
      }
    }

    readCart()
    const updateBalance = (event: Event) => {
      const coins = (event as CustomEvent<{ coins?: number }>).detail?.coins
      if (typeof coins === 'number') setCoins(coins)
      else fetchBalance()
    }

    window.addEventListener('storage', readCart)
    window.addEventListener(BALANCE_UPDATED_EVENT, updateBalance)
    return () => {
      window.removeEventListener('storage', readCart)
      window.removeEventListener(BALANCE_UPDATED_EVENT, updateBalance)
    }
  }, [])

  const initials = user?.name ? user.name.split(" ").map(n => n[0]).slice(0,2).join("") : (user?.email ? user.email[0].toUpperCase() : "U")

  return (
    <header className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/10">
          <Coins className="h-4 w-4 text-yellow-600" />
          <div className="text-sm">{coins}</div>
          <div className="text-xs text-muted-foreground ml-2">Koin</div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="text-right mr-2 hidden sm:block">
          <div className="text-sm font-medium">{user?.name ?? user?.email}</div>
          <div className="text-xs text-muted-foreground">{user?.email}</div>
        </div>
        <div className="flex items-center gap-2">
          <Avatar className="h-9 w-9 ring-2 ring-primary/20">
            {user?.avatar && (
              <AvatarImage src={user.avatar} alt={user.name ?? "avatar"} className="object-cover" />
            )}
            <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  )
}
