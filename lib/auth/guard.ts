import 'server-only'
import { getLoungeSession } from '@/lib/auth/passcode-session'

export async function requireAuthUser() {
  const session = await getLoungeSession()
  if (!session) throw new Error('Unlock the lounge to continue.')
  return { userId: session.userId, role: session.role }
}
