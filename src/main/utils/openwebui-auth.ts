// Silent OpenWebUI admin bootstrap.
//
// OpenWebUI 0.9.5 wants a local user account before any of its
// /openai/* endpoints will serve data. Our users have already authed
// with Omnizen (Google via Clerk on omnizen.ai) - asking them to type
// another email+password into a second local signup form is broken
// UX.
//
// On first server start we silently:
//   1. Generate a hidden admin email + random password
//   2. POST /api/v1/auths/signup - first user becomes admin even when
//      ENABLE_SIGNUP is false (the upstream bootstrap path)
//   3. Persist email/password/JWT encrypted via safeStorage so we can
//      sign back in on subsequent runs without re-signing-up
//   4. Hand the JWT to the renderer via sync IPC so the webview's
//      preload can inject it into localStorage BEFORE OpenWebUI's
//      Svelte frontend runs its first auth check
//
// User never sees the OpenWebUI login or signup form.

import { safeStorage, app } from 'electron'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import crypto from 'node:crypto'

const FILE = 'openwebui-bootstrap.bin'

type Bootstrap = {
  email: string
  password: string
  // token is cached but we still re-signin on each launch to keep it
  // fresh and to detect a wiped webui.db.
  token?: string
}

function bsPath(): string {
  return join(app.getPath('userData'), FILE)
}

async function readBootstrap(): Promise<Bootstrap | null> {
  try {
    if (!safeStorage.isEncryptionAvailable()) return null
    const buf = await fs.readFile(bsPath())
    return JSON.parse(safeStorage.decryptString(buf)) as Bootstrap
  } catch {
    return null
  }
}

async function writeBootstrap(b: Bootstrap): Promise<void> {
  const buf = safeStorage.encryptString(JSON.stringify(b))
  // Atomic write: write to a .tmp sibling, then rename. A power loss or
  // crash mid-write leaves the previous valid file intact instead of a
  // half-written one that decrypts to garbage on next launch.
  const dst = bsPath()
  const tmp = dst + '.tmp'
  await fs.writeFile(tmp, buf, { mode: 0o600 })
  await fs.rename(tmp, dst)
}

async function postJson(
  url: string,
  body: unknown
): Promise<{ status: number; data: { token?: string; detail?: string } | null }> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    })
    let data: { token?: string; detail?: string } | null = null
    try {
      data = (await res.json()) as { token?: string; detail?: string }
    } catch {
      // Non-JSON, leave null
    }
    return { status: res.status, data }
  } catch {
    return { status: 0, data: null }
  }
}

/**
 * Returns a valid OpenWebUI session JWT. Creates the local admin
 * silently on first call if one doesn't exist. Re-signs in on
 * subsequent calls to keep the JWT fresh.
 *
 * Returns null only if both signup and signin failed (e.g. server is
 * unreachable, or webui.db was wiped and ENABLE_SIGNUP is false). The
 * caller falls back to letting the user see the OpenWebUI login form,
 * which still works as an escape hatch.
 */
export async function getOrCreateOpenWebUIToken(serverUrl: string): Promise<string | null> {
  let bs = await readBootstrap()

  // Try signin first if we have creds from a previous run.
  if (bs) {
    const r = await postJson(`${serverUrl}/api/v1/auths/signin`, {
      email: bs.email,
      password: bs.password
    })
    if (r.status === 200 && r.data?.token) {
      bs.token = r.data.token
      await writeBootstrap(bs)
      return bs.token
    }
    // Signin failed - webui.db was probably wiped. Fall through to
    // signup with the same creds (so the bootstrap file stays usable).
  }

  // First-run path (or post-wipe). The first user OpenWebUI sees
  // becomes admin even if ENABLE_SIGNUP=false.
  //
  // Email must be RFC-valid - OpenWebUI 0.9.5's signup validates with
  // pydantic EmailStr, which rejects fake TLDs like `.local`. We use
  // example.com (RFC 2606 reserved for documentation/testing) so the
  // address looks intentional, never collides with any real omnizen.ai
  // user, and is never deliverable.
  const email = bs?.email ?? `omnizen-desktop@example.com`
  const password = bs?.password ?? crypto.randomBytes(24).toString('base64url')
  const name = 'Omnizen Desktop'

  const r = await postJson(`${serverUrl}/api/v1/auths/signup`, {
    email,
    password,
    name
  })
  if (r.status === 200 && r.data?.token) {
    const next: Bootstrap = { email, password, token: r.data.token }
    await writeBootstrap(next)
    return next.token!
  }

  // Both paths failed. Caller decides whether to surface this.
  return null
}

/**
 * Clears the stored bootstrap. Used when the user signs out of
 * Omnizen so subsequent launches get a clean OpenWebUI session too.
 */
export async function clearOpenWebUIBootstrap(): Promise<void> {
  try {
    await fs.unlink(bsPath())
  } catch {
    // Missing is fine.
  }
}
