import { API_VERSION, PAGE_SIZE } from './config';

const API_BASE = 'https://api.foursquare.com/v2';

export type Checkin = {
  id: string;
  createdAt: number;
  shout?: string;
  venue: {
    name: string;
    location?: { city?: string; state?: string };
  };
};

export class FoursquareError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'FoursquareError';
    this.status = status;
  }

  // トークンが無効・失効している場合だけ再入力を促したい
  get isAuthError(): boolean {
    return this.status === 401;
  }
}

const call = async (
  path: string,
  token: string,
  params: Record<string, string> = {},
): Promise<any> => {
  const query = new URLSearchParams({ oauth_token: token, v: API_VERSION, ...params });

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}?${query}`);
  } catch (e) {
    throw new FoursquareError(0, `ネットワークに接続できませんでした (${String(e)})`);
  }

  const json = await res.json().catch(() => null);

  // v2 は HTTP ステータスと meta.code の両方にエラーを載せてくる
  if (!res.ok || json?.meta?.code !== 200) {
    const status = json?.meta?.code ?? res.status;
    const detail = json?.meta?.errorDetail ?? `HTTP ${res.status}`;
    throw new FoursquareError(status, detail);
  }

  return json.response;
};

/** トークンが有効か確認する。無効なら FoursquareError を投げる */
export const verifyToken = async (token: string): Promise<void> => {
  await call('/users/self', token);
};

export type CheckinPage = {
  items: Checkin[];
  /** 全チェックイン数。まだ先があるかの判定に使う */
  total: number;
};

export const fetchCheckins = async (token: string, offset = 0): Promise<CheckinPage> => {
  const res = await call('/users/self/checkins', token, {
    limit: String(PAGE_SIZE),
    offset: String(offset),
  });
  return {
    items: res?.checkins?.items ?? [],
    total: res?.checkins?.count ?? 0,
  };
};

/** 短縮URL（https://www.swarmapp.com/c/...）は詳細APIにしか含まれない */
export const fetchCheckinShortUrl = async (
  token: string,
  checkinId: string,
): Promise<string | undefined> => {
  const res = await call(`/checkins/${checkinId}`, token);
  return res?.checkin?.checkinShortUrl;
};
