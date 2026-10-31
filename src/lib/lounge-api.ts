const sessionTokenKey = 'lounge-session-token'

export class LoungeApiError extends Error {}

export function getStoredSessionToken() {
  return window.localStorage.getItem(sessionTokenKey)
}

export function storeSessionToken(token: string) {
  window.localStorage.setItem(sessionTokenKey, token)
}

export function clearSessionToken() {
  window.localStorage.removeItem(sessionTokenKey)
}

const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lounge`
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export async function callLounge<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${anonKey}`,
        Apikey: anonKey,
      },
      body: JSON.stringify({ action, token: getStoredSessionToken(), ...payload }),
    })
  } catch {
    throw new LoungeApiError('The lounge could not be reached. Check your connection and try again.')
  }

  let body: unknown
  try {
    body = await response.json()
  } catch {
    throw new LoungeApiError('The lounge sent an unexpected response.')
  }

  if (!response.ok) {
    const message = body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
      ? body.error
      : 'Something went wrong. Please try again.'
    throw new LoungeApiError(message)
  }
  return body as T
}
