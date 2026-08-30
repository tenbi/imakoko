<script lang="ts">
  import { onMount } from 'svelte';
  import {
    FoursquareError,
    fetchCheckinShortUrl,
    fetchCheckins,
    type Checkin,
  } from './foursquare';
  import { buildShareText, buildTweetUrl, canUseWebShare } from './share';
  import { PAGE_SIZE, VISIBILITY_RELOAD_INTERVAL_MS } from './config';

  let {
    token,
    onunauthorized,
    onbusychange,
  }: {
    token: string;
    onunauthorized: () => void;
    onbusychange?: (busy: boolean) => void;
  } = $props();

  let checkins = $state<Checkin[]>([]);
  let total = $state(0);
  let loadingMore = $state(false);
  const hasMore = $derived(checkins.length < total);
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

  // loading は「初回の読み込み中表示」用。多重実行の抑止は $state ではない
  // inFlight で行う（loading の初期値が true のため、これで兼用すると初回が走らない）。
  let inFlight = false;

  /** 直近に API を叩いた時刻。前面復帰時の自動再取得を間引くために使う */
  let lastLoadedAt = 0;

  /**
   * 短縮URLは詳細APIにしか含まれない。クリック後に取りに行くと transient user
   * activation が切れて navigator.share() が NotAllowedError になるため先読みする。
   * 1件につき1リクエストなので、取得済みのぶんは対象にしない。
   */
  const prefetchShortUrls = async (targets: Checkin[]) => {
    linksPending += targets.length;
    await Promise.all(
      targets.map(async (c) => {
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

  const handleError = (e: unknown): void => {
    if (e instanceof FoursquareError && e.isAuthError) {
      onunauthorized();
      return;
    }
    error = e instanceof Error ? e.message : String(e);
  };

  /** 先頭ページを取り直す。更新ボタンと初回マウントから呼ばれる */
  const load = async () => {
    if (inFlight) return; // 連打で読み込みが重ならないようにする
    inFlight = true;
    loading = true;
    onbusychange?.(true);
    error = null;
    shortUrls = {};

    try {
      let page;
      try {
        page = await fetchCheckins(token, 0);
      } catch (e) {
        handleError(e);
        return;
      } finally {
        loading = false;
      }

      checkins = page.items;
      total = page.total;
      await prefetchShortUrls(page.items);
    } finally {
      inFlight = false;
      lastLoadedAt = Date.now();
      onbusychange?.(false);
    }
  };

  /** さかのぼる。今表示している件数を offset にして次のページを足す */
  const loadMore = async () => {
    if (inFlight) return;
    inFlight = true;
    loadingMore = true;
    onbusychange?.(true);
    error = null;

    try {
      const page = await fetchCheckins(token, checkins.length);
      checkins = [...checkins, ...page.items];
      total = page.total;
      await prefetchShortUrls(page.items);
    } catch (e) {
      handleError(e);
    } finally {
      inFlight = false;
      loadingMore = false;
      lastLoadedAt = Date.now();
      onbusychange?.(false);
    }
  };

  onMount(() => {
    void load();

    // Swarm でチェックインして戻ってきたときに、手動更新なしで最新化する。
    const maybeReload = () => {
      if (document.visibilityState !== 'visible') return;

      // 通知センターを下ろすだけでも visible は飛ぶ。取り直しは
      // /checkins/{id} を PAGE_SIZE 回叩くので、短い間隔では走らせない。
      if (Date.now() - lastLoadedAt < VISIBILITY_RELOAD_INTERVAL_MS) return;

      // さかのぼって読んだぶんを勝手に捨てないよう、先頭ページ表示中だけにする。
      if (checkins.length > PAGE_SIZE) return;

      void load();
    };

    document.addEventListener('visibilitychange', maybeReload);
    // タブの戻る/進むは bfcache から復元され visibilitychange が飛ばないことがある
    window.addEventListener('pageshow', maybeReload);

    return () => {
      document.removeEventListener('visibilitychange', maybeReload);
      window.removeEventListener('pageshow', maybeReload);
    };
  });

  /** ヘッダーの更新ボタンから呼ばれる（bind:this 経由のコンポーネントエクスポート） */
  export function reload(): void {
    void load();
  }

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

{#if loading && checkins.length === 0}
  <p class="status">読み込み中…</p>
{:else if error && checkins.length === 0}
  <p class="status error" role="alert">{error}</p>
  <button onclick={load}>再試行</button>
{:else if checkins.length === 0}
  <p class="status">チェックインがありません。</p>
{:else}
  <!-- 追加読み込みが失敗しても一覧は残す -->
  {#if error}
    <p class="status error" role="alert">{error}</p>
  {/if}

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

  {#if hasMore}
    <button class="more" onclick={loadMore} disabled={loadingMore}>
      {loadingMore ? '読み込み中…' : 'さかのぼる'}
    </button>
  {/if}
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

  .more {
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
