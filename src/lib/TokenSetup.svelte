<script lang="ts">
  import { FoursquareError, verifyToken } from './foursquare';
  import { saveToken } from './storage';

  let { onsaved }: { onsaved: (token: string) => void } = $props();

  let input = $state('');
  let busy = $state(false);
  let error = $state<string | null>(null);

  const submit = async (e: SubmitEvent) => {
    e.preventDefault();
    const token = input.trim();
    if (token === '' || busy) return;

    busy = true;
    error = null;
    try {
      await verifyToken(token);

      if (!saveToken(token)) {
        error = 'このブラウザではトークンを保存できませんでした。プライベートブラウズを解除して再試行してください。';
        return;
      }
      onsaved(token);
    } catch (err) {
      error =
        err instanceof FoursquareError
          ? `トークンを確認できませんでした: ${err.message}`
          : `予期しないエラー: ${String(err)}`;
    } finally {
      busy = false;
    }
  };
</script>

<section>
  <p class="lead">
    Foursquare のアクセストークンを貼り付けてください。トークンはこの端末の localStorage にだけ保存され、どこにも送信されません。
  </p>

  <form onsubmit={submit}>
    <input
      type="password"
      autocomplete="off"
      autocapitalize="off"
      autocorrect="off"
      spellcheck="false"
      placeholder="アクセストークン"
      bind:value={input}
      disabled={busy}
    />
    <button class="primary" type="submit" disabled={busy || input.trim() === ''}>
      {busy ? '確認中…' : '確認して保存'}
    </button>
  </form>

  {#if error}
    <p class="error" role="alert">{error}</p>
  {/if}

  <details>
    <summary>トークンの取り方</summary>
    <ol>
      <li>
        <a href="https://foursquare.com/developers/apps" target="_blank" rel="noreferrer noopener">
          foursquare.com/developers/apps
        </a>
        でアプリを作り、Redirect URI に <code>https://example.com/</code> を設定する
      </li>
      <li>
        <code>https://foursquare.com/oauth2/authenticate?client_id=<em>CLIENT_ID</em>&response_type=code&redirect_uri=https%3A%2F%2Fexample.com%2F</code>
        をブラウザで開いて承認し、戻り先URLの <code>code</code> の値を控える
      </li>
      <li>
        手元のターミナルで
        <code>curl "https://foursquare.com/oauth2/access_token?client_id=<em>CLIENT_ID</em>&client_secret=<em>CLIENT_SECRET</em>&grant_type=authorization_code&redirect_uri=https%3A%2F%2Fexample.com%2F&code=<em>CODE</em>"</code>
        を実行する
      </li>
      <li>返ってきた <code>access_token</code> を上の欄に貼り付ける</li>
    </ol>
    <p class="note">
      Client Secret を使うのは手順3だけです。この Web アプリには一切含まれないので、公開リポジトリに置いても漏れません。
    </p>
  </details>
</section>

<style>
  .lead {
    color: var(--muted);
    line-height: 1.7;
    margin-top: 0;
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
  }

  .error {
    color: var(--danger);
    line-height: 1.6;
  }

  details {
    margin-top: 2rem;
    border-top: 1px solid var(--border);
    padding-top: 1rem;
  }

  summary {
    cursor: pointer;
    color: var(--muted);
  }

  ol {
    line-height: 2;
    padding-left: 1.2rem;
  }

  .note {
    color: var(--muted);
    font-size: 0.9rem;
    line-height: 1.7;
  }
</style>
