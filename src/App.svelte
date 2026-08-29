<script lang="ts">
  import CheckinList from './lib/CheckinList.svelte';
  import TokenSetup from './lib/TokenSetup.svelte';
  import { clearToken, loadToken } from './lib/storage';

  let token = $state<string | null>(loadToken());
  let notice = $state<string | null>(null);

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
    <button onclick={disconnect}>切断</button>
  {/if}
</header>

{#if notice}
  <p class="notice" role="alert">{notice}</p>
{/if}

{#if token}
  <CheckinList {token} onunauthorized={onUnauthorized} />
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

  .notice {
    background: color-mix(in srgb, var(--danger) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--danger) 35%, transparent);
    color: var(--danger);
    border-radius: 0.6rem;
    padding: 0.7rem 0.9rem;
    line-height: 1.6;
  }
</style>
