'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Calendar, Settings } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// ตัวช่วยรวม class
function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(' ')
}

export default function Sidebar() {
  const pathname = usePathname()
  const [role, setRole] = useState<string | null>(null)

  // โหลด role จาก Supabase ฝั่ง client
  useEffect(() => {
    const supabase = createClient()

    async function loadRole() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        setRole(profile?.role ?? 'user')
      }
    }

    loadRole()
  }, [])

  // เมนูหลัก
  const NAV = [
    { href: '/home', label: 'home', icon: Home, adminOnly: true },
    { href: '/calendar', label: 'calendar', icon: Calendar },
    { href: '/settings', label: 'setting', icon: Settings },
  ]

  return (
    <aside className="fixed left-0 top-0 z-40 h-dvh w-60 border-r bg-white">
      <div className="flex h-full flex-col">
        <div className="h-16 px-5 flex items-center font-black text-2xl">Worldwide</div>

        <nav className="mt-2 flex-1 space-y-4 px-3">
          {NAV.map(({ href, label, icon: Icon, adminOnly }) => {
            

            const active = pathname?.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={cx(
                  'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm capitalize transition',
                  active
                    ? 'bg-zinc-100 font-semibold shadow-[inset_0_-2px_0_rgba(0,0,0,0.12)]'
                    : 'hover:bg-zinc-50'
                )}
              >
                <span className="grid place-items-center rounded-full border w-6 h-6">
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span>{label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="p-4 text-xs text-zinc-400">v0.1.0</div>
      </div>
    </aside>
  )
}
