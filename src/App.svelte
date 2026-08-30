<script lang="ts">
  import CheckinList from './lib/CheckinList.svelte';
  import TokenSetup from './lib/TokenSetup.svelte';
  import { clearToken, loadToken } from './lib/storage';

  let token = $state<string | null>(loadToken());
  let notice = $state<string | null>(null);

  // CheckinList がエクスポートする reload() をヘッダーの更新ボタンから叩く
  let list = $state<{ reload: () => void } | undefined>();
  let refreshing = $state(false);

  // 更新ボタンの隣にあるため誤タップしやすい。ネイティブの confirm() は
  // standalone 表示だとオリジン名が題名に出て分かりにくいので、
  // アプリ内の <dialog> で明示的に確認する。
  let confirmDialog = $state<HTMLDialogElement | undefined>();

  const onSaved = (saved: string) => {
    token = saved;
    notice = null;
  };

  const onUnauthorized = () => {
    clearToken();
    token = null;
    notice = 'トークンが無効になっていました。取得し直して貼り付けてください。';
  };

  const disconnect = () => confirmDialog?.showModal();

  const confirmDisconnect = () => {
    confirmDialog?.close();
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
      <button class="disconnect" onclick={disconnect}>切断</button>
    </div>
  {/if}
</header>

<dialog bind:this={confirmDialog} class="confirm">
  <h2>切断しますか？</h2>
  <p>この端末に保存したアクセストークンを削除します。</p>
  <p class="sub">
    Swarm のチェックイン履歴は消えません。トークンを貼り付け直せば元に戻せます。
  </p>
  <div class="dialog-actions">
    <button onclick={() => confirmDialog?.close()}>キャンセル</button>
    <button class="danger" onclick={confirmDisconnect}>切断する</button>
  </div>
</dialog>

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
    /* 更新と切断の誤タップを減らすため、隣接ボタンより広めに離す */
    gap: 0.9rem;
  }

  .disconnect {
    color: var(--danger);
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

  .confirm {
    margin: auto;
    max-width: min(24rem, calc(100vw - 2rem));
    padding: 1.3rem;
    border: 1px solid var(--border);
    border-radius: 0.9rem;
    background: var(--surface);
    color: var(--text);
  }

  .confirm::backdrop {
    background: rgb(0 0 0 / 45%);
  }

  .confirm h2 {
    margin: 0 0 0.7rem;
    font-size: 1.05rem;
  }

  .confirm p {
    margin: 0 0 0.5rem;
    line-height: 1.7;
  }

  .confirm .sub {
    color: var(--muted);
    font-size: 0.85rem;
  }

  .dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.6rem;
    margin-top: 1.2rem;
  }

  .dialog-actions .danger {
    background: var(--danger);
    border-color: var(--danger);
    color: #fff;
    font-weight: 600;
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
