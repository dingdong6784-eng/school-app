import { LoungeApp } from '@/components/lounge-app'
import { getLoungeSession } from '@/lib/auth/passcode-session'

export const dynamic = 'force-dynamic'

type SearchParams = Promise<{ invite?: string | string[] }>

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const inviteValue = Array.isArray(params.invite) ? params.invite[0] : params.invite
  const session = await getLoungeSession()
  const user = session ? { id: session.userId, role: session.role, name: session.name } : null

  return <LoungeApp user={user} invitationToken={inviteValue ?? ''} />
}
