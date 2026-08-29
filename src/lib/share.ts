import type { Checkin } from './foursquare';

/**
 * シェア文を組み立てる。
 *
 *   I'm at スターバックス 渋谷店 in Shibuya, Tōkyō https://www.swarmapp.com/c/xxxxxxxx
 *
 *   ランチなう
 *
 * シャウトがある場合のみ、空行を挟んで末尾に付ける。
 */
export const buildShareText = (checkin: Checkin, shortUrl?: string): string => {
  // 日本の会場は city が欠けていることがあるので、空要素は畳む
  const address = [checkin.venue.location?.city, checkin.venue.location?.state]
    .filter(Boolean)
    .join(', ');

  const head = address
    ? `I'm at ${checkin.venue.name} in ${address}`
    : `I'm at ${checkin.venue.name}`;

  const line = shortUrl ? `${head} ${shortUrl}` : head;

  return checkin.shout ? `${line}\n\n${checkin.shout}` : line;
};

export const canUseWebShare = (): boolean => typeof navigator.share === 'function';
