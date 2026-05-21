<script lang="ts">
  // Slim persistent banner at the top of the chat content area. Surfaces
  // the Omnizen device-flow sign-in whenever creds aren't present, so
  // users don't accidentally end up chatting against a local-only
  // OpenWebUI (with Ollama, etc.) without realising Omnizen routing
  // is the whole point of this fork.
  //
  // Auto-hides once the user is signed in. Cannot be permanently
  // dismissed - the desktop is built around Omnizen routing, so missing
  // creds is a state we want visible until resolved.

  import { onMount, onDestroy } from 'svelte'
  import { fade, slide } from 'svelte/transition'

  type Status = 'unknown' | 'signed-out' | 'pending' | 'signed-in' | 'error'

  let status = $state<Status>('unknown')
  let userCode = $state('')
  let verificationUri = $state('')
  let errorMsg = $state('')
  let cleanup: (() => void) | undefined

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const api = (): any => (window as any).electronAPI

  async function refresh(): Promise<void> {
    try {
      const r = await api()?.omnizenStatus()
      status = r?.signedIn ? 'signed-in' : 'signed-out'
    } catch {
      status = 'signed-out'
    }
  }

  async function signIn(): Promise<void> {
    errorMsg = ''
    status = 'pending'
    try {
      await api()?.omnizenLogin()
      status = 'signed-in'
    } catch (err) {
      errorMsg = err instanceof Error ? err.message : String(err)
      status = 'error'
    }
  }

  async function signOut(): Promise<void> {
    await api()?.omnizenLogout()
    status = 'signed-out'
    userCode = ''
    verificationUri = ''
  }

  onMount(() => {
    refresh()
    cleanup = api()?.onOmnizenPending?.((info: { user_code: string; verification_uri: string }) => {
      userCode = info.user_code
      verificationUri = info.verification_uri
    })
  })

  onDestroy(() => {
    cleanup?.()
  })
</script>

{#if status === 'signed-out' || status === 'pending' || status === 'error'}
  <div
    class="absolute top-0 left-0 right-0 z-30 border-b border-black/[0.08] dark:border-white/[0.10] bg-gradient-to-r from-[#fafafa] to-[#f5f5f7] dark:from-[#161616] dark:to-[#0f0f0f] px-4 py-2.5 flex items-center gap-3"
    in:slide={{ duration: 250 }}
    out:fade={{ duration: 150 }}
  >
    <div class="flex-1 min-w-0 flex items-center gap-3">
      <div class="w-7 h-7 rounded-full bg-black/[0.06] dark:bg-white/[0.08] flex items-center justify-center shrink-0">
        <svg class="w-3.5 h-3.5 text-[#1d1d1f] dark:text-[#fafafa]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75">
          <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
        </svg>
      </div>
      <div class="flex-1 min-w-0">
        {#if status === 'pending' && userCode}
          <div class="text-[12px] text-[#1d1d1f] dark:text-[#fafafa] truncate">
            Approve sign-in in your browser. Code: <span class="font-mono font-semibold">{userCode}</span>
          </div>
          {#if verificationUri}
            <div class="text-[11px] opacity-50 truncate">
              <a class="underline" href={verificationUri} target="_blank" rel="noreferrer">{verificationUri}</a>
            </div>
          {/if}
        {:else if status === 'error'}
          <div class="text-[12px] text-red-600 dark:text-red-400 truncate">
            Sign-in failed: {errorMsg || 'unknown error'}
          </div>
        {:else}
          <div class="text-[12px] text-[#1d1d1f] dark:text-[#fafafa]">
            <span class="font-medium">Sign in to Omnizen</span>
            <span class="opacity-60"> · Route every frontier model through one key.</span>
          </div>
        {/if}
      </div>
    </div>
    <button
      class="shrink-0 inline-flex items-center gap-1.5 bg-black dark:bg-white px-3 py-1.5 rounded-md text-white dark:text-black text-[12px] font-medium transition hover:bg-gray-800 dark:hover:bg-gray-100 border-none disabled:opacity-50"
      onclick={signIn}
      disabled={status === 'pending'}
    >
      {#if status === 'pending'}
        <div class="w-3 h-3 rounded-full border-2 border-white/30 dark:border-black/30 border-t-white dark:border-t-black animate-spin"></div>
        Waiting…
      {:else if status === 'error'}
        Try again
      {:else}
        Sign in
      {/if}
    </button>
  </div>
{:else if status === 'signed-in'}
  <div
    class="absolute top-0 left-0 right-0 z-30 border-b border-black/[0.04] dark:border-white/[0.04] bg-[#fafafa]/60 dark:bg-[#161616]/60 backdrop-blur px-4 py-1.5 flex items-center gap-3"
    transition:fade={{ duration: 200 }}
  >
    <div class="flex-1 min-w-0 flex items-center gap-2 text-[11px] opacity-60">
      <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
      </svg>
      <span>Signed in to Omnizen - frontier models routed via api.omnizen.ai</span>
    </div>
    <button
      class="shrink-0 text-[11px] opacity-60 hover:opacity-100 underline bg-transparent border-none p-0 text-current cursor-pointer"
      onclick={signOut}
    >
      Sign out
    </button>
  </div>
{/if}
