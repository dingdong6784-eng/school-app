import 'server-only'
import { auth } from '@/lib/auth/server'

export async function requireAuthUser() {
  const { data, error } = await auth.getSession()
  if (error || !data?.user?.id) throw new Error('Sign in to continue.')
  return { userId: data.user.id }
}
