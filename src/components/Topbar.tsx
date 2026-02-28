// src/components/Topbar.tsx  (Server Component)
import { createClient } from '@/lib/supabase/server'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

function initials(nameOrEmail?: string) {
  if (!nameOrEmail) return 'U'
  const base = nameOrEmail.includes(' ')
    ? nameOrEmail.split(' ').slice(0, 2).join(' ')
    : nameOrEmail.split('@')[0]
  const [a = '', b = ''] = base.split(' ')
  return (a[0] + (b[0] ?? '')).toUpperCase()
}

export default async function Topbar() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const name = (user.user_metadata?.name as string) || user.email || 'User'
  const avatarUrl = user.user_metadata?.avatar_url as string | undefined

  return (
    <div className="flex items-center gap-3">
      <div className="px-4 py-2 rounded-full border shadow-sm bg-white text-sm font-medium">
        {name}
      </div>
      <Avatar className="h-9 w-9 border">
        <AvatarImage src={avatarUrl} alt={name} />
        <AvatarFallback>{initials(name)}</AvatarFallback>
      </Avatar>
    </div>
  )
}
