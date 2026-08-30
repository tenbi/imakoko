import type { Checkin } from './foursquare';

/**
 * シェア文を組み立てる。
 *
 * シャウトあり:
 *   ランチなう (@ スターバックス 渋谷店 in Shibuya, Tōkyō) https://www.swarmapp.com/user/.../checkin/...
 *
 * シャウトなし:
 *   I'm at スターバックス 渋谷店 in Shibuya, Tōkyō https://www.swarmapp.com/user/.../checkin/...
 */
export const buildShareText = (checkin: Checkin, shortUrl?: string): string => {
  // 日本の会場は city が欠けていることがあるので、空要素は畳む
  const address = [checkin.venue.location?.city, checkin.venue.location?.state]
    .filter(Boolean)
    .join(', ');

  const place = address ? `${checkin.venue.name} in ${address}` : checkin.venue.name;

  const head = checkin.shout ? `${checkin.shout} (@ ${place})` : `I'm at ${place}`;

  return shortUrl ? `${head} ${shortUrl}` : head;
};

export const canUseWebShare = (): boolean => typeof navigator.share === 'function';

/**
 * X の Web Intent URL を作る。シェア文と一字一句同じものを流したいので、
 * url パラメータは使わず text にすべて載せる。
 */
export const buildTweetUrl = (checkin: Checkin, shortUrl?: string): string =>
  `https://x.com/intent/tweet?text=${encodeURIComponent(buildShareText(checkin, shortUrl))}`;
