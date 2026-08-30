<script lang="ts">
  import CheckinList from './lib/CheckinList.svelte';
  import TokenSetup from './lib/TokenSetup.svelte';
  import { clearToken, loadToken } from './lib/storage';

  let token = $state<string | null>(loadToken());
  let notice = $state<string | null>(null);

  // CheckinList がエクスポートする reload() をヘッダーの更新ボタンから叩く
  let list = $state<{ reload: () => void } | undefined>();
  let refreshing = $state(false);

  const onSaved = (saved: string) => {
    token = saved;
    notice = null;
  };

  const onUnauthorized = () => {
    clearToken();
    token = null;
    notice = 'トークンが無効になっていました。取得し直して貼り付けてください。';
  };

  const disconnect = () => {
    if (!confirm('この端末に保存したトークンを削除しますか？')) return;
    clearToken();
    token = null;
    notice = null;
  };
</script>

<header>
  <h1>いまここ</h1>
  {#if token}
    <div class="header-actions">
      <button
        class="icon-button"
        onclick={() => list?.reload()}
        disabled={refreshing}
        aria-label="更新"
        title="更新"
      >
        <svg
          class="stroke"
          class:spinning={refreshing}
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
          <path d="M21 3v5h-5" />
        </svg>
      </button>
      <button onclick={disconnect}>切断</button>
    </div>
  {/if}
</header>

{#if notice}
  <p class="notice" role="alert">{notice}</p>
{/if}

{#if token}
  <CheckinList
    bind:this={list}
    {token}
    onunauthorized={onUnauthorized}
    onbusychange={(busy) => (refreshing = busy)}
  />
{:else}
  <TokenSetup onsaved={onSaved} />
{/if}

<style>
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1.2rem;
  }

  h1 {
    font-size: 1.3rem;
    margin: 0;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .icon-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2.4rem;
    height: 2.4rem;
    padding: 0;
  }

  .icon-button svg {
    width: 1.15rem;
    height: 1.15rem;
    display: block;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .icon-button svg.spinning {
    animation: spin 0.9s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .icon-button svg.spinning {
      animation: none;
    }
  }

  .notice {
    background: color-mix(in srgb, var(--danger) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--danger) 35%, transparent);
    color: var(--danger);
    border-radius: 0.6rem;
    padding: 0.7rem 0.9rem;
    line-height: 1.6;
  }
</style>
