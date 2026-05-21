<script lang="ts">
  // Full-area sign-in cover that sits on top of the chat webview
  // whenever Omnizen creds aren't present. The webview underneath is
  // attached to a local OpenWebUI that has no model backend until the
  // user signs in (the main process injects OPENAI_API_BASE_URLS +
  // OPENAI_API_KEYS only when creds exist), so without this cover the
  // user sees a broken / blank chat surface and no way out.
  //
  // After a successful sign-in:
  //   1. Main process writes creds + restarts the local server with
  //      Omnizen routing injected (handled in main/index.ts).
  //   2. We dispatch a 'omnizen:signed-in' DOM event so the parent
  //      Content.svelte can reload the active webview against the
  //      fresh server.
  //   3. We fade ourselves out so the user sees the now-Omnizen-backed
  //      chat surface.

  import { onMount, onDestroy } from 'svelte'
  import { fade } from 'svelte/transition'

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
      // Notify Content.svelte to reload the webview once the local
      // server's back up. Content.svelte adds its own small delay so
      // the OpenWebUI HTTP server has time to accept connections.
      window.dispatchEvent(new CustomEvent('omnizen:signed-in'))
    } catch (err) {
      errorMsg = err instanceof Error ? err.message : String(err)
      status = 'error'
    }
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
    class="absolute inset-0 z-30 flex items-center justify-center px-6 bg-[#fafafa] dark:bg-[#0a0a0a]"
    transition:fade={{ duration: 250 }}
  >
    <div class="w-full max-w-md text-center">
      <div class="mx-auto mb-5 w-14 h-14 rounded-2xl bg-black/[0.05] dark:bg-white/[0.08] flex items-center justify-center">
        <svg class="w-6 h-6 text-[#1d1d1f] dark:text-[#fafafa]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
        </svg>
      </div>

      <h2 class="text-2xl font-medium tracking-tight mb-2 text-[#1d1d1f] dark:text-[#fafafa]">
        Sign in to Omnizen
      </h2>
      <p class="text-[14px] opacity-60 text-[#1d1d1f] dark:text-[#fafafa] mb-8 leading-relaxed">
        Chat with every frontier model on one plan. Your data stays on your machine; only chat requests route through api.omnizen.ai.
      </p>

      {#if status === 'pending' && userCode}
        <div class="mb-6 p-4 rounded-xl border border-black/[0.08] dark:border-white/[0.10] bg-black/[0.02] dark:bg-white/[0.03]">
          <div class="text-[11px] uppercase tracking-wider opacity-50 mb-2">Approve in browser</div>
          <div class="text-2xl font-mono font-semibold tracking-wider mb-3 text-[#1d1d1f] dark:text-[#fafafa]">
            {userCode}
          </div>
          {#if verificationUri}
            <a class="text-[12px] underline opacity-60 hover:opacity-100" href={verificationUri} target="_blank" rel="noreferrer">
              {verificationUri}
            </a>
          {/if}
        </div>
      {/if}

      {#if status === 'error' && errorMsg}
        <div class="mb-6 p-3 rounded-lg text-[12px] text-red-600 dark:text-red-400 bg-red-500/[0.08] border border-red-500/[0.20]">
          Sign-in failed: {errorMsg}
        </div>
      {/if}

      <button
        class="inline-flex items-center justify-center gap-2 bg-black dark:bg-white px-6 py-3 rounded-xl text-white dark:text-black text-[14px] font-medium transition hover:bg-gray-800 dark:hover:bg-gray-100 border-none disabled:opacity-50 min-w-[200px]"
        onclick={signIn}
        disabled={status === 'pending'}
      >
        {#if status === 'pending'}
          <div class="w-4 h-4 rounded-full border-2 border-white/30 dark:border-black/30 border-t-white dark:border-t-black animate-spin"></div>
          Waiting for browser approval…
        {:else if status === 'error'}
          Try again
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M20.015 4.356v4.992m0 0h-4.992m4.993 0l-3.181-3.183a8.25 8.25 0 00-13.803 3.7" />
          </svg>
        {:else}
          Sign in with Omnizen
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        {/if}
      </button>

      <p class="mt-6 text-[11px] opacity-40 leading-relaxed">
        Don't have an Omnizen account?{' '}
        <a class="underline" href="https://omnizen.ai/sign-up" target="_blank" rel="noreferrer">Sign up at omnizen.ai</a>.
      </p>
    </div>
  </div>
{/if}
