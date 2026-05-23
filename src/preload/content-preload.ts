import { ipcRenderer, contextBridge } from 'electron'

// ─── Silent OpenWebUI sign-in via injected session JWT ──
// Runs BEFORE any OpenWebUI page script. Synchronously asks the main
// process for the cached session token (bootstrapped silently after
// the local server is up - see src/main/utils/openwebui-auth.ts) and
// drops it into localStorage so OpenWebUI's Svelte frontend sees an
// already-authenticated user on its first auth check.
//
// The user never sees OpenWebUI's login or signup form - the Omnizen
// device-flow they completed in the browser is the only sign-in.
try {
  const token: string | null = ipcRenderer.sendSync('openwebui:token-sync')
  if (token && typeof window !== 'undefined' && window.localStorage) {
    if (window.localStorage.getItem('token') !== token) {
      window.localStorage.setItem('token', token)
    }
  }
} catch {
  // If sync IPC fails for any reason fall back to OpenWebUI's own
  // login screen - bootstrap is best-effort.
}

// Suppress OpenWebUI's "What's New / Release Notes" modal which opens
// on every fresh launch as a full-screen bg-black/30 overlay. The
// modal hides the chat behind a dark layer that looks like a broken
// app. OpenWebUI shows the modal whenever localStorage.version !=
// current server version - setting a high sentinel value here before
// any OpenWebUI script runs disables it permanently.
try {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem('version', '99.99.99')
  }
} catch {
  // best-effort
}

// ─── Desktop ↔ Open WebUI Generic Protocol ──────────────
// This preload is a dumb relay. It passes typed {type, data}
// messages between the embedder (desktop renderer) and the
// Open WebUI page. Business logic lives elsewhere.
// To add new features, just add new event types - this file
// never needs to change.

type EventCallback = (data: any) => void
const eventCallbacks: EventCallback[] = []

// Embedder → Guest (push events from desktop)
ipcRenderer.on('desktop:event', (_event, data) => {
  eventCallbacks.forEach((cb) => cb(data))
})

// ─── Theme Sync: Open WebUI → Desktop ───────────────────
// Open WebUI calls window.applyTheme() after every theme change.
// We inject this hook so the desktop shell can mirror the theme.
contextBridge.exposeInMainWorld('applyTheme', () => {
  const theme = localStorage.getItem('theme') ?? 'system'
  ipcRenderer.sendToHost('webview:event', { type: 'theme:update', data: { theme } })
})

// Expose to the Open WebUI page via contextBridge (secure, unforgeable)
contextBridge.exposeInMainWorld('electronAPI', {
  // Push events: desktop → Open WebUI
  onEvent: (callback: EventCallback): void => {
    eventCallbacks.push(callback)
  },

  // Request/Response: Open WebUI → desktop
  send: (data: any): Promise<any> => {
    return new Promise((resolve) => {
      const id = Math.random().toString(36).slice(2)
      const handler = (_event: any, response: any) => {
        if (response?._responseId === id) {
          ipcRenderer.removeListener('desktop:response', handler)
          resolve(response.data)
        }
      }
      ipcRenderer.on('desktop:response', handler)
      ipcRenderer.sendToHost('webview:send', { ...data, _requestId: id })
    })
  },

  // Navigation: Open WebUI → desktop
  load: (page: string): void => {
    ipcRenderer.sendToHost('webview:load', page)
  }
})
