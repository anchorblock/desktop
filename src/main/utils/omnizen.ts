// Omnizen device-flow client + creds store.
//
// First-launch sign-in opens omnizen.ai/connect in the user's default
// browser, polls /api/cli/auth/poll until approval, and persists the
// returned API key via Electron's safeStorage (OS keychain on macOS,
// libsecret on Linux, DPAPI on Windows). The bundled Open WebUI server
// reads these creds at spawn time to route every chat completion
// through api.omnizen.ai.
//
// Ported from the omnizen-ai monorepo CLI (apps/cli/src/login.mjs).
// Kept dependency-free so it's easy to vendor under AGPL.

import { shell, safeStorage, app } from 'electron'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'

const APP_URL = process.env.OMNIZEN_APP_URL ?? 'https://omnizen.ai'
const CREDS_FILE = 'omnizen-creds.bin'
const SLOW_DOWN_MS = 5000

export type OmnizenCreds = {
  api_key: string
  openai_base_url: string
  anthropic_base_url: string
}

export type DeviceLoginEvent =
  | { type: 'pending'; user_code: string; verification_uri: string }
  | { type: 'approved'; creds: OmnizenCreds }
  | { type: 'expired' | 'denied'; reason: string }

function credsPath(): string {
  return join(app.getPath('userData'), CREDS_FILE)
}

export async function readCreds(): Promise<OmnizenCreds | null> {
  try {
    if (!safeStorage.isEncryptionAvailable()) return null
    const buf = await fs.readFile(credsPath())
    return JSON.parse(safeStorage.decryptString(buf)) as OmnizenCreds
  } catch {
    return null
  }
}

export async function writeCreds(c: OmnizenCreds): Promise<void> {
  const buf = safeStorage.encryptString(JSON.stringify(c))
  await fs.writeFile(credsPath(), buf, { mode: 0o600 })
}

export async function clearCreds(): Promise<void> {
  try {
    await fs.unlink(credsPath())
  } catch {
    // Missing file is fine.
  }
}

export async function isSignedIn(): Promise<boolean> {
  return Boolean(await readCreds())
}

async function postJson(path: string, body: unknown): Promise<{ status: number; data: any }> {
  const res = await fetch(`${APP_URL}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
  let data: any = null
  try {
    data = await res.json()
  } catch {
    // Non-JSON body, keep data null.
  }
  return { status: res.status, data }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/**
 * Start a device-flow login. Pops the user's default browser to the
 * verification URL, polls until approval, persists the creds, and
 * returns them. The optional `onPending` callback fires once after the
 * start-call so the renderer can show the user_code as a fallback in
 * case the browser failed to focus.
 */
export async function deviceLogin(
  onPending?: (info: { user_code: string; verification_uri: string }) => void,
): Promise<OmnizenCreds> {
  const start = await postJson('/api/cli/auth/start', {})
  if (start.status !== 200 || !start.data?.device_code) {
    throw new Error(
      `Could not start sign-in (HTTP ${start.status}). ${start.data?.error?.message ?? 'Try again in a moment.'}`,
    )
  }

  const { device_code, user_code, verification_uri, verification_uri_complete } = start.data
  await shell.openExternal(verification_uri_complete).catch(() => undefined)
  onPending?.({ user_code, verification_uri })

  let pollMs = (start.data.interval ?? 2) * 1000
  for (;;) {
    await sleep(pollMs)
    const r = await postJson('/api/cli/auth/poll', { device_code })
    if (r.status === 429) {
      // slow_down per RFC 8628 — back off and keep polling.
      pollMs = Math.max(pollMs, SLOW_DOWN_MS)
      continue
    }
    const status = r.data?.status
    if (status === 'pending') continue
    if (status === 'approved') {
      const creds: OmnizenCreds = {
        api_key: String(r.data.api_key),
        openai_base_url: String(r.data.openai_base_url),
        anthropic_base_url: String(r.data.anthropic_base_url),
      }
      await writeCreds(creds)
      return creds
    }
    if (status === 'expired' || status === 'denied') {
      throw new Error(`Sign-in ${status}`)
    }
    throw new Error(`Unexpected sign-in status (HTTP ${r.status}, status=${status ?? '?'})`)
  }
}
