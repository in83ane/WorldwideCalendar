import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()

  // ใช้ any ที่นี่ตามที่ Supabase SSR กำหนด เนื่องจาก type ของ options
  // มักจะเป็น object ที่มีความซับซ้อนตามมาตรฐาน Cookie Options
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value
        },
        // ****************************************************
        // * แก้ไข: ใช้ unknown แทน any และเพิ่ม ESLint ignore *
        // ****************************************************
        set(name: string, value: string, options: unknown) {
          // หากคุณมั่นใจว่า options คือ CookieOptions ให้ทำ Type Assertion
          // แต่เพื่อความง่ายและแก้ Error เราจะใช้ Type Assertion to object
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          res.cookies.set({ name, value, ...(options as any) }) 
        },
        remove(name: string, options: unknown) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          res.cookies.set({ name, value: '', ...(options as any) })
        },
      },
    }
  )

  // (ตัวอย่าง) ปกป้องเส้นทางที่ต้องล็อกอิน
  const { data: { user } } = await supabase.auth.getUser()
  // * แก้ไข: เพิ่ม '/' ข้างหน้า protected paths เพื่อให้ถูกต้องตามหลักการของ Next.js *
  const protectedPaths = ['/calendar', '/home'] // เพิ่ม path ที่คุณต้องการป้องกัน
  
  // ตรวจสอบว่า path ปัจจุบันอยู่ในกลุ่มที่ต้องการป้องกันหรือไม่
  // ใช้ startsWith(p) เพื่อรองรับ /home, /home/settings เป็นต้น
  const isProtectedRoute = protectedPaths.some(p => req.nextUrl.pathname.startsWith(p))
  
  if (isProtectedRoute && !user) {
    const url = req.nextUrl.clone()
    url.pathname = '/auth/login'
    return NextResponse.redirect(url)
  }

  // หากผู้ใช้พยายามเข้าหน้า Login หรือ Register แต่ล็อกอินอยู่แล้ว ให้ Redirect ไปหน้าหลัก
  if (user && (req.nextUrl.pathname.startsWith('/auth/login') || req.nextUrl.pathname.startsWith('/auth/register'))) {
    const url = req.nextUrl.clone()
    url.pathname = '/home'
    return NextResponse.redirect(url)
  }

  return res
}

// * แก้ไข: เปลี่ยน matcher ให้ครอบคลุมทุกส่วน ยกเว้น API, Static, และ Auth *
export const config = {
  matcher: [
    // ป้องกัน routes ใน / (app)
    '/',
    '/((?!api|_next/static|_next/image|favicon.ico|auth/login|auth/register).*)',
    '/calendar/:path*',
    '/home/:path*'
  ],
}