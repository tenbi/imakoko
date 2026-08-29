<script lang="ts">
  import { onMount } from 'svelte';
  import {
    FoursquareError,
    fetchCheckinShortUrl,
    fetchRecentCheckins,
    type Checkin,
  } from './foursquare';
  import { buildShareText, buildTweetUrl, canUseWebShare } from './share';

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
        <div class="actions">
          <a
            class="icon-button"
            href={buildTweetUrl(checkin, shortUrls[checkin.id])}
            target="_blank"
            rel="noreferrer noopener"
            aria-label="ツイート"
            title="ツイート"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path
                fill="currentColor"
                d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
              />
            </svg>
          </a>

          <button
            class="icon-button accent"
            onclick={() => shareCheckin(checkin)}
            aria-label={actionLabel}
            title={actionLabel}
          >
            {#if webShare}
              <svg class="stroke" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M12 15V3m0 0L8 7m4-4 4 4" />
                <path d="M7 11H5.5A1.5 1.5 0 0 0 4 12.5v7A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5v-7A1.5 1.5 0 0 0 18.5 11H17" />
              </svg>
            {:else}
              <svg class="stroke" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <rect x="9" y="9" width="11" height="11" rx="2" />
                <path d="M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" />
              </svg>
            {/if}
          </button>
        </div>
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

  .actions {
    display: flex;
    gap: 0.4rem;
    flex: none;
  }

  .icon-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2.6rem;
    height: 2.6rem;
    padding: 0;
    border-radius: 0.6rem;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text);
    text-decoration: none;
    cursor: pointer;
    flex: none;
  }

  .icon-button.accent {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--accent-text);
  }

  .icon-button svg {
    width: 1.2rem;
    height: 1.2rem;
    display: block;
  }

  .icon-button svg.stroke {
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
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
