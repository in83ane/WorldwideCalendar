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
    // 1. Sidebar กว้าง w-20
    <aside className="fixed left-0 top-0 z-40 h-dvh w-20 border-r bg-white">
      <div className="flex h-full flex-col">
        
        {/* 2. ชื่อแบรนด์: แสดงไอคอนตรงกลางแทนข้อความ
        <div className="h-16 flex items-center justify-center font-black text-2xl">
          <Home className="h-6 w-6 text-zinc-700" />
        </div> */}

        {/* 3. เมนู: จัดให้อยู่ตรงกลาง ไม่มี padding ด้านข้าง (px-0) */}
        <nav className="mt-2 flex-1 space-y-4 px-0">
          {NAV.map(({ href, label, icon: Icon, adminOnly }) => {
            
            // Optional: Logic ซ่อนเมนูสำหรับ admin (ถ้ามี)
            // if (adminOnly && role !== 'admin') return null

            const active = pathname?.startsWith(href)
            
            return (
              // 4. ห่อด้วย div ที่มี class 'group' และ 'relative' สำหรับ Tooltip
              <div key={href} className="relative group">
                <Link
                  href={href}
                  className={cx(
                    // จัดองค์ประกอบตรงกลาง (justify-center)
                    'flex items-center justify-center rounded-2xl px-1 py-3 text-sm capitalize transition',
                    active
                      ? 'bg-zinc-100 font-semibold shadow-[inset_0_-2px_0_rgba(0,0,0,0.12)]'
                      : 'hover:bg-zinc-50'
                  )}
                >
                  <span className="grid place-items-center rounded-full border w-6 h-6">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                </Link>

                {/* 5. Tooltip Content (แสดงเมื่อ group:hover) */}
                <div
                  className={cx(
                    // ตำแหน่ง
                    'absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2',
                    // สไตล์ Tooltip
                    'whitespace-nowrap rounded-lg bg-zinc-800 px-3 py-1 text-xs font-medium text-white shadow-lg',
                    // การแสดงผล: ซ่อนไว้ และแสดงเมื่อ group ถูก hover
                    'pointer-events-none opacity-0 transition-opacity delay-300 group-hover:opacity-100'
                  )}
                >
                  {label.charAt(0).toUpperCase() + label.slice(1)} {/* แสดง Label */}
                </div>
              </div>
            )
          })}
        </nav>

        {/* 6. ซ่อนเลขเวอร์ชัน */}
        <div className="hidden p-4 text-xs text-zinc-400">v0.1.0</div>
      </div>
    </aside>
  )
}
