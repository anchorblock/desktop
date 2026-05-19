<script lang="ts">
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

{#if status !== 'unknown' && status !== 'signed-in'}
  <div
    class="rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 p-4 backdrop-blur"
    in:fade={{ duration: 200 }}
  >
    <div class="text-[13px] font-medium text-[#1d1d1f] dark:text-[#fafafa] mb-1">
      Sign in with Omnizen
    </div>
    <div class="text-[12px] opacity-60 text-[#1d1d1f] dark:text-[#fafafa] mb-3 leading-relaxed">
      Route every frontier model through your Omnizen plan. One bill, one key, no per-provider setup.
    </div>

    {#if status === 'pending' && userCode}
      <div class="text-[11px] font-mono opacity-70 mb-2">
        Code: <span class="font-semibold">{userCode}</span>
      </div>
      <div class="text-[11px] opacity-50 mb-3">
        Approve at <a class="underline" href={verificationUri} target="_blank" rel="noreferrer">{verificationUri}</a>
      </div>
    {/if}

    {#if status === 'error' && errorMsg}
      <div class="text-[11px] text-red-600 dark:text-red-400 mb-3">{errorMsg}</div>
    {/if}

    <button
      class="inline-flex items-center gap-2 bg-black dark:bg-white px-4 py-1.5 rounded-lg text-white dark:text-black text-[12px] transition hover:bg-gray-800 dark:hover:bg-gray-100 border-none disabled:opacity-50"
      onclick={signIn}
      disabled={status === 'pending'}
    >
      {#if status === 'pending'}
        <div class="w-3 h-3 rounded-full border-2 border-white/30 dark:border-black/30 border-t-white dark:border-t-black animate-spin"></div>
        Waiting for browser…
      {:else if status === 'error'}
        Try again
      {:else}
        Sign in
      {/if}
    </button>
  </div>
{:else if status === 'signed-in'}
  <div class="flex items-center justify-between text-[12px] opacity-60" in:fade={{ duration: 200 }}>
    <span>Signed in to Omnizen</span>
    <button
      class="underline opacity-70 hover:opacity-100 bg-transparent border-none p-0 text-current"
      onclick={signOut}
    >
      Sign out
    </button>
  </div>
{/if}
