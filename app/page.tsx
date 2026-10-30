import { LoungeApp } from '@/components/lounge-app'
import { auth } from '@/lib/auth/server'

export const dynamic = 'force-dynamic'

type SearchParams = Promise<{ invite?: string | string[] }>

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const inviteValue = Array.isArray(params.invite) ? params.invite[0] : params.invite
  let user: { id: string; email: string; name: string } | null = null

  try {
    const { data } = await auth.getSession()
    if (data?.user?.id) {
      user = {
        id: data.user.id,
        email: data.user.email ?? '',
        name: data.user.name ?? 'Lounge member',
      }
    }
  } catch {
    user = null
  }

  return <LoungeApp user={user} invitationToken={inviteValue ?? ''} />
}
