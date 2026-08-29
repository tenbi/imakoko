<script lang="ts">
  import { onMount } from 'svelte';
  import {
    FoursquareError,
    fetchCheckinShortUrl,
    fetchRecentCheckins,
    type Checkin,
  } from './foursquare';
  import { buildShareText, canUseWebShare } from './share';

  let { token, onunauthorized }: { token: string; onunauthorized: () => void } = $props();

  let checkins = $state<Checkin[]>([]);
  let shortUrls = $state<Record<string, string>>({});
  let loading = $state(true);
  let linksPending = $state(0);
  let error = $state<string | null>(null);
  let toast = $state<{ text: string; kind: 'ok' | 'error' } | null>(null);

  const webShare = canUseWebShare();
  const actionLabel = webShare ? 'シェア' : 'コピー';

  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  const notify = (text: string, kind: 'ok' | 'error' = 'ok') => {
    toast = { text, kind };
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toast = null), 4000);
  };

  const load = async () => {
    loading = true;
    error = null;
    shortUrls = {};

    try {
      checkins = await fetchRecentCheckins(token);
    } catch (e) {
      if (e instanceof FoursquareError && e.isAuthError) {
        onunauthorized();
        return;
      }
      error = e instanceof Error ? e.message : String(e);
      return;
    } finally {
      loading = false;
    }

    // 短縮URLは詳細APIにしか含まれない。クリック後に取りに行くと transient user
    // activation が切れて navigator.share() が NotAllowedError になるため先読みする。
    linksPending = checkins.length;
    await Promise.all(
      checkins.map(async (c) => {
        try {
          const url = await fetchCheckinShortUrl(token, c.id);
          if (url) shortUrls[c.id] = url;
        } catch {
          // 取れなければ URL 無しでシェアする
        } finally {
          linksPending -= 1;
        }
      }),
    );
  };

  onMount(load);

  // ここは同期関数のままにすること。await を挟むと share() が失敗する。
  const shareCheckin = (checkin: Checkin) => {
    const text = buildShareText(checkin, shortUrls[checkin.id]);

    if (webShare) {
      navigator.share({ text }).catch((e: unknown) => {
        // シェアシートを閉じただけなら何も言わない
        if (e instanceof DOMException && e.name === 'AbortError') return;
        notify(`シェアできませんでした: ${e instanceof Error ? e.message : String(e)}`, 'error');
      });
      return;
    }

    navigator.clipboard.writeText(text).then(
      () => notify('クリップボードにコピーしました'),
      (e: unknown) => notify(`コピーできませんでした: ${String(e)}`, 'error'),
    );
  };

  const formatAddress = (checkin: Checkin) =>
    [checkin.venue.location?.city, checkin.venue.location?.state].filter(Boolean).join(', ');

  const formatTime = (createdAt: number) =>
    new Date(createdAt * 1000).toLocaleString('ja-JP', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
</script>

{#if loading}
  <p class="status">読み込み中…</p>
{:else if error}
  <p class="status error" role="alert">{error}</p>
  <button onclick={load}>再試行</button>
{:else if checkins.length === 0}
  <p class="status">チェックインがありません。</p>
{:else}
  {#if linksPending > 0}
    <p class="status subtle">リンクを取得中…（今シェアするとリンク無しになります）</p>
  {/if}

  <ul>
    {#each checkins as checkin (checkin.id)}
      <li>
        <div class="info">
          <span class="venue">{checkin.venue.name}</span>
          {#if formatAddress(checkin)}
            <span class="address">{formatAddress(checkin)}</span>
          {/if}
          {#if checkin.shout}
            <span class="shout">{checkin.shout}</span>
          {/if}
          <span class="time">{formatTime(checkin.createdAt)}</span>
        </div>
        <button class="primary" onclick={() => shareCheckin(checkin)}>{actionLabel}</button>
      </li>
    {/each}
  </ul>

  <button class="reload" onclick={load}>再読み込み</button>
{/if}

{#if toast}
  <p class="toast" class:error={toast.kind === 'error'} role="status">{toast.text}</p>
{/if}

<style>
  .status {
    color: var(--muted);
    line-height: 1.7;
  }

  .status.subtle {
    font-size: 0.85rem;
  }

  .status.error,
  .toast.error {
    color: var(--danger);
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  li {
    display: flex;
    align-items: center;
    gap: 0.8rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 0.8rem;
    padding: 0.8rem 0.9rem;
  }

  .info {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    min-width: 0;
    flex: 1;
  }

  .venue {
    font-weight: 600;
    overflow-wrap: anywhere;
  }

  .address,
  .time {
    font-size: 0.8rem;
    color: var(--muted);
  }

  .shout {
    font-size: 0.85rem;
    overflow-wrap: anywhere;
  }

  li button {
    flex: none;
  }

  .reload {
    margin-top: 1.2rem;
    width: 100%;
  }

  .toast {
    position: fixed;
    left: 50%;
    bottom: calc(1.2rem + env(safe-area-inset-bottom));
    transform: translateX(-50%);
    max-width: min(90vw, 34rem);
    margin: 0;
    padding: 0.7rem 1rem;
    border-radius: 0.7rem;
    border: 1px solid var(--border);
    background: var(--surface);
    box-shadow: 0 6px 24px rgb(0 0 0 / 18%);
    line-height: 1.6;
  }
</style>
